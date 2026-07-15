# LexiPath Error-Recognition Handoff

## Purpose

This document explains the error-recognition work added on top of the original `origin/main` codebase (`70e0f87`). It is intended for teammates who need to maintain, present, or extend this part of the project.

The implementation deliberately remains an MVP:

- Gemini transcribes the work but does not classify errors.
- A deterministic local engine compares the transcription strings.
- The engine uses the `diff` package rather than a custom edit-distance algorithm.
- Intervention tracks are fixed placeholder routing rules, not a recommendation system.
- PDF support uses existing browser and Gemini capabilities without a separate PDF-processing pipeline.

## 1. Overall change

### Original flow

```text
Image upload
    -> Gemini analyses and categorises errors
    -> legacy errors[]
    -> review UI
```

Gemini was responsible for both reading the handwriting and deciding the error categories. The application accepted image files but not PDFs, and there was no deterministic Team 1-to-Team 2 handoff.

### Current flow

```text
JPG / PNG / WebP / PDF
          |
          v
POST /api/samples
          |
          v
Gemini transcription service (Team 1)
          |
          |  { raw_text, corrected_text }
          v
ErrorPatternAnalysisEngine (Team 2)
          |
          |  Diff.diffChars(raw_text, corrected_text)
          v
Structured ErrorPatternReport
          |
          v
MongoDB Sample document
          |
          v
React review screen
```

The responsibilities are now separated:

1. **Team 1 / VLM:** Read the document and return two strings.
2. **Team 2 / deterministic engine:** Compare those strings and classify the differences.
3. **MongoDB:** Persist the handoff and generated report.
4. **Frontend:** Show the original document, transcription, summary, and contextual word-level cards.

## 2. Files changed since the original codebase

Compared with `origin/main`, 14 files were added or modified:

```text
client/src/components/ImageViewer.jsx
client/src/components/ReviewScreen.jsx
client/src/components/UploadScreen.jsx
server/models/Sample.js
server/package.json
server/package-lock.json
server/routes/samples.js
server/services/ErrorPatternAnalysisEngine.js
server/services/gemini.js
server/services/geminiPrompt.js
server/test/ErrorPatternAnalysisEngine.test.js
server/test/Sample.test.js
server/test/geminiTranscription.test.js
server/test/uploadTypes.test.js
```

## 3. Recommended code ownership

Use this table if the original team responsibility split is still active.

| Responsibility | Suggested owner | Primary files | What the owner should be able to explain |
|---|---|---|---|
| Team 1 VLM handoff | Yong Ze / VLM owner | `server/services/geminiPrompt.js`, `server/services/gemini.js`, `server/test/geminiTranscription.test.js` | Why Gemini only transcribes, the strict two-field JSON contract, file-to-base64 handling, MIME selection, parsing, and retry behaviour. |
| Team 2 error engine | Somesh / engine owner | `server/services/ErrorPatternAnalysisEngine.js`, `server/test/ErrorPatternAnalysisEngine.test.js` | `diffChars` direction, index tracking, word expansion, sentence context, substitution consolidation, summary analytics, and dummy routing tracks. |
| MongoDB persistence | Aarushi / database owner | `server/models/Sample.js`, `server/test/Sample.test.js` | How `raw_text`, `corrected_text`, summary analytics, contextual errors, and tracks are embedded in a `Sample`. |
| Upload and PDF support | Michelle / upload owner | `client/src/components/UploadScreen.jsx`, upload section of `server/routes/samples.js`, `client/src/components/ImageViewer.jsx`, `server/test/uploadTypes.test.js` | MIME validation on both sides, multer storage, PDF selection, and browser PDF preview. |
| Report integration and presentation | Team 2 plus frontend owner | analysis route in `server/routes/samples.js`, `client/src/components/ReviewScreen.jsx` | How the two services are connected, when analysis starts, how reports are displayed, and why PDFs use a vertical layout. |
| Shared integration | Backend owner | `server/routes/samples.js` | End-to-end request lifecycle and sample status changes. |

### Shared-file rule

Two files cross ownership boundaries:

