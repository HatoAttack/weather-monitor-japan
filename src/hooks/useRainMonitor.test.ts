import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRainMonitor } from './useRainMonitor';
import { config } from '../app/config';
import type { WeatherFrame } from '../weather/domain/WeatherFrame';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe('automatic updates', () => {
  it('waits only the remaining time when a polling timer arrives 1ms early', async () => {
    vi.useFakeTimers();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const loader = vi.fn().mockResolvedValue([]);
    renderHook(() => useRainMonitor(loader));
    await act(async () => {});
    await act(async () => vi.advanceTimersByTimeAsync(config.pollIntervalMs - 1));
    vi.setSystemTime(Date.now() - 1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(loader).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('polls at the configured interval, pauses, resumes and stops on unmount', async () => {
    vi.useFakeTimers();
    const loader = vi.fn().mockResolvedValue([]);
    const { result, unmount } = renderHook(() => useRainMonitor(loader));
    await act(async () => {});
    expect(loader).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(config.pollIntervalMs));
    expect(loader).toHaveBeenCalledTimes(2);
    act(() => result.current.setAutoUpdate(false));
    await act(async () => vi.advanceTimersByTimeAsync(config.pollIntervalMs * 2));
    expect(loader).toHaveBeenCalledTimes(2);
    act(() => result.current.setAutoUpdate(true));
    await act(async () => vi.advanceTimersByTimeAsync(config.pollIntervalMs));
    expect(loader).toHaveBeenCalledTimes(3);
    unmount();
    await vi.advanceTimersByTimeAsync(config.pollIntervalMs);
    expect(loader).toHaveBeenCalledTimes(3);
  });
  it('skips hidden tabs and checks when they become visible without rapid repeat requests', async () => {
    vi.useFakeTimers();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const loader = vi.fn().mockResolvedValue([]);
    renderHook(() => useRainMonitor(loader));
    await act(async () => {});
    await act(async () => vi.advanceTimersByTimeAsync(config.pollIntervalMs));
    expect(loader).toHaveBeenCalledTimes(1);
    hidden.mockReturnValue(false);
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(loader).toHaveBeenCalledTimes(2);
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(loader).toHaveBeenCalledTimes(2);
  });
  it('does not overlap requests, and aborts in-flight work on unmount', async () => {
    const loader = vi.fn((signal: AbortSignal) => { void signal; return new Promise<WeatherFrame[]>(() => {}); });
    const { result, unmount } = renderHook(() => useRainMonitor(loader));
    await act(async () => { void result.current.refresh(); });
    expect(loader).toHaveBeenCalledTimes(1);
    unmount();
    expect(loader.mock.calls[0][0].aborted).toBe(true);
  });
});
