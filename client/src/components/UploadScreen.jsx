// src/components/UploadScreen.jsx
// --------------------------------
// Screen 1: upload a scan of the child's work. A drag-and-drop area (with a
// normal file picker as fallback), the DAS ID, the task type, and - for
// Edit & Diagram tasks only - an optional answer key.
//
// Note there is no <form> element here: in React we drive everything with
// onClick/onChange handlers, so there is no browser form submission to
// intercept.

import { useState, useRef, useEffect } from 'react'
import { ImagePlus, Upload, ArrowLeft } from 'lucide-react'
import { uploadSample } from '../api.js'
import { TASK_TYPE_OPTIONS } from '../constants.js'
import ProblemNotice from './ProblemNotice.jsx'

function UploadScreen({ onCancel, onUploaded }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [externalRef, setExternalRef] = useState('')
  const [taskType, setTaskType] = useState('')
  const [answerKey, setAnswerKey] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [problemMessage, setProblemMessage] = useState('')

  // A ref lets us "click" the invisible file input when the drop area is
  // clicked, so the whole area works as a big friendly file picker.
  const fileInputRef = useRef(null)

  // Build a temporary preview URL for the chosen image, and clean it up
  // when the file changes (object URLs hold memory until revoked).
  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl('')
      return
    }
    const url = URL.createObjectURL(selectedFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedFile])

  function acceptFile(file) {
    if (!file) {
      return
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      setProblemMessage('Please choose a JPG, PNG, WebP or PDF scan of the work.')
      return
    }
    setProblemMessage('')
    setSelectedFile(file)
  }

  function handleFilePicked(event) {
    acceptFile(event.target.files[0])
  }

  function handleDrop(event) {
    // preventDefault stops the browser from just opening the image file.
    event.preventDefault()
    acceptFile(event.dataTransfer.files[0])
  }

  function handleDragOver(event) {
    // Also required - without this, the browser refuses the drop.
    event.preventDefault()
  }

  async function handleUploadAndAnalyse() {
    // Validate before sending, with messages that say exactly what to do.
    if (!selectedFile) {
      setProblemMessage('Please choose a scan of the work first.')
      return
    }
    if (externalRef.trim() === '') {
      setProblemMessage("Please enter the student's DAS ID (e.g. Student-60570).")
      return
    }
    if (taskType === '') {
      setProblemMessage('Please choose the task type.')
      return
    }

    setProblemMessage('')
    setIsUploading(true)

    try {
      // FormData is how a browser sends a file plus fields in one request.
      const formData = new FormData()
      formData.append('image', selectedFile)
      formData.append('externalRef', externalRef.trim())
      formData.append('taskType', taskType)
      formData.append('answerKey', taskType === 'EDIT_DIAGRAM' ? answerKey : '')

      const sample = await uploadSample(formData)

      // Hand over to the review screen, which runs the AI analysis.
      onUploaded(sample._id)
    } catch (error) {
      setProblemMessage(error.message)
      setIsUploading(false)
    }
  }

  const labelClasses = 'mb-1 block font-medium text-stone-800'
  const inputClasses =
    'w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-stone-800 placeholder-stone-400'

  return (
    <div className="mx-auto max-w-2xl">
      <button
        type="button"
        onClick={onCancel}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-primary"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to samples
      </button>

      <h1 className="mb-2 text-2xl font-semibold text-stone-900">
        Upload a new sample
      </h1>
      <p className="mb-6 text-stone-600">
        Add a photo or scan of the child's handwritten work. The AI will read
        it and flag the spelling and writing mistakes for you to review.
      </p>

      <div className="flex flex-col gap-5 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        {/* The drop area doubles as a button for the hidden file input. */}
        <div>
          <span className={labelClasses}>Scan of the work</span>
          <div
            role="button"
            tabIndex={0}
            aria-label="Choose or drop an image of the student's work"
            onClick={() => fileInputRef.current.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                fileInputRef.current.click()
              }
            }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 p-8 text-center transition-colors hover:border-primary hover:bg-primary-soft"
          >
            {previewUrl ? (
              <>
                {selectedFile.type === 'application/pdf' ? (
                  <div className="rounded-lg border border-stone-200 bg-white px-6 py-8 text-stone-700 shadow-sm">
                    PDF scan selected
                  </div>
                ) : (
                  <img
                    src={previewUrl}
                    alt="Preview of the chosen scan"
                    className="max-h-56 rounded-lg border border-stone-200 shadow-sm"
                  />
                )}
                <span className="text-sm text-stone-500">
                  {selectedFile.name} — click to choose a different file
                </span>
              </>
            ) : (
              <>
                <ImagePlus size={34} aria-hidden="true" className="text-stone-400" />
                <span className="font-medium text-stone-700">
                  Drop the scan here, or click to choose a file
                </span>
                <span className="text-sm text-stone-500">JPG, PNG, WebP or PDF</span>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleFilePicked}
            className="hidden"
          />
        </div>

        <div>
          <label htmlFor="das-id" className={labelClasses}>
            Student DAS ID
          </label>
          <input
            id="das-id"
            type="text"
            value={externalRef}
            onChange={(event) => setExternalRef(event.target.value)}
            placeholder="e.g. Student-60570"
            className={inputClasses}
          />
          <p className="mt-1 text-sm text-stone-500">
            Only the DAS ID is stored — never the child's name.
          </p>
        </div>

        <div>
          <label htmlFor="task-type" className={labelClasses}>
            Task type
          </label>
          <select
            id="task-type"
            value={taskType}
            onChange={(event) => setTaskType(event.target.value)}
            className={inputClasses}
          >
            <option value="">Choose a task type…</option>
            {TASK_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Only closed tasks have one known correct answer, so the answer
            key field appears only for Edit & Diagram. */}
        {taskType === 'EDIT_DIAGRAM' && (
          <div>
            <label htmlFor="answer-key" className={labelClasses}>
              Answer key <span className="font-normal text-stone-500">(optional)</span>
            </label>
            <textarea
              id="answer-key"
              rows={3}
              value={answerKey}
              onChange={(event) => setAnswerKey(event.target.value)}
              placeholder="The exercise's correct text, if you have it"
              className={inputClasses}
            />
            <p className="mt-1 text-sm text-stone-500">
              Used only to help the AI read unclear handwriting — it will
              never "correct" the child's writing toward it.
            </p>
          </div>
        )}

        {problemMessage && <ProblemNotice message={problemMessage} />}

        <button
          type="button"
          onClick={handleUploadAndAnalyse}
          disabled={isUploading}
          className="flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload size={18} aria-hidden="true" />
          {isUploading ? 'Uploading…' : 'Upload and analyse'}
        </button>
      </div>
    </div>
  )
}

export default UploadScreen