- `server/routes/samples.js` connects upload, Gemini, the engine, and MongoDB.
- `client/src/components/ReviewScreen.jsx` connects document preview, transcription, analytics, and report cards.

Changes to either file should be reviewed by both the relevant feature owner and the integration/frontend owner.

## 4. Current project structure

```text
ESC-Project-C3-T1/
├── client/
│   ├── src/
│   │   ├── api.js                         # HTTP calls and uploaded-file URL helper
│   │   ├── App.jsx                        # Top-level screen/state flow
│   │   ├── constants.js                   # Legacy categories and task labels
│   │   └── components/
│   │       ├── UploadScreen.jsx            # Image/PDF selection and upload form
│   │       ├── ImageViewer.jsx             # Zoomable image or embedded PDF preview
│   │       ├── ReviewScreen.jsx            # Transcription, summary, and report cards
│   │       ├── SamplesList.jsx             # Existing samples list
│   │       ├── SummaryPanel.jsx            # Legacy errors[] summary fallback
│   │       └── ErrorCard.jsx               # Legacy errors[] card fallback
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── config/
│   │   ├── config.js                       # Environment configuration
│   │   └── db.js                           # MongoDB connection
│   ├── models/
│   │   ├── Sample.js                       # Main sample and report schemas
│   │   └── Student.js                      # DAS ID record
│   ├── routes/
│   │   └── samples.js                      # Upload, analyse, review, and read routes
│   ├── services/
│   │   ├── geminiPrompt.js                 # Team 1 transcription prompt
│   │   ├── gemini.js                       # Gemini call and strict response parser
│   │   └── ErrorPatternAnalysisEngine.js   # Team 2 deterministic comparison
│   ├── test/
│   │   ├── ErrorPatternAnalysisEngine.test.js
│   │   ├── Sample.test.js
│   │   ├── geminiTranscription.test.js
│   │   └── uploadTypes.test.js
│   ├── .env.example                        # Safe placeholders only
│   └── package.json
└── docs/
    └── ERROR_RECOGNITION_HANDOFF.md         # This document
```

## 5. Team 1: Gemini transcription handoff

### `server/services/geminiPrompt.js`

This file defines the VLM's responsibility.

#### `TRANSCRIPTION_PROMPT`

Gemini is instructed to return exactly:

```json
{
  "raw_text": "the student's text exactly as written",
  "corrected_text": "the same text with basic spelling corrected"
}
```

Rules in the prompt:

- `raw_text` preserves mistakes, punctuation, capitalisation, line breaks, paragraph breaks, and visible spacing.
- `corrected_text` changes only basic spelling.
- Vocabulary and ideas must not be rewritten.
- Unreadable characters use `[?]` in both strings.
- Gemini must not return categories, Markdown, explanations, or extra fields.

#### `buildPromptWithAnswerKey(answerKey)`

For a closed exercise, the answer key is appended as reading context. The prompt explicitly says not to copy the answer key into the student's transcription.

The answer key is therefore an OCR aid, not a correction target.

### `server/services/gemini.js`

This file contains all Gemini API code.

#### `getGeminiClient()`

Creates the Google GenAI client lazily. This allows the application to start without a key and produce a readable error only when analysis is requested.

#### `getMimeType(imagePath)`

Maps file extensions to Gemini MIME types:

```text
.jpg/.jpeg -> image/jpeg
.png       -> image/png
.webp      -> image/webp
.pdf       -> application/pdf
```

#### `readImageAsBase64(imagePath)`

Reads the uploaded file and converts its bytes to base64 for Gemini's `inlineData` request format.

#### `callGeminiWithRetry(requestContents)`

Calls `models.generateContent` and retries rate-limit failures. Delays increase from 2 to 4 to 8 seconds. Non-rate-limit errors are returned immediately to the API route.

#### `parseTranscriptionResponse(rawText)`

This is the Team 1 contract gate. It:

1. Rejects empty output.
2. Removes accidental Markdown code fences.
3. Parses JSON.
4. Requires exactly two keys: `raw_text` and `corrected_text`.
5. Requires both values to be strings.
6. Rejects the previous category-based Gemini response.

#### `analyseImage(imagePath, answerKey)`

