import { describe, expect, it, vi } from 'vitest';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import type { Map as LibreMap, LayerSpecification, StyleSpecification } from 'maplibre-gl';
import type { Polygon } from 'geojson';
import { WarningLayer } from './WarningLayer';
import type { WarningSnapshot } from '../../weather/domain/Warning';
import type { WarningAreaShape } from '../../weather/adapters/jma/warning';
import { config } from '../../app/config';

const box = (west: number, south: number, east: number, north: number): Polygon =>
  ({ type: 'Polygon', coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] });

type Collection = { features: { properties: { code: string; rank: number } }[] };

function stubMap({ zoom = 5, stationAt = false } = {}) {
  const style: StyleSpecification = { version: 8, sources: {}, layers: [] };
  const handlers = new Map<string, (event: unknown) => void>();
  const data = new Map<string, Collection>();
  const state = { zoom };
  const map = {
    getLayer: (id: string) => style.layers.find(layer => layer.id === id),
    addSource: (id: string, source: StyleSpecification['sources'][string]) => { style.sources[id] = source; },
    getSource: (id: string) => ({ setData: (next: Collection) => data.set(id, next) }),
    addLayer: (layer: LayerSpecification) => style.layers.push(layer),
    on: (type: string, layerOrHandler: string | ((event: unknown) => void), handler?: (event: unknown) => void) => {
      if (typeof layerOrHandler === 'string') handlers.set(layerOrHandler, handler!);
      else handlers.set(type, layerOrHandler);
    },
    getZoom: () => state.zoom,
    // The view covers the area around Tokyo only.
    getBounds: () => ({ getWest: () => 139, getSouth: () => 35, getEast: () => 140.5, getNorth: () => 36.5 }),
    queryRenderedFeatures: () => stationAt ? [{}] : [],
    setLayoutProperty: vi.fn(),
  };
  return { style, map: map as unknown as LibreMap, handlers, data, state };
}

const snapshot: WarningSnapshot = {
  reportedAt: '2026-09-11T20:00:00+09:00', fetchedAt: 'now', unknownCodes: [],
  areas: [
    { code: 'TOKYO', name: '東京地方', shape: box(139, 35, 140, 36), reportedAt: null,
      kinds: [{ code: '14', name: '雷注意報', tier: 'advisory' }] },
    { code: 'FAR', name: '遠方', shape: box(130, 31, 131, 32), reportedAt: null,
      kinds: [{ code: '03', name: 'レベル３大雨警報', tier: 'warning', level: 3 }] },
    { code: 'QUIET', name: '静穏', shape: box(139.5, 35.5, 140.5, 36.5), reportedAt: null, kinds: [] },
  ],
  municipalities: [
    { code: 'M1', name: '千代田区', area: 'TOKYO', reportedAt: null,
      kinds: [{ code: '03', name: 'レベル３大雨警報', tier: 'warning', level: 3 }] },
    { code: 'M2', name: '遠い町', area: 'FAR', reportedAt: null,
      kinds: [{ code: '03', name: 'レベル３大雨警報', tier: 'warning', level: 3 }] },
  ],
};

const shapeFor = (code: string): WarningAreaShape => ({ code, name: code, shape: box(139.2, 35.2, 139.4, 35.4) });
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe('warning map layer', () => {
  it('uses valid MapLibre expressions', () => {
    const { style, map } = stubMap();
    new WarningLayer(map, () => {}, async () => []);
    expect(validateStyleMin(style).map(error => error.message)).toEqual([]);
  });

  it('paints each area by the most severe warning in force', () => {
    const { map, data } = stubMap();
    new WarningLayer(map, () => {}, async () => []).setSnapshot(snapshot);
    expect(data.get('warning-areas')!.features.map(feature => feature.properties))
      .toEqual([{ code: 'TOKYO', rank: 1 }, { code: 'FAR', rank: 2 }, { code: 'QUIET', rank: 0 }]);
  });

  it('switches from areas to municipalities at the configured zoom', () => {
    const { style, map } = stubMap();
    new WarningLayer(map, () => {}, async () => []);
    const find = (id: string) => style.layers.find(layer => layer.id === id)!;
    expect(find('warning-fill').maxzoom).toBe(config.warningMunicipalZoom);
    expect(find('warning-municipal-fill').minzoom).toBe(config.warningMunicipalZoom);
  });

  it('loads municipality shapes only for warned areas in view, once zoomed in', async () => {
    const zoomedOut = stubMap({ zoom: config.warningMunicipalZoom - 2 });
    const unused = vi.fn(async (codes: string[]) => codes.map(shapeFor));
    new WarningLayer(zoomedOut.map, () => {}, unused).setSnapshot(snapshot);
    await settle();
    expect(unused).not.toHaveBeenCalled();

    const zoomedIn = stubMap({ zoom: config.warningMunicipalZoom });
    const load = vi.fn(async (codes: string[]) => codes.map(shapeFor));
    new WarningLayer(zoomedIn.map, () => {}, load).setSnapshot(snapshot);
    await settle();
    // FAR is out of view and QUIET has nothing in force, so only Tokyo's municipality loads.
    expect(load).toHaveBeenCalledWith(['M1']);
    expect(zoomedIn.data.get('warning-municipalities')!.features.map(feature => feature.properties))
      .toEqual([{ code: 'M1', rank: 2 }]);
  });

  it('ignores municipality shapes that arrive after a newer request', async () => {
    const { map, data, handlers } = stubMap({ zoom: config.warningMunicipalZoom });
    const replies: ((shapes: WarningAreaShape[]) => void)[] = [];
    const load = vi.fn(() => new Promise<WarningAreaShape[]>(resolve => replies.push(resolve)));
    vi.useFakeTimers();
    new WarningLayer(map, () => {}, load).setSnapshot(snapshot);
    handlers.get('moveend')!({});
    await vi.advanceTimersByTimeAsync(config.warningShapeSettleMs);
    vi.useRealTimers();
    replies[1]([shapeFor('M1')]);
    await settle();
    replies[0]([]);
    await settle();
    expect(data.get('warning-municipalities')!.features).toHaveLength(1);
  });

  it('leaves a click on a station to the station', () => {
    const chosen = vi.fn();
    const plain = stubMap();
    new WarningLayer(plain.map, chosen, async () => []);
    plain.handlers.get('warning-municipal-fill')!({ point: { x: 0, y: 0 }, features: [{ properties: { code: 'M1' } }] });
    expect(chosen).toHaveBeenCalledWith('M1');

    const busy = stubMap({ stationAt: true });
    busy.style.layers.push({ id: 'amedas-click-targets', type: 'circle', source: 'x' });
    const ignored = vi.fn();
    new WarningLayer(busy.map, ignored, async () => []);
    busy.handlers.get('warning-fill')!({ point: { x: 0, y: 0 }, features: [{ properties: { code: 'TOKYO' } }] });
    expect(ignored).not.toHaveBeenCalled();
  });

  it('waits for the map to stop moving before loading municipality shapes', async () => {
    vi.useFakeTimers();
    const { map, handlers } = stubMap({ zoom: config.warningMunicipalZoom });
    const load = vi.fn(async (codes: string[]) => codes.map(shapeFor));
    const layer = new WarningLayer(map, () => {}, load);
    layer.setSnapshot(snapshot);
    load.mockClear();
    for (let step = 0; step < 4; step++) {
      handlers.get('moveend')!({});
      await vi.advanceTimersByTimeAsync(config.warningShapeSettleMs / 2);
    }
    expect(load).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(config.warningShapeSettleMs);
    expect(load).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
