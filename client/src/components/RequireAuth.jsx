// Layout-route guard: sits above the app shell in main.jsx so every screen
// under it requires a session. Not real security (see lib/session.js) — the
// API stays unauthenticated — this only decides what the browser lets you
// navigate to (see server/README.md's Authentication section).
//
// Remembers where the visitor was headed (state.from) so LoginPage.jsx can
// send them back there instead of always landing on the caseload.

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getSession } from '../lib/session.js';

export default function RequireAuth() {
  const location = useLocation();

  if (!getSession()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
