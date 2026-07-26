// A category label, rendered either as a static tag (on an error card) or
// as a clickable filter with a count (the review screen's category rail).
// One component so the two never drift apart visually.

import { categoryFor } from '../lib/category.js';

export default function CategoryChip({ category, count, active, onClick }) {
  const { label } = categoryFor(category);
  const interactive = typeof onClick === 'function';

  const className = `cat-chip${active ? ' cat-chip--active' : ''}${
    interactive ? ' cat-chip--interactive' : ''
  }`;

  const content = (
    <>
      {label}
      {typeof count === 'number' && <b className="cat-chip__count">{count}</b>}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        className={className}
        onClick={onClick}
        aria-pressed={active}
      >
        {content}
      </button>
    );
  }

  return <span className={className}>{content}</span>;
}
