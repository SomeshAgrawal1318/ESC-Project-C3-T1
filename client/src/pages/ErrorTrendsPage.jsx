import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Button from '../components/Button.jsx';
import Icon from '../components/Icon.jsx';
import {
  getStudentTrend,
  getStudent,
} from '../lib/api.js';

const CHART_CATEGORIES = [
  {
    key: 'phonological',
    label: 'Phonological',
    marker: 'diamond',
    className: 'trend-series--phonological',
  },
  {
    key: 'orthographic',
    label: 'Orthographic',
    marker: 'circle',
    className: 'trend-series--orthographic',
  },
  {
    key: 'morphological',
    label: 'Morphological',
    marker: 'triangle',
    className: 'trend-series--morphological',
  },
  {
    key: 'capitalisation',
    label: 'Capitalisation',
    marker: 'square',
    className: 'trend-series--capitalisation',
  },
  {
    key: 'punctuation',
    label: 'Punctuation',
    marker: 'plus',
    className: 'trend-series--punctuation',
  },
];

export default function ErrorTrendsPage() {
  const { studentId } = useParams();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let live = true;

    async function loadPage() {
      try {
        setState({ status: 'loading' });

        // The existing student screens can continue using mockData.
        // We only use the returned name to find this student's live MongoDB reports.
        const student = await getStudent(studentId);

        if (!student) {
          if (live) setState({ status: 'notfound' });
          return;
        }

        const trendData = await getStudentTrend(studentId);
        const sortedTrends = [...trendData.trends].sort(
          (first, second) => new Date(first.date) - new Date(second.date),
        );

        if (live) {
          setState({
            status: 'ready',
            student,
            trends: sortedTrends,
          });
        }
      } catch (error) {
        if (live) {
          setState({
            status: 'error',
            message: error.message,
          });
        }
      }
    }

    loadPage();

    return () => {
      live = false;
    };
  }, [studentId]);

  if (state.status === 'loading') {
    return (
      <div className="feedback">
        <h2 className="feedback__title">Loading error trends…</h2>
        <p className="feedback__text">
          Retrieving the selected student&apos;s reports from MongoDB.
        </p>
      </div>
    );
  }

  if (state.status === 'notfound') {
    return (
      <Feedback
        title="Student not found"
        text="The selected student could not be found in the current caseload."
      />
    );
  }

  if (state.status === 'error') {
    return (
      <Feedback
        title="Couldn’t load error trends"
        text={state.message}
        tone="error"
      />
    );
  }

  const { student, trends } = state;

  if (trends.length < 2) {
    return (
      <div className="profile">
        <header className="profile__head">
          <div className="profile__id">
            <span className="eyebrow">Error trends</span>
            <h1 className="profile__name">{student.name}</h1>
            <span className="grade">{student.currentGrade}</span>
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
        </header>

        <section className="empty">
          <div className="empty__mark" aria-hidden="true">
            <Icon name="trends" size={42} />
          </div>
          <h2 className="empty__title">
            Not enough samples for a trend yet
          </h2>
          <p className="empty__text">
            At least two analysed writing samples are needed before a trend can
            be drawn.
          </p>
        </section>
      </div>
    );
  }

  return (
    <PopulatedTrends
      studentId={studentId}
      student={student}
      trends={trends}
    />
  );
}

