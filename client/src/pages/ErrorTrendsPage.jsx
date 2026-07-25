import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Button from '../components/Button.jsx';
import Icon from '../components/Icon.jsx';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

function ErrorTrendsPage() {
  const { studentId } = useParams();

  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
  async function loadTrends() {
    try {
      console.log('Sending request to backend...');

      const response = await fetch(
        'http://localhost:5000/api/error-trend'
      );

      console.log('Response status:', response.status);

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();

      console.log('Received trend data:', data);

      if (!Array.isArray(data)) {
        throw new Error('Backend response is not an array');
      }

      const sortedData = [...data].sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );

      setTrends(sortedData);
    } catch (error) {
      console.error('Failed to load error trends:', error);
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  loadTrends();
}, []);

  const summary = useMemo(() => {
    if (trends.length === 0) {
      return null;
    }

    const totalErrors = trends.reduce(
      (total, trend) =>
        total + Number(trend.totalErrors || 0),
      0
    );

    const categoryCounts = {};

    trends.forEach((trend) => {
      const category = trend.commonErrorType || 'unsure';

      categoryCounts[category] =
        (categoryCounts[category] || 0) + 1;
    });

    const mostCommonCategory =
      Object.entries(categoryCounts).sort(
        (first, second) => second[1] - first[1]
      )[0]?.[0] || 'unsure';

    const latestSample = trends[trends.length - 1];
    const previousSample = trends[trends.length - 2];

    let progress = 'Not enough information';

    if (previousSample) {
      const latestErrors = Number(
        latestSample.totalErrors || 0
      );

      const previousErrors = Number(
        previousSample.totalErrors || 0
      );

      if (latestErrors < previousErrors) {
        progress = 'Improving';
      } else if (latestErrors > previousErrors) {
        progress = 'Errors increased';
      } else {
        progress = 'No change';
      }
    }

    return {
      totalErrors,
      mostCommonCategory,
      progress,
      studentName: trends[0]?.studentName || 'Student',
    };
  }, [trends]);

  if (loading) {
    return (
      <div className="feedback">
        <h2 className="feedback__title">
          Loading error trends…
        </h2>

        <p className="feedback__text">
          Retrieving the records from the database.
        </p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="feedback feedback--error">
        <h2 className="feedback__title">
          Something went wrong
        </h2>

        <p className="feedback__text">{errorMessage}</p>
      </div>
    );
  }

  /*
   * 4b: insufficient-data screen.
   * Displayed when fewer than two records are returned.
   */
  if (trends.length < 2) {
    return (
      <div className="profile">
        <section className="profile__head">
          <div className="profile__id">
            <span className="eyebrow">
              Error trends
            </span>

            <h1 className="profile__name">
              {trends[0]?.studentName || 'Student'}
            </h1>
          </div>

          <div className="profile__actions">
            <Button
              variant="secondary"
              icon="chevronLeft"
              to={`/students/${studentId}`}
            >
              Back to student
            </Button>
          </div>
        </section>

        <section className="empty">
          <div
            className="empty__mark"
            aria-hidden="true"
          >
            <Icon name="trends" size={42} />
          </div>

          <h2 className="empty__title">
            Not enough samples for a trend yet
          </h2>

          <p className="empty__text">
            Trends require at least two analysed samples.
            Upload and analyse another writing sample to see
            how the student&apos;s errors change over time.
          </p>

          <Button
            variant="primary"
            icon="upload"
            disabled
            disabledHint="The upload page is not connected yet."
          >
            Upload writing sample
          </Button>
        </section>
      </div>
    );
  }

  /*
   * 4a: populated trends screen.
   * Displayed when at least two records are returned.
   */
  return (
    <div className="profile">
      <section className="profile__head">
        <div className="profile__id">
          <span className="eyebrow">
            Error trends
          </span>

          <h1 className="profile__name">
            {summary.studentName}
          </h1>

          <span className="grade">
            Errors across analysed samples
          </span>
        </div>

        <div className="profile__actions">
          <Button
            variant="secondary"
            icon="chevronLeft"
            to={`/students/${studentId}`}
          >
            Back
          </Button>

          <Button
            variant="secondary"
            icon="recommendations"
            to={`/students/${studentId}/recommendations`}
          >
            View recommendations
          </Button>
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
        }}
      >
        <SummaryCard
          title="Samples analysed"
          value={trends.length}
          detail={`${formatDate(
            trends[0].date
          )} – ${formatDate(
            trends[trends.length - 1].date
          )}`}
        />

        <SummaryCard
          title="Total errors"
          value={summary.totalErrors}
          detail="Across all analysed samples"
        />

        <SummaryCard
          title="Most common category"
          value={capitalise(
            summary.mostCommonCategory
          )}
          detail={summary.progress}
        />
      </section>

      <section className="samples">
        <div className="samples__head">
          <h2 className="samples__title">
            Total errors over time
          </h2>

          <span className="samples__meta">
            Earliest sample to latest sample
          </span>
        </div>

        <SimpleTrendChart trends={trends} />
      </section>

      <section className="samples">
        <div className="samples__head">
          <h2 className="samples__title">
            Error breakdown
          </h2>

          <span className="samples__meta">
            Data received from MongoDB
          </span>
        </div>

        <div className="samples__list">
          {trends.map((trend) => (
            <article
              className="sample-row sample-row--ready"
              key={trend._id || trend.date}
            >
              <span
                className="sample-row__thumb"
                aria-hidden="true"
              >
                <Icon name="trends" size={22} />

                <span className="sample-row__count">
                  {trend.totalErrors}
                </span>
              </span>

              <span className="sample-row__body">
                <span className="sample-row__title">
                  {formatDate(trend.date)}
                </span>

                <span className="sample-row__date">
                  Spelling: {trend.spellingErrors || 0}
                  {' · '}
                  Grammar: {trend.grammarErrors || 0}
                  {' · '}
                  Punctuation:{' '}
                  {trend.punctuationErrors || 0}
                </span>

                <span className="sample-row__date">
                  Common error:{' '}
                  {capitalise(trend.commonErrorType)}

                  {trend.commonErrorVariant
                    ? ` — ${trend.commonErrorVariant}`
                    : ''}
                </span>
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ title, value, detail }) {
  return (
    <article
      style={{
        padding: '18px',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius)',
        background: 'var(--surface)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <p
        style={{
          color: 'var(--muted)',
          fontSize: '13px',
          marginBottom: '5px',
        }}
      >
        {title}
      </p>

      <h2
        style={{
          fontFamily: 'var(--display)',
          fontSize: '26px',
          fontWeight: 500,
          marginBottom: '4px',
        }}
      >
        {value}
      </h2>

      <p
        style={{
          color: 'var(--muted)',
          fontSize: '13px',
        }}
      >
        {detail}
      </p>
    </article>
  );
}

function SimpleTrendChart({ trends }) {
  const width = 700;
  const height = 230;
  const padding = 38;

  const maximumErrors = Math.max(
    1,
    ...trends.map((trend) =>
      Number(trend.totalErrors || 0)
    )
  );

  function getXPosition(index) {
    return (
      padding +
      (index / (trends.length - 1)) *
        (width - padding * 2)
    );
  }

  function getYPosition(value) {
    return (
      height -
      padding -
      (Number(value) / maximumErrors) *
        (height - padding * 2)
    );
  }

  const points = trends
    .map(
      (trend, index) =>
        `${getXPosition(index)},${getYPosition(
          trend.totalErrors
        )}`
    )
    .join(' ');

  return (
    <div
      style={{
        padding: '18px',
        overflowX: 'auto',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius)',
        background: 'var(--surface)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{
          width: '100%',
          minWidth: '550px',
          display: 'block',
        }}
        role="img"
        aria-label="Total errors over time"
      >
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="var(--border-strong)"
        />

        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="var(--border-strong)"
        />

        <polyline
          points={points}
          fill="none"
          stroke="var(--sage-strong)"
          strokeWidth="3"
        />

        {trends.map((trend, index) => (
          <g key={trend._id || trend.date}>
            <circle
              cx={getXPosition(index)}
              cy={getYPosition(trend.totalErrors)}
              r="5"
              fill="var(--surface)"
              stroke="var(--sage-strong)"
              strokeWidth="3"
            />

            <text
              x={getXPosition(index)}
              y={
                getYPosition(trend.totalErrors) - 12
              }
              textAnchor="middle"
              fill="var(--ink)"
              fontSize="12"
            >
              {trend.totalErrors}
            </text>

            <text
              x={getXPosition(index)}
              y={height - 12}
              textAnchor="middle"
              fill="var(--muted)"
              fontSize="11"
            >
              {formatShortDate(trend.date)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function formatDate(date) {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Unknown date';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsedDate);
}

function formatShortDate(date) {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(parsedDate);
}

function capitalise(value) {
  if (!value) {
    return 'Unsure';
  }

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

export default ErrorTrendsPage;