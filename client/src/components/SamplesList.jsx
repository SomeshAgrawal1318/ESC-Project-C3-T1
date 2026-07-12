// src/components/SamplesList.jsx
// -------------------------------
// The landing screen: every uploaded sample in one friendly list, newest
// first, each row showing the DAS ID, task type, status and date. Clicking
// a row opens it on the review screen.

import { useState, useEffect } from 'react'
import { Upload, BookOpenCheck } from 'lucide-react'
import { fetchSamplesList } from '../api.js'
import { taskTypeLabel } from '../constants.js'
import StatusBadge from './StatusBadge.jsx'
import LoadingMessage from './LoadingMessage.jsx'
import ProblemNotice from './ProblemNotice.jsx'

function SamplesList({ onUploadNew, onOpenSample }) {
  const [samples, setSamples] = useState(null) // null = not loaded yet
  const [problemMessage, setProblemMessage] = useState('')

  async function loadSamples() {
    setProblemMessage('')
    setSamples(null)
    try {
      const list = await fetchSamplesList()
      setSamples(list)
    } catch (error) {
      setProblemMessage(error.message)
    }
  }

  // Load the list once, when the screen first appears.
  useEffect(() => {
    loadSamples()
  }, [])

  if (problemMessage) {
    return <ProblemNotice message={problemMessage} onRetry={loadSamples} />
  }

  if (samples === null) {
    return <LoadingMessage message="Loading the samples…" />
  }

  // The welcoming empty state: explains what LexiPath does and points to
  // the one action that makes sense next.
  if (samples.length === 0) {
    return (
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-sm">
        <span className="rounded-2xl bg-primary-soft p-4 text-primary">
          <BookOpenCheck size={34} aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-semibold text-stone-900">
          Welcome to LexiPath
        </h1>
        <p className="max-w-lg text-stone-600">
          LexiPath reads a scan of a child's handwritten work and flags their
          spelling and writing mistakes — preserved exactly as written — so
          you can see the patterns behind them. Upload a first sample to try
          it.
        </p>
        <button
          type="button"
          onClick={onUploadNew}
          className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-primary-dark"
        >
          <Upload size={18} aria-hidden="true" />
          Upload a sample
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-stone-900">Samples</h1>
        <button
          type="button"
          onClick={onUploadNew}
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition-colors hover:bg-primary-dark"
        >
          <Upload size={18} aria-hidden="true" />
          Upload new sample
        </button>
      </div>

      <ul className="flex flex-col gap-3">
        {samples.map((sample) => (
          <li key={sample._id}>
            <button
              type="button"
              onClick={() => onOpenSample(sample._id)}
              className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-5 py-4 text-left shadow-sm transition-all hover:border-primary hover:shadow"
            >
              <span className="flex flex-col">
                <span className="font-semibold text-stone-900">
                  {sample.student ? sample.student.externalRef : 'Unknown student'}
                </span>
                <span className="text-sm text-stone-500">
                  {taskTypeLabel(sample.taskType)} ·{' '}
                  {new Date(sample.createdAt).toLocaleDateString('en-SG', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </span>
              <StatusBadge status={sample.status} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default SamplesList
