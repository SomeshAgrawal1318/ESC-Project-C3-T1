// src/components/ProblemNotice.jsx
// ---------------------------------
// A calm, readable panel for when something goes wrong - never a raw error
// dump. It shows the human-readable message from the backend and, when a
// retry makes sense, a "Try again" button.
//
// (Named ProblemNotice rather than "Error..." so it is never confused with
// the spelling errors the app is actually about.)

import { TriangleAlert, RotateCcw } from 'lucide-react'

function ProblemNotice({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-8 text-center"
    >
      <TriangleAlert size={30} aria-hidden="true" className="text-amber-600" />
      <p className="max-w-prose text-stone-700">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-medium text-white transition-colors hover:bg-primary-dark"
        >
          <RotateCcw size={16} aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  )
}

export default ProblemNotice
