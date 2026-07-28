# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**LexiPath** — a tool for classifying spelling/literacy errors in children's handwritten work. An educator uploads a scan (or several pages) of a student's writing; Gemini flags errors and categorises them; the educator reviews each flag against the scan (the "scan-beside-errors" review screen) and corrects the AI. Aggregated error trends and intervention recommendations are planned on top of that reviewed data.

## Current state

The **upload → analyse → review** slice is built end to end. What exists:

- **Server** — `/api/students` and `/api/samples` are fully implemented (routes → controllers → services). Multipart upload via multer, background Gemini analysis, image serving, error reclassify/dismiss, mark-reviewed.
- **AI** — `server/services/errorClassificationEngine.js` is written and wired into the upload route (`@google/genai`, JSON response schema, retries, timeout, validation). It needs `GEMINI_API_KEY` in `server/.env` to actually run.
- **Client** — a real React Router SPA: students list, student profile, upload flow, sample review screen, plus a `/styleguide` reference page. No mock data left; every page goes through `client/src/lib/api.js`.

What is **not** built:

- `server/routes/recommendation.js` is still a `res.send("Hello world")` stub, and there are no routes for the `RecommendationReport` model. Trends and recommendations are `Placeholder` routes on the client too.
- **No authentication** anywhere — every route is public. Deliberate, recorded cut.
- **No test runner.** `npm test` in `server/` exits 1. The engine exports a `__testing` object and takes an injected `client` seam for tests that do not exist yet — don't assume a suite is there to catch you.

## Repository layout

Two **independent** npm packages, each with its own `package.json` and `node_modules`:

- `client/` — Vite 8 + React 19 + React Router 7 SPA (ES modules, `"type": "module"`)
- `server/` — Express 5 + Mongoose 9 / MongoDB REST API (ES modules, `"type": "module"`)

The root `package.json` is not a real workspace root — ignore it. Always `cd` into `client/` or `server/` before running npm commands.

Docs and references at the repo root: `paths.txt` (the API route spec — **root, not `server/`**), `LexiPath Wireframes.html`, `solution-class-diagram.jpg`, `lexipath-api-routes.docx`, `LexiPath - Work Allocation.docx`, and `lexipath_brand_assets_v2/` (logo SVGs + `brand-tokens.json`).

**UI work**: `client/DESIGN.md` is the authoritative visual spec (owner-approved tokens, geometry, status treatment, layout rules) — read it before writing or changing any client UI. Its §2 "hard rules" list things the owner explicitly rejected; don't reintroduce them. The brand kit wins over anything invented.

## Commands

Server (from `server/`):
```
npm install
npm start          # nodemon server.js; restarts on change
npm run lint       # ESLint (server/eslint.config.js)
npm run format     # Prettier write  (also: npm run format:check)
```

Client (from `client/`):
```
npm install
npm run dev        # Vite dev server with HMR
npm run build      # production build to dist/
npm run lint       # ESLint (flat config, client/eslint.config.js)
npm run format     # Prettier write  (also: npm run format:check)
npm run preview    # serve the built dist/
```

**Ports**: the client reads `VITE_API_URL` from `client/.env.local`, currently `http://localhost:4000/api`. `server/.env` sets `PORT=4000` to match. `server.js` falls back to 5000 if `PORT` is unset — if the client suddenly 404s on every call, check that pair first. There is no Vite dev proxy; the client talks cross-origin and the server enables `cors()` wide open.

## Server architecture

Entry point `server/server.js`: loads `.env`, `connectDB()`, `cors()`, JSON parsing, then mounts three routers at **`/api/samples`, `/api/students`, `/api/recommendation`**, with the error handler **last**.

Layering is `routes/` (URL shape, multer config) → `controllers/` (request handling, serialisation) → `services/` (the AI engine) → `models/`.

- **Config** — `.env` (gitignored) holds `MONGODB_URI`, `GEMINI_API_KEY`, `PORT`. The engine also reads optional `GEMINI_MODEL_NAME`, `GEMINI_TIMEOUT_MS`, `GEMINI_MAX_RETRIES`, `GEMINI_RETRY_BASE_MS`, `ERROR_CONFIDENCE_THRESHOLD`. `config/dbConnection.js` connects Mongoose and `process.exit(1)`s on failure.
- **Error handling** — `middleware/errorHandler.js` switches on `res.statusCode` using the numeric codes in `constants.js`. The convention throughout the controllers is `res.status(4xx)` **then** `throw new Error(...)`; the handler formats `{ title, message, stackTrace }`. Express 5 forwards async rejections automatically, so controllers are written without try/catch. Keep the handler registered after all routes.

