// src/components/CategoryBadge.jsx
// ---------------------------------
// The coloured pill that names an error category. Used on every error card,
// in the summary panel, and in the filter row - always the same colours, so
// the categories become instantly recognisable.
//
// Accessibility rule: the badge ALWAYS shows its text label. The colour is
// a helpful extra, never the only signal.

import { CATEGORY_DETAILS } from '../constants.js'

function CategoryBadge({ category, count }) {
  // Fall back to "unsure" styling if an unknown category ever appears.
  const details = CATEGORY_DETAILS[category] || CATEGORY_DETAILS.unsure

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-sm font-medium ${details.badgeClasses}`}
    >
      {details.label}
      {typeof count === 'number' && (
        <span className="font-semibold">{count}</span>
      )}
    </span>
  )
}

export default CategoryBadge
