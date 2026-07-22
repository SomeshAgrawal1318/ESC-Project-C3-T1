// Shared Tailwind class recipes so buttons/cards/headings stay consistent
// across screens instead of everyone retyping the same classes.

export const heading = {
  page: 'text-2xl font-semibold text-stone-900',
  section: 'text-lg font-semibold text-stone-900',
}

export const button = {
  primary:
    'flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition-colors hover:bg-primary-dark',
  secondary:
    'flex items-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-2.5 font-medium text-stone-700 transition-colors hover:border-primary hover:text-primary',
}

export const card = {
  base: 'rounded-2xl border border-stone-200 bg-white p-6 shadow-sm',
  interactive:
    'rounded-2xl border border-stone-200 bg-white px-5 py-4 shadow-sm transition-all hover:border-primary hover:shadow',
}

export const text = {
  muted: 'text-stone-500',
  body: 'text-stone-600',
}
