# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**LexiPath** — a tool for classifying spelling/literacy errors in children's handwritten work. An educator uploads a scan of a student's writing; an AI (Gemini, planned) flags errors and categorises them; the educator reviews each flag against the scan (the "scan-beside-errors" review screen) and corrects the AI. Aggregated error trends and intervention recommendations build on top of that reviewed data.

The project is **early-stage**: the Mongoose data models are the most developed part. The Express routes are still stubs (`res.send("Hello world")`) and the React client is the untouched Vite starter template. The real API design lives in `server/paths.txt` (see below) and has not been implemented yet.

## Repository layout

Two **independent** npm packages, each with its own `package.json` and `node_modules`:

- `client/` — Vite 8 + React 19 SPA (ES modules, `"type": "module"`)
- `server/` — Express 5 + Mongoose 9 / MongoDB REST API (ES modules, `"type": "module"`)

The root `package.json` is not a real workspace root — ignore it. Always `cd` into `client/` or `server/` before running npm commands.

Design/reference docs at the root: `server/paths.txt` (API route spec), `LexiPath Wireframes.html`, `solution-class-diagram.jpg`, and the `.docx` work-allocation / API files.

**UI work**: `client/DESIGN.md` is the authoritative visual spec (owner-approved tokens, geometry, status treatment, layout rules) — read it before writing or changing any client UI. Brand assets live in `lexipath_brand_assets_v2/`.

## Commands

Server (from `server/`):
```
npm install
npm start          # runs `nodemon server.js`; restarts on change
```

Client (from `client/`):
```
npm install
npm run dev        # Vite dev server with HMR
npm run build      # production build to dist/
npm run lint       # ESLint (flat config, client/eslint.config.js)
npm run preview    # serve the built dist/
```

There is **no test runner** — `npm test` in `server/` is a placeholder that exits 1. Don't assume tests exist.

## Server architecture

Entry point `server/server.js`: loads `.env`, calls `connectDB()`, mounts JSON parsing and three routers (`/samples`, `/students`, `/recommendation`), then the error handler **last**.

- **Config** — `.env` (gitignored) holds `MONGODB_URI`, `GEMINI_API_KEY`, `PORT` (defaults to 5000). `config/dbConnection.js` connects Mongoose and `process.exit(1)`s on failure.
- **Error handling** — `middleware/errorHandler.js` switches on `res.statusCode` using the numeric codes in `constants.js` (`VALIDATION_ERROR=400`, `NOT_FOUND=404`, etc.). The convention is to set the status code with `res.status(...)` and then `throw new Error(...)`; the handler formats `{ title, message, stackTrace }`. It must stay registered after all routes.
- **Data models** (`models/`) — this is where the domain lives. Read the extensive inline comments before changing them; they encode deliberate decisions.

### Data model (Mongoose)

- **Student** (`student.js`) — one per child. Privacy intent: identify students by DAS ID, never real names (though the current field is literally `name` + `currentGrade`).
- **Sample** (`sample.js`) — the core collection, one document per uploaded piece of work. Errors are **embedded** in the `errors` array (sub-schema `errorSchema`), not a separate collection, because the module always processes one sample end-to-end. Key invariants:
  - `written` (the word as the child wrote it) is **never auto-corrected** anywhere.
  - `ERROR_CATEGORIES` (exported) is the fixed vocabulary: phonological, orthographic, morphological, capitalisation, punctuation, unsure.
  - An error is dismissed (`dismissed: true`) by the educator, **not deleted** — the decision must stay visible and reversible (audit trail).
  - `status` flow: `UPLOADED → ANALYSED → REVIEWED`. `taskType` is `ESSAY | LONG_ANSWER | SHORT_ANSWER`.
  - `imagePath` stores a filesystem path, not image bytes. Never expose the raw path in JSON responses.
  - `locationOnScan` (a normalised 0–1 `boxSchema`) is what lets the UI draw highlights over the scan — it must survive serialisation intact.
- **RecommendationReport** (`recommendationReport.js`) — embedded `strategies`, references `student` and `basedOnSamples`. `status` is `CURRENT | OUTDATED | SUPERSEDED`; regeneration links the new report via `supersedes`.

Cross-collection references (`student`, `basedOnSamples`) are stored as ObjectIds and resolved with `.populate()` in routes when the full document is needed.

## `server/paths.txt` — API spec vs. reality

`paths.txt` is the authoritative route design and is worth reading before building any endpoint, but **it does not match the current code** — reconcile deliberately, don't assume:

- The spec uses a `/api` base path and richer nested routes (`/api/students/:id/samples`, `/api/samples/:id/report`, trends, etc.). The code currently mounts flat routers at `/samples`, `/students`, `/recommendation`.
- The spec's status vocabulary (`PENDING/PROCESSING/COMPLETE/FAILED`) and entities (`SampleReport`, `DetectedError`) differ from the implemented models (`UPLOADED/ANALYSED/REVIEWED`; errors embedded in `Sample`). When implementing, follow the model's actual enums.
- Recommendation routes and auth are **deliberately deferred**. There is no authentication — every route is effectively public. This is a known, recorded cut, not an oversight.
- Route-collision rule from the spec: Express matches on position, so two routes differing only by param **name** collide (`/reports/:sampleId` vs `/reports/:studentId`). Keep collections nested under their owning resource.
- Sample upload is designed as `202 Accepted` (multipart) with analysis running in the background after the response; the client then polls `GET /samples/:id` until analysis completes.

The Gemini vision analysis (`GEMINI_API_KEY` in `.env`) is the intended AI backend but is **not yet wired up** — a prior `gemini.js` was removed. Answer keys, when present, are passed to the model only to help it read unclear handwriting, never to correct the child's writing toward them.
