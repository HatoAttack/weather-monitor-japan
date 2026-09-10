import { describe, expect, it } from 'vitest';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import type { Map as LibreMap, LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { AmedasLayer } from './AmedasLayer';

// The stub only needs to read and write the parts the layer touches.
type StubLayer = { id: string; filter?: unknown; paint?: Record<string, unknown>; layout?: Record<string, unknown> };

function stubMap() {
  const style: StyleSpecification = { version: 8, sources: {}, layers: [] };
  const layer = (id: string) => style.layers.find(item => item.id === id) as unknown as StubLayer;
  const map = {
    addSource: (id: string, source: StyleSpecification['sources'][string]) => { style.sources[id] = source; },
    addLayer: (spec: LayerSpecification) => style.layers.push(spec),
    on: () => {},
    // The arrow icon is drawn on a canvas, which the map owns once it is registered.
    hasImage: () => true,
    addImage: () => {},
    setFilter: (id: string, filter: unknown) => { layer(id).filter = filter; },
    setPaintProperty: (id: string, name: string, value: unknown) => {
      Object.assign(layer(id).paint ??= {}, { [name]: value });
    },
    setLayoutProperty: (id: string, name: string, value: unknown) => {
      Object.assign(layer(id).layout ??= {}, { [name]: value });
    },
  };
  return { style, map: map as unknown as LibreMap, layer };
}

describe('Amedas map style', () => {
  it('uses valid MapLibre expressions for all observation metrics', () => {
    const { style, map } = stubMap();
    const amedas = new AmedasLayer(map, () => {});
    expect(validateStyleMin(style).map(error => error.message)).toEqual([]);
    for (const metric of ['temperature', 'precipitation', 'wind'] as const) {
      amedas.setMetric(metric);
      expect(validateStyleMin(style).map(error => error.message)).toEqual([]);
    }
  });

  it('shows wind arrows only for the wind metric while the layer is visible', () => {
    const { map, layer } = stubMap();
    const amedas = new AmedasLayer(map, () => {});
    const visibility = () => layer('amedas-wind-arrows').layout?.visibility;
    expect(visibility()).toBe('none');
    amedas.setMetric('wind');
    expect(visibility()).toBe('visible');
    amedas.setVisible(false);
    expect(visibility()).toBe('none');
    amedas.setVisible(true);
    expect(visibility()).toBe('visible');
    amedas.setMetric('temperature');
    expect(visibility()).toBe('none');
  });
});
