import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Map as LibreMap } from 'maplibre-gl';
import { RainLayer } from './RainLayer';
import { config } from '../../app/config';
import { normalizeFrames } from '../../weather/adapters/jma/precipitation';

function setup() {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  const sources = new Map<string, boolean>();
  const layers = new Map<string, { opacity: number }>();
  const map = {
    on: (type: string, listener: (event: unknown) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    off: (type: string, listener: (event: unknown) => void) => listeners.get(type)?.delete(listener),
    addSource: (id: string) => sources.set(id, false),
    getSource: (id: string) => sources.has(id),
    isSourceLoaded: (id: string) => sources.get(id),
    removeSource: (id: string) => sources.delete(id),
    addLayer: ({ id }: { id: string }) => layers.set(id, { opacity: 0 }),
    getLayer: (id: string) => layers.get(id),
    removeLayer: (id: string) => layers.delete(id),
    setPaintProperty: (id: string, _name: string, opacity: number) => { layers.get(id)!.opacity = opacity; },
  };
  const display = vi.fn();
  const status = vi.fn();
  const rain = new RainLayer(map as unknown as LibreMap, display, status);
  const emit = (type: string, event: unknown = {}) => [...listeners.get(type) ?? []].forEach(fn => fn(event));
  const frames = normalizeFrames([
    { basetime: '20260909000000', validtime: '20260909000000', elements: ['hrpns'] },
    { basetime: '20260909000500', validtime: '20260909000500', elements: ['hrpns'] },
  ], '2026-09-09T00:10:00Z', Date.parse('2026-09-09T00:10:00Z'));
  return { rain, emit, sources, layers, display, status, frames };
}

afterEach(() => vi.useRealTimers());

describe('rain image loading', () => {
  it('shows loaded rain even while other sources prevent the map from becoming idle', () => {
    const { rain, emit, sources, layers, display, frames } = setup();
    rain.setFrame(frames[0]);
    emit('render');
    expect(display).not.toHaveBeenCalled();
    sources.set('rain-1', true);
    emit('render'); // No idle event: the background map is still loading.
    expect(display).toHaveBeenCalledWith(frames[0]);
    expect(layers.get('rain-1-layer')?.opacity).toBe(0.75);
    rain.destroy();
  });

  it.each(['error', 'timeout'])('preserves the previous image after %s and can retry', failure => {
    vi.useFakeTimers();
    const { rain, emit, sources, layers, display, status, frames } = setup();
    rain.setFrame(frames[0]);
    sources.set('rain-1', true);
    emit('render');
    rain.setFrame(frames[1]);
    if (failure === 'error') emit('error', { sourceId: 'rain-2' });
    else vi.advanceTimersByTime(config.tileTimeoutMs);
    expect(status).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'error' }));
    expect(display).toHaveBeenCalledTimes(1);
    expect(layers.has('rain-1-layer')).toBe(true);
    expect(layers.has('rain-2-layer')).toBe(false);
    rain.setFrame(frames[1], true);
    sources.set('rain-3', true);
    emit('render');
    expect(display).toHaveBeenLastCalledWith(frames[1]);
    expect(layers.has('rain-1-layer')).toBe(false);
    rain.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('respects visibility while loading and discards a superseded request', () => {
    const { rain, emit, sources, layers, display, frames } = setup();
    rain.setFrame(frames[0]);
    rain.setFrame(frames[1]);
    expect(sources.has('rain-1')).toBe(false);
    rain.setVisible(false);
    sources.set('rain-2', true);
    emit('render');
    expect(display).toHaveBeenCalledTimes(1);
    expect(display).toHaveBeenCalledWith(frames[1]);
    expect(layers.get('rain-2-layer')?.opacity).toBe(0);
    rain.setVisible(true);
    expect(layers.get('rain-2-layer')?.opacity).toBe(0.75);
    rain.destroy();
  });
});
