import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PDFDocument } from 'pdf-lib';
import { buildTestApp } from './testApp.js';
import { Student } from '../models/student.js';
import { Sample } from '../models/sample.js';

let mongod;
const app = buildTestApp();

// a real 1x1 PNG - file-type reads the actual bytes, not the extension, so
// this has to be a genuine (if tiny) file of that format.
const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);
// just the JFIF signature bytes - enough for file-type to recognise it as
// a jpg, which is all validateSample checks for.
const JPEG_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

async function makePdf(pageCount) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage([200, 200]);
  return Buffer.from(await doc.save());
}

async function createStudent() {
  const student = await Student.create({ name: 'Wei Jie Lim', currentGrade: 'Primary 4' });
  return student._id.toString();
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await Student.deleteMany({});
  await Sample.deleteMany({});
});

describe('POST /api/samples', () => {
  it('accepts a jpg and produces imageCount 1', async () => {
    const studentId = await createStudent();

    const res = await request(app)
      .post('/api/samples')
      .field('studentId', studentId)
      .attach('images', JPEG_BUFFER, { filename: 'page.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(202);
    expect(res.body.status).toBe('UPLOADED');
    expect(res.body.images).toHaveLength(1);
    expect(res.body.images[0].path).toBeUndefined(); // never leak the fs path
  });

  it('accepts a png and produces imageCount 1', async () => {
    const studentId = await createStudent();

    const res = await request(app)
      .post('/api/samples')
      .field('studentId', studentId)
      .attach('images', PNG_BUFFER, { filename: 'page.png', contentType: 'image/png' });

    expect(res.status).toBe(202);
    expect(res.body.images).toHaveLength(1);
  });

  it('splits a multi-page pdf into one image per page', async () => {
    const studentId = await createStudent();
    const pdfBuffer = await makePdf(3);

    const res = await request(app)
      .post('/api/samples')
      .field('studentId', studentId)
      .attach('images', pdfBuffer, { filename: 'essay.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(202);
    expect(res.body.images).toHaveLength(3);
  });

  it('rejects an unsupported file with a 422 naming the file', async () => {
    const studentId = await createStudent();

    const res = await request(app)
      .post('/api/samples')
      .field('studentId', studentId)
      .attach('images', Buffer.from('not a real docx'), {
        filename: 'notes.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('notes.docx');
  });

  it('400s when studentId is missing', async () => {
    const res = await request(app)
      .post('/api/samples')
      .attach('images', JPEG_BUFFER, { filename: 'page.jpg' });

    expect(res.status).toBe(400);
  });

  it('400s when no file is attached', async () => {
    const studentId = await createStudent();

    const res = await request(app).post('/api/samples').field('studentId', studentId);

    expect(res.status).toBe(400);
  });

  it('400s for an unknown studentId', async () => {
    const res = await request(app)
      .post('/api/samples')
      .field('studentId', new mongoose.Types.ObjectId().toString())
      .attach('images', JPEG_BUFFER, { filename: 'page.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/samples/:sampleId', () => {
  it('404s for an unknown sample', async () => {
    const res = await request(app).get(`/api/samples/${new mongoose.Types.ObjectId()}`);
    expect(res.status).toBe(404);
  });

  it('returns the polling summary shape, without images or sampleContent', async () => {
    const studentId = await createStudent();
    const uploadRes = await request(app)
      .post('/api/samples')
      .field('studentId', studentId)
      .attach('images', JPEG_BUFFER, { filename: 'page.jpg', contentType: 'image/jpeg' });

    const res = await request(app).get(`/api/samples/${uploadRes.body._id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      sampleId: uploadRes.body._id,
      studentId,
      analysisStatus: 'UPLOADED',
      imageCount: 1,
    });
    expect(res.body.images).toBeUndefined();
    expect(res.body.sampleContent).toBeUndefined();
  });

  it('carries the failure reason once analysisStatus is FAILED', async () => {
    // nothing in this slice ever sets FAILED itself (that's the analysis
    // engine's job), so this simulates the hand-off directly to prove the
    // response shape holds up once it does.
    const studentId = await createStudent();
    const uploadRes = await request(app)
      .post('/api/samples')
      .field('studentId', studentId)
      .attach('images', JPEG_BUFFER, { filename: 'page.jpg', contentType: 'image/jpeg' });

    await Sample.findByIdAndUpdate(uploadRes.body._id, {
      status: 'FAILED',
      analysisError: 'Gemini timed out after 3 retries',
    });

    const res = await request(app).get(`/api/samples/${uploadRes.body._id}`);

    expect(res.body.analysisStatus).toBe('FAILED');
    expect(res.body.analysisError).toBe('Gemini timed out after 3 retries');
  });
});

describe('GET /api/students/:studentId/samples', () => {
  it('404s for an unknown student', async () => {
    const res = await request(app).get(`/api/students/${new mongoose.Types.ObjectId()}/samples`);
    expect(res.status).toBe(404);
  });

  it('lists samples newest first without leaking images or sampleContent', async () => {
    const studentId = await createStudent();
    await request(app)
      .post('/api/samples')
      .field('studentId', studentId)
      .attach('images', JPEG_BUFFER, { filename: 'first.jpg', contentType: 'image/jpeg' });
    await request(app)
      .post('/api/samples')
      .field('studentId', studentId)
      .attach('images', PNG_BUFFER, { filename: 'second.png', contentType: 'image/png' });

    const res = await request(app).get(`/api/students/${studentId}/samples`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toBe('second'); // newest first
    for (const summary of res.body) {
      expect(summary.images).toBeUndefined();
      expect(summary.sampleContent).toBeUndefined();
    }
  });

  it('filters by ?status= when given', async () => {
    const studentId = await createStudent();
    const uploadRes = await request(app)
      .post('/api/samples')
      .field('studentId', studentId)
      .attach('images', JPEG_BUFFER, { filename: 'page.jpg', contentType: 'image/jpeg' });

    await Sample.findByIdAndUpdate(uploadRes.body._id, { status: 'ANALYSED' });

    const stillUploaded = await request(app).get(
      `/api/students/${studentId}/samples?status=UPLOADED`
    );
    const nowAnalysed = await request(app).get(
      `/api/students/${studentId}/samples?status=ANALYSED`
    );

    expect(stillUploaded.body).toHaveLength(0);
    expect(nowAnalysed.body).toHaveLength(1);
  });
});

describe('GET /api/samples/:sampleId/images/:index', () => {
  it('404s on an unknown sample', async () => {
    const res = await request(app).get(`/api/samples/${new mongoose.Types.ObjectId()}/images/0`);
    expect(res.status).toBe(404);
  });

  it('404s on an out-of-range index', async () => {
    const studentId = await createStudent();
    const uploadRes = await request(app)
      .post('/api/samples')
      .field('studentId', studentId)
      .attach('images', JPEG_BUFFER, { filename: 'page.jpg', contentType: 'image/jpeg' });

    const res = await request(app).get(`/api/samples/${uploadRes.body._id}/images/5`);
    expect(res.status).toBe(404);
  });

  it('streams the image bytes with the right content type', async () => {
    const studentId = await createStudent();
    const uploadRes = await request(app)
      .post('/api/samples')
      .field('studentId', studentId)
      .attach('images', PNG_BUFFER, { filename: 'page.png', contentType: 'image/png' });

    const res = await request(app).get(`/api/samples/${uploadRes.body._id}/images/0`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
  });
});
