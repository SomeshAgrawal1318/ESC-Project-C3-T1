// components/UploadModal.jsx
// ---------------------------
// the upload flow (wireframes 2a-2d): pick a file, watch it get analysed,
// land on success or a clear error. one component, four states - the
// state decides which panel renders.

import { useState } from 'react';
import { useSamplePolling } from '../hooks/useSamplePolling.js';
import { uploadSample } from '../lib/api.js';
import Button from './Button.jsx';
import Icon from './Icon.jsx';

const ACCEPTED_TYPES = '.jpg,.jpeg,.png,.pdf';
const ACCEPTED_LABEL = 'JPG, PNG or PDF';

export default function UploadModal({ studentId, onClose, onUploaded }) {
  const [phase, setPhase] = useState('picking'); // picking | analysing | error
  const [files, setFiles] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [sampleId, setSampleId] = useState(null);

  const poll = useSamplePolling(phase === 'analysing' ? sampleId : null);
  // success is derived from the poll result rather than its own phase, so
  // there's no effect needed to sync the two.
  const isSuccess = phase === 'analysing' && poll.status === 'complete';

  function addFiles(fileList) {
    setFiles((prev) => [...prev, ...Array.from(fileList)]);
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleAnalyse() {
    try {
      const sample = await uploadSample(studentId, files);
      // real uploads return the raw Sample doc (id in _id); mock mode
      // already returns the friendly sampleId - handle either.
      setSampleId(sample.sampleId ?? sample._id);
      setPhase('analysing');
    } catch (err) {
      setErrorMessage(err.message);
      setPhase('error');
    }
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Upload writing sample"
        onClick={(event) => event.stopPropagation()}
      >
        {phase === 'picking' && (
          <PickingPanel
            files={files}
            onAddFiles={addFiles}
            onRemoveFile={removeFile}
            onCancel={onClose}
            onAnalyse={handleAnalyse}
          />
        )}
        {phase === 'analysing' && !isSuccess && (
          <AnalysingPanel pollStatus={poll.status} onClose={onClose} />
        )}
        {isSuccess && (
          <SuccessPanel
            sampleId={sampleId}
            onBackToProfile={() => {
              onUploaded?.();
              onClose();
            }}
          />
        )}
        {phase === 'error' && (
          <ErrorPanel
            message={errorMessage}
            onTryAgain={() => setPhase('picking')}
            onCancel={onClose}
          />
        )}
      </div>
    </div>
  );
}

// state 2a: drag-and-drop zone, browse, file preview, cancel / analyse.
function PickingPanel({ files, onAddFiles, onRemoveFile, onCancel, onAnalyse }) {
  function handleDrop(event) {
    event.preventDefault();
    onAddFiles(event.dataTransfer.files);
  }

  return (
    <>
      <h2 className="modal__title">Upload writing sample</h2>

      <div className="dropzone" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
        <Icon name="upload" size={26} />
        <p className="dropzone__text">Drag a scan here, or</p>
        <label className="dropzone__browse">
          Browse files
          <input
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            hidden
            onChange={(event) => onAddFiles(event.target.files)}
          />
        </label>
        <p className="dropzone__hint">{ACCEPTED_LABEL} accepted</p>
      </div>

      {files.length > 0 && (
        <ul className="file-list">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="file-list__item">
              <Icon name="page" size={18} />
              <span className="file-list__name">{file.name}</span>
              <span className="file-list__size">{formatSize(file.size)}</span>
              <button
                type="button"
                className="file-list__remove"
                aria-label={`Remove ${file.name}`}
                onClick={() => onRemoveFile(index)}
              >
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="modal__actions">
        <Button variant="tertiary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={onAnalyse}
          disabled={files.length === 0}
          disabledHint="Choose a file first"
        >
          Analyse sample →
        </Button>
      </div>
    </>
  );
}

// state 2b: spinner while polling, plus the FAILED/timeout/error paths the
// polling hook can land on.
function AnalysingPanel({ pollStatus, onClose }) {
  const isTrouble = pollStatus === 'failed' || pollStatus === 'timeout' || pollStatus === 'error';

  if (isTrouble) {
    return (
      <>
        <h2 className="modal__title">Analysis didn’t finish</h2>
        <p className="modal__text">
          {pollStatus === 'failed'
            ? 'The AI couldn’t analyse this sample. You can try uploading it again.'
            : 'This is taking longer than expected. Check back on the sample later.'}
        </p>
        <div className="modal__actions">
          <Button variant="primary" onClick={onClose}>
            Back to profile
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="spinner" aria-hidden="true" />
      <h2 className="modal__title">Analysing your upload…</h2>
      <p className="modal__text">
        The AI is reading the scan for spelling errors. You can’t view it before then.
      </p>
      <div className="modal__actions">
        <Button variant="secondary" onClick={onClose}>
          Close — keep analysing in background
        </Button>
      </div>
    </>
  );
}

// state 2c: success panel.
function SuccessPanel({ sampleId, onBackToProfile }) {
  return (
    <>
      <Icon name="check" size={30} />
      <h2 className="modal__title">Sample analysed</h2>
      <p className="modal__text">The AI has finished reviewing this sample.</p>
      <div className="modal__actions">
        <Button variant="secondary" onClick={onBackToProfile}>
          Back to profile
        </Button>
        <Button variant="primary" to={`/samples/${sampleId}`}>
          Open error report →
        </Button>
      </div>
    </>
  );
}

// state 2d: the 422 rejection, naming the offending file.
function ErrorPanel({ message, onTryAgain, onCancel }) {
  return (
    <>
      <h2 className="modal__title">Couldn’t upload that file</h2>
      <p className="modal__text">{message}</p>
      <div className="modal__actions">
        <Button variant="tertiary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onTryAgain}>
          Try again
        </Button>
      </div>
    </>
  );
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
