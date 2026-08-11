# LexiPath client

React and Vite frontend for managing students, uploading writing samples, reviewing
AI-classified literacy errors beside the original scan, and opening grounded intervention
worksheets.

## Setup

Create `client/.env.local`:

```text
VITE_API_URL=http://localhost:5000/api
```

Then run:

```text
npm install
npm run dev
```

The API server should normally be running on port `5000`. `vite.config.js` also proxies
`/api` requests to `http://localhost:5000` in dev, so this would work without
`VITE_API_URL` set at all — but setting it explicitly, as above, is what's actually
configured locally and is the more reliable path. See the repo root's `SETUP_GUIDE.md`
for the full setup walkthrough.

## Scripts

```text
npm run dev
npm run build
npm run lint
npm run format:check
npm run format
npm run preview
```

## Structure

- `src/main.jsx`: route definitions.
- `src/App.jsx`: persistent application shell.
- `src/pages/`: routed screens.
- `src/components/`: shared UI components.
- `src/lib/api.js`: client API boundary.
- `src/lib/status.js` and `src/lib/categories.js`: display rules for backend values.
- `src/index.css` and `src/App.css`: design tokens and application styles.
- `/styleguide`: rendered component and design-system reference.

Read `DESIGN.md` before changing UI and `AGENTS.md` before changing client code. Pages should use
`src/lib/api.js` rather than calling `fetch()` directly.

All Gemini, MongoDB, Azure, and SAS credentials belong in the server's ignored environment file.
Never expose them through `VITE_*` variables.

## Recommendations

The student recommendations route displays reviewed evidence, intervention strategies, and
approved worksheets. Worksheet links send only a stable ID to `/api/worksheets/:worksheetId/file`;
the browser never receives an Azure SAS token or signed Blob URL.
