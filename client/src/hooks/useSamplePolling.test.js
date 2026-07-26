import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { renderHook } from '@testing-library/react';
import { useSamplePolling } from './useSamplePolling.js';
import { getSample } from '../lib/api.js';

vi.mock('../lib/api.js', () => ({
  getSample: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('useSamplePolling', () => {
  it('stops polling once analysisStatus is COMPLETE', async () => {
    getSample
      .mockResolvedValueOnce({ analysisStatus: 'PROCESSING' })
      .mockResolvedValueOnce({ analysisStatus: 'COMPLETE' });

    const { result } = renderHook(() => useSamplePolling('smp_1'));

    await vi.waitFor(() => expect(getSample).toHaveBeenCalledTimes(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(result.current.status).toBe('complete');
    expect(getSample).toHaveBeenCalledTimes(2);
  });

  it('stops polling once analysisStatus is FAILED', async () => {
    getSample.mockResolvedValue({ analysisStatus: 'FAILED' });

    const { result } = renderHook(() => useSamplePolling('smp_2'));

    // FAILED resolves on the very first attempt - no timer to advance, just
    // the microtask from the mocked promise needs to flush.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.status).toBe('failed');
  });

  it('gives up after the retry ceiling instead of polling forever', async () => {
    getSample.mockResolvedValue({ analysisStatus: 'PROCESSING' });

    const { result } = renderHook(() => useSamplePolling('smp_3'));

    await vi.waitFor(() => expect(getSample).toHaveBeenCalledTimes(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000 * 31);
    });

    expect(result.current.status).toBe('timeout');
    expect(getSample).toHaveBeenCalledTimes(30);
  });

  it('stops calling getSample after unmount - closing the modal must not cancel the server job, but it must stop watching it', async () => {
    getSample.mockResolvedValue({ analysisStatus: 'PROCESSING' });

    const { unmount } = renderHook(() => useSamplePolling('smp_4'));
    await vi.waitFor(() => expect(getSample).toHaveBeenCalledTimes(1));

    unmount();
    const callsAtUnmount = getSample.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(getSample).toHaveBeenCalledTimes(callsAtUnmount);
  });
});
