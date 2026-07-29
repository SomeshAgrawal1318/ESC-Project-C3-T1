// Screens 2a–2d — the "Upload writing sample" flow.
//
// The wireframe draws this as a modal, but DESIGN.md §9 settled on inline
// sheets of paper instead of modals, so it is a page: /students/:id/upload.
// One page, one small state machine (`phase`):
//
//   form       (2a) drop zone + chosen files + title/task type, ready to analyse
//              (2d) the same screen with an inline alert when a file isn't a
//                   supported format or the upload itself fails — the flow
//                   loops back here with everything still filled in
//   uploading       the POST is in flight (button shows "Uploading…")
//   analysing  (2b) upload accepted; we poll GET /api/samples/:sampleId until
//                   the status leaves UPLOADED, or the educator closes the
//                   page and lets it finish in the background (the profile
//                   list shows the sample as "Pending analysis" meanwhile)
//   done       (2c) analysis finished — offer the error report or the profile
//   failed          analysis ended without a report — explain why and return
//                   to the profile instead of polling forever

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getStudent, getSample, uploadSample } from '../lib/api.js';
import { statusFor } from '../lib/status.js';
import Button from '../components/Button.jsx';
import Icon from '../components/Icon.jsx';

const MAX_FILES = 12;
const POLL_EVERY_MS = 3000;

// The Sample model's taskType enum, with human labels for the select.
const TASK_TYPES = [
  { value: 'ESSAY', label: 'Essay' },
  { value: 'LONG_ANSWER', label: 'Long answer' },
  { value: 'SHORT_ANSWER', label: 'Short answer' },
];

// What the AI can read: image scans or PDFs. Browsing is already limited by
// the input's `accept`, but drag & drop can hand us anything (screen 2d).
function isSupported(file) {
  return (
    file.type.startsWith('image/') || file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  );
}

