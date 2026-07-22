# API-client conventions

How `client/src/api.js` is built, so every feature owner adding a new
endpoint call follows the same shape instead of everyone inventing their own.

## The pattern

Every function in `api.js` is a thin wrapper around one backend endpoint,
and all of them go through the same `requestJson(path, options)` helper.
That helper does three things:

1. Prefixes the path with `/api` and calls `fetch`.
2. Tries to parse the response body as JSON, even on failure - the backend
   always replies with `{ message: "..." }` when something goes wrong.
3. If `response.ok` is false, throws a plain `Error` whose `.message` is
   that human-readable string (or a generic fallback if the body had none).

So every screen component gets to write:

```js
try {
  const sample = await fetchSample(sampleId)
} catch (error) {
  setProblemMessage(error.message) // always safe to show directly
}
```

with no per-call status-code handling, ever.

## Adding a new endpoint call

1. Add one function to `api.js`, named after what it does
   (`fetchX` / `createX` / `saveX`), not after the HTTP verb.
2. Call `requestJson`, don't call `fetch` directly - that's how every
   caller gets consistent error handling for free.
3. JSON bodies: pass `headers: { 'Content-Type': 'application/json' }` and
   `body: JSON.stringify(payload)`. File uploads: pass a `FormData` body and
   no headers (the browser sets the multipart boundary itself) - see
   `uploadSample`.
4. Keep the function one level of abstraction: it shapes the request and
   returns the parsed response. Any UI-facing formatting (dates, labels)
   belongs in the component or in `constants.js`, not here.

## Where things live

- `api.js` - every backend call, all through `requestJson`. Shared across
  feature screens; if two people need to add calls at the same time, that's
  a merge, not a redesign.
- `constants.js` - the app's fixed vocabulary (categories, statuses, task
  types) and small pure formatting helpers like `taskTypeLabel`.
- `theme/` - design tokens (colours, shared Tailwind class recipes) so
  screens don't each re-derive the same button/card styling.