This is the public service function used by the route. It sends one request containing:

- The uploaded file as base64 `inlineData`.
- The transcription prompt as text.

It returns the parsed Team 1 handoff.

## 6. Team 2: ErrorPatternAnalysisEngine

### `server/services/ErrorPatternAnalysisEngine.js`

This is the main error-recognition implementation.

### Input

```js
buildErrorPatternReport(rawText, correctedText)
```

Example:

```js
buildErrorPatternReport(
  "Her face turned pail.",
  "Her face turned pale."
)
```

### `interventionTracks`

The tracks are intentionally hardcoded MVP routing data:

```js
phonological  -> TRK_1 / Phonics Review
orthographic  -> TRK_2 / Letter Accuracy Review
morphological -> TRK_4 / Word Structure Review
spelling      -> TRK_3 / Spelling Review
grammar       -> TRK_5 / Grammar Review
```

They are not a complete recommendation system.

### `isWordCharacter(character)`

Defines a word character as a Unicode letter, number, apostrophe, or hyphen. Unicode matching is important because the transcription may not be limited to ASCII.

### `findWord(text, index)`

Starts at an error index and scans left and right until it reaches the word boundaries. This expands a one-character diff into a useful UI comparison.

Instead of displaying:

```text
i
e
```

it can display:

```text
pail -> pale
```

If the difference is a non-word mark, the changed mark is retained so the two sides are not misleadingly identical:

```text
^sunny -> sunny
```

### `findSentence(text, index)`

Scans backward and forward to `.`, `!`, or `?` and returns the complete raw-text sentence containing the error.

Newlines are deliberately not treated as sentence boundaries because handwritten OCR often preserves visual line wrapping inside one sentence.

This is still simple substring logic, not an NLP sentence detector.

### `wordComparison(...)`

Uses the raw and corrected indexes to produce the card's display value:

```text
raw word -> corrected word
```

The implementation uses the Unicode arrow in returned JSON:

```text
raw word → corrected word
```

### `buildErrorPatternReport(rawText, correctedText)`

This is the engine's main function.

#### Step 1: normalise input

Non-string inputs become empty strings so the function is deterministic and does not crash.

#### Step 2: run `Diff.diffChars`

```js
const diffTokens = Diff.diffChars(raw, corrected)
```

Direction matters:

- `token.added` means the character exists in corrected text but not raw text: `phonological`.
- `token.removed` means the character exists in raw text but not corrected text: `orthographic`.
- Unchanged tokens are correct matches.

This is a primitive hardcoded split for the MVP. It keeps the report within the documented taxonomy; it does not infer a clinical category from linguistic context.

#### Step 3: maintain two indexes

```js
currentRawIndex
currentCorrectedIndex
```

Unchanged tokens advance both indexes. Removed tokens advance only the raw index. Added tokens advance only the corrected index.

The two indexes allow the engine to locate the corresponding whole word in both strings.

#### Step 4: consolidate substitutions

Immediately adjacent removed and added diff tokens are merged into one `spelling` error.

Multiple changes that resolve to the same word comparison and sentence are also consolidated. This handles cases such as:

```text
pail → pale
```

where `diffChars` may place a shared character between the removal and insertion.

#### Step 5: ignore whitespace-only differences

Gemini can preserve spacing differently between the raw and corrected strings. Whitespace-only diff tokens are skipped so layout changes do not create meaningless report cards.

#### Step 6: produce word-level contextual errors

Each final error contains:

```json
{
  "value": "pail → pale",
  "category": "spelling",
  "track": {
    "trackId": "TRK_3",
    "label": "Spelling Review"
  },
  "context_snippet": "Her face turned pail."
}
```

Correct matches are used for index movement but are not included in the returned `errors` array.

#### Step 7: calculate summary analytics

The report includes:

- `total_characters_analyzed`: length of `raw_text`.
- `total_errors`: number of consolidated error cards.
- `error_percentage`: consolidated errors divided by raw character count, formatted to one decimal place.
- `primary_prevention_track`: the track attached to the most frequent final category.

Current tie behaviour follows category order:

```text
phonological, orthographic, morphological, spelling, grammar
```

