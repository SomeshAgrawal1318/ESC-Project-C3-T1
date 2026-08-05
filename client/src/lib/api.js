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

// GET /api/students  ->  Student[]
export function getStudents() {
  return request('/students');
}

// GET /api/students/:studentId  ->  { studentId, name, currentGrade }
// Resolves to null on 404 so the profile page can show its "not found"
// screen instead of a generic error. (StudentProfilePage and
// UploadSamplePage both branch on the null — don't drop this catch.)
export function getStudent(studentId) {
  return request(`/students/${studentId}`).catch((err) => {
    if (err.status === 404) return null;
    throw err;
  });
}

// POST /api/students  { name, currentGrade }  ->  created student
export function createStudent({ name, currentGrade }) {
  return request('/students', { method: 'POST', body: { name, currentGrade } });
}

// GET /api/students/:studentId/samples?status=  ->  samples, newest first.
// The response uses the same full path-safe shape as getSample(), including
// errors[]. The profile ignores the detail; ErrorTrendsPage derives its chart
// locally from it without needing a separate trends request.
export function getStudentSamples(studentId, { status } = {}) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return request(`/students/${studentId}/samples${qs}`);
}

// GET /api/samples/:sampleId  ->  one sample, with its errors.
//
// The upload page polls this to notice UPLOADED -> ANALYSED; the review
// screen (3a) reads the whole thing. On top of the summary shape it carries
// studentId, illegibleNote, analysisError and:
//
//   errors: [{ errorIndex, written, intended, category, confidenceScore,
//              locationOnScan: { page, x, y, z, w } | null, note, dismissed }]
//
// errorIndex is the error's position in the sample's errors array — the only
// handle there is, since the sub-schema has no _id. It stays stable because
// removing a tag sets dismissed rather than deleting the entry.
export function getSample(sampleId) {
  return request(`/samples/${sampleId}`);
}

// The scan itself. NOT routed through request() — that parses JSON, and this
// is an image the browser loads via <img src>. index is 0-based into the
// sample's pages, so it runs 0 .. imageCount - 1.
export function sampleImageUrl(sampleId, index) {
  return `${BASE}/samples/${sampleId}/images/${index}`;
}

// PATCH /api/samples/:sampleId/errors/:errorIndex  ->  the updated sample
// (same shape as getSample), so the screen repaints its counts and groups
// from one response instead of reconciling locally.
//
// A partial update — send only what changes:
//   { category }         reclassify (must be one of ERROR_CATEGORIES)
//   { dismissed: true }  remove the tag   { dismissed: false }  restore it
//   { confidenceScore }  1 when the educator confirms an uncertain tag
export function updateSampleError(sampleId, errorIndex, patch) {
  return request(`/samples/${sampleId}/errors/${errorIndex}`, {
    method: 'PATCH',
    body: patch,
  });
}

// PATCH /api/samples/:sampleId  { status }  ->  the updated sample.
// Behind "Mark review done" on 3a: ANALYSED -> REVIEWED.
export function markSampleReviewed(sampleId) {
  return request(`/samples/${sampleId}`, {
    method: 'PATCH',
    body: { status: 'REVIEWED' },
  });
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
  return fetch(`${BASE}/samples/${studentId}`, { method: 'POST', body: form }).then(async (res) => {
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
  });
}
