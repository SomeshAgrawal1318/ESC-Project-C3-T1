# LexiPath server

Express and Mongoose API for student records, uploaded writing samples, AI classification,
educator review, trends, and student-level intervention recommendations.

## Setup

Create `server/.env`:

```text
MONGODB_URI=<MongoDB connection string>
GEMINI_API_KEY=<Gemini API key>
PORT=4000
GEMINI_MODEL_NAME=gemini-flash-latest
GEMINI_TIMEOUT_MS=30000
GEMINI_MAX_RETRIES=2
ERROR_CONFIDENCE_THRESHOLD=0.6
```

Copy names and placeholder guidance from `.env.example`; never commit the real `.env`.

## Recommendation configuration

Recommendation mode defaults to offline deterministic mocks when this value is absent:

```text
RECOMMENDATION_USE_MOCKS=true
```

Mock mode needs no Azure or Gemini connection. It generates readable example strategies and marks
worksheet PDFs unavailable, so local UI work never produces dead private-storage links.

Live mode reuses `GEMINI_API_KEY`, `GEMINI_MODEL_NAME`, `GEMINI_TIMEOUT_MS`, and
`GEMINI_MAX_RETRIES`. Set `RECOMMENDATION_USE_MOCKS=false` and supply exactly these Azure values:

```text
AZURE_STORAGE_ACCOUNT_NAME=<storage account name>
AZURE_STORAGE_CONTAINER_NAME=<private container name>
AZURE_KNOWLEDGE_MANIFEST_PATH=_manifests/gemini-canonical-markdown.jsonl
AZURE_STORAGE_SAS_TOKEN=<container SAS with read permission>
```

No storage key, connection string, tenant ID, client ID, Key Vault SDK, or Blob listing permission
is required. The manifests identify every private path. SAS values and constructed URLs stay
inside the server and are never logged or returned through `VITE_*` settings.

The recommendation engine loads the Markdown manifest once, fetches documents in batches of eight,
and ranks up to 12 documents with simple lexical matching. It independently joins the Blob upload
manifest to the resource catalogue and accepts only student/mixed PDF resources without answer
keys. The supplied vault currently yields 174 approved worksheets from 185 PDF records.

## Recommendation behavior

- `POST /api/students/:studentId/recommendations` uses all `ANALYSED` and `REVIEWED` samples,
  excludes dismissed errors, generates at most four strategies and three worksheets, then
  atomically replaces the student's previous report.
- `GET /api/students/:studentId/recommendations/latest` returns the report and computes whether new
  or changed evidence makes it outdated.
- `GET /api/worksheets/:worksheetId/file` resolves only an approved stable ID, verifies size,
  metadata, and the `%PDF-` signature, and proxies the private PDF with non-sniffable headers.

There are no sample-level recommendation routes or report history. The application is still a
single trusted super-user prototype with no authentication.

Then run:

```text
npm install
npm start
```

The client normally expects the API at `http://localhost:4000/api`.

## Scripts

```text
npm test
npm run lint
npm run format:check
npm run format
```

Tests use Node's built-in test runner and are stored in `test/`.

## Structure

- `server.js`: application setup and route mounting.
- `routes/`: URL definitions and multipart upload configuration.
- `controllers/`: HTTP handling and public response serialization.
- `services/errorClassificationEngine.js`: Gemini request, validation, retry, and background
  analysis behavior.
- `services/generateReport.js`: assembles reviewed student evidence without database writes.
- `services/RecommendationEngine.js`: mock/live recommendation decisions, Azure retrieval,
  approved worksheet catalogue, Gemini transport, and output validation.
- `models/`: Mongoose schemas.
- `middleware/errorHandler.js`: API error response formatting.
- `samples/`: local uploaded files; never use real student work as a test fixture.

See `AGENTS.md` for implementation constraints and the repository root `README.md` for client
setup.
