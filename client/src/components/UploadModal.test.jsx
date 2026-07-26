import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UploadModal from './UploadModal.jsx';
import { uploadSample } from '../lib/api.js';
import { useSamplePolling } from '../hooks/useSamplePolling.js';

vi.mock('../lib/api.js', () => ({
  uploadSample: vi.fn(),
}));

vi.mock('../hooks/useSamplePolling.js', () => ({
  useSamplePolling: vi.fn(),
}));

function renderModal(props = {}) {
  return render(
    <MemoryRouter>
      <UploadModal studentId="stu_wei" onClose={vi.fn()} onUploaded={vi.fn()} {...props} />
    </MemoryRouter>
  );
}

function makeFile(name = 'page.jpg') {
  return new File(['contents'], name, { type: 'image/jpeg' });
}

function fileInput() {
  return document.querySelector('input[type="file"]');
}

// The Analyse button's onClick triggers handleAnalyse, an async function
// that awaits uploadSample() before updating state. fireEvent.click doesn't
// wait for that - wrapping it in act() flushes the microtask queue so the
// resulting state update has actually committed by the time we assert.
async function clickAnalyse() {
  await act(async () => {
    fireEvent.click(screen.getByText('Analyse sample →'));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useSamplePolling.mockReturnValue({ status: 'polling', sample: null });
});

describe('UploadModal', () => {
  it('2a: disables Analyse until a file is chosen, enables it once one is', () => {
    renderModal();

    expect(screen.getByText('Upload writing sample')).toBeInTheDocument();
    const analyseButton = screen.getByText('Analyse sample →');
    expect(analyseButton.closest('[aria-disabled="true"]')).toBeTruthy();

    fireEvent.change(fileInput(), { target: { files: [makeFile()] } });

    expect(screen.getByText('page.jpg')).toBeInTheDocument();
    expect(screen.getByText('Analyse sample →').closest('[aria-disabled="true"]')).toBeNull();
  });

  it('2a -> 2b: moves to the analysing panel once upload succeeds', async () => {
    uploadSample.mockResolvedValue({ _id: 'smp_123' });
    renderModal();

    fireEvent.change(fileInput(), { target: { files: [makeFile()] } });
    await clickAnalyse();

    expect(screen.getByText('Analysing your upload…')).toBeInTheDocument();
    expect(uploadSample).toHaveBeenCalledWith('stu_wei', [expect.any(File)]);
  });

  it('2b -> 2c: moves to the success panel once polling reports complete', async () => {
    uploadSample.mockResolvedValue({ _id: 'smp_123' });
    useSamplePolling.mockReturnValue({ status: 'complete', sample: { sampleId: 'smp_123' } });

    renderModal();
    fireEvent.change(fileInput(), { target: { files: [makeFile()] } });
    await clickAnalyse();

    expect(screen.getByText('Sample analysed')).toBeInTheDocument();
    expect(screen.getByText('Open error report →').closest('a')).toHaveAttribute(
      'href',
      '/samples/smp_123'
    );
  });

  it('2a -> 2d: shows the real filename when the upload is rejected with a 422', async () => {
    const error = new Error(
      '"notes.docx" is not a supported file. Only JPG, PNG and PDF are accepted.'
    );
    error.status = 422;
    uploadSample.mockRejectedValue(error);

    renderModal();
    fireEvent.change(fileInput(), { target: { files: [makeFile('notes.docx')] } });
    await clickAnalyse();

    expect(screen.getByText(/notes\.docx/)).toBeInTheDocument();
  });

  it('closing the analysing panel does not make any further upload request - the job keeps running server-side', async () => {
    uploadSample.mockResolvedValue({ _id: 'smp_123' });
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.change(fileInput(), { target: { files: [makeFile()] } });
    await clickAnalyse();

    fireEvent.click(screen.getByText('Close — keep analysing in background'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(uploadSample).toHaveBeenCalledTimes(1);
  });
});
