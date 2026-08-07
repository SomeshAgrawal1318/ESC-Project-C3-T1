// right-hand panel: category filter chips with counts, then the
// (non-dismissed) errors grouped under a heading per category

import { useMemo, useState } from 'react';
import ErrorCard from './ErrorCard.jsx';
import CategoryChip from './CategoryChip.jsx';
import { categoryFor, CATEGORY_ORDER } from '../lib/category.js';

export default function ErrorCardList({
  errors,
  statistics,
  selectedErrorId,
  onSelect,
  onReclassify,
  onRemove,
  onConfirm,
}) {
  const [activeFilter, setActiveFilter] = useState(null); // null = all categories

  const visible = useMemo(() => {
    const active = errors.filter((e) => !e.dismissed);
    return activeFilter ? active.filter((e) => e.category === activeFilter) : active;
  }, [errors, activeFilter]);

  const groups = useMemo(() => {
    const byCategory = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, []]));
    for (const error of visible) byCategory[error.category].push(error);
    return CATEGORY_ORDER.map((category) => ({ category, errors: byCategory[category] })).filter(
      (g) => g.errors.length > 0,
    );
  }, [visible]);

  return (
    <div className="err-list">
      <div className="err-list__filters" role="group" aria-label="Filter by category">
        {CATEGORY_ORDER.map((category) => {
          const count = statistics?.categoryCounts[category] || 0;
          if (count === 0) return null;
          return (
            <CategoryChip
              key={category}
              category={category}
              count={count}
              active={activeFilter === category}
              onClick={() => setActiveFilter((f) => (f === category ? null : category))}
            />
          );
        })}
      </div>

      <div className="err-list__scroll">
        {groups.map((group) => (
          <section key={group.category} className="err-group" aria-label={categoryFor(group.category).label}>
            <h3 className="err-group__heading">
              {categoryFor(group.category).label} — {group.errors.length}{' '}
              {group.errors.length === 1 ? 'error' : 'errors'}
            </h3>
            {group.errors.map((error) => (
              <ErrorCard
                key={error.errorId}
                error={error}
                isSelected={error.errorId === selectedErrorId}
                onSelect={onSelect}
                onReclassify={onReclassify}
                onRemove={onRemove}
                onConfirm={onConfirm}
              />
            ))}
          </section>
        ))}
        {groups.length === 0 && (
          <p className="err-list__empty">No errors match this filter.</p>
        )}
      </div>
    </div>
  );
}