### Routes as implemented

```
GET    /api/students                        list, newest first
POST   /api/students                        { name, currentGrade }
GET    /api/students/:studentId
GET    /api/students/:studentId/samples     ?status=UPLOADED|ANALYSED|REVIEWED|FAILED

GET    /api/samples                         every sample, newest first
POST   /api/samples/:studentId              multipart; files under field "samples" (max 12)
GET    /api/samples/:sampleId
PATCH  /api/samples/:sampleId               { status } — mark reviewed
GET    /api/samples/:sampleId/images/:index  binary; index is 0-based into pages[]
PATCH  /api/samples/:sampleId/errors/:errorIndex   { category } / { dismissed }
```

Upload responds **201 with the created sample**, then kicks off `runAnalysis(...)` fire-and-forget *after* the response. The client polls `GET /api/samples/:sampleId` until `status` leaves `UPLOADED`. (The spec in `paths.txt` says 202; the code sends 201 — the polling contract is the same either way.)

### The serialisation contract

`controllers/sampleController.js` exports **one** mapper, `toClientSample()`, and every read *and* write route answers with it. Two rules ride on that:

1. **Raw `imagePath` never leaves the server** — the client gets `imageCount` and fetches pixels through the images route.
2. Writes answer with the same full shape as reads, because the review screen repaints itself from whatever a PATCH returns rather than reconciling locally. Don't split a "summary" shape off for the list routes; that was tried and reverted (see the comment at the top of the file).

`errorIndex` (array position) is the only handle the client has on an embedded error — the sub-schema is `_id: false`. It stays stable **only** because dismissing flags rather than deletes. Never splice `errors[]`.

`controllers/studentController.js` does the same with `toClientStudent()`, so `_id`/`__v` never reach the UI; the client keys off `studentId`.

### The AI engine (`services/errorClassificationEngine.js`)

- `analyseSample(sample, { client })` builds one multimodal request containing **all** pages in upload order, so an error spanning a page break is readable and the model's `page` index lines up. Returns `{ errors, illegibleNote }` — the two fields `Sample` has room for. There is no separate report model.
- `runAnalysis(sampleId)` is the background job: it always resolves the sample to `ANALYSED` or `FAILED`, never leaves one stuck mid-analysis, and swallows its own errors (nothing is awaiting it). `describeFailure()` turns exceptions into a sentence an educator reads — never a stack trace. Note the parameter is a **sample id**; `createSample` currently hands it the document and relies on Mongoose casting — pass an id from new callers.
- Model output is validated (`validateAnalysisResult`) before it is stored: category must be in `ERROR_CATEGORIES`, box coords in 0–1, `page` a real index into `pages[]`.
- The model name defaults to the `-latest` alias deliberately (pinned Gemini versions get retired). Don't pin it back.
- `getConfidenceThreshold()` / `isUncertain()` drive the "AI needs your judgement" state. The default (0.6) is **duplicated** in `client/src/lib/categories.js` — the server does not send it, so changing one means changing both.
- The header comment points at `server/README.md`, which does not exist.

### Data model (Mongoose)

- **Student** (`student.js`) — one per child, `name` + `currentGrade`. Privacy intent was to identify by DAS ID rather than real names; the field is still literally `name`.
- **Sample** (`sample.js`) — the core collection, one document per uploaded piece of work. Errors are **embedded** in `errors[]` (sub-schema `errorSchema`), not a separate collection, because the module always processes one sample end to end. Invariants:
  - `written` (the word as the child wrote it) is **never auto-corrected** anywhere.
  - `ERROR_CATEGORIES` (exported) is the fixed vocabulary: phonological, orthographic, morphological, capitalisation, punctuation, unsure.
  - An error is dismissed (`dismissed: true`) by the educator, **not deleted** — the decision must stay visible and reversible.
  - `status`: `UPLOADED → ANALYSED → REVIEWED`, plus `FAILED` for analysis that could not complete (`analysisError` carries the educator-facing reason). `taskType` is `ESSAY | LONG_ANSWER | SHORT_ANSWER`.
  - `pages[]` holds `{ imagePath, originalFilename }` — filesystem paths, not bytes; at least one page required, up to 12 per sample.
  - `locationOnScan` is a normalised `boxSchema` `{ page, x, y, z, w }` (`z`/`w` are width/height, all 0–1). This is what lets the UI draw highlights over the scan — it must survive serialisation intact.
  - `answerKey` is passed to the model **only** to help it read unclear handwriting, never to correct the child's writing toward it, and only for non-`ESSAY` tasks.