### Output contract

```json
{
  "summary": {
    "total_characters_analyzed": 21,
    "total_errors": 1,
    "error_percentage": "4.8%",
    "primary_prevention_track": {
      "trackId": "TRK_3",
      "label": "Spelling Review"
    }
  },
  "errors": [
    {
      "value": "pail → pale",
      "category": "spelling",
      "track": {
        "trackId": "TRK_3",
        "label": "Spelling Review"
      },
      "context_snippet": "Her face turned pail."
    }
  ]
}
```

### `ErrorPatternAnalysisEngine.analyse(...)`

This class method is a small wrapper around `buildErrorPatternReport`. It allows either a function-style or class-style integration without duplicating logic.

## 7. MongoDB persistence

### `server/models/Sample.js`

The original `Sample` model is retained and extended.

### Team 1 fields

```js
raw_text: String
corrected_text: String
```

### Team 2 report

```js
errorPatternReport: {
  summary: {
    total_characters_analyzed: Number,
    total_errors: Number,
    error_percentage: String,
    primary_prevention_track: {
      trackId: String,
      label: String
    } | null
  },
  errors: [
    {
      value: String,
      category: "phonological" |
                "orthographic" |
                "morphological" |
                "spelling" |
                "grammar",
      track: {
        trackId: String,
        label: String
      },
      context_snippet: String
    }
  ]
}
```

The legacy `errors` array remains in the model for compatibility with the original educator-review UI. New deterministic analyses set that array to `[]` and use `errorPatternReport`.

### Schema migration warning

The first engine version stored `errorPatternReport` directly as an array. The current version stores an object with `summary` and `errors`.

Old analysed records may need to be reanalysed or have the report recomputed from their stored `raw_text` and `corrected_text`.

After changing a Mongoose schema, fully restart the backend. A stale Node process can continue validating against the old schema and produce paths such as:

```text
errorPatternReport.0.value is required
```

## 8. Backend integration

### `server/routes/samples.js`

### Upload validation

Both client and server now accept:

```text
image/jpeg
image/png
image/webp
application/pdf
```

The backend still applies the existing 10 MB multer limit and safe filename handling.

`isSupportedUploadMimeType(mimeType)` is exported so upload acceptance can be tested without starting Express.

### Analysis route

`POST /api/samples/:id/analyse` now performs:

```js
const transcription = await analyseImage(
  sample.imagePath,
  sample.answerKey
)

sample.raw_text = transcription.raw_text
sample.corrected_text = transcription.corrected_text
sample.errorPatternReport = buildErrorPatternReport(
  transcription.raw_text,
  transcription.corrected_text
)
sample.errors = []
sample.status = "ANALYSED"
await sample.save()
```

This route is the explicit Team 1-to-Team 2 handoff.

### Status flow

```text
UPLOADED -> ANALYSED -> REVIEWED
```

The deterministic report is generated during the transition from `UPLOADED` to `ANALYSED`.

## 9. Frontend changes

### `client/src/components/UploadScreen.jsx`

Changes:

- Adds `application/pdf` to client-side validation.
- Adds PDF to the file input's `accept` value.
- Updates help and error text.
- Shows a PDF-selected placeholder instead of trying to render a PDF in an `<img>`.
- Keeps existing image preview behaviour.

The backend repeats MIME validation because browser-side validation is only a convenience and cannot be trusted for security.

### `client/src/components/ImageViewer.jsx`

Images retain the existing zoom and pan controls.

PDFs use a browser `<iframe>`:

```jsx
<iframe src={imageUrl} />
```

This avoids introducing a PDF rendering dependency. The browser's native PDF controls handle zooming and page navigation.

### `client/src/components/ReviewScreen.jsx`

This screen still:

- Fetches a sample.
- Automatically analyses an `UPLOADED` sample.
- Prevents duplicate Gemini calls in React Strict Mode.
- Handles retry and loading states.

It now also:

1. Detects the structured `errorPatternReport`.
2. Shows `raw_text` and `corrected_text` side by side.
3. Displays summary analytics.
4. Displays one card per consolidated error.
5. Shows the whole-word comparison, readable category, target track, and sentence context.
6. Retains a fallback for the original array-based report and legacy `errors` UI.

