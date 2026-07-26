import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// React's act() (used directly in UploadModal.test.jsx to flush an async
// handler) checks this flag before running - without it, it warns even
// though the flush still works correctly.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Explicit rather than relying on vitest's `globals: true` - this project
// imports test functions directly (describe/it/expect/...), so Testing
// Library's own auto-cleanup (which hooks into a global afterEach) never
// registers unless we do it ourselves here.
afterEach(() => {
  cleanup();
});
