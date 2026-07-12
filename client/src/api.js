// src/api.js
// -----------
// Every conversation with the backend goes through this file. Each function
// wraps one endpoint, and they all share the same helper, so error handling
// works the same way everywhere: if the server says something went wrong,
// we surface ITS human-readable message, not a cryptic status code.

// One shared helper: send the request, parse the JSON, and turn any failure
// into an Error whose message is safe to show to the user.
async function requestJson(path, options = {}) {
  const response = await fetch(`/api${path}`, options)

  // Try to read the JSON body even on failure - our backend always sends
  // { message: "..." } when something goes wrong.
  let body = null
  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (!response.ok) {
    const message =
      body && body.message
        ? body.message
        : `The server replied with an unexpected error (status ${response.status}).`
    throw new Error(message)
  }

  return body
}

// GET /api/samples - the list for the landing page.
export function fetchSamplesList() {
  return requestJson('/samples')
}

// GET /api/samples/:id - one sample with everything.
export function fetchSample(sampleId) {
  return requestJson(`/samples/${sampleId}`)
}

// POST /api/samples - upload a new scan. Takes a FormData (not JSON)
// because it carries an actual file; the browser sets the right headers.
export function uploadSample(formData) {
  return requestJson('/samples', {
    method: 'POST',
    body: formData,
  })
}

// POST /api/samples/:id/analyse - ask the backend to run the single
// Gemini call that reads the image and flags the errors.
export function analyseSample(sampleId) {
  return requestJson(`/samples/${sampleId}/analyse`, {
    method: 'POST',
  })
}

// PUT /api/samples/:id/errors - save the educator's review (dismissed
// flags and corrected "intended" words).
export function saveErrors(sampleId, errors) {
  return requestJson(`/samples/${sampleId}/errors`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ errors }),
  })
}

// The backend stores where the scan lives on ITS disk (e.g.
// "C:\...\server\uploads\1234-scan.jpg") and serves that same file at
// "/uploads/1234-scan.jpg". This turns one into the other so the review
// screen can show the image.
export function scanImageUrl(sample) {
  if (!sample || !sample.imagePath) {
    return ''
  }
  const filename = sample.imagePath.split(/[\\/]/).pop()
  return `/uploads/${filename}`
}