export default function UploadSamplePage() {
  const { studentId } = useParams();
  const navigate = useNavigate();

  const [student, setStudent] = useState(null); // null = still loading
  const [phase, setPhase] = useState('form'); // form | uploading | analysing | done
  const [files, setFiles] = useState([]); // [{ id, file, previewUrl }]
  const [title, setTitle] = useState('');
  const [taskType, setTaskType] = useState('ESSAY');
  const [alert, setAlert] = useState(null); // { title, detail } — the 2d banner
  const [createdSample, setCreatedSample] = useState(null);

  // Whose work is this? The band header needs the name and grade.
  useEffect(() => {
    let live = true;
    getStudent(studentId).then((s) => live && setStudent(s ?? 'notfound'));
    return () => {
      live = false;
    };
  }, [studentId]);

  // Preview URLs are borrowed browser memory — give them back when the
  // page unmounts. The ref shadows `files` so the unmount cleanup sees
  // the latest list without re-running on every change.
  // (Removing a single file revokes its own URL in removeFile.)
  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);
  useEffect(() => () => filesRef.current.forEach((f) => URL.revokeObjectURL(f.previewUrl)), []);

  // ---- 2b: poll until analysis finishes -----------------------------
  // The server answers the upload before the AI has looked at the scan
  // (status UPLOADED). We ask again every few seconds; once the status
  // reads as ready ("Analysed"), the success screen (2c) takes over.
  useEffect(() => {
    if (phase !== 'analysing' || !createdSample) return undefined;
    const timer = setInterval(async () => {
      try {
        const fresh = await getSample(createdSample.sampleId);
        const status = statusFor(fresh.analysisStatus);
        if (status.failed) {
          setCreatedSample(fresh);
          setPhase('failed');
        } else if (status.ready) {
          setCreatedSample(fresh);
          setPhase('done');
        }
      } catch {
        // A dropped poll is not a failed upload — just try again next tick.
      }
    }, POLL_EVERY_MS);
    return () => clearInterval(timer);
  }, [phase, createdSample]);

  // ---- file picking (drop zone + browse button share this) ----------
  function addFiles(picked) {
    const rejected = [...picked].filter((file) => !isSupported(file));
    const accepted = [...picked].filter(isSupported);

    // 2d — say exactly which file the AI can't read, and what it wants.
    if (rejected.length > 0) {
      const names = rejected.map((f) => `“${f.name}”`).join(', ');
      setAlert({
        title:
          rejected.length === 1 ? 'That file can’t be analysed' : 'Those files can’t be analysed',
        detail: `${names} ${rejected.length === 1 ? 'isn’t' : 'aren’t'} a supported format. Upload a JPG, PNG or PDF scan of the handwritten sample, then try again.`,
      });
    } else if (accepted.length > 0) {
      setAlert(null); // a clean pick clears the old complaint
    }

    setFiles((current) => {
      const merged = [...current];
      for (const file of accepted) {
        // The same scan dropped twice shouldn't become two pages.
        const alreadyChosen = merged.some(
          (f) => f.file.name === file.name && f.file.size === file.size
        );
        if (alreadyChosen || merged.length >= MAX_FILES) continue;
        merged.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }
      return merged;
    });
  }

  function removeFile(id) {
    setFiles((current) => {
      const going = current.find((f) => f.id === id);
      if (going) URL.revokeObjectURL(going.previewUrl);
      return current.filter((f) => f.id !== id);
    });
  }

  // ---- submit --------------------------------------------------------
  async function handleAnalyse() {
    setAlert(null);
    setPhase('uploading');
    try {
      const sample = await uploadSample(studentId, {
        title: title.trim(),
        taskType,
        files: files.map((f) => f.file),
      });
      setCreatedSample(sample);
      setPhase('analysing');
    } catch (err) {
      // Also 2d — the flow loops back to the form with everything intact.
      setAlert({
        title: 'The upload didn’t go through',
        detail: `${err.message}. Check the server is running, then try again.`,
      });
      setPhase('form');
    }
  }

  if (student === null) return <div className="skel skel--row" aria-hidden="true" />;

  if (student === 'notfound') {
    return (
      <div className="feedback">
        <h2 className="feedback__title">Student not found</h2>
        <p className="feedback__text">
          This student may have been removed. Head back to your list.
        </p>
        <Button variant="secondary" icon="chevronLeft" to="/">
          Back to my students
        </Button>
      </div>
    );
  }

  const firstName = student.name.split(' ')[0];

  return (
    <div className="profile">
      {/* Band header — same pattern as the profile, because this screen is
          still about one student's work (DESIGN.md §9/§12). */}
      <header className="profile__head">
        <div className="profile__id">
          <span className="eyebrow">Upload writing sample</span>
          <h1 className="profile__name">{student.name}</h1>
          <span className="grade">{student.currentGrade}</span>
        </div>
        <div className="profile__actions">
          <Button variant="secondary" icon="chevronLeft" to={`/students/${studentId}`}>
            Back to profile
          </Button>
        </div>
      </header>

      {phase === 'done' ? (
        <DoneCard sample={createdSample} firstName={firstName} studentId={studentId} />
      ) : phase === 'failed' ? (
        <FailedCard sample={createdSample} studentId={studentId} />
      ) : phase === 'analysing' ? (
        <AnalysingCard
          sample={createdSample}
          firstName={firstName}
          onClose={() => navigate(`/students/${studentId}`)}
        />
      ) : (
        <UploadForm
          files={files}
          title={title}
          taskType={taskType}
          uploading={phase === 'uploading'}
          alert={alert}
          onAddFiles={addFiles}
          onRemoveFile={removeFile}
          onTitle={setTitle}
          onTaskType={setTaskType}
          onCancel={() => navigate(`/students/${studentId}`)}
          onAnalyse={handleAnalyse}
        />
      )}
    </div>
  );
}

/* ---- 2a/2d: drop zone + chosen files (+ inline alert) ------------------ */

