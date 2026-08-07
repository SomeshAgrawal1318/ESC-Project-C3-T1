// hooks/useSamplePolling.js
// -------------------------
// polls GET /api/samples/:sampleId every 2s until analysis finishes, or
// gives up. backs the upload modal's "analysing" state (2b).
//
// stops once analysisStatus reads as "done" (via statusFor - handles
// ANALYSED and REVIEWED both, not just one hardcoded value), on FAILED, or
// after MAX_ATTEMPTS with no answer - a stuck sample must not spin the UI
// forever.

import { useEffect, useState } from 'react';
import { getSample } from '../lib/api.js';
import { statusFor } from '../lib/status.js';

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 30; // ~1 minute of polling before giving up

// status: 'polling' | 'complete' | 'failed' | 'timeout' | 'error'
export function useSamplePolling(sampleId) {
  const [state, setState] = useState({ status: 'polling', sample: null });

  // reset the moment sampleId changes (render-phase reset, same pattern
  // StudentProfilePage.jsx uses) rather than setState inside the effect
  // below, which would cost an extra wasted render.
  const [trackedId, setTrackedId] = useState(sampleId);
  if (trackedId !== sampleId) {
    setTrackedId(sampleId);
    setState({ status: 'polling', sample: null });
  }

  useEffect(() => {
    if (!sampleId) return undefined;

    let live = true;
    let timeoutId;
    let attempts = 0; // scoped to this effect run, so a new sampleId starts fresh

    async function poll() {
      attempts += 1;

      let sample;
      try {
        sample = await getSample(sampleId);
      } catch (err) {
        if (live) setState({ status: 'error', message: err.message });
        return;
      }
      if (!live) return;

      if (sample.analysisStatus === 'FAILED') {
        setState({ status: 'failed', sample });
      } else if (statusFor(sample.analysisStatus).ready) {
        setState({ status: 'complete', sample });
      } else if (attempts >= MAX_ATTEMPTS) {
        setState({ status: 'timeout', sample });
      } else {
        timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();

    // closing the modal only stops this effect from watching - the
    // analysis itself runs server-side and keeps going regardless.
    return () => {
      live = false;
      clearTimeout(timeoutId);
    };
  }, [sampleId]);

  return state;
}
