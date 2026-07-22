# AI declaration

One entry per Claude Code session, logged by whoever ran it.

## 18/7 — Aarushi — F0 Foundation

**Prompt/scope:** F0 ownership per the sprint plan — local MongoDB setup,
`server/.env` (not committed), `scripts/seed.js`, `client/src/theme/`,
`client/src/pages/StudentProfile.jsx`, API-client conventions doc.

**Files touched:**
- `server/scripts/seed.js` (new) — dev seed data
- `server/package.json` — added `npm run seed`
- `client/src/theme/colors.js`, `classNames.js`, `index.js` (new)
- `client/src/pages/StudentProfile.jsx` (new)
- `client/src/App.jsx` — added the `profile` screen
- `client/src/components/Header.jsx` — added the "Students" nav button
- `docs/api-conventions.md`, `docs/decisions-log.md` (new)
- `server/.env` (new, local only — gitignored, never committed)

**Reviewed against the sequence/class diagrams before committing:** yes —
found that the domain class diagram's `Student.name` and split
`SampleReport`/`DetectedError` collections diverge from the already-frozen,
already-integrated schema. Deliberately did not change the schema to match;
see `docs/decisions-log.md` for why.
