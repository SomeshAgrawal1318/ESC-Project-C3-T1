// Minimal client-side "who's signed in" state, persisted to localStorage so
// it survives a reload. This is NOT auth gating — every route still works
// without it (see LoginPage.jsx's header comment) — it only exists so pages
// that want to show who's logged in (the sidebar, the account page) have
// something to read after a successful sign-in.

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
