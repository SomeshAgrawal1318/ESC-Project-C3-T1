// Entry screen (GET /api/students): the therapist's caseload. Pick a
// student to land on their profile (1a / 1b). The search box filters the
// grid client-side as you type — no server round-trip needed at this
// caseload size.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStudents } from '../lib/api.js';
import Icon from '../components/Icon.jsx';

export default function StudentsListPage() {
  const [state, setState] = useState({ status: 'loading' });
  const [query, setQuery] = useState('');

  useEffect(() => {
    let live = true;
    getStudents()
      .then((students) => live && setState({ status: 'ready', students }))
      .catch(
        (err) => live && setState({ status: 'error', message: err.message }),
      );
    return () => {
      live = false;
    };
  }, []);

  const visibleStudents =
    state.status === 'ready' ? filterByName(state.students, query) : [];

  return (
    <div className="students">
      {/* Page header pattern: eyebrow → title → sub, search on the right */}
      <header className="students__head">
        <div className="students__id">
          <span className="eyebrow">Caseload</span>
          <h1 className="students__title">My students</h1>
          <p className="students__sub">
            Choose a student to open their profile.
          </p>
        </div>

        <div className="search">
          <Icon name="search" size={17} />
          <input
            className="search__input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search students by name…"
            aria-label="Search students by name"
          />
        </div>
      </header>

      {state.status === 'loading' && (
        <div className="students__grid" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skel skel--card" />
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <p className="feedback__text feedback--error">{state.message}</p>
      )}

      {state.status === 'ready' &&
        (visibleStudents.length > 0 ? (
          <div className="students__grid">
            {visibleStudents.map((student) => (
              <Link
                key={student.studentId}
                to={`/students/${student.studentId}`}
                className="student-card"
              >
                <span className="student-card__avatar" aria-hidden="true">
                  {initials(student.name)}
                </span>
                <span className="student-card__body">
                  <span className="student-card__name">{student.name}</span>
                  <span className="student-card__grade">
                    {student.currentGrade}
                  </span>
                </span>
                <Icon name="arrow" size={20} className="student-card__go" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="students__sub">
            No students match “{query}”. Clear the search to see the full
            caseload.
          </p>
        ))}
    </div>
  );
}

function filterByName(students, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return students;
  return students.filter((s) => s.name.toLowerCase().includes(needle));
}

function initials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
