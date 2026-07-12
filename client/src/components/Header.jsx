// src/components/Header.jsx
// --------------------------
// The bar across the top of every screen: the LexiPath name (click it to go
// back to the samples list) and the reading-comfort toggle.

import { BookOpenCheck, Eye } from 'lucide-react'

function Header({ readingComfort, onToggleReadingComfort, onGoHome }) {
  return (
    <header className="mb-8 border-b border-stone-200 bg-white/60 print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={onGoHome}
          className="flex items-center gap-3 rounded-lg text-left"
        >
          <span className="rounded-xl bg-primary p-2 text-white">
            <BookOpenCheck size={22} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-xl font-semibold text-stone-900">
              LexiPath
            </span>
            <span className="block text-sm text-stone-500">
              Error analysis · Dyslexia Association of Singapore
            </span>
          </span>
        </button>

        {/* aria-pressed tells screen readers this button is an on/off
            toggle, and whether it is currently on. */}
        <button
          type="button"
          onClick={onToggleReadingComfort}
          aria-pressed={readingComfort}
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            readingComfort
              ? 'border-primary bg-primary text-white'
              : 'border-stone-300 bg-white text-stone-700 hover:border-primary hover:text-primary'
          }`}
        >
          <Eye size={17} aria-hidden="true" />
          Reading comfort {readingComfort ? 'on' : 'off'}
        </button>
      </div>
    </header>
  )
}

export default Header
