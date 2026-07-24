// One row in the Writing samples list. A finished sample links to its error
// report (screen 3, GET /api/samples/:sampleId/report); a sample still being
// analysed is inert — no link, muted look — matching the wireframe.

import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import StatusPill from './StatusPill.jsx';
import { statusFor } from '../lib/status.js';

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function formatUploaded(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d);
}

export default function SampleRow({ sample }) {
  const { ready } = statusFor(sample.analysisStatus);

  const inner = (
    <>
      <span className="sample-row__thumb" aria-hidden="true">
        <Icon name="page" size={22} />
        {sample.imageCount > 1 && (
          <span className="sample-row__count">{sample.imageCount}</span>
        )}
      </span>
      <span className="sample-row__body">
        <span className="sample-row__title">{sample.title}</span>
        <span className="sample-row__date">
          Uploaded {formatUploaded(sample.uploadedAt)}
        </span>
      </span>
      <StatusPill analysisStatus={sample.analysisStatus} />
      {ready && (
        <Icon name="arrow" size={20} className="sample-row__go" />
      )}
    </>
  );

  if (ready) {
    return (
      <Link
        className="sample-row sample-row--ready"
        to={`/samples/${sample.sampleId}`}
        aria-label={`Open error report for ${sample.title}`}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="sample-row sample-row--waiting" aria-disabled="true">
      {inner}
    </div>
  );
}
