// Groups samples by student DAS ID instead of the flat list SamplesList
// shows. No dedicated "students" endpoint exists yet, so this just reuses
// GET /api/samples and groups client-side.

import { useState, useEffect } from 'react'
import { Users, ChevronRight, ChevronDown } from 'lucide-react'
import { fetchSamplesList } from '../api.js'
import { taskTypeLabel } from '../constants.js'
import StatusBadge from '../components/StatusBadge.jsx'
import LoadingMessage from '../components/LoadingMessage.jsx'
import ProblemNotice from '../components/ProblemNotice.jsx'
import { heading, card, text } from '../theme/index.js'

// One entry per student, newest sample first, students ordered by last activity.
function groupSamplesByStudent(samples) {
  const studentsByRef = new Map()

  for (const sample of samples) {
    const ref = sample.student ? sample.student.externalRef : 'Unknown student'
    if (!studentsByRef.has(ref)) {
      studentsByRef.set(ref, { externalRef: ref, samples: [] })
    }
    studentsByRef.get(ref).samples.push(sample)
  }

  const students = Array.from(studentsByRef.values())
  for (const student of students) {
    student.samples.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }
  students.sort(
    (a, b) => new Date(b.samples[0].createdAt) - new Date(a.samples[0].createdAt)
  )

  return students
}

function StudentProfile({ onOpenSample }) {
  const [samples, setSamples] = useState(null) // null = not loaded yet
  const [problemMessage, setProblemMessage] = useState('')
  const [expandedRef, setExpandedRef] = useState(null)

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

  useEffect(() => {
    loadSamples()
  }, [])

  if (problemMessage) {
    return <ProblemNotice message={problemMessage} onRetry={loadSamples} />
  }

  if (samples === null) {
    return <LoadingMessage message="Loading students…" />
  }

  const students = groupSamplesByStudent(samples)

  if (students.length === 0) {
    return (
      <div className={`flex flex-col items-center gap-4 ${card.base} text-center`}>
        <span className="rounded-2xl bg-primary-soft p-4 text-primary">
          <Users size={30} aria-hidden="true" />
        </span>
        <h1 className={heading.page}>No students yet</h1>
        <p className={`max-w-lg ${text.body}`}>
          Once samples are uploaded, students will appear here grouped by
          their DAS ID.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className={`mb-6 ${heading.page}`}>Students</h1>

      <ul className="flex flex-col gap-3">
        {students.map((student) => {
          const isExpanded = expandedRef === student.externalRef
          return (
            <li key={student.externalRef} className={card.base}>
              <button
                type="button"
                onClick={() =>
                  setExpandedRef(isExpanded ? null : student.externalRef)
                }
                aria-expanded={isExpanded}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="flex flex-col">
                  <span className="font-semibold text-stone-900">
                    {student.externalRef}
                  </span>
                  <span className={`text-sm ${text.muted}`}>
                    {student.samples.length}{' '}
                    {student.samples.length === 1 ? 'sample' : 'samples'}
                  </span>
                </span>
                {isExpanded ? (
                  <ChevronDown size={20} aria-hidden="true" className="text-stone-400" />
                ) : (
                  <ChevronRight size={20} aria-hidden="true" className="text-stone-400" />
                )}
              </button>

              {isExpanded && (
                <ul className="mt-4 flex flex-col gap-2 border-t border-stone-200 pt-4">
                  {student.samples.map((sample) => (
                    <li key={sample._id}>
                      <button
                        type="button"
                        onClick={() => onOpenSample(sample._id)}
                        className={`flex w-full flex-wrap items-center justify-between gap-3 ${card.interactive}`}
                      >
                        <span className="flex flex-col">
                          <span className="text-stone-900">
                            {taskTypeLabel(sample.taskType)}
                          </span>
                          <span className={`text-sm ${text.muted}`}>
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
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default StudentProfile
