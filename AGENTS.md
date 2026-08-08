# LexiPath repository instructions

These instructions apply to the entire repository. More specific guidance lives in
`client/AGENTS.md` and `server/AGENTS.md` and takes precedence inside those directories.

## Product context

LexiPath helps educators review spelling and literacy errors in children's handwritten work.
An educator uploads one or more pages, Gemini proposes error classifications, and the educator
reviews, reclassifies, or dismisses each result. Trends and recommendations build on reviewed
data.

Protect these product invariants:

- Preserve the child's `written` text exactly. Never silently correct or paraphrase it.
- Dismiss errors by setting `dismissed: true`; do not delete them from `errors[]`.
- Never expose raw scan filesystem paths to the client.
- Treat uploaded scans and student information as sensitive data. Do not print, copy, commit, or
  inspect their contents unless the task specifically requires it.
- The fixed error categories are defined by `ERROR_CATEGORIES` in `server/models/sample.js`.

## Repository structure

This is not an npm workspace. Run commands from the package they belong to:

- `client/`: Vite, React, and React Router SPA.
- `server/`: Express, Mongoose, MongoDB, and Gemini integration.
- `lexipath_brand_assets_v2/`: approved logos and brand tokens.

Reference artifacts at the root include `paths.txt`, the wireframes, API-route documentation,
the class diagram, and work-allocation material. They describe the original design and can be
stale. When documentation and running code disagree, confirm the intended behavior and update
the relevant documentation with the implementation.

## Working conventions

- Read the closest `AGENTS.md` before changing files in `client/` or `server/`.
- Keep changes within the user's requested scope and preserve unrelated working-tree changes.
- Search with `rg` or `rg --files` before assuming a file or pattern does not exist.
- Follow existing ES module syntax and local formatting conventions.
- Prefer small, focused changes. Do not add dependencies unless the task needs one.
- Do not edit generated output, dependency directories, `.env` files, or uploaded files.
- Never include secrets from `client/.env.local` or `server/.env` in output, tests, or commits.
- When behavior changes, add or update the narrowest useful test.
- Run the package's lint/check commands after changes and report what was actually run.

## Sources of truth

- UI and visual behavior: `client/DESIGN.md`, then the approved brand kit.
- Server data constraints: Mongoose schemas and their inline comments.
- Client/server response shapes: controller serializers and `client/src/lib/api.js`.
- Implemented routes: Express router files. Do not rely on `paths.txt` alone.

## Current product boundaries

- Upload, analysis, and review are implemented end to end.
- Authentication is not implemented; routes are currently public.
- Error trends and student-level recommendations are implemented end to end.
- Recommendations combine every `ANALYSED` and `REVIEWED` sample, exclude dismissed errors, and
  retain only one latest report per student.
- Recommendation worksheets are selected from the approved Azure catalogue and opened through a
  server proxy; Blob paths, SAS values, and signed URLs never belong in client data.
- There are no sample-level recommendation routes and no authentication layer. The legacy
  `/api/recommendation` stub remains available only for compatibility.
