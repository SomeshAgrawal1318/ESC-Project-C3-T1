// src/constants.js
// -----------------
// The app's fixed vocabulary, defined once so every screen speaks the same
// language: the five error categories (plus "unsure"), the sample statuses,
// and the task types.
//
// Each category has its own colour, used consistently everywhere. The hues
// were chosen to be distinguishable for colour-blind users - and, more
// importantly, NO badge ever relies on colour alone: the text label is
// always shown too, so printouts and colour-blind users lose nothing.

export const CATEGORY_DETAILS = {
  phonological: {
    label: 'Phonological',
    description: 'sounds right but spelled wrong',
    badgeClasses: 'bg-purple-50 text-purple-800 border-purple-300',
    chipSelectedClasses: 'bg-purple-700 text-white border-purple-700',
  },
  orthographic: {
    label: 'Orthographic',
    description: 'letters wrong, swapped, or reversed',
    badgeClasses: 'bg-blue-50 text-blue-800 border-blue-300',
    chipSelectedClasses: 'bg-blue-700 text-white border-blue-700',
  },
  morphological: {
    label: 'Morphological',
    description: 'base word correct but ending or prefix wrong',
    badgeClasses: 'bg-green-50 text-green-800 border-green-300',
    chipSelectedClasses: 'bg-green-700 text-white border-green-700',
  },
  capitalisation: {
    label: 'Capitalisation',
    description: 'a capital letter is missing or wrong',
    badgeClasses: 'bg-amber-50 text-amber-800 border-amber-400',
    chipSelectedClasses: 'bg-amber-600 text-white border-amber-600',
  },
  punctuation: {
    label: 'Punctuation',
    description: 'a punctuation mark is missing or wrong',
    badgeClasses: 'bg-rose-50 text-rose-800 border-rose-300',
    chipSelectedClasses: 'bg-rose-700 text-white border-rose-700',
  },
  unsure: {
    label: 'Unsure',
    description: 'the AI could not confidently categorise this',
    badgeClasses: 'bg-stone-100 text-stone-700 border-stone-300',
    chipSelectedClasses: 'bg-stone-600 text-white border-stone-600',
  },
}

// A stable display order for the categories (object key order is not
// something to rely on for layout).
export const CATEGORY_ORDER = [
  'phonological',
  'orthographic',
  'morphological',
  'capitalisation',
  'punctuation',
  'unsure',
]

// How each sample status is shown in the UI.
export const STATUS_DETAILS = {
  UPLOADED: {
    label: 'Uploaded',
    badgeClasses: 'bg-stone-100 text-stone-700 border-stone-300',
  },
  ANALYSED: {
    label: 'Analysed',
    badgeClasses: 'bg-sky-50 text-sky-800 border-sky-300',
  },
  REVIEWED: {
    label: 'Reviewed',
    badgeClasses: 'bg-teal-50 text-teal-800 border-teal-300',
  },
}

// The task types, in the order the Upload screen's dropdown shows them.
// EDIT_DIAGRAM tasks have one known correct answer (so an answer key can be
// provided); narrative writing does not.
export const TASK_TYPE_OPTIONS = [
  { value: 'EDIT_DIAGRAM', label: 'Edit & Diagram' },
  { value: 'NARRATIVE', label: 'Narrative writing' },
  { value: 'OTHER', label: 'Other' },
]

// A friendly label for any task type value coming back from the API.
export function taskTypeLabel(taskType) {
  const option = TASK_TYPE_OPTIONS.find((entry) => entry.value === taskType)
  return option ? option.label : taskType
}
