# LexiPath server

Express and Mongoose API for samples, students, grounded literacy recommendations, and server-side worksheet delivery.

## Setup

```bash
npm install
cp .env.example .env
npm start
```

The server listens on `PORT` (default `5000`) and expects MongoDB at `MONGODB_URI`.

## Recommendation modes

Mock mode is the safe local default:

```text
RECOMMENDATION_USE_MOCKS=true
```

Set `RECOMMENDATION_USE_MOCKS=false` to use Gemini with private Azure knowledge retrieval. Live mode requires these variables in the ignored `server/.env`:

```text
GEMINI_RECOMMENDATION_API_KEY
GEMINI_RECOMMENDATION_MODEL
AZURE_STORAGE_ACCOUNT_NAME
AZURE_STORAGE_CONTAINER_NAME
AZURE_STORAGE_SAS_TOKEN
AZURE_KNOWLEDGE_MANIFEST_PATH
AZURE_ASSET_MANIFEST_PATH
```

`GEMINI_API_KEY` is accepted as a fallback for the recommendation key. Copy variable names and safe placeholders from [`.env.example`](.env.example); never put real credentials in Markdown, source code, frontend state, or Git.

The Azure SAS is a bearer credential and should have only the minimum Blob read permission needed by the server. Keep the container private, rotate exposed credentials, and never send signed Azure URLs to the browser.

## Grounded recommendation architecture

```text
Private Azure Blob Storage
    -> canonical Markdown manifest
    -> complete Markdown pages cached by the server
    -> relevance selection (at most 12 pages)
    -> Gemini structured-output request
    -> Azure asset-manifest worksheet ID/path validation
    -> Express PDF stream
    -> educator browser
```

The server treats retrieved Markdown as untrusted reference data. It does not execute instructions from the corpus. Gemini receives only relevant pages, not the complete vault, and may return only worksheet IDs and PDF paths listed in the private Azure asset manifest. Returned category names are constrained to the model's fixed error vocabulary. Mock mode uses a small built-in worksheet catalogue and does not require local knowledge files.

Recommendation prompts include the reviewed written form, intended form, error category, and educator note. Database sample IDs are stripped before calling Gemini and prompt evidence uses ephemeral IDs. Do not describe this payload as anonymous; obtain the required approval before sending real student work to an external model.

The three recommendation services have distinct responsibilities:

- `services/recommendationEngine.js` retrieves context, calls Gemini, validates structured output, and fetches approved PDFs.
- `services/recommendWorksheet.js` selects up to three PDFs for one analysed sample.
- `services/generateReport.js` creates the latest intervention report from all analysed samples for one student.

There is no SQLite retrieval dependency. Generating a student report saves the new report and removes older reports; there is no lifecycle, supersession, comparison, or adoption workflow.

## Recommendation API

```text
POST /api/samples/:sampleId/recommendations
GET  /api/samples/:sampleId/recommendations

POST /api/students/:studentId/recommendations
GET  /api/students/:studentId/recommendations/latest

GET  /api/worksheets/:worksheetId/file
```

The worksheet endpoint accepts only a stable approved worksheet ID. The server resolves the corresponding private Blob path, rejects unexpected upstream content types, and forces a non-sniffable `application/pdf` response. It does not expose the SAS token or permit arbitrary Blob paths.

The prototype currently has no authentication or authorization. Although the Azure container remains private, anyone who can reach the application and knows an approved worksheet ID can call the proxy endpoint. Add access control and confirm worksheet publication/redistribution rights before any public or production deployment.

The sample-analysis workflow should call `generateAndSaveSampleWorksheets(sampleId)` after saving an `ANALYSED` sample. Until the upload/analysis controller is complete, the sample POST endpoint exposes that operation directly.

Errors use this shape:

```json
{ "error": { "code": "ERROR_CODE", "message": "Readable message" } }
```

## Runtime logging

The server writes structured progress events to stdout:

- `[http]` — method, path without query strings, status, and duration.
- `[recommendation]` — mode, Azure retrieval/cache progress, selected source paths, Gemini timing, validated worksheet IDs, strategy counts, and PDF streaming lifecycle.

Logs intentionally omit request bodies, student writing, API keys, SAS values, and signed URLs.

## Tests

Run the isolated server suite:

```bash
npm test
```

The live integration test is opt-in and is skipped by `npm test`:

```bash
npm run test:live
```

`npm run test:live` forces live recommendation mode and verifies the complete Azure canonical context → Gemini strategies → approved Azure PDF path. It requires configured local credentials, internet access, and may incur external API usage. Test output reports only safe operational metadata.

## Before pushing

```bash
npm test
node --check services/recommendationEngine.js
node --check test/live-recommendation.test.js
git diff --check
```

From `client/`, also run `npm run lint` and `npm run build`.