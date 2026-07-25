# LexiPath server

## Error Classification Engine

`server/services/errorClassificationEngine.js` is the AI core: it takes an
uploaded `Sample` and produces the categorised errors written back onto it.
There is no separate `SampleReport` model in this codebase — errors are
embedded on `Sample` (see `server/models/sample.js`), so the "report" this
engine returns is just `{ errors, illegibleNote }`, the two fields `Sample`
already has.

### Running it

```
cd server
npm install
npm test        # runs the unit tests with node's built-in test runner
```

No `.env` variables are required to run in mock mode (the default). Copy
`.env.example` to `.env` and fill in `MONGODB_URI` to run the rest of the
server.

### Mock mode vs real mode

- **Mock mode** (default, active whenever `GEMINI_API_KEY` is unset, or force
  with `USE_MOCK_AI=true`): returns a fixed fixture with one error per
  category plus one deliberately low-confidence entry, so downstream slices
  (review screen, trends, recommendations) can build against a stable shape
  without an API key or network latency.
- **Real mode**: set `GEMINI_API_KEY` (and optionally `USE_MOCK_AI=false`) to
  call Gemini vision. Requires `npm install` to have pulled in
  `@google/genai`. Gemini SDK APIs move quickly - if `ai.models.generateContent`
  or its response shape has changed since this was written, check the current
  Gemini API docs before relying on real mode; `callModelWithRetry` in
  `errorClassificationEngine.js` is the only place that would need updating.

**Testing the FAILED path without a real broken file**: in mock mode, a
sample whose `imagePath` or `originalFilename` contains the word "corrupt"
(case-insensitive) simulates an unreadable upload and rejects with the same
message the real path uses for an unreadable file.

### Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `GEMINI_API_KEY` | (empty) | Gemini API key. Leave blank to force mock mode. Never sent to the client. |
| `USE_MOCK_AI` | `true` if no API key, else `false` | Explicit override for mock vs real mode. |
| `GEMINI_MODEL_NAME` | `gemini-flash-latest` | Gemini model used for the vision call. The `-latest` alias is deliberate: pinned versions get retired for new API keys. |
| `GEMINI_TIMEOUT_MS` | `30000` | Per-attempt timeout before the request is treated as failed. |
| `GEMINI_MAX_RETRIES` | `2` | Additional attempts after a timeout/error/malformed response, with exponential backoff. |
| `ERROR_CONFIDENCE_THRESHOLD` | `0.6` | Confidence score below which a detected error is flagged "uncertain" for the educator. |

### Integration point for Person 2 (Sample Upload)

`runAnalysis(sampleId)` is the background job. Call it **after** the sample
upload route has already sent its response — do not `await` it in the
request handler:

```js
// in the POST /api/samples handler, after res.status(202).json(sample):
runAnalysis(sample._id);
```

It always resolves the sample to `status: "ANALYSED"` or `status: "FAILED"`
(with a human-readable `analysisError`) — it never leaves a sample stuck
mid-analysis, even if every retry fails.

### `locationOnScan` coordinate system

`{ x, y, z, w }`, all normalised 0–1 against the full page image: `x, y` is
the bounding box's top-left corner, `z, w` are its width and height. This was
chosen here in the absence of a written agreement with Person 4 (the review
screen owner) — confirm it still matches what they render before wiring up
the real review screen.
