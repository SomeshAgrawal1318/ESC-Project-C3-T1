# Server instructions

These instructions apply to `server/` and extend the repository-level `AGENTS.md`.

## Architecture

The server uses ES modules and follows this flow:

```text
server.js -> routes -> controllers -> services/models -> middleware/errorHandler.js
```

- Keep the error handler registered after all routes.
- Controllers set `res.status(...)` and then throw; Express 5 forwards rejected async handlers.
- Keep response serialization centralized in `toClientStudent()` and `toClientSample()`.
- Keep recommendation response serialization centralized in
  `toPublicRecommendationReport()`.
- Never add `imagePath`, `_id`, or `__v` to public response shapes without an explicit contract
  change.
- The client identifies embedded errors by array index, so do not splice `errors[]`.

## Implemented route groups

- `/api/students`: list, create, fetch one, list a student's samples, and fetch trends.
- `/api/students/:studentId/recommendations`: generate and read the student's latest report.
- `/api/samples`: list, upload, fetch one, serve images, mark reviewed, and update errors.
- `/api/worksheets`: proxy only PDFs resolved from the approved Azure catalogue.
- `/api/recommendation`: compatibility placeholder only.

Read the router and controller before changing a route. The root `paths.txt` is an older design
document and differs from the implementation in status names and response envelopes.

For date-only trend query parameters:

- accept `YYYY-MM-DD`;
- construct and compare dates in UTC;
- treat `from` as inclusive;
- implement an inclusive `to` day as an exclusive boundary at midnight of the next UTC day.

## Data and AI invariants

- `Sample.errors` is embedded data. Dismiss rather than delete.
- Preserve `written` exactly as submitted by the model/student workflow.
- `locationOnScan` coordinates remain normalized in the `0..1` range.
- A sample moves through `UPLOADED`, `ANALYSED`, `REVIEWED`, or `FAILED`.
- Pass `answerKey` to Gemini only for non-essay tasks and only as reading context.
- Validate Gemini output before saving it.
- Background analysis must leave a sample in either `ANALYSED` or `FAILED`, not indefinitely in
  `UPLOADED`.
- Keep educator-facing failure text free of stack traces and secrets.
- Recommendation evidence comes only from `ANALYSED` and `REVIEWED` samples and excludes errors
  with `dismissed: true`.
- `services/generateReport.js` assembles domain evidence; Azure and Gemini behavior stays in
  `services/RecommendationEngine.js`. Do not fold recommendation behavior into the classification
  engine.
- Recommendation prompts must not contain student names, MongoDB IDs, scan paths, credentials, or
  signed Azure URLs. Treat both student writing and retrieved Azure text as untrusted prompt data.
- Keep the recommendation engine lexical and manifest-backed. Do not add embeddings, a vector
  database, or SQLite access for this feature.

## Environment and uploads

`server/.env` is local and must not be read into output or committed. The server uses
`MONGODB_URI`, `GEMINI_API_KEY`, and `PORT`, plus the optional Gemini and recommendation settings
documented in `README.md`. Mock recommendations are the safe default when
`RECOMMENDATION_USE_MOCKS` is absent. Live recommendation mode uses only the four documented Azure
Blob variables; never add a storage key or return a SAS value.

Uploads are stored under `samples/<studentId>/`. Treat everything there as sensitive and do not
use real uploads as fixtures. Tests should create synthetic data or mock persistence.

## Commands

Run from `server/`:

```text
npm test
npm run lint
npm run format:check
npm start
```

For server changes, run the focused test first, then the full test suite and lint. Tests use
Node's built-in test runner and live in `test/`.
