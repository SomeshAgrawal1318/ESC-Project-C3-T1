// src/components/LoadingMessage.jsx
// ----------------------------------
// A friendly spinner with a message. The Gemini call takes a few seconds,
// so telling the user WHAT is happening ("Reading and analysing the
// handwriting…") turns a worrying pause into an expected one.

import { LoaderCircle } from 'lucide-react'

function LoadingMessage({ message }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-4 rounded-2xl border border-stone-200 bg-white p-10 text-center shadow-sm"
    >
      <LoaderCircle
        size={36}
        aria-hidden="true"
        className="animate-spin text-primary"
      />
      <p className="text-stone-600">{message}</p>
    </div>
  )
}

export default LoadingMessage
