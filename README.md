# LexiPath

LexiPath is an educator-facing tool for reviewing spelling and literacy errors detected in
children's handwritten work. Educators upload one or more pages, an AI analysis proposes error
categories, and the review screen keeps the scan beside the proposed errors for human checking.

## Project layout

- `client/` — React 19 SPA built with Vite.
- `server/` — Express 5 API backed by MongoDB through Mongoose.
- `lexipath_brand_assets_v2/` — approved logo files and brand tokens.
- `client/DESIGN.md` — authoritative UI design guidance.
- `AGENTS.md` — repository guidance for Codex and other coding agents.

The client and server are separate npm packages, not npm workspaces.

## Local development

Create local environment files without committing them:

`server/.env`:

```text
MONGODB_URI=<MongoDB connection string>
GEMINI_API_KEY=<Gemini API key>
JWT_SECRET=<any long random string — required, login throws without it>
PORT=5000
```

`client/.env.local`:

```text
VITE_API_URL=http://localhost:5000/api
```

See `SETUP_GUIDE.md` at the repo root for the full list of environment variables
(Resend, Azure, recommendation-engine settings, etc.), seeding demo data, and running
the test suites.

Install and start each package in its own terminal:

```text
cd server
npm install
npm start
```

```text
cd client
npm install
npm run dev
```

## Verification

```text
cd server
npm test
npm run lint
```

```text
cd client
npm run lint
npm run build
```

Do not commit uploaded student scans or environment files.