function PopulatedTrends({ studentId, student, trends }) {
  const samplePoints = useMemo(
    () => trends.map(createSamplePoint),
    [trends],
  );

  const summary = useMemo(
    () => createSummary(samplePoints),
    [samplePoints],
  );

  const displayedName = student.name || trends[0]?.studentName || 'Student';

  return (
    <div className="trend-page">
      <header className="trend-header">
        <Button
          variant="secondary"
          icon="chevronLeft"
          to={`/students/${studentId}`}
        >
          {displayedName}
        </Button>

        <div className="trend-header__title">
          <h1>Error trends</h1>
          <p>Errors per category, across analysed samples in date order</p>
        </div>

        <Button
          variant="secondary"
          icon="recommendations"
          to={`/students/${studentId}/recommendations`}
        >
          View recommendations
        </Button>
      </header>

      <section className="trend-summary" aria-label="Trend summary">
        <SummaryCard
          title="Samples analysed"
          value={samplePoints.length}
          detail={`${formatShortDate(samplePoints[0].date)} – ${formatDate(
            samplePoints[samplePoints.length - 1].date,
          )}`}
        />

        <SummaryCard
          title="Most frequent category"
          value={capitalise(summary.mostCommonCategory)}
          valuePrefix="◆"
          detail={`${summary.mostCommonCount} of ${summary.taggedErrorCount} tagged errors`}
        />

        <SummaryCard
          title="vs previous sample"
          value={summary.progressLabel}
          valuePrefix={summary.progressSymbol}
          detail={`${summary.previousTotal} errors → ${summary.latestTotal} errors overall`}
        />
      </section>

      <section className="trend-filters" aria-label="Displayed samples">
        <div className="trend-filter trend-filter--range">
          <span className="trend-filter__label">Date range</span>
          <span className="trend-range-control">
            Last 3 months <span aria-hidden="true">⌄</span>
          </span>
        </div>

        <div className="trend-filter trend-filter--samples">
          <span className="trend-filter__label">Samples included</span>
          <div className="trend-filter__chips">
            {samplePoints.map((sample) => (
              <span
                className="trend-sample-chip trend-sample-chip--selected"
                key={sample._id || sample.date}
              >
                <span aria-hidden="true">☑</span>
                {formatShortDate(sample.date)}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="trend-chart-card">
        <CategoryTrendChart samples={samplePoints} />
        <p className="trend-chart-note">
          Lines are labelled directly at their end — each category keeps its
          symbol throughout the chart.
        </p>
      </section>
    </div>
  );
}

function SummaryCard({ title, value, detail, valuePrefix = '' }) {
  return (
    <article className="trend-summary-card">
      <p className="trend-summary-card__title">{title}</p>
      <h2 className="trend-summary-card__value">
        {valuePrefix && (
          <span className="trend-summary-card__symbol" aria-hidden="true">
            {valuePrefix}
          </span>
        )}
        {value}
      </h2>
      <p className="trend-summary-card__detail">{detail}</p>
    </article>
  );
}

function CategoryTrendChart({ samples }) {
  const width = 1040;
  const height = 390;
  const margin = { top: 30, right: 205, bottom: 58, left: 66 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const maximumCount = Math.max(
    1,
    ...samples.flatMap((sample) =>
      CHART_CATEGORIES.map((category) => sample.counts[category.key] || 0),
    ),
  );

  const yMaximum = Math.max(4, Math.ceil(maximumCount / 2) * 2);
  const tickStep = yMaximum <= 5 ? 1 : 2;
  const yTicks = [];

  for (let value = 0; value <= yMaximum; value += tickStep) {
    yTicks.push(value);
  }

  const getX = (index) =>
    margin.left +
    (index / Math.max(1, samples.length - 1)) * plotWidth;

  const getY = (value) =>
    margin.top + plotHeight - (Number(value) / yMaximum) * plotHeight;

  const labelPositions = calculateLabelPositions(
    CHART_CATEGORIES.map((category) => ({
      key: category.key,
      desiredY: getY(
        samples[samples.length - 1].counts[category.key] || 0,
      ),
    })),
    margin.top,
    margin.top + plotHeight,
  );

  return (
    <div className="trend-chart-scroll">
      <svg
        className="trend-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Errors per category over time"
      >
        <text
          className="trend-chart__axis-title"
          x={18}
          y={margin.top + plotHeight / 2}
          transform={`rotate(-90 18 ${margin.top + plotHeight / 2})`}
          textAnchor="middle"
        >
          errors tagged
        </text>

        {yTicks.map((tick) => {
          const y = getY(tick);
          return (
            <g key={tick}>
              <line
                className="trend-chart__grid"
                x1={margin.left}
                y1={y}
                x2={margin.left + plotWidth}
                y2={y}
              />
              <text
                className="trend-chart__tick"
                x={margin.left - 13}
                y={y + 4}
                textAnchor="end"
              >
                {tick}
              </text>
            </g>
          );
        })}

        <line
          className="trend-chart__axis"
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={margin.top + plotHeight}
        />
        <line
          className="trend-chart__axis"
          x1={margin.left}
          y1={margin.top + plotHeight}
          x2={margin.left + plotWidth}
          y2={margin.top + plotHeight}
        />

        {CHART_CATEGORIES.map((category) => {
          const points = samples.map((sample, index) => ({
            x: getX(index),
            y: getY(sample.counts[category.key] || 0),
            value: sample.counts[category.key] || 0,
            sample,
          }));

          const path = points
            .map((point, index) =>
              `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`,
            )
            .join(' ');

          const lastPoint = points[points.length - 1];
          const labelY = labelPositions[category.key];

          return (
            <g
              className={`trend-series ${category.className}`}
              key={category.key}
            >
              <path className="trend-series__line" d={path} />

              {points.map((point) => (
                <g key={`${category.key}-${point.sample._id || point.sample.date}`}>
                  <title>
                    {`${formatDate(point.sample.date)} — ${category.label}: ${point.value}`}
                  </title>
                  <ChartMarker
                    type={category.marker}
                    x={point.x}
                    y={point.y}
                  />
                </g>
              ))}

              <line
                className="trend-series__label-guide"
                x1={lastPoint.x + 8}
                y1={lastPoint.y}
                x2={lastPoint.x + 27}
                y2={labelY}
              />
              <ChartMarker
                type={category.marker}
                x={lastPoint.x + 39}
                y={labelY}
                small
              />
              <text
                className="trend-series__label"
                x={lastPoint.x + 52}
                y={labelY + 4}
              >
                {category.label}
              </text>
            </g>
          );
        })}

        {samples.map((sample, index) => (
          <text
            className="trend-chart__date"
            x={getX(index)}
            y={height - 18}
            textAnchor="middle"
            key={sample._id || sample.date}
          >
            {formatShortDate(sample.date)}
          </text>
        ))}
      </svg>
    </div>
  );
}

function ChartMarker({ type, x, y, small = false }) {
  const size = small ? 4 : 6;

  if (type === 'diamond') {
    return (
      <polygon
        className="trend-series__marker trend-series__marker--filled"
        points={`${x},${y - size} ${x + size},${y} ${x},${
          y + size
        } ${x - size},${y}`}
      />
    );
  }

  if (type === 'triangle') {
    return (
      <polygon
        className="trend-series__marker trend-series__marker--filled"
        points={`${x},${y - size} ${x + size},${y + size} ${
          x - size
        },${y + size}`}
      />
    );
  }

  if (type === 'square') {
    return (
      <rect
        className="trend-series__marker"
        x={x - size}
        y={y - size}
        width={size * 2}
        height={size * 2}
      />
    );
  }

  if (type === 'plus') {
    return (
      <g className="trend-series__marker trend-series__marker--plus">
        <line x1={x - size} y1={y} x2={x + size} y2={y} />
        <line x1={x} y1={y - size} x2={x} y2={y + size} />
      </g>
    );
  }

  return (
    <circle
      className="trend-series__marker"
      cx={x}
      cy={y}
      r={size}
    />
  );
}

function createSamplePoint(trend) {
  const counts = Object.fromEntries(
    CHART_CATEGORIES.map((category) => [category.key, 0]),
  );

  for (const error of trend.errors || []) {
    if (error.dismissed === true) continue;
    if (Object.hasOwn(counts, error.category)) {
      counts[error.category] += 1;
    }
  }

  return {
    ...trend,
    counts,
  };
}

function createSummary(samples) {
  const totalsByCategory = Object.fromEntries(
    CHART_CATEGORIES.map((category) => [category.key, 0]),
  );

  for (const sample of samples) {
    for (const category of CHART_CATEGORIES) {
      totalsByCategory[category.key] += sample.counts[category.key] || 0;
    }
  }

  const [mostCommonCategory, mostCommonCount] = Object.entries(
    totalsByCategory,
  ).sort((first, second) => second[1] - first[1])[0];

  const taggedErrorCount = Object.values(totalsByCategory).reduce(
    (total, count) => total + count,
    0,
  );

  const latestTotal = Number(samples[samples.length - 1].totalErrors || 0);
  const previousTotal = Number(samples[samples.length - 2].totalErrors || 0);

  if (latestTotal < previousTotal) {
    return {
      mostCommonCategory,
      mostCommonCount,
      taggedErrorCount,
      latestTotal,
      previousTotal,
      progressLabel: 'Improving',
      progressSymbol: '↘',
    };
  }

  if (latestTotal > previousTotal) {
    return {
      mostCommonCategory,
      mostCommonCount,
      taggedErrorCount,
      latestTotal,
      previousTotal,
      progressLabel: 'Errors increased',
      progressSymbol: '↗',
    };
  }

  return {
    mostCommonCategory,
    mostCommonCount,
    taggedErrorCount,
    latestTotal,
    previousTotal,
    progressLabel: 'No change',
    progressSymbol: '→',
  };
}

function calculateLabelPositions(labels, minimumY, maximumY) {
  const minimumGap = 24;
  const sorted = [...labels].sort((first, second) => first.desiredY - second.desiredY);

  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].desiredY - sorted[index - 1].desiredY < minimumGap) {
      sorted[index].desiredY = sorted[index - 1].desiredY + minimumGap;
    }
  }

  const overflow = sorted[sorted.length - 1].desiredY - maximumY;
  if (overflow > 0) {
    sorted.forEach((label) => {
      label.desiredY -= overflow;
    });
  }

  const underflow = minimumY - sorted[0].desiredY;
  if (underflow > 0) {
    sorted.forEach((label) => {
      label.desiredY += underflow;
    });
  }

  return Object.fromEntries(
    sorted.map((label) => [label.key, label.desiredY]),
  );
}

function Feedback({ title, text, tone }) {
  return (
    <div className={`feedback${tone === 'error' ? ' feedback--error' : ''}`}>
      <h2 className="feedback__title">{title}</h2>
      <p className="feedback__text">{text}</p>
      <Button variant="secondary" icon="chevronLeft" to="/">
        Back to my students
      </Button>
    </div>
  );
}

function formatDate(date) {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return 'Unknown date';

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsedDate);
}

function formatShortDate(date) {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
  }).format(parsedDate);
}

function capitalise(value) {
  if (!value) return 'Unsure';
  return value.charAt(0).toUpperCase() + value.slice(1);
}