- **RecommendationReport** (`recommendationReport.js`) — embedded `strategies`, references `student` and `basedOnSamples`. `status` is `CURRENT | OUTDATED | SUPERSEDED`; regeneration links the new report via `supersedes`. **No routes touch this model yet.**

Read the extensive inline comments in `models/` before changing them — they encode deliberate decisions.

### Uploaded files

Scans land in `server/samples/<studentId>/<timestamp>-<originalname>`. That directory is **not gitignored and files in it are currently tracked in git** — be aware before adding more, and don't commit real student work.

## Client architecture

`main.jsx` owns the router; `App.jsx` is the shell (persistent `Sidebar` + `<Outlet/>`).

```
/                                    StudentsListPage
/students/:studentId                 StudentProfilePage
/students/:studentId/upload          UploadSamplePage        (screens 2a–2d)
/students/:studentId/trends          Placeholder
/students/:studentId/recommendations Placeholder
/samples/:sampleId                   SampleReportPage        (screens 3a/3c)
/styleguide                          StyleguidePage
```

`src/lib/` is the discipline layer — pages import from it and never inline the rules:

- **`api.js`** — the single seam to the backend. Pages never call `fetch()` or build URLs. Every export maps to one route; the comments document the exact response shapes. `getStudent()` deliberately resolves to `null` on 404 so pages can show a "not found" screen — don't drop that catch. `uploadSample()` builds `FormData` and must not set a `Content-Type` header.
- **`status.js`** — `statusFor()` maps a status string to `{ label, tone, ready }`. It accepts **both** vocabularies (`paths.txt`'s `PENDING/PROCESSING/COMPLETE/FAILED` and the model's `UPLOADED/ANALYSED/REVIEWED`). The UI never branches on a raw status string.
- **`categories.js`** — `categoryFor()` gives each category a label, short form and icon. Categories are told apart by **shape + label, never colour** (six new palette colours would break DESIGN.md §3, and icon-only cues were rejected). `RECLASSIFY_ORDER` omits `unsure` — an educator picking by hand is by definition not unsure.

Components in `src/components/` are shared and appear in `/styleguide`; if you add a reusable pattern, add it there too. `ScanViewer` (scan + overlaid boxes) and `ErrorCard` are the two substantial ones. Styling is plain CSS (`index.css` tokens on `:root`, `App.css`) — no CSS framework, no CSS-in-JS. Use the CSS variables, never raw hex.

`client/.env.local` still sets `VITE_USE_MOCKS`; nothing reads it — `mockData.js` is gone.

## `paths.txt` — spec vs. reality

`paths.txt` (repo root) is the original route design. Most of it is now implemented, but **reconcile deliberately, don't assume**:

- The base path `/api` and the students/samples routes now match. Recommendation routes do not exist.
- The spec's status vocabulary (`PENDING/PROCESSING/COMPLETE/FAILED`) and entities (`SampleReport`, `DetectedError`) differ from the implemented models (`UPLOADED/ANALYSED/REVIEWED/FAILED`; errors embedded in `Sample`). **Follow the model's actual enums.**
- The spec's error envelope is `{ error: { code, message } }`; the implemented handler sends `{ title, message, stackTrace }`, and `api.js` reads `message`.
- Route-collision rule from the spec, still worth honouring: Express matches on position, so two routes differing only by param **name** collide (`/samples/:studentId` POST vs `/samples/:sampleId` GET coexist only because the methods differ). Keep collections nested under their owning resource.

## Known rough edges

Worth knowing before you touch the relevant file — fix them if the task calls for it, don't be surprised by them:

- `markReviewed` guards with `if (!status && !valid.includes(status))` — the `&&` means a bogus status slips past to Mongoose's enum validation instead of the intended 400.
- `reclassifyError` saves `dismissed` and *then* requires a valid `category`, so the `{ dismissed: true }` patch documented in `api.js` writes the dismissal and still answers 400.
- `getImages` indexes `sample.pages[index]` before checking the index is in range.
- `createStudent` `console.log`s the request body.
- Server-side owner's convention (from prior sessions): prefer widening an existing route over adding a new one, and don't add history/audit fields that weren't asked for.
