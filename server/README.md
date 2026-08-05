# LexiPath server

Express and Mongoose API for student records, uploaded writing samples, AI classification, and
educator review.

## Setup

Create `server/.env`:

```text
MONGODB_URI=<MongoDB connection string>
GEMINI_API_KEY=<Gemini API key>
PORT=4000
```

Optional AI settings:

```text
GEMINI_MODEL_NAME=<model name>
GEMINI_TIMEOUT_MS=<milliseconds>
GEMINI_MAX_RETRIES=<count>
GEMINI_RETRY_BASE_MS=<milliseconds>
ERROR_CONFIDENCE_THRESHOLD=<number from 0 to 1>
```

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
- `models/`: Mongoose schemas.
- `middleware/errorHandler.js`: API error response formatting.
- `samples/`: local uploaded files; never use real student work as a test fixture.

See `AGENTS.md` for implementation constraints and the repository root `README.md` for client
setup.
