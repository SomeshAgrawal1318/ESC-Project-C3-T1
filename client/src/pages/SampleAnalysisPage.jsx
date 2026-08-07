// Wireframe 3c — what a therapist sees when they open a writing sample whose
// analysis has not finished. Two variants, both driven by real status, never
// by a flag:
//   still running — spinner, "Analysis is still running", "↻ Check again"
//   FAILED        — the reason the analysis job recorded, so the screen never
//                   shows a spinner that spins forever
//
// Once analysis IS done this route belongs to the error report screen, so we
// hand off rather than render anything of our own here.
//
// Deliberately no auto-polling: the poll loop belongs to the upload slice.
// This screen re-fetches only when the therapist asks it to.

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getSample } from '../lib/api.js';
import { statusFor } from '../lib/status.js';
import Button from '../components/Button.jsx';
import Icon from '../components/Icon.jsx';
import Placeholder from '../components/Placeholder.jsx';
import StatusPill from '../components/StatusPill.jsx';

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatUploaded(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d);
}

export default function SampleAnalysisPage() {
  const { sampleId } = useParams();
  const [state, setState] = useState({ status: 'loading' });
  const [checking, setChecking] = useState(false);
  // Bumped by "Check again" so the one fetch path below re-runs.
  const [attempt, setAttempt] = useState(0);

  // Reset to the skeleton when the sample changes, so navigating between
  // samples never shows the previous one's state (React's documented
  // render-phase reset pattern).
  const [loadedFor, setLoadedFor] = useState(sampleId);
  if (loadedFor !== sampleId) {
    setLoadedFor(sampleId);
    setState({ status: 'loading' });
  }

  useEffect(() => {
    let live = true;
    getSample(sampleId)
      .then((sample) => {
        if (!live) return;
        setState(sample ? { status: 'ready', sample } : { status: 'notfound' });
      })
      .catch((err) => {
        if (live) setState({ status: 'error', message: err.message });
      })
      .finally(() => {
        if (live) setChecking(false);
      });
    return () => {
      live = false;
    };
  }, [sampleId, attempt]);

  if (state.status === 'loading') return <AnalysisSkeleton />;

  if (state.status === 'notfound') {
    return (
      <Feedback
        title="Sample not found"
        text="This writing sample may have been removed. Head back to your students."
        to="/"
        action="Back to my students"
      />
    );
  }

  if (state.status === 'error') {
    return (
      <Feedback
        title="Couldn’t load this sample"
        text={state.message}
        tone="error"
        to="/"
        action="Back to my students"
      />
    );
  }

  const { sample } = state;
  const { ready, tone } = statusFor(sample.analysisStatus);

  // Analysis finished — this screen has nothing to say. The report belongs
  // to the review-screen slice.
  if (ready) return <Placeholder label="Error report" />;

  const failed = tone === 'failed';

  return (
    <div className="analysis">
      {/* Shared ruled band from DESIGN.md §7/§9 — the same element the
          student profile header uses, not a fourth home for the motif. */}
      <header className="profile__head">
        <div className="profile__id">
          <span className="eyebrow">Writing sample</span>
          <h1 className="profile__name">{sample.title}</h1>
          <span className="grade">{sample.studentName}</span>
        </div>
        <StatusPill analysisStatus={sample.analysisStatus} />
      </header>

      <section
        className={`analysis__panel${failed ? ' analysis__panel--failed' : ''}`}
        role="status"
        aria-live="polite"
      >
        {failed ? (
          <span className="analysis__mark">
            <Icon name="alert" size={26} />
          </span>
        ) : (
          <span className="analysis__spinner" aria-hidden="true" />
        )}

        <h2 className="analysis__title">
          {failed ? 'Analysis failed' : 'Analysis is still running'}
        </h2>

        <p className="analysis__text">
          {failed
            ? sample.analysisError ||
              'The AI could not produce an error report for this sample.'
            : 'The AI is reading the scan and tagging spelling errors. This usually takes under a minute — you can leave this page and come back to it.'}
        </p>

        <p className="analysis__meta">
          Uploaded {formatUploaded(sample.uploadedAt)}
          {sample.imageCount > 1 ? ` · ${sample.imageCount} pages` : ''}
        </p>

        <div className="analysis__actions">
          <Button
            variant="secondary"
            icon="chevronLeft"
            to={`/students/${sample.studentId}`}
          >
            Back to profile
          </Button>
          {/* No "Check again" on a failed sample — re-running analysis is not
              something this screen can do, so the control would be inert.
              It stays enabled while checking: the dashed disabled treatment
              means "locked feature", not "busy for a moment". */}
          {!failed && (
            <Button
              variant="primary"
              icon="refresh"
              onClick={() => {
                if (checking) return;
                setChecking(true);
                setAttempt((n) => n + 1);
              }}
            >
              {checking ? 'Checking…' : 'Check again'}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="analysis" aria-hidden="true">
      <header className="profile__head">
        <div className="profile__id">
          <span className="eyebrow">Writing sample</span>
          <div className="skel skel--title" />
          <div className="skel skel--pill" />
        </div>
      </header>
      <div className="skel skel--panel" />
    </div>
  );
}

function Feedback({ title, text, tone, to, action }) {
  return (
    <div className={`feedback${tone === 'error' ? ' feedback--error' : ''}`}>
      <h2 className="feedback__title">{title}</h2>
      <p className="feedback__text">{text}</p>
      <Button variant="secondary" icon="chevronLeft" to={to}>
        {action}
      </Button>
    </div>
  );
}
