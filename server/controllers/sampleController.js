// controllers/sampleController.js
// --------------------------------
// the logic behind POST /api/samples: check the uploaded files are really
// what they claim to be, write the good ones to disk, and create the
// Sample. kept out of routes/samples.js so the route itself stays a thin
// list of "which function handles this request".

import fs from "fs";
import path from "path";
import { fileTypeFromBuffer } from "file-type";
import { pdf as renderPdf } from "pdf-to-img";
import { Sample } from "../models/sample.js";
import { Student } from "../models/student.js";
import { triggerAnalysis } from "../services/analysisTrigger.js";

// only these are accepted - matches the upload modal's copy ("JPG, PNG or
// PDF only").
const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

// looks at the file's real content (not just its claimed mimetype or
// extension, which are trivial to spoof) and throws if it isn't one of the
// accepted formats. this is what produces the 422 the upload modal's error
// state (wireframe 2d) reads from.
export async function validateSample(file) {
  const detected = await fileTypeFromBuffer(file.buffer);

  if (!detected || !ACCEPTED_MIME_TYPES.includes(detected.mime)) {
    const error = new Error(
      `"${file.originalname}" is not a supported file. Only JPG, PNG and PDF are accepted.`
    );
    error.statusCode = 422;
    throw error;
  }

  return detected;
}

// derives a title from the first file's name, since the upload modal (2a)
// doesn't have a title field - see the plan doc for why.
function deriveTitle(originalFilename) {
  const withoutExtension = originalFilename.replace(/\.[^/.]+$/, "");
  return withoutExtension || "Untitled sample";
}

// a JPG or PNG is already one raster image. a PDF might be several pages of
// one composition, so it gets split into one image per page - a therapist
// scanning a single-page worksheet and a multi-page essay both end up with
// the "right" imageCount either way.
async function toPageBuffers(file, detected) {
  if (detected.mime !== "application/pdf") {
    return [{ buffer: file.buffer, mimeType: detected.mime }];
  }

  let pages;
  try {
    const document = await renderPdf(
      `data:application/pdf;base64,${file.buffer.toString("base64")}`,
      { scale: 2 }
    );
    pages = [];
    for await (const page of document) pages.push(page);
  } catch {
    const error = new Error(`"${file.originalname}" could not be read as a PDF.`);
    error.statusCode = 422;
    throw error;
  }

  return pages.map((buffer) => ({ buffer, mimeType: "image/png" }));
}

// validates every file first (so a bad second file doesn't leave the first
// one already written to disk), splits any PDFs into their pages, then
// saves the good ones and creates the Sample.
export async function createSample(studentId, files) {
  const student = await Student.findById(studentId).catch(() => null);
  if (!student) {
    const error = new Error(`Unknown studentId "${studentId}"`);
    error.statusCode = 400;
    throw error;
  }

  const perFilePages = [];
  for (const file of files) {
    const detected = await validateSample(file);
    perFilePages.push({
      originalFilename: file.originalname,
      pages: await toPageBuffers(file, detected),
    });
  }

  const studentDir = path.join(UPLOAD_ROOT, studentId);
  fs.mkdirSync(studentDir, { recursive: true });

  const images = [];
  perFilePages.forEach(({ originalFilename, pages }, fileIndex) => {
    pages.forEach((page, pageIndex) => {
      const extension = page.mimeType === "image/jpeg" ? "jpg" : "png";
      const filename = `${Date.now()}-${fileIndex}-${pageIndex}.${extension}`;
      const filePath = path.join(studentDir, filename);
      fs.writeFileSync(filePath, page.buffer);

      images.push({
        path: filePath,
        originalFilename,
        mimeType: page.mimeType,
      });
    });
  });

  // status defaults to UPLOADED - nothing to set explicitly here, the
  // analysis engine is what moves it on from there.
  const sample = await Sample.create({
    student: studentId,
    title: deriveTitle(files[0].originalname),
    images,
  });

  // fire and forget - the 202 response has already gone out by the time
  // this matters.
  triggerAnalysis(sample);

  return sample;
}
