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
    unmount();
    await vi.advanceTimersByTimeAsync(config.amedasPollIntervalMs);
    expect(loader).toHaveBeenCalledTimes(3);
  });
});