#### Layout

For image uploads on large screens:

```text
image preview | report
```

For PDF uploads:

```text
PDF preview
report
```

The PDF is not sticky because a full-width embedded document and report need to scroll vertically without overlap.

## 10. Tests

### `server/test/ErrorPatternAnalysisEngine.test.js`

Covers:

- Omission errors.
- Addition errors.
- Adjacent substitutions.
- Multi-change substitutions within one word.
- Whole-word display values.
- Complete sentence context.
- OCR line breaks inside sentences.
- Whitespace-only filtering.
- Non-word marks.
- Error-free input.

### `server/test/Sample.test.js`

Validates that MongoDB can store the Team 1 handoff and the structured report, including the `spelling` label and `TRK_3`.

### `server/test/geminiTranscription.test.js`

Covers:

- The transcription-only prompt.
- Answer-key context rules.
- Strict two-field parsing.
- Rejection of missing fields and extra fields.

### `server/test/uploadTypes.test.js`

Confirms that JPG, PNG, WebP, and PDF are accepted and unrelated MIME types are rejected.

## 11. Dependencies and configuration

### Added dependency

```json
"diff": "^9.0.0"
```

### Server scripts

```bash
npm run dev
npm start
npm test
```

### Required local environment

Create `server/.env` from `server/.env.example`:

```env
GEMINI_API_KEY=your-local-key
GEMINI_MODEL=gemini-3-flash-preview
MONGODB_URI=mongodb://127.0.0.1:27017/lexipath
PORT=5000
```

`server/.env` is ignored by Git. Never place a real key in source code, documentation, `.env.example`, commits, screenshots, or chat messages.

## 12. Running and verification

Backend:

```bash
cd server
npm install
npm test
npm run dev
```

Frontend:

```bash
cd client
npm install
npm run lint
npm run build
npm run dev
```

Health check:

```bash
curl http://127.0.0.1:5000/api/health
```

Expected response:

```json
{
  "status": "ok",
  "message": "LexiPath server is running."
}
```

## 13. Known limitations

1. **Gemini remains probabilistic.** Reanalysing the same page can produce slightly different transcription text.
2. **The engine trusts the handoff.** Incorrect raw or corrected transcription creates incorrect deterministic differences.
3. **Sentence detection is deliberately simple.** It uses `.`, `!`, and `?`, not an NLP library.
4. **The percentage is card-based.** `total_errors / raw_text.length` uses consolidated report cards, not the number of incorrect characters.
5. **Tracks are placeholders.** They satisfy primitive routing but are not pedagogical recommendations.
6. **Crossed-out text can appear as marks.** For example, `^sunny → sunny` remains visible rather than being silently discarded.
7. **Legacy review code remains.** `errors`, `SummaryPanel`, and `ErrorCard` still support records from the original architecture.
8. **Existing records are not automatically migrated.** Recompute reports when the report schema or algorithm changes.
9. **A backend restart may be required after schema changes.** Do not rely only on the file watcher for Mongoose model updates.

## 14. Safe extension points

Good next changes that preserve the current architecture:

- Add educator confirmation/dismissal fields to `errorPatternReport.errors`.
- Add an explicit report schema version for future migrations.
- Add a recompute endpoint that does not call Gemini again.
- Add clearer category colours for omission, addition, and substitution.
- Store the raw and corrected word in separate fields while keeping `value` as a display string.
- Add unit tests for multilingual words and apostrophes.

Avoid putting the following back into Gemini:

- Error classification.
- Track selection.
- Summary calculation.

Those outputs should remain deterministic and testable in `ErrorPatternAnalysisEngine.js`.

## 15. Short presentation summary

> We separated handwriting recognition from error recognition. Gemini now returns only an exact transcription and a minimally corrected version. A local deterministic engine compares them with `Diff.diffChars`, expands character changes into whole-word comparisons, consolidates substitutions, attaches simple placeholder tracks, calculates summary analytics, and stores the structured report in MongoDB. The frontend supports images and PDFs and displays the document, transcription, summary, and contextual error cards for educator review.
