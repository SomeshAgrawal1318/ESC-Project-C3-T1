// RequireAuth is the layout-route guard main.jsx wraps every non-auth route
// in: no session redirects to /login, a session lets the wrapped route render.

import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

let sessionValue;
mock.module('../src/lib/session.js', {
  namedExports: {
    getSession: () => sessionValue,
  },
});

const { default: RequireAuth } = await import('../src/components/RequireAuth.jsx');

afterEach(cleanup);

function renderGuarded(initialPath = '/students/s1') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<p>Sign in screen</p>} />
        <Route element={<RequireAuth />}>
          <Route path="/students/:studentId" element={<p>Protected student profile</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

test('redirects to /login when there is no session', () => {
  sessionValue = null;
  renderGuarded();

  assert.ok(screen.getByText('Sign in screen'));
  assert.equal(screen.queryByText('Protected student profile'), null);
});

test('renders the protected route once a session exists', () => {
  sessionValue = { username: 'Sandy@DAS', name: 'Sandy Lim' };
  renderGuarded();

  assert.ok(screen.getByText('Protected student profile'));
  assert.equal(screen.queryByText('Sign in screen'), null);
});
