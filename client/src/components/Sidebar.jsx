// The app shell's persistent sidebar: brand, reading-comfort toggle,
// navigation, and the signed-in therapist. Present on every screen.
// (No auth yet — the therapist here is a placeholder; see paths.txt.)

import { NavLink } from 'react-router-dom';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';
import ComfortToggle from './ComfortToggle.jsx';

const THERAPIST = { name: 'Ms. Tan', role: 'Therapist', initials: 'MT' };

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <Logo size={28} variant="light" className="brand__mark" />
        <span className="brand__name">LexiPath</span>
      </div>

      <ComfortToggle />

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

      <div className="therapist">
        <span className="therapist__avatar" aria-hidden="true">
          {THERAPIST.initials}
        </span>
        <span className="therapist__meta">
          <span className="therapist__name">{THERAPIST.name}</span>
          <span className="therapist__role">{THERAPIST.role}</span>
        </span>
      </div>
    </aside>
  );
}
