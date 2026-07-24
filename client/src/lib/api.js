// ------------------------------------------------------------------
// The single seam between the UI and the backend.
//
// Every function here maps 1:1 to a route in server/paths.txt, so when
// you build the Express endpoints the client already speaks their shape.
//
//   VITE_API_URL   base origin for the API (default "/api", per paths.txt)
//   VITE_USE_MOCKS "false" to hit the real backend; anything else = mocks
//
// While the backend does not exist yet, USE_MOCKS defaults to true and the
// screens run entirely off src/lib/mockData.js. Flip VITE_USE_MOCKS=false
// (and point VITE_API_URL at your server) to go live — no component changes.
// ------------------------------------------------------------------

import { mockStudents, mockSamplesByStudent } from './mockData.js';

const BASE = import.meta.env.VITE_API_URL ?? '/api';
const USE_MOCKS = (import.meta.env.VITE_USE_MOCKS ?? 'true') !== 'false';

// Small artificial delay so loading states are exercised in mock mode.
const settle = (value, ms = 250) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

async function request(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    let detail;
    try {
      detail = (await res.json())?.error?.message;
    } catch {
      /* body was not JSON */
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json();
}

// GET /api/students  ->  Student[]
export function getStudents() {
  if (USE_MOCKS) return settle(mockStudents);
  return request('/students');
}

// GET /api/students/:studentId  ->  { studentId, name, currentGrade }
export function getStudent(studentId) {
  if (USE_MOCKS) {
    const student = mockStudents.find((s) => s.studentId === studentId);
    return settle(student ?? null);
  }
  return request(`/students/${studentId}`);
}

// GET /api/students/:studentId/samples?status=  ->  Sample summaries
// Summary shape used by the profile list:
//   { sampleId, title, uploadedAt, analysisStatus, imageCount }
// NOTE for the backend: paths.txt's summary omits `title`, but the Sample
// model has it and the list needs it — include `title` in this response.
export function getStudentSamples(studentId, { status } = {}) {
  if (USE_MOCKS) {
    let list = mockSamplesByStudent[studentId] ?? [];
    if (status) list = list.filter((s) => s.analysisStatus === status);
    return settle(list);
  }
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return request(`/students/${studentId}/samples${qs}`);
}
