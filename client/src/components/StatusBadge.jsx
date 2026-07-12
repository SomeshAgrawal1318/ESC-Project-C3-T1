// src/components/StatusBadge.jsx
// -------------------------------
// A small pill showing how far through the flow a sample is:
// Uploaded -> Analysed -> Reviewed.

import { STATUS_DETAILS } from '../constants.js'

function StatusBadge({ status }) {
  const details = STATUS_DETAILS[status] || {
    label: status,
    badgeClasses: 'bg-stone-100 text-stone-700 border-stone-300',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-0.5 text-sm font-medium ${details.badgeClasses}`}
    >
      {details.label}
    </span>
  )
}

export default StatusBadge