function UploadForm({
  files,
  title,
  taskType,
  uploading,
  alert,
  onAddFiles,
  onRemoveFile,
  onTitle,
  onTaskType,
  onCancel,
  onAnalyse,
}) {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const full = files.length >= MAX_FILES;
  const canAnalyse = files.length > 0 && title.trim() !== '' && !uploading;

  function handleDrop(event) {
    event.preventDefault();
    setDragOver(false);
    onAddFiles(event.dataTransfer.files);
  }

  return (
    <section className="upload" aria-label="Upload a writing sample">
      {/* 2d — the inline alert sits above the drop zone so the fix (pick a
          different file) is right underneath the complaint. */}
      {alert && (
        <div className="upload-alert" role="alert">
          <span className="upload-alert__mark" aria-hidden="true">
            <Icon name="alert" size={22} />
          </span>
          <span className="upload-alert__body">
            <span className="upload-alert__title">{alert.title}</span>
            <span className="upload-alert__detail">{alert.detail}</span>
          </span>
        </div>
      )}

      {/* Drop zone — a fresh ruled page waiting for writing, like the
          empty state (motif use approved in DESIGN.md §7). */}
      <div
        className={`dropzone${dragOver ? ' dropzone--over' : ''}${full ? ' dropzone--full' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <span className="dropzone__mark" aria-hidden="true">
          <Icon name="upload" size={30} />
        </span>
        <h2 className="dropzone__title">
          {full ? 'That’s the limit for one sample' : 'Drag & drop the scan here'}
        </h2>
        <p className="dropzone__text">
          {full
            ? `A sample can hold up to ${MAX_FILES} pages. Remove one below to swap it.`
            : 'JPG, PNG or PDF scans of handwritten work. Several pages of the same piece can go in together — they become one sample.'}
        </p>
        {!full && (
          <Button variant="secondary" icon="plus" onClick={() => fileInputRef.current.click()}>
            Browse files…
          </Button>
        )}
        <input
          ref={fileInputRef}
          className="dropzone__input"
          type="file"
          accept="image/*,.pdf"
          multiple
          onChange={(e) => {
            onAddFiles(e.target.files);
            e.target.value = ''; // so picking the same file again still fires onChange
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="filelist" aria-label="Chosen files">
          {files.map((f, index) => (
            <FileRow
              key={f.id}
              item={f}
              pageNumber={index + 1}
              onRemove={() => onRemoveFile(f.id)}
            />
          ))}
        </ul>
      )}

      {/* What is this piece of work? The model needs both of these. */}
      <div className="upload__fields">
        <label className="field">
          <span className="field__label">Sample title</span>
          <input
            className="field__input"
            type="text"
            value={title}
            placeholder="e.g. Composition — “My School Holiday”"
            onChange={(e) => onTitle(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">Task type</span>
          <select
            className="field__input"
            value={taskType}
            onChange={(e) => onTaskType(e.target.value)}
          >
            {TASK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="upload__actions">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          icon="arrow"
          disabled={!canAnalyse}
          disabledHint={
            files.length === 0 ? 'Choose at least one file first' : 'Give the sample a title first'
          }
          onClick={onAnalyse}
        >
          {uploading ? 'Uploading…' : 'Analyse sample'}
        </Button>
      </div>
    </section>
  );
}

function FileRow({ item, pageNumber, onRemove }) {
  const isImage = item.file.type.startsWith('image/');
  const sizeMb = (item.file.size / (1024 * 1024)).toFixed(1);

  return (
    <li className="file-row">
      {/* Images preview themselves; PDFs get the ruled-page mark. */}
      {isImage ? (
        <img className="file-row__thumb" src={item.previewUrl} alt="" />
      ) : (
        <span className="file-row__thumb file-row__thumb--doc" aria-hidden="true">
          <Icon name="page" size={20} />
        </span>
      )}
      <span className="file-row__body">
        <span className="file-row__name">{item.file.name}</span>
        <span className="file-row__meta">
          Page {pageNumber} · {sizeMb} MB · ready to analyse
        </span>
      </span>
      <button
        className="file-row__remove"
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${item.file.name}`}
      >
        <Icon name="cross" size={16} />
      </button>
    </li>
  );
}

/* ---- 2b: analysing in progress ----------------------------------------- */

function AnalysingCard({ sample, firstName, onClose }) {
  return (
    <section className="analysing" aria-label="Analysing sample">
      <span className="analysing__spinner" aria-hidden="true" />
      <h2 className="analysing__title">Analysing “{sample.title}”…</h2>
      <p className="analysing__text">
        LexiPath is reading {firstName}’s handwriting and tagging the errors it finds. This can take
        a little while — the sample sits in {firstName}’s list as “Pending analysis” until it’s
        done, so it’s safe to close this and carry on.
      </p>
      <Button variant="secondary" onClick={onClose}>
        Close — keep analysing in background
      </Button>
    </section>
  );
}

function FailedCard({ sample, studentId }) {
  return (
    <section className="analysing" aria-label="Sample analysis failed" role="alert">
      <h2 className="analysing__title">Analysis couldn’t finish</h2>
      <p className="analysing__text">
        {sample.analysisError || 'LexiPath could not produce an error report for this sample.'}
      </p>
      <Button variant="secondary" to={`/students/${studentId}`}>
        Back to profile
      </Button>
    </section>
  );
}

/* ---- 2c: success, report ready ------------------------------------------ */

function DoneCard({ sample, firstName, studentId }) {
  return (
    <section className="analysing" aria-label="Sample analysed">
      <span className="done-mark" aria-hidden="true">
        <Icon name="check" size={28} />
      </span>
      <h2 className="analysing__title">Sample uploaded &amp; analysed</h2>
      <p className="analysing__text">
        LexiPath found and tagged the literacy errors in “{sample.title}”. Review the AI’s tagging
        against {firstName}’s scan in the error report.
      </p>
      <div className="analysing__actions">
        <Button variant="secondary" to={`/students/${studentId}`}>
          Back to profile
        </Button>
        <Button variant="primary" icon="arrow" to={`/samples/${sample.sampleId}`}>
          Open error report
        </Button>
      </div>
    </section>
  );
}
