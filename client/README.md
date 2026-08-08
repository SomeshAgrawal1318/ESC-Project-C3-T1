# LexiPath client

React and Vite frontend for managing students, uploading writing samples, reviewing
AI-classified literacy errors beside the original scan, viewing trends, and generating
student-level intervention recommendations.

## Setup

Create `client/.env.local`:

```text
VITE_API_URL=http://localhost:4000/api
```

Then run:

```text
npm install
npm run dev
```

The API server should normally be running on port `4000`. There is no Vite proxy; the client
uses `VITE_API_URL` directly.

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

## Recommendations screen

`/students/:studentId/recommendations` loads the student and optional latest report together. The
educator can generate or refresh the report; a failed refresh keeps the existing report visible.
Outdated reports are identified by the server when analysed evidence changes.

Each strategy shows its target categories, exact reviewed `written` examples, and approved
worksheets. Live PDF actions contain only a stable worksheet ID and open through the server proxy.
Mock worksheets clearly say that the PDF is unavailable and do not render a dead link. No Azure
configuration or private value belongs in the client environment.
