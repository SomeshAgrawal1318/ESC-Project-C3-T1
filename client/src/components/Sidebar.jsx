// The app shell's persistent sidebar: brand, navigation, and the signed-in
// therapist. Present on every screen.
//
// The identity block reads lib/session.js (set by LoginPage on a successful
// sign-in). Nothing gates the app behind login, so someone can still be
// browsing signed out — the placeholder below covers that case rather than
// assuming a session always exists.

import { NavLink } from 'react-router-dom';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';
import { getSession } from '../lib/session.js';

const PLACEHOLDER = { name: 'Not signed in', role: 'Guest', initials: '?' };

function initials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function Sidebar() {
  const session = getSession();
  const identity = session
    ? {
        name: session.name || session.username,
        role: session.role || 'Signed in',
        initials: initials(session.name || session.username),
      }
    : PLACEHOLDER;

  return (
    <aside className="sidebar">
      <div className="brand">
        <Logo size={28} variant="light" className="brand__mark" />
        <span className="brand__name">LexiPath</span>
      </div>

      <nav className="nav" aria-label="Main">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `nav__item${isActive ? ' nav__item--active' : ''}`
          }
        >
          <Icon name="students" size={19} />
          My students
        </NavLink>
      </nav>

      <NavLink to="/account" className="therapist">
        <span className="therapist__avatar" aria-hidden="true">
          {identity.initials}
        </span>
        <span className="therapist__meta">
          <span className="therapist__name">{identity.name}</span>
          <span className="therapist__role">{identity.role}</span>
        </span>
      </NavLink>
    </aside>
  );
}
