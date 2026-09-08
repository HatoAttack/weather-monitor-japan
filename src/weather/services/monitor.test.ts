import { describe, expect, it } from 'vitest';
import type { WeatherFrame } from '../domain/WeatherFrame';
import { initialMonitorState, isStale, monitorReducer } from './monitor';
export const frame = (minute: number): WeatherFrame => ({
  id: 'frame-' + minute, observedAt: new Date(Date.UTC(2026, 8, 8, 14, minute)).toISOString(),
  fetchedAt: '2026-09-08T14:00:00.000Z', layerType: 'precipitation', source: 'test',
  tileTemplate: 'https://example.com/{z}/{x}/{y}.png', minZoom: 4, maxZoom: 10, bounds: [100, 7, 170, 61], attribution: 'test',
});
describe('monitor state', () => {
  const initial = monitorReducer(initialMonitorState, { type: 'success', frames: [frame(0), frame(5)], at: 'first' });
  it('follows new observations only when viewing the latest', () => {
    expect(monitorReducer(initial, { type: 'success', frames: [frame(10)], at: 'second' }).selectedId).toBe('frame-10');
    const past = monitorReducer(initial, { type: 'select', id: 'frame-0' });
    expect(monitorReducer(past, { type: 'success', frames: [frame(10)], at: 'second' }).selectedId).toBe('frame-0');
  });
  it('retains frames, selection and last success on failures', () => {
    for (const kind of ['network', 'format'] as const) {
      const failed = monitorReducer(initial, { type: 'failure', kind, message: 'failed' });
      expect(failed.frames).toBe(initial.frames);
      expect(failed.selectedId).toBe(initial.selectedId);
      expect(failed.lastSuccessAt).toBe('first');
      expect(failed.phase).toBe(kind + '-error');
    }
  });
  it('deduplicates, sorts and marks unchanged responses, even after errors', () => {
    const state = monitorReducer(initial, { type: 'success', frames: [frame(5), frame(0), frame(5)], at: 'second' });
    expect(state.frames.map(frame => frame.id)).toEqual(['frame-0', 'frame-5']);
    expect(state.phase).toBe('unchanged');
    expect(state.lastSuccessAt).toBe('second');
    const failed = monitorReducer(state, { type: 'failure', kind: 'network', message: 'offline' });
    expect(monitorReducer(failed, { type: 'success', frames: [frame(0)], at: 'third' }).error).toBeNull();
  });
  it('preserves a pinned past observation outside the rolling window', () => {
    const past = monitorReducer(initial, { type: 'select', id: 'frame-0' });
    const state = monitorReducer(past, { type: 'success', frames: Array.from({ length: 20 }, (_, i) => frame(10 + i)), at: 'second' });
    expect(state.selectedId).toBe('frame-0');
    expect(state.frames).toHaveLength(14);
    expect(state.frames[0].id).toBe('frame-0');
  });
  it('distinguishes stale data and does not select unknown IDs', () => {
    expect(isStale(frame(0), Date.parse(frame(16).observedAt))).toBe(true);
    expect(isStale(frame(0), Date.parse(frame(15).observedAt))).toBe(false);
    expect(isStale(undefined, Date.now())).toBe(false);
    expect(monitorReducer(initial, { type: 'select', id: 'missing' })).toBe(initial);
  });
});
