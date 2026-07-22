# Decisions log

One line per scoping/design decision, logged the same day by whoever made it.

- Local MongoDB (brew service, already running on dev machines) instead of a
  shared Atlas cluster for now — avoids distributing cloud credentials at
  prototype scale; every dev's `MONGODB_URI` defaults to
  `mongodb://127.0.0.1:27017/lexipath` — 18/7, Aarushi
- Kept `Sample.errors` embedded rather than splitting into separate
  `SampleReport`/`DetectedError` collections as shown in domain class diagram
  v2 — the schema froze 17/7 and is already integrated with the Gemini engine
  and `routes/samples.js`; restructuring now needs a reviewed PR with every
  affected owner's sign-off, not a silent edit — 18/7, Aarushi
- `Student` intentionally has no `name` field (DAS ID / `externalRef` only),
  which diverges from domain class diagram v2's `Student.name` — PDPA
  anonymisation is a hard requirement (see README Privacy section) and takes
  priority over the diagram — 18/7, Aarushi
