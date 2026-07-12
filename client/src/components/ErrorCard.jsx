// src/components/ErrorCard.jsx
// -----------------------------
// One card per flagged error: the word as the child wrote it (prominent,
// and NEVER auto-corrected), an arrow to the AI's guess at the intended
// word, the category badge, and the plain-language note.
//
// The two controls are the educator's human-in-the-loop powers:
//   - "Not an error" dismisses a false alarm (the card greys out rather
//     than vanishing, so the decision is visible and reversible)
//   - the pencil corrects the AI's "intended" guess

import { useState } from 'react'
import { ArrowRight, Ban, Undo2, Pencil, Check, X } from 'lucide-react'
import CategoryBadge from './CategoryBadge.jsx'

function ErrorCard({ error, onToggleDismissed, onChangeIntended }) {
  const [isEditingIntended, setIsEditingIntended] = useState(false)
  const [intendedDraft, setIntendedDraft] = useState(error.intended)

  function startEditing() {
    setIntendedDraft(error.intended)
    setIsEditingIntended(true)
  }

  function saveIntended() {
    setIsEditingIntended(false)
    if (intendedDraft.trim() !== error.intended) {
      onChangeIntended(intendedDraft.trim())
    }
  }

  function cancelEditing() {
    setIsEditingIntended(false)
    setIntendedDraft(error.intended)
  }

  const smallButtonClasses =
    'flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3 py-1 text-sm font-medium text-stone-600 transition-colors hover:border-primary hover:text-primary'

  return (
    <article
      className={`rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition-opacity ${
        error.dismissed ? 'opacity-50' : ''
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* The child's word, exactly as written. The quotes make clear this
            is a verbatim reading, not our spelling. */}
        <span className="text-xl font-semibold text-stone-900">
          “{error.written}”
        </span>

        <ArrowRight size={18} aria-hidden="true" className="text-stone-400" />

        {isEditingIntended ? (
          <span className="flex items-center gap-1.5">
            <label htmlFor={`intended-edit-${error.written}`} className="sr-only">
              Corrected intended word
            </label>
            <input
              id={`intended-edit-${error.written}`}
              type="text"
              value={intendedDraft}
              onChange={(event) => setIntendedDraft(event.target.value)}
              className="w-36 rounded-lg border border-stone-300 px-2 py-1 text-stone-800"
              autoFocus
            />
            <button
              type="button"
              onClick={saveIntended}
              aria-label="Save the corrected intended word"
              className="rounded-full p-1.5 text-primary hover:bg-primary-soft"
            >
              <Check size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              aria-label="Cancel editing"
              className="rounded-full p-1.5 text-stone-500 hover:bg-stone-100"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </span>
        ) : (
          <span className="text-xl text-stone-700">{error.intended || '?'}</span>
        )}

        <CategoryBadge category={error.category} />

        {error.dismissed && (
          <span className="rounded-full bg-stone-200 px-3 py-0.5 text-sm font-medium text-stone-600">
            Dismissed
          </span>
        )}
      </div>

      {error.note && <p className="mt-2 text-sm text-stone-600">{error.note}</p>}

      <div className="mt-3 flex flex-wrap gap-2 print:hidden">
        {error.dismissed ? (
          <button
            type="button"
            onClick={onToggleDismissed}
            className={smallButtonClasses}
          >
            <Undo2 size={15} aria-hidden="true" />
            Restore this error
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onToggleDismissed}
              className={smallButtonClasses}
            >
              <Ban size={15} aria-hidden="true" />
              Not an error
            </button>
            {!isEditingIntended && (
              <button
                type="button"
                onClick={startEditing}
                className={smallButtonClasses}
              >
                <Pencil size={15} aria-hidden="true" />
                Correct the intended word
              </button>
            )}
          </>
        )}
      </div>
    </article>
  )
}

export default ErrorCard
