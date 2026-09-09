import { describe, expect, it } from 'vitest';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import type { Map as LibreMap, CircleLayerSpecification, StyleSpecification } from 'maplibre-gl';
import { AmedasLayer } from './AmedasLayer';

describe('Amedas map style', () => {
  it('uses valid MapLibre expressions for all observation metrics', () => {
    const style: StyleSpecification = { version: 8, sources: {}, layers: [] };
    const map = {
      addSource: (id: string, source: StyleSpecification['sources'][string]) => { style.sources[id] = source; },
      addLayer: (layer: CircleLayerSpecification) => style.layers.push(layer),
      on: () => {},
      setFilter: (_id: string, filter: CircleLayerSpecification['filter']) => {
        (style.layers[0] as CircleLayerSpecification).filter = filter;
      },
      setPaintProperty: (_id: string, name: string, value: unknown) => {
        Object.assign(style.layers[0].paint!, { [name]: value });
      },
    };
    const amedas = new AmedasLayer(map as unknown as LibreMap, () => {});
    expect(validateStyleMin(style).map(error => error.message)).toEqual([]);
    for (const metric of ['temperature', 'precipitation', 'wind'] as const) {
      amedas.setMetric(metric);
      expect(validateStyleMin(style).map(error => error.message)).toEqual([]);
    }
  });
});
