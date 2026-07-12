// src/components/SummaryPanel.jsx
// --------------------------------
// The at-a-glance summary at the top of the review screen: how many errors
// fell into each category (as the usual coloured badges, with counts), plus
// one plain-language sentence describing the overall pattern.
//
// Dismissed errors are left out of the counts - the summary should describe
// what the EDUCATOR currently agrees is real, not the AI's raw output.

import { CATEGORY_ORDER, CATEGORY_DETAILS } from '../constants.js'
import CategoryBadge from './CategoryBadge.jsx'

// One warm, plain-language ending per category, completing the sentence
// "Most mistakes were phonological — ...".
const PATTERN_DESCRIPTIONS = {
  phonological: 'this child tends to spell words the way they sound.',
  orthographic: 'this child tends to write letters in the wrong order or form.',
  morphological: 'this child mostly needs support with word endings and prefixes.',
  capitalisation: 'this child mostly needs support with capital letters.',
  punctuation: 'this child mostly needs support with punctuation.',
  unsure: 'the AI was unsure how to classify most of them — worth a close look.',
}

function countByCategory(activeErrors) {
  const counts = {}
  for (const error of activeErrors) {
    counts[error.category] = (counts[error.category] || 0) + 1
  }
  return counts
}

function buildSummarySentence(activeErrors, counts) {
  const total = activeErrors.length

  if (total === 0) {
    return 'No mistakes are currently flagged for this sample.'
  }

  // Find the category with the most errors (first in display order wins a tie).
  let topCategory = null
  let topCount = 0
  for (const category of CATEGORY_ORDER) {
    if ((counts[category] || 0) > topCount) {
      topCategory = category
      topCount = counts[category]
    }
  }

  const description = PATTERN_DESCRIPTIONS[topCategory]
  const label = CATEGORY_DETAILS[topCategory].label.toLowerCase()

  if (total === 1) {
    return `The one mistake flagged was ${label} — ${description}`
  }
  if (topCount === total) {
    return `All ${total} mistakes were ${label} — ${description}`
  }
  return `Most mistakes (${topCount} of ${total}) were ${label} — ${description}`
}

function SummaryPanel({ errors }) {
  const activeErrors = errors.filter((error) => !error.dismissed)
  const dismissedCount = errors.length - activeErrors.length
  const counts = countByCategory(activeErrors)

  return (
    <section
      aria-label="Summary of flagged errors"
      className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
    >
      <h2 className="mb-3 text-lg font-semibold text-stone-900">Summary</h2>

      {activeErrors.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {CATEGORY_ORDER.map((category) =>
            counts[category] ? (
              <CategoryBadge
                key={category}
                category={category}
                count={counts[category]}
              />
            ) : null
          )}
        </div>
      )}

      <p className="text-stone-700">
        {buildSummarySentence(activeErrors, counts)}
      </p>

      {dismissedCount > 0 && (
        <p className="mt-2 text-sm text-stone-500">
          {dismissedCount === 1
            ? '1 flagged item was dismissed during review.'
            : `${dismissedCount} flagged items were dismissed during review.`}
        </p>
      )}
    </section>
  )
}

export default SummaryPanel
