// Minimal client-side "who's signed in" state, persisted to localStorage so
// it survives a reload. RequireAuth.jsx reads getSession() to gate every
// route except /login, /forgot-password and /reset-password/:token — but
// that's a client-side navigation gate only, not real API security (the
// server accepts every request whether or not the caller has a session; see
// server/README.md's Authentication section). Pages that want to show who's
// logged in (the sidebar, the account page) also read this directly.

const KEY = 'lexipath.session';

export function saveSession(account) {
  localStorage.setItem(KEY, JSON.stringify(account));
}

export function getSession() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
