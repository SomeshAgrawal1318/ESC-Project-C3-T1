// Screen 3 — Error Report & Review. GET /api/samples/:sampleId/report.
// A 404 here means either the sample doesn't exist, or analysis hasn't
// finished (see reportController.getErrorReport) - the second case gets
// its own "not analysed yet" state rather than reading as a dead link.

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSampleReport, getSampleImageUrl } from '../lib/api.js';
import Button from '../components/Button.jsx';
import ScanViewer from '../components/ScanViewer.jsx';
import ErrorCardList from '../components/ErrorCardList.jsx';

export default function ErrorReportPage() {
  const { sampleId } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading' });
  const [selectedErrorId, setSelectedErrorId] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);

  // Render-phase reset (same pattern as StudentProfilePage) so navigating
  // between two samples never flashes the previous report.
  const [loadedFor, setLoadedFor] = useState(sampleId);
  if (loadedFor !== sampleId) {
    setLoadedFor(sampleId);
    setState({ status: 'loading' });
    setCurrentPage(0);
  }

  useEffect(() => {
    let live = true;
    getSampleReport(sampleId)
      .then((report) => {
        if (!live) return;
        setState({ status: 'ready', report });
        setSelectedErrorId(report.detectedErrors[0]?.errorId ?? null);
      })
      .catch((err) => {
        if (!live) return;
        if (err.status === 404) setState({ status: 'not-analysed' });
        else setState({ status: 'error', message: err.message });
      });
    return () => {
      live = false;
    };
  }, [sampleId]);

  // --- Person 5's territory below: stubs only. Person 4 owns the card and
  // its buttons; Person 5 owns the reclassify/remove panels and the PATCH
  // request that follows them (paths.txt "Error card callbacks" seam).
  const handleReclassify = (errorId) =>
    console.log('TODO(Person 5): open reclassify panel for', errorId);
  const handleRemove = (errorId) =>
    console.log('TODO(Person 5): open remove-tag confirm for', errorId);
  const handleConfirm = (errorId) =>
    console.log('TODO(Person 5): PATCH confirm action for', errorId);

  if (state.status === 'loading') return <ReportSkeleton />;

  if (state.status === 'not-analysed') {
    return (
      <div className="feedback">
        <h2 className="feedback__title">This sample hasn’t been analysed yet</h2>
        <p className="feedback__text">
          Analysis usually takes a few seconds. Come back to this page once the
          sample shows “Analysed” in the writing samples list.
        </p>
        <div className="feedback__actions">
          <Button variant="secondary" icon="chevronLeft" onClick={() => navigate(-1)}>
            Back
          </Button>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Check again
          </Button>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="feedback">
        <h2 className="feedback__title">Couldn’t load this report</h2>
        <p className="feedback__text feedback--error">{state.message}</p>
        <Button variant="secondary" icon="chevronLeft" onClick={() => navigate(-1)}>
          Back
        </Button>
      </div>
    );
  }

  const { report } = state;

  return (
    <div className="report">
      <header className="report__head">
        <Button variant="secondary" icon="chevronLeft" onClick={() => navigate(-1)}>
          Back
        </Button>
        <div className="report__id">
          <span className="eyebrow">Error report</span>
          <h1 className="report__title">{report.title}</h1>
          <p className="report__sub">
            {report.statistics.total} {report.statistics.total === 1 ? 'error' : 'errors'} tagged ·
            analysed {new Date(report.generatedAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
        <Button variant="secondary" icon="check">
          Mark review done
        </Button>
      </header>

      <div className="report__split">
        <ScanViewer
          imageUrl={getSampleImageUrl(report.sampleId, currentPage)}
          pageCount={report.pageCount ?? 0}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          errors={report.detectedErrors}
          selectedErrorId={selectedErrorId}
          onSelect={setSelectedErrorId}
        />
        <ErrorCardList
          errors={report.detectedErrors}
          statistics={report.statistics}
          selectedErrorId={selectedErrorId}
          onSelect={setSelectedErrorId}
          onReclassify={handleReclassify}
          onRemove={handleRemove}
          onConfirm={handleConfirm}
        />
      </div>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="report" aria-hidden="true">
      <header className="report__head">
        <div className="skel skel--btn" style={{ width: 90 }} />
        <div className="report__id">
          <span className="eyebrow">Error report</span>
          <div className="skel skel--title" />
        </div>
        <div className="skel skel--btn" />
      </header>
      <div className="report__split">
        <div className="skel skel--row" style={{ flex: 55, height: 420 }} />
        <div className="skel skel--row" style={{ flex: 45, height: 420 }} />
      </div>
    </div>
  );
}