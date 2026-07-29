# LexiPath client

React 19 and Vite educator interface for reviewing student writing samples,
inspecting error patterns, and opening grounded intervention worksheets.

## Setup

```bash
npm install
npm run dev
```

Create an ignored `client/.env` containing the public API origin:

```dotenv
VITE_API_URL=http://localhost:4000/api
```

All Gemini, MongoDB, Azure, and SAS credentials belong in the server's ignored
environment file. Never expose them through `VITE_*` variables.

## Recommendations

The student recommendations route displays reviewed evidence, intervention
strategies, and approved worksheets. Worksheet links send only a stable ID to
`/api/worksheets/:worksheetId/file`; the browser never receives an Azure SAS
token or signed Blob URL.

## Verification

```bash
npm run lint
npm run build
```

`DESIGN.md` is the authoritative visual specification for UI changes.
