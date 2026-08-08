import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import Button from '../components/Button.jsx';
import {
  generateRecommendations,
  getLatestRecommendations,
  getStudent,
  worksheetFileUrl,
} from '../lib/api.js';

const reportDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatGeneratedAt(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'recently' : reportDate.format(date);
}

export default function RecommendationsPage() {
  const { studentId } = useParams();
  const [state, setState] = useState({ status: 'loading' });

  const [loadedFor, setLoadedFor] = useState(studentId);
  if (loadedFor !== studentId) {
    setLoadedFor(studentId);
    setState({ status: 'loading' });
  }

  useEffect(() => {
    let active = true;

    Promise.all([getStudent(studentId), getLatestRecommendations(studentId)])
      .then(([student, report]) => {
        if (!active) return;
        if (!student) {
          setState({ status: 'notfound' });
          return;
        }
        setState({ status: 'ready', student, report, generationError: null });
      })
      .catch((error) => {
        if (active) setState({ status: 'error', message: error.message });
      });

    return () => {
      active = false;
    };
  }, [studentId]);

  async function handleGenerate() {
    setState((current) => ({
      ...current,
      status: 'generating',
      generationError: null,
    }));

    try {
      const report = await generateRecommendations(studentId);
      setState((current) => ({
        ...current,
        status: 'ready',
        report,
        generationError: null,
      }));
    } catch (error) {
      // Keep the previous report visible. Generation completes before the
      // server upsert, so a failed refresh cannot replace good recommendations.
      setState((current) => ({
        ...current,
        status: 'ready',
        generationError: error.message,
      }));
    }
  }

  if (state.status === 'loading') return <RecommendationsSkeleton />;
  if (state.status === 'notfound') {
    return (
      <RecommendationFeedback
        title="Student not found"
        text="This student may have been removed. Head back to your list of students."
      />
    );
  }
  if (state.status === 'error') {
    return (
      <RecommendationFeedback
        title="Couldn’t load recommendations"
        text={state.message}
        tone="error"
      />
    );
  }

  const { student, report, generationError } = state;
  const generating = state.status === 'generating';

  return (
    <div className="profile recommendations-page">
      <header className="profile__head recommendations-head">
        <div className="profile__id">
          <Button variant="tertiary" icon="chevronLeft" to={`/students/${studentId}`}>
            Back to {student.name}
          </Button>
          <span className="eyebrow">Intervention recommendations</span>
          <h1 className="profile__name">Suggested next steps</h1>
          <span className="grade">{student.currentGrade}</span>
        </div>
        <div className="profile__actions">
          <Button
            variant="primary"
            icon="recommendations"
            disabled={generating}
            disabledHint="Reviewing all analysed and reviewed samples…"
            onClick={handleGenerate}
          >
            {generating
              ? 'Generating…'
              : report
                ? 'Refresh recommendations'
                : 'Generate recommendations'}
          </Button>
        </div>
      </header>

      {generationError && (
        <RecommendationWarning tone="error" title="The new report could not be generated">
          {report ? `The previous report is still available. ${generationError}` : generationError}
        </RecommendationWarning>
      )}

      {report?.isOutdated && (
        <RecommendationWarning
          title="These recommendations may be outdated"
          action={
            <Button variant="secondary" onClick={handleGenerate} disabled={generating}>
              Refresh now
            </Button>
          }
        >
          Analysed evidence has been added or changed since this report was generated.
        </RecommendationWarning>
      )}

      {!report ? (
        <RecommendationEmptyState generating={generating} />
      ) : (
        <section className="recommendations" aria-label="Intervention strategies">
          <div className="samples__head">
            <h2 className="samples__title">Recommended teaching sequence</h2>
            <span className="samples__meta">Generated {formatGeneratedAt(report.generatedAt)}</span>
          </div>
          <div className="recommendations__list" aria-live="polite">
            {report.strategies.map((strategy, index) => (
              <StrategyCard
                key={`${strategy.strategy}-${index}`}
                strategy={strategy}
                sequenceNumber={index + 1}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RecommendationEmptyState({ generating }) {
  return (
    <section className="recommendations-empty" aria-live="polite">
      {generating && <span className="recommendations-empty__spinner" aria-hidden="true" />}
      <h2>{generating ? 'Building recommendations…' : 'No recommendations yet'}</h2>
      <p>
        {generating
          ? 'The engine is reviewing all analysed and reviewed samples for this student.'
          : 'Generate a report to turn the student’s reviewed error evidence into practical teaching strategies.'}
      </p>
    </section>
  );
}

function RecommendationWarning({ title, children, action, tone }) {
  return (
    <div
      className={`recommendations-warning${
        tone === 'error' ? ' recommendations-warning--error' : ''
      }`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
      {action}
    </div>
  );
}

function StrategyCard({ strategy, sequenceNumber }) {
  return (
    <article className="recommendation-card">
      <span className="recommendation-card__number">Strategy {sequenceNumber}</span>
      <h3>{strategy.strategy}</h3>
      <p>{strategy.rationale}</p>

      <p className="recommendation-card__targets">
        <strong>Targets:</strong> {strategy.targetCategories.join(', ')}
      </p>

      {strategy.evidence.length > 0 && (
        <div className="recommendation-card__evidence">
          <strong>Reviewed evidence</strong>
          {strategy.evidence.map((item) => (
            <span key={item.category}>
              {item.category}: {item.count} {item.count === 1 ? 'error' : 'errors'}
              {item.writtenExamples.length > 0
                ? ` — ${item.writtenExamples.map((value) => `“${value}”`).join(', ')}`
                : ''}
            </span>
          ))}
        </div>
      )}

      {strategy.worksheets.map((worksheet) => (
        <WorksheetCard key={worksheet.worksheetId} worksheet={worksheet} />
      ))}
    </article>
  );
}

function WorksheetCard({ worksheet }) {
  return (
    <div className="worksheet-card">
      <div>
        <span className="eyebrow">Recommended worksheet</span>
        <h4>{worksheet.title}</h4>
        <p>{worksheet.rationale}</p>
        {worksheet.pdfPages && <small>Source: {worksheet.pdfPages}</small>}
      </div>
      {worksheet.available ? (
        <a
          className="btn btn--secondary"
          href={worksheetFileUrl(worksheet.worksheetId)}
          target="_blank"
          rel="noreferrer"
        >
          Open worksheet PDF
        </a>
      ) : (
        <span className="worksheet-card__unavailable">
          PDF unavailable while recommendation mock mode is active
        </span>
      )}
    </div>
  );
}

function RecommendationsSkeleton() {
  return (
    <div className="profile recommendations-page" aria-label="Loading recommendations">
      <header className="profile__head">
        <div className="profile__id">
          <span className="eyebrow">Intervention recommendations</span>
          <div className="skel skel--title" />
          <div className="skel skel--pill" />
        </div>
        <div className="skel skel--btn" />
      </header>
      <div className="recommendations__list" aria-hidden="true">
        {[0, 1].map((index) => (
          <div key={index} className="skel recommendations__skeleton-card" />
        ))}
      </div>
    </div>
  );
}

function RecommendationFeedback({ title, text, tone }) {
  return (
    <section className={`feedback${tone === 'error' ? ' feedback--error' : ''}`}>
      <h1 className="feedback__title">{title}</h1>
      <p className="feedback__text">{text}</p>
      <Button variant="secondary" icon="chevronLeft" to="/">
        Back to my students
      </Button>
    </section>
  );
}
