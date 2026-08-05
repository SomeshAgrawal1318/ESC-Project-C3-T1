import { useId } from 'react';
import { Link } from 'react-router-dom';

import { categoryFor } from '../lib/categories.js';
import { TREND_CATEGORIES } from '../lib/trends.js';

const SERIES = {
  phonological: { dash: undefined, marker: 'diamond' },
  orthographic: { dash: '10 7', marker: 'circle' },
  morphological: { dash: '2 7', marker: 'triangle' },
  capitalisation: { dash: '15 6 3 6', marker: 'square' },
  punctuation: { dash: '5 5', marker: 'plus' },
};

const shortDate = new Intl.DateTimeFormat('en-SG', {
  day: '2-digit',
  month: 'short',
});

export default function TrendChart({
  samples,
  excludedIds,
  activeCategory,
  onCategoryChange,
  onOpenSample,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const included = samples.filter((sample) => !excludedIds.has(String(sample.sampleId)));
  const includedIds = new Set(included.map((sample) => String(sample.sampleId)));
  const category = categoryFor(activeCategory);
  const config = SERIES[activeCategory];
  const categoryTotals = Object.fromEntries(
    TREND_CATEGORIES.map((item) => [
      item,
      included.reduce((total, sample) => total + sample.counts[item], 0),
    ])
  );

  const chartWidth = Math.max(920, 350 + Math.max(samples.length - 1, 1) * 190);
  const chartHeight = 390;
  const plot = {
    left: 62,
    top: 36,
    right: chartWidth - 38,
    bottom: 285,
  };
  const plotWidth = plot.right - plot.left;
  const plotHeight = plot.bottom - plot.top;
  const maxValue = Math.max(0, ...included.map((sample) => sample.counts[activeCategory]));
  const axisMax = Math.max(4, Math.ceil(maxValue / 2) * 2);
  const tickCount = 4;

  const xForIndex = (index) =>
    samples.length === 1
      ? plot.left + plotWidth / 2
      : plot.left + (index / (samples.length - 1)) * plotWidth;
  const yForValue = (value) => plot.bottom - (value / axisMax) * plotHeight;
  const points = samples
    .map((sample, sampleIndex) => ({ sample, sampleIndex }))
    .filter(({ sample }) => includedIds.has(String(sample.sampleId)))
    .map(({ sample, sampleIndex }) => ({
      sample,
      x: xForIndex(sampleIndex),
      y: yForValue(sample.counts[activeCategory]),
    }));
  const areaPoints = [
    `${points[0].x},${plot.bottom}`,
    ...points.map((point) => `${point.x},${point.y}`),
    `${points.at(-1).x},${plot.bottom}`,
  ].join(' ');

  return (
    <section className="trend-chart-card" aria-labelledby={titleId}>
      <div className="trend-chart-card__head">
        <div>
          <span className="eyebrow">Category movement</span>
          <h2 id={titleId} className="trend-chart-card__title">
            {category.label} errors over time
          </h2>
        </div>
        <p className="trend-chart-card__focus">
          <strong>{categoryTotals[activeCategory]}</strong> tagged across {included.length} samples
        </p>
      </div>

      <div className="trend-category-nav" aria-label="Choose an error category">
        {TREND_CATEGORIES.map((item) => {
          const itemCategory = categoryFor(item);
          const itemConfig = SERIES[item];
          const selected = item === activeCategory;
          return (
            <button
              key={item}
              type="button"
              className={`trend-category-option trend-category-option--${item}${selected ? ' trend-category-option--active' : ''}`}
              aria-pressed={selected}
              onClick={() => onCategoryChange(item)}
            >
              <svg className="trend-category-option__marker" viewBox="0 0 20 20" aria-hidden="true">
                <SeriesMarker marker={itemConfig.marker} x={10} y={10} small />
              </svg>
              <span>{itemCategory.label}</span>
              <strong>{categoryTotals[item]}</strong>
            </button>
          );
        })}
      </div>

      <p className="trend-chart-card__hint">Select a point to open that sample’s error report.</p>

      <div className="trend-chart-scroll" tabIndex="0" aria-label="Scrollable trends chart">
        <svg
          className="trend-chart"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          style={{ width: `${chartWidth}px`, minWidth: `${chartWidth}px` }}
          aria-labelledby={`${titleId} ${descriptionId}`}
        >
          <desc id={descriptionId}>
            Line chart showing {category.label.toLowerCase()} errors across the selected writing
            samples.
          </desc>

          <text
            className="trend-chart__axis-title"
            x="18"
            y={(plot.top + plot.bottom) / 2}
            textAnchor="middle"
            transform={`rotate(-90 18 ${(plot.top + plot.bottom) / 2})`}
          >
            Errors tagged
          </text>

          {Array.from({ length: tickCount + 1 }, (_, index) => {
            const value = (axisMax / tickCount) * index;
            const y = yForValue(value);
            return (
              <g key={value}>
                <line className="trend-chart__grid" x1={plot.left} x2={plot.right} y1={y} y2={y} />
                <text className="trend-chart__tick" x={plot.left - 13} y={y + 4} textAnchor="end">
                  {Number.isInteger(value) ? value : value.toFixed(1)}
                </text>
              </g>
            );
          })}

          <line
            className="trend-chart__axis"
            x1={plot.left}
            x2={plot.left}
            y1={plot.top}
            y2={plot.bottom}
          />
          <line
            className="trend-chart__axis"
            x1={plot.left}
            x2={plot.right}
            y1={plot.bottom}
            y2={plot.bottom}
          />

          {samples.map((sample, index) => {
            const x = xForIndex(index);
            const isIncluded = includedIds.has(String(sample.sampleId));
            return (
              <g key={sample.sampleId}>
                {!isIncluded && (
                  <>
                    <line
                      className="trend-chart__excluded"
                      x1={x}
                      x2={x}
                      y1={plot.top}
                      y2={plot.bottom}
                    />
                    <text
                      className="trend-chart__excluded-label"
                      x={x}
                      y={plot.top - 10}
                      textAnchor="middle"
                    >
                      Excluded
                    </text>
                  </>
                )}
                <text
                  className={`trend-chart__date${isIncluded ? '' : ' trend-chart__date--excluded'}`}
                  x={x}
                  y={plot.bottom + 27}
                  textAnchor="middle"
                >
                  {shortDate.format(new Date(sample.uploadedAt))}
                </text>
                <text
                  className={`trend-chart__sample-title${isIncluded ? '' : ' trend-chart__date--excluded'}`}
                  x={x}
                  y={plot.bottom + 47}
                  textAnchor="middle"
                >
                  {shortTitle(sample.title)}
                </text>
              </g>
            );
          })}

          <g className={`trend-series trend-series--${activeCategory}`}>
            <polygon className="trend-series__area" points={areaPoints} />
            <polyline
              className="trend-series__line"
              points={points.map((point) => `${point.x},${point.y}`).join(' ')}
              strokeDasharray={config.dash}
            />

            {points.map(({ sample, x, y }) => {
              const count = sample.counts[activeCategory];
              return (
                <g key={sample.sampleId}>
                  <text className="trend-point__value" x={x} y={Math.max(plot.top + 12, y - 16)}>
                    {count}
                  </text>
                  <g
                    className="trend-point"
                    role="link"
                    tabIndex="0"
                    aria-label={`${sample.title}, ${category.label}: ${count} ${count === 1 ? 'error' : 'errors'}. Open error report.`}
                    onClick={() => onOpenSample(sample.sampleId)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onOpenSample(sample.sampleId);
                      }
                    }}
                  >
                    <title>{`${sample.title} — ${category.label}: ${count}`}</title>
                    <circle className="trend-point__hit" cx={x} cy={y} r="16" />
                    <circle className="trend-point__focus" cx={x} cy={y} r="11" />
                    <SeriesMarker marker={config.marker} x={x} y={y} />
                  </g>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <details className="trend-table-wrap">
        <summary>View all category data as a table</summary>
        <div className="trend-table-scroll">
          <table className="trend-table">
            <thead>
              <tr>
                <th scope="col">Writing sample</th>
                {TREND_CATEGORIES.map((item) => (
                  <th key={item} scope="col">
                    {categoryFor(item).label}
                  </th>
                ))}
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((sample) => {
                const includedRow = includedIds.has(String(sample.sampleId));
                return (
                  <tr key={sample.sampleId} className={includedRow ? '' : 'trend-table__excluded'}>
                    <th scope="row">
                      <Link to={`/samples/${sample.sampleId}`}>{sample.title}</Link>
                      <span>{shortDate.format(new Date(sample.uploadedAt))}</span>
                      {!includedRow && <span>Excluded</span>}
                    </th>
                    {TREND_CATEGORIES.map((item) => (
                      <td key={item}>{sample.counts[item]}</td>
                    ))}
                    <td>{sample.totalErrors}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function shortTitle(title) {
  return title.length > 18 ? `${title.slice(0, 17)}…` : title;
}

function SeriesMarker({ marker, x, y, small = false }) {
  const size = small ? 5 : 6;

  if (marker === 'diamond') {
    return (
      <path
        className="trend-marker trend-marker--fill"
        d={`M ${x} ${y - size} L ${x + size} ${y} L ${x} ${y + size} L ${x - size} ${y} Z`}
      />
    );
  }
  if (marker === 'circle') {
    return <circle className="trend-marker trend-marker--outline" cx={x} cy={y} r={size} />;
  }
  if (marker === 'triangle') {
    return (
      <path
        className="trend-marker trend-marker--fill"
        d={`M ${x} ${y - size - 1} L ${x + size + 1} ${y + size} L ${x - size - 1} ${y + size} Z`}
      />
    );
  }
  if (marker === 'square') {
    return (
      <rect
        className="trend-marker trend-marker--outline"
        x={x - size}
        y={y - size}
        width={size * 2}
        height={size * 2}
      />
    );
  }
  return (
    <path
      className="trend-marker trend-marker--plus"
      d={`M ${x} ${y - size - 1} V ${y + size + 1} M ${x - size - 1} ${y} H ${x + size + 1}`}
    />
  );
}
