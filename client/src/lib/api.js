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
      const payload = await res.json();
      detail = payload?.error?.message ?? payload?.message;
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

// GET /api/students/:studentId/samples?status=  ->  lightweight summaries,
// newest first: { sampleId, title, uploadedAt, analysisStatus, imageCount }.
// Never carries errors/content — see paths.txt. Powers the profile's sample
// list. For trend data use getStudentTrends() below, not this.
export function getStudentSamples(studentId, { status } = {}) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return request(`/students/${studentId}/samples${qs}`);
}

// GET /api/students/:studentId/trends?from=&to=  ->
//   { studentId, totalSamples, totalErrors, mostFrequentCategory,
//     categoryTotals, trends: [{ sampleId, title, date, totalErrors,
//     categoryCounts }] }
// Computed server-side from stored SampleReports; totalErrors/categoryCounts
// already exclude dismissed tags and only count ANALYSED/REVIEWED samples,
// so it reconciles exactly with the review screen's own counts.
export function getStudentTrends(studentId, { from, to } = {}) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  return request(`/students/${studentId}/trends${qs ? `?${qs}` : ''}`);
}

// GET the latest report. `isOutdated` is computed from source sample updates;
// the expected no-report 404 is not a page-level failure.
export async function getLatestRecommendations(studentId) {
  try {
    return (await request(`/students/${studentId}/recommendations/latest`)).report;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

// Generate and replace the student's latest intervention report.
export async function generateRecommendations(studentId) {
  return (
    await request(`/students/${studentId}/recommendations`, {
      method: 'POST',
      body: {},
    })
  ).report;
}

// The browser receives only a stable approved ID, never an Azure blob path or SAS URL.
// Mock worksheet records carry available=false, so the UI does not offer a dead link.
export function worksheetFileUrl(worksheetId) {
  return `${BASE}/worksheets/${encodeURIComponent(worksheetId)}/file`;
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

// POST /api/auth/login  { username, password }  ->  account (no password)
export function login({ username, password }) {
  return request('/auth/login', { method: 'POST', body: { username, password } });
}

// POST /api/auth/forgot-password  { username }  ->  { message }
// Always resolves 200 whether or not the username exists, so the caller
// can't use this to discover which usernames are registered.
export function requestPasswordReset({ username }) {
  return request('/auth/forgot-password', { method: 'POST', body: { username } });
}

// POST /api/auth/reset-password/:token  { password }  ->  { message }
export function resetPassword(token, { password }) {
  return request(`/auth/reset-password/${token}`, { method: 'POST', body: { password } });
}

// GET /api/auth/account/:username  ->  { username, name, email, phoneNumber,
// role, organisation, createdAt }. Powers AccountPage.
export function getAccount(username) {
  return request(`/auth/account/${encodeURIComponent(username)}`);
}

// PATCH /api/auth/change-password  { username, currentPassword, newPassword }
// ->  { message }. Distinct from resetPassword() — this is the logged-in
// "I know my current password" flow, not the emailed-token one.
export function changePassword({ username, currentPassword, newPassword }) {
  return request('/auth/change-password', {
    method: 'PATCH',
    body: { username, currentPassword, newPassword },
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
        const payload = await res.json();
        detail = payload?.error?.message ?? payload?.message;
      } catch {
        /* body was not JSON */
      }
      const error = new Error(detail || `Upload failed (${res.status})`);
      error.status = res.status;
      throw error;
    }
    return res.json();
  });
}
