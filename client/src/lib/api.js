// ------------------------------------------------------------------
// The single seam between the UI and the backend.
//
// Every function here maps to a route in server/routes/, so the pages
// never touch fetch() or URLs themselves.
//
// VITE_API_URL defaults to "/api".
// Students and samples now use live backend routes.
// ------------------------------------------------------------------

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined && {
        'Content-Type': 'application/json',
      }),
    },
    ...(body !== undefined && {
      body: JSON.stringify(body),
    }),
  });

  if (!response.ok) {
    let detail;

    try {
      detail = (await response.json())?.message;
    } catch {
      // Response body was not JSON.
    }

    const error = new Error(detail || `Request failed (${response.status})`);

    error.status = response.status;
    throw error;
  }

  return response.json();
}
// The backend returns MongoDB documents using `_id`.
// The frontend uses `studentId`.
const toClientStudent = (student) =>
  student && {
    studentId: student._id,
    name: student.name,
    currentGrade: student.currentGrade,
  };

// GET /api/students
export function getStudents() {
  return request('/students').then((students) => students.map(toClientStudent));
}

// GET /api/students/:studentId
export function getStudent(studentId) {
  return request(`/students/${encodeURIComponent(studentId)}`)
    .then(toClientStudent)
    .catch((error) => {
      if (error.status === 404) {
        return null;
      }

      throw error;
    });
}

// POST /api/students
export function createStudent({ name, currentGrade }) {
  return request('/students', {
    method: 'POST',
    body: {
      name,
      currentGrade,
    },
  }).then(toClientStudent);
}

// GET /api/students/:studentId/samples?status=
export function getStudentSamples(studentId, { status } = {}) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';

  return request(`/students/${encodeURIComponent(studentId)}/samples${query}`);
}

// GET /api/:studentId/trend
export function getStudentTrend(studentId) {
  return request(`/${encodeURIComponent(studentId)}/trend`);
}

// GET /api/samples/:sampleId
export function getSample(sampleId) {
  return request(`/samples/${encodeURIComponent(sampleId)}`);
}

// POST /api/samples/:studentId
// This request uses FormData, so the browser must set Content-Type.
export async function uploadSample(studentId, { title, taskType, files }) {
  const form = new FormData();

  form.append('title', title);
  form.append('taskType', taskType);

  for (const file of files) {
    form.append('samples', file);
  }

  const response = await fetch(`${BASE}/samples/${encodeURIComponent(studentId)}`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    let detail;

    try {
      detail = (await response.json())?.message;
    } catch {
      // Response body was not JSON.
    }

    const error = new Error(detail || `Upload failed (${response.status})`);

    error.status = response.status;
    throw error;
  }

  return response.json();
}
