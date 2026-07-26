// ------------------------------------------------------------------
// The single seam between the UI and the backend.
//
// Every function here maps to a route in server/routes/, so the pages
// never touch fetch() or URLs themselves.
//
//   VITE_API_URL   base origin for the API (default "/api")
//
// Students AND samples routes are live now — the old mockData.js is gone.
// ------------------------------------------------------------------

const BASE = import.meta.env.VITE_API_URL ?? '/api';

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    let detail;
    try {
      // errorHandler responds with { title, message, stackTrace }
      detail = (await res.json())?.message;
    } catch {
      /* body was not JSON */
    }
    const error = new Error(detail || `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

// The server returns raw Mongoose docs keyed by `_id`; the UI keys off `studentId`.
const toClientStudent = (s) => s && { studentId: s._id, name: s.name, currentGrade: s.currentGrade };

// GET /api/students  ->  Student[]
export function getStudents() {
  return request('/students').then((list) => list.map(toClientStudent));
}

// GET /api/students/:studentId  ->  { studentId, name, currentGrade }
// Resolves to null on 404 so the profile page can show its "not found"
// screen instead of a generic error.
export function getStudent(studentId) {
  return request(`/students/${studentId}`)
    .then(toClientStudent)
    .catch((err) => {
      if (err.status === 404) return null;
      throw err;
    });
}

// POST /api/students  { name, currentGrade }  ->  created student
export function createStudent({ name, currentGrade }) {
  return request('/students', { method: 'POST', body: { name, currentGrade } }).then(
    toClientStudent,
  );
}

// GET /api/students/:studentId/samples?status=  ->  sample summaries,
// newest first. The server already sends the client shape:
//   { sampleId, title, uploadedAt, analysisStatus, imageCount, taskType }
export function getStudentSamples(studentId, { status } = {}) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return request(`/students/${studentId}/samples${qs}`);
}

// GET /api/samples/:sampleId  ->  one sample summary.
// The upload page polls this to notice UPLOADED -> ANALYSED.
export function getSample(sampleId) {
  return request(`/samples/${sampleId}`);
}

// POST /api/samples/:studentId  ->  the created sample summary.
// Multipart, not JSON: the files go under the field "samples" (they all
// become pages of ONE sample) with title/taskType alongside. We build the
// FormData here so pages stay fetch-free; note we must NOT set a
// Content-Type header — the browser writes the multipart boundary itself.
export function uploadSample(studentId, { title, taskType, files }) {
  const form = new FormData();
  form.append('title', title);
  form.append('taskType', taskType);
  for (const file of files) {
    form.append('samples', file);
  }
  return fetch(`${BASE}/samples/${studentId}`, { method: 'POST', body: form }).then(
    async (res) => {
      if (!res.ok) {
        let detail;
        try {
          detail = (await res.json())?.message;
        } catch {
          /* body was not JSON */
        }
        throw new Error(detail || `Upload failed (${res.status})`);
      }
      return res.json();
    },
  );
}
