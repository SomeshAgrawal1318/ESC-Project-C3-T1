// src/components/ReviewScreen.jsx
// --------------------------------
// Screen 2, the heart of the app: the original scan on the left, the AI's
// flagged errors on the right, side by side. This layout IS the human
// checkpoint - it lets the educator verify every flagged mistake against
// the child's real handwriting, dismiss false alarms, and correct the AI's
// guesses.
//
// This screen also triggers the analysis itself: if it opens a sample that
// is still UPLOADED, it starts the single Gemini call and shows a friendly
// wait message. That way "try again" after a failure lives here too.

import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Printer, Info, ScanEye } from 'lucide-react'
import { fetchSample, analyseSample, saveErrors, scanImageUrl } from '../api.js'
import { CATEGORY_ORDER, CATEGORY_DETAILS, taskTypeLabel } from '../constants.js'
import ImageViewer from './ImageViewer.jsx'
import SummaryPanel from './SummaryPanel.jsx'
import ErrorCard from './ErrorCard.jsx'
import LoadingMessage from './LoadingMessage.jsx'
import ProblemNotice from './ProblemNotice.jsx'

function ReviewScreen({ sampleId, onBackToList }) {
  const [sample, setSample] = useState(null)
  const [isAnalysing, setIsAnalysing] = useState(false)
  const [problemMessage, setProblemMessage] = useState('')
  const [saveState, setSaveState] = useState('idle') // 'idle' | 'saving' | 'saved'
  const [filterCategory, setFilterCategory] = useState('all')

  // React StrictMode runs effects twice in development. Without this guard
  // we would fire TWO Gemini calls for one sample - wasteful on a free tier
  // of ~10 requests/minute. The ref remembers we already started.
  const hasStartedAnalysis = useRef(false)

  async function runAnalysis(id) {
    setProblemMessage('')
    setIsAnalysing(true)
    try {
      const analysedSample = await analyseSample(id)
      setSample(analysedSample)
    } catch (error) {
      setProblemMessage(error.message)
    } finally {
      setIsAnalysing(false)
    }
  }

  // Load the sample when the screen opens; if the AI hasn't looked at it
  // yet, start the analysis straight away.
  useEffect(() => {
    async function loadAndMaybeAnalyse() {
      try {
        const loadedSample = await fetchSample(sampleId)
        setSample(loadedSample)
        if (loadedSample.status === 'UPLOADED' && !hasStartedAnalysis.current) {
          hasStartedAnalysis.current = true
          await runAnalysis(sampleId)
        }
      } catch (error) {
        setProblemMessage(error.message)
      }
    }
    loadAndMaybeAnalyse()
  }, [sampleId])

  // Save the educator's review. We send the WHOLE errors array each time -
  // simple, and the amounts of data are tiny.
  async function saveReviewedErrors(nextErrors) {
    // Show the change immediately (optimistic update)...
    setSample((current) => ({ ...current, errors: nextErrors }))
    setSaveState('saving')
    try {
      // ...then let the server's saved version replace it.
      const savedSample = await saveErrors(sampleId, nextErrors)
      setSample(savedSample)
      setSaveState('saved')
    } catch (error) {
      setSaveState('idle')
      setProblemMessage(`Your review change could not be saved: ${error.message}`)
    }
  }

  function handleToggleDismissed(errorIndex) {
    const nextErrors = sample.errors.map((error, index) =>
      index === errorIndex ? { ...error, dismissed: !error.dismissed } : error
    )
    saveReviewedErrors(nextErrors)
  }

  function handleChangeIntended(errorIndex, newIntended) {
    const nextErrors = sample.errors.map((error, index) =>
      index === errorIndex ? { ...error, intended: newIntended } : error
    )
    saveReviewedErrors(nextErrors)
  }

  // ---- The states before the sample is ready to review ----

  if (problemMessage && !sample) {
    return <ProblemNotice message={problemMessage} onRetry={onBackToList} />
  }

  if (!sample) {
    return <LoadingMessage message="Loading the sample…" />
  }

  const backButton = (
    <button
      type="button"
      onClick={onBackToList}
      className="mb-4 flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-primary print:hidden"
    >
      <ArrowLeft size={16} aria-hidden="true" />
      Back to samples
    </button>
  )

  const scanUrl = scanImageUrl(sample)
  const isPdf = scanUrl.toLowerCase().split('?')[0].endsWith('.pdf')
  const reviewLayoutClasses = isPdf
    ? 'grid items-start gap-6'
    : 'grid items-start gap-6 lg:grid-cols-2'

  if (isAnalysing) {
    return (
      <div>
        {backButton}
        <div className={reviewLayoutClasses}>
          <ImageViewer
            imageUrl={scanUrl}
            altText="Scan of the student's handwritten work"
          />
          <LoadingMessage message="Transcribing and comparing the handwriting… this takes a few seconds." />
        </div>
      </div>
    )
  }

  if (sample.status === 'UPLOADED') {
    // Analysis hasn't run (or it failed) - offer to start it.
    return (
      <div>
        {backButton}
        <ProblemNotice
          message={
            problemMessage ||
            'This sample has not been analysed yet. Start the analysis when you are ready.'
          }
          onRetry={() => runAnalysis(sampleId)}
        />
      </div>
    )
  }

  // ---- The review itself ----

  const illegibleNote = (sample.illegibleNote || '').trim()
  const hasIllegibleParts =
    illegibleNote !== '' && illegibleNote.toLowerCase() !== 'none'

  const patternReport = sample.errorPatternReport
  const structuredPatternReport =
    patternReport && !Array.isArray(patternReport) ? patternReport : null
  const patternSummary = structuredPatternReport?.summary || null
  const patternErrors = structuredPatternReport
    ? structuredPatternReport.errors || []
    : Array.isArray(patternReport)
      ? patternReport.filter((token) => token.category !== 'correct_match')
      : []
  const hasPatternReport = Boolean(structuredPatternReport) || patternErrors.length > 0

  // Which categories actually appear, for the filter row.
  const presentCategories = CATEGORY_ORDER.filter((category) =>
    sample.errors.some((error) => error.category === category)
  )

  const visibleErrors = sample.errors
    .map((error, index) => ({ error, index }))
    .filter(
      ({ error }) => filterCategory === 'all' || error.category === filterCategory
    )

  const filterChipClasses = (isSelected, selectedClasses) =>
    `rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
      isSelected
        ? selectedClasses
        : 'border-stone-300 bg-white text-stone-600 hover:border-primary hover:text-primary'
    }`

  return (
    <div>
      {backButton}

      {/* The reminder banner: teaches the human-in-the-loop principle right
          where it matters. */}
      <div className="mb-5 flex gap-3 rounded-2xl border border-primary/30 bg-primary-soft p-4 text-stone-700 print:hidden">
        <Info size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
        <p>
          Please check the transcription against the original.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">
            {sample.student ? sample.student.externalRef : 'Sample'}
          </h1>
          <p className="text-sm text-stone-500">
            {taskTypeLabel(sample.taskType)} ·{' '}
            {new Date(sample.createdAt).toLocaleDateString('en-SG', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-3 print:hidden">
          {saveState === 'saving' && (
            <span className="text-sm text-stone-500">Saving…</span>
          )}
          {saveState === 'saved' && (
            <span className="text-sm text-stone-500">Review saved</span>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:border-primary hover:text-primary"
          >
            <Printer size={16} aria-hidden="true" />
            Print
          </button>
        </div>
      </div>

      {problemMessage && sample && (
        <div className="mb-5">
          <ProblemNotice
            message={problemMessage}
            onRetry={() => setProblemMessage('')}
          />
        </div>
      )}

      <div className={reviewLayoutClasses}>
        {/* The source stays beside image reports on wide screens. PDF reports
            stack below the embedded document so both retain a useful width.
            Hidden when printing (the printout is the error report). */}
        <div className={isPdf ? 'print:hidden' : 'lg:sticky lg:top-4 print:hidden'}>
          <ImageViewer
            imageUrl={scanUrl}
            altText="Scan of the student's handwritten work"
          />
        </div>

        {/* Right: summary, notices, filters, and the error cards. */}
        <div className="flex flex-col gap-4">
          {hasPatternReport ? (
            <>
              <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-lg font-semibold text-stone-900">
                  Team 1 transcription handoff
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h3 className="mb-1 text-sm font-semibold text-stone-600">Raw text</h3>
                    <pre className="whitespace-pre-wrap rounded-xl bg-stone-50 p-3 font-sans text-stone-800">
                      {sample.raw_text}
                    </pre>
                  </div>
                  <div>
                    <h3 className="mb-1 text-sm font-semibold text-stone-600">
                      Corrected text
                    </h3>
                    <pre className="whitespace-pre-wrap rounded-xl bg-stone-50 p-3 font-sans text-stone-800">
                      {sample.corrected_text}
                    </pre>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                <h2 className="mb-1 text-lg font-semibold text-stone-900">
                  ErrorPatternReport
                </h2>
                {patternSummary && (
                  <dl className="my-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-stone-50 p-3">
                      <dt className="text-sm text-stone-500">Characters analysed</dt>
                      <dd className="text-xl font-semibold text-stone-900">
                        {patternSummary.total_characters_analyzed}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-stone-50 p-3">
                      <dt className="text-sm text-stone-500">Total errors</dt>
                      <dd className="text-xl font-semibold text-stone-900">
                        {patternSummary.total_errors}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-stone-50 p-3">
                      <dt className="text-sm text-stone-500">Error percentage</dt>
                      <dd className="text-xl font-semibold text-stone-900">
                        {patternSummary.error_percentage}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-stone-50 p-3">
                      <dt className="text-sm text-stone-500">Primary prevention track</dt>
                      <dd className="font-semibold text-stone-900">
                        {patternSummary.primary_prevention_track
                          ? `${patternSummary.primary_prevention_track.trackId} — ${patternSummary.primary_prevention_track.label}`
                          : 'None'}
                      </dd>
                    </div>
                  </dl>
                )}
                <p className="mb-4 text-sm text-stone-500">
                  {patternErrors.length} changed character token{patternErrors.length === 1 ? '' : 's'}
                </p>
                {patternErrors.length === 0 ? (
                  <p className="text-stone-600">No character differences were found.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {patternErrors.map((token, index) => (
                      <li
                        key={`${token.category}-${index}`}
                        className="rounded-xl border border-stone-200 bg-stone-50 p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <code className="rounded bg-white px-2 py-1 text-stone-900">
                            {JSON.stringify(token.value)}
                          </code>
                          <span className="rounded-full bg-primary-soft px-2.5 py-1 text-sm font-medium text-primary-dark">
                            {token.category}
                          </span>
                        </div>
                        {token.track && (
                          <p className="mt-2 text-sm text-stone-600">
                            Target track: {token.track.trackId} — {token.track.label}
                          </p>
                        )}
                        {token.context_snippet && (
                          <p className="mt-2 rounded-lg bg-white p-2 text-sm text-stone-700">
                            <span className="font-medium">Context:</span>{' '}
                            {token.context_snippet}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : (
            <SummaryPanel errors={sample.errors} />
          )}

          {hasIllegibleParts && (
            <div className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-stone-700">
              <ScanEye size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-600" />
              <p>
                <span className="font-medium">
                  Some parts couldn't be read clearly:
                </span>{' '}
                {illegibleNote} — worth checking those spots on the scan
                yourself.
              </p>
            </div>
          )}

          {!hasPatternReport && sample.errors.length > 0 && (
            <div
              className="flex flex-wrap gap-2 print:hidden"
              role="group"
              aria-label="Filter errors by category"
            >
              <button
                type="button"
                onClick={() => setFilterCategory('all')}
                aria-pressed={filterCategory === 'all'}
                className={filterChipClasses(
                  filterCategory === 'all',
                  'border-primary bg-primary text-white'
                )}
              >
                All ({sample.errors.length})
              </button>
              {presentCategories.map((category) => {
                const count = sample.errors.filter(
                  (error) => error.category === category
                ).length
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setFilterCategory(category)}
                    aria-pressed={filterCategory === category}
                    className={filterChipClasses(
                      filterCategory === category,
                      CATEGORY_DETAILS[category].chipSelectedClasses
                    )}
                  >
                    {CATEGORY_DETAILS[category].label} ({count})
                  </button>
                )
              })}
            </div>
          )}

          {hasPatternReport ? null : sample.errors.length === 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-stone-600 shadow-sm">
              The AI found no spelling or writing errors in this sample.
              Do double-check the scan — the AI can miss things too.
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {visibleErrors.map(({ error, index }) => (
                <li key={index}>
                  <ErrorCard
                    error={error}
                    onToggleDismissed={() => handleToggleDismissed(index)}
                    onChangeIntended={(newIntended) =>
                      handleChangeIntended(index, newIntended)
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReviewScreen
