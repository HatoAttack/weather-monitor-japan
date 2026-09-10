import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTimelinePlayer } from './useTimelinePlayer';
import { config } from '../app/config';
import type { WeatherFrame } from '../weather/domain/WeatherFrame';

const frame = (minute: number): WeatherFrame => ({
  id: 'frame-' + minute, observedAt: new Date(Date.UTC(2026, 8, 8, 14, minute)).toISOString(),
  fetchedAt: '2026-09-08T14:00:00.000Z', layerType: 'precipitation', source: 'test',
  tileTemplate: 'https://example.com/{z}/{x}/{y}.png', minZoom: 4, maxZoom: 10, bounds: [100, 7, 170, 61], attribution: 'test',
});
const frames = [frame(0), frame(5), frame(10)];
const { frameWaitMs, lastFrameHoldMs } = config.playback;
const interval = config.playback.speeds.find(speed => speed.id === config.playback.defaultSpeedId)!.frameIntervalMs;
type Props = { frames: WeatherFrame[]; selectedId: string | null; displayedId: string | null; enabled: boolean };

function render(props: Partial<Props> = {}) {
  const onSelect = vi.fn();
  const initialProps: Props = { frames, selectedId: frames[0].id, displayedId: frames[0].id, enabled: true, ...props };
  const view = renderHook((current: Props) => useTimelinePlayer({ ...current, onSelect }), { initialProps });
  return { ...view, onSelect, initialProps };
}
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('timeline playback', () => {
  it('advances one frame at the configured interval, then waits for the next image', async () => {
    vi.useFakeTimers();
    const { result, rerender, onSelect, initialProps } = render();
    act(() => result.current.toggle());
    expect(result.current.playing).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(interval - 1));
    expect(onSelect).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(onSelect).toHaveBeenCalledWith(frames[1].id);
    // The map still shows the previous frame, so the next step must not run on the frame interval.
    rerender({ ...initialProps, selectedId: frames[1].id });
    await act(async () => vi.advanceTimersByTimeAsync(interval * 3));
    expect(onSelect).toHaveBeenCalledTimes(1);
    rerender({ ...initialProps, selectedId: frames[1].id, displayedId: frames[1].id });
    await act(async () => vi.advanceTimersByTimeAsync(interval));
    expect(onSelect).toHaveBeenLastCalledWith(frames[2].id);
  });

  it('applies a changed playback speed', async () => {
    vi.useFakeTimers();
    const fast = config.playback.speeds.find(speed => speed.id === 'fast')!;
    const { result, onSelect } = render();
    act(() => { result.current.toggle(); result.current.setSpeed(fast.id); });
    expect(result.current.speedId).toBe(fast.id);
    await act(async () => vi.advanceTimersByTimeAsync(fast.frameIntervalMs));
    expect(onSelect).toHaveBeenCalledWith(frames[1].id);
  });

  it('replays from the oldest frame when started on the newest', () => {
    vi.useFakeTimers();
    const { result, onSelect } = render({ selectedId: frames[2].id, displayedId: frames[2].id });
    act(() => result.current.toggle());
    expect(onSelect).toHaveBeenCalledWith(frames[0].id);
  });

  it('stops on the newest frame when repeat is off', async () => {
    vi.useFakeTimers();
    const { result, rerender, onSelect, initialProps } = render({ selectedId: frames[1].id, displayedId: frames[1].id });
    expect(result.current.loop).toBe(false);
    act(() => result.current.toggle());
    await act(async () => vi.advanceTimersByTimeAsync(interval));
    expect(onSelect).toHaveBeenCalledWith(frames[2].id);
    rerender({ ...initialProps, selectedId: frames[2].id, displayedId: frames[2].id });
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(result.current.playing).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(lastFrameHoldMs * 2));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('holds on the newest frame, then loops back to the oldest when repeat is on', async () => {
    vi.useFakeTimers();
    const { result, rerender, onSelect, initialProps } = render({ selectedId: frames[1].id, displayedId: frames[1].id });
    act(() => { result.current.setLoop(true); result.current.toggle(); });
    await act(async () => vi.advanceTimersByTimeAsync(interval));
    expect(onSelect).toHaveBeenCalledWith(frames[2].id);
    rerender({ ...initialProps, selectedId: frames[2].id, displayedId: frames[2].id });
    await act(async () => vi.advanceTimersByTimeAsync(interval));
    expect(onSelect).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(lastFrameHoldMs - interval));
    expect(onSelect).toHaveBeenLastCalledWith(frames[0].id);
    expect(result.current.playing).toBe(true);
  });

  it('gives up on a frame that never displays instead of stalling', async () => {
    vi.useFakeTimers();
    const { result, onSelect } = render({ selectedId: frames[1].id, displayedId: frames[0].id });
    act(() => result.current.toggle());
    await act(async () => vi.advanceTimersByTimeAsync(frameWaitMs - 1));
    expect(onSelect).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(onSelect).toHaveBeenCalledWith(frames[2].id);
  });

  it('does not advance in a hidden tab and resumes when it becomes visible', async () => {
    vi.useFakeTimers();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const { result, onSelect } = render();
    act(() => result.current.toggle());
    await act(async () => vi.advanceTimersByTimeAsync(interval * 4));
    expect(onSelect).not.toHaveBeenCalled();
    hidden.mockReturnValue(false);
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    await act(async () => vi.advanceTimersByTimeAsync(interval));
    expect(onSelect).toHaveBeenCalledWith(frames[1].id);
  });

  it('stops for a manual selection, a hidden layer, and a single frame', async () => {
    vi.useFakeTimers();
    const { result, rerender, onSelect, initialProps } = render();
    act(() => result.current.toggle());
    act(() => result.current.select(frames[2].id));
    expect(onSelect).toHaveBeenCalledWith(frames[2].id);
    expect(result.current.playing).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(interval * 4));
    expect(onSelect).toHaveBeenCalledTimes(1);

    act(() => result.current.toggle());
    rerender({ ...initialProps, enabled: false });
    expect(result.current.canPlay).toBe(false);
    expect(result.current.playing).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(interval * 4));
    expect(onSelect).toHaveBeenCalledTimes(1);

    rerender({ ...initialProps, frames: [frames[0]] });
    expect(result.current.canPlay).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(interval * 4));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
