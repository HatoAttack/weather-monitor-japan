import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../app/config';
import type { AmedasSnapshot } from '../weather/domain/AmedasObservation';
import { useAmedasMonitor } from './useAmedasMonitor';

const snapshot: AmedasSnapshot = {
  observedAt: '2026-09-08T14:30:00.000Z',
  fetchedAt: '2026-09-08T14:31:00.000Z',
  source: '気象庁',
  stations: [],
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('AMeDAS automatic updates', () => {
  it('retries a failed update at its deadline when the timer arrives 1ms early', async () => {
    vi.useFakeTimers();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const recovered = { ...snapshot, observedAt: '2026-09-08T14:50:00.000Z' };
    const loader = vi.fn().mockResolvedValueOnce(snapshot)
      .mockRejectedValueOnce(new Error('offline')).mockResolvedValue(recovered);
    const { result } = renderHook(() => useAmedasMonitor(loader));
    await act(async () => {});
    await act(async () => vi.advanceTimersByTimeAsync(config.amedasPollIntervalMs));
    expect(result.current.phase).toBe('network-error');
    expect(result.current.snapshot).toBe(snapshot);

    await act(async () => vi.advanceTimersByTimeAsync(config.amedasPollIntervalMs - 1));
    // Separate wall-clock time from the timer deadline by 1ms, as with timer jitter.
    vi.setSystemTime(Date.now() - 1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(loader).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(loader).toHaveBeenCalledTimes(3);
    expect(result.current.snapshot).toBe(recovered);
    expect(result.current.phase).toBe('updated');
  });

  it('schedules the next automatic attempt from a manual update without skipping a cycle', async () => {
    vi.useFakeTimers();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const loader = vi.fn().mockResolvedValue(snapshot);
    const { result, unmount } = renderHook(() => useAmedasMonitor(loader));
    await act(async () => {});
    await act(async () => vi.advanceTimersByTimeAsync(2 * 60_000));
    await act(async () => result.current.refresh());
    await act(async () => vi.advanceTimersByTimeAsync(config.amedasPollIntervalMs - 1));
    expect(loader).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(loader).toHaveBeenCalledTimes(3);
    unmount();
    await vi.advanceTimersByTimeAsync(config.amedasPollIntervalMs);
    expect(loader).toHaveBeenCalledTimes(3);
  });

  it('polls every 10 minutes, defers hidden tabs and resumes on visibility', async () => {
    vi.useFakeTimers();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const loader = vi.fn().mockResolvedValue(snapshot);
    const { unmount } = renderHook(() => useAmedasMonitor(loader));
    await act(async () => {});
    expect(loader).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(config.amedasPollIntervalMs));
    expect(loader).toHaveBeenCalledTimes(2);
    hidden.mockReturnValue(true);
    await act(async () => vi.advanceTimersByTimeAsync(config.amedasPollIntervalMs));
    expect(loader).toHaveBeenCalledTimes(2);
    hidden.mockReturnValue(false);
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(loader).toHaveBeenCalledTimes(3);
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(loader).toHaveBeenCalledTimes(3);
    unmount();
    await vi.advanceTimersByTimeAsync(config.amedasPollIntervalMs);
    expect(loader).toHaveBeenCalledTimes(3);
  });
});
