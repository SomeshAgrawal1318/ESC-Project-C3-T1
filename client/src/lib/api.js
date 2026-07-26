// ------------------------------------------------------------------
// The single seam between the UI and the backend.
//
// VITE_API_URL defaults to the local Express server during development.
// VITE_USE_MOCKS keeps the existing student/sample screens on mockData while
// the new error-trends call still reads live records from MongoDB.
// ------------------------------------------------------------------

import { mockStudents, mockSamplesByStudent } from './mockData.js';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';
const USE_MOCKS = (import.meta.env.VITE_USE_MOCKS ?? 'true') !== 'false';

const settle = (value, ms = 250) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

async function request(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    let detail;

    try {
      const body = await res.json();
      detail = body?.error?.message || body?.message;
    } catch {
      // The response body was not JSON.
    }

    throw new Error(detail || `Request failed (${res.status})`);
  }

  return res.json();
}

// GET /api/students -> Student[]
export function getStudents() {
  if (USE_MOCKS) return settle(mockStudents);
  return request('/students');
}

// GET /api/students/:studentId -> { studentId, name, currentGrade }
export function getStudent(studentId) {
  if (USE_MOCKS) {
    const student = mockStudents.find((item) => item.studentId === studentId);
    return settle(student ?? null);
  }

  return request(`/students/${studentId}`);
}

// GET /api/students/:studentId/samples?status= -> Sample summaries
export function getStudentSamples(studentId, { status } = {}) {
  if (USE_MOCKS) {
    let list = mockSamplesByStudent[studentId] ?? [];
    if (status) list = list.filter((sample) => sample.analysisStatus === status);
    return settle(list);
  }

  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return request(`/students/${studentId}/samples${query}`);
}

// GET /api/error-trend/by-name/:studentName -> ErrorTrend[]
// This request is intentionally live even while the other screens use mocks.
export function getErrorTrendsByStudentName(studentName) {
  return request(`/error-trend/by-name/${encodeURIComponent(studentName)}`);
}
