import { describe, expect, it, vi } from 'vitest';
import type { Map as LibreMap } from 'maplibre-gl';
import { BaseMapFeatures } from './BaseMapFeatures';
import { baseMapStyle } from './baseMap';

function stubMap() {
  const paint = new Map<string, unknown>();
  const types = new Map(baseMapStyle.layers.map(layer => [layer.id, layer.type]));
  const map = {
    getLayer: (id: string) => types.has(id) ? { id, type: types.get(id) } : undefined,
    getPaintProperty: (id: string, property: string) => paint.get(id + '/' + property),
    setPaintProperty: vi.fn((id: string, property: string, value: unknown) => paint.set(id + '/' + property, value)),
  };
  // Start from the style's own values, as MapLibre would after loading.
  for (const layer of baseMapStyle.layers) {
    for (const [property, value] of Object.entries(layer.paint ?? {})) paint.set(layer.id + '/' + property, value);
  }
  return { map: map as unknown as LibreMap, paint, calls: map.setPaintProperty };
}

describe('base map feature switches', () => {
  it('fades a detail out and restores the value the style defined', () => {
    const { map, paint, calls } = stubMap();
    const full = paint.get('elevation-colour/raster-opacity');
    expect(full).toBeDefined();
    const features = new BaseMapFeatures(map);

    features.set({ elevation: false, contour: true, river: true, railway: true });
    expect(paint.get('elevation-colour/raster-opacity')).toBe(0);
    expect(paint.get('railway/line-opacity')).not.toBe(0);

    features.set({ elevation: true, contour: true, river: true, railway: true });
    expect(paint.get('elevation-colour/raster-opacity')).toEqual(full);
    expect(calls).toHaveBeenCalled();
  });

  it('falls back to fully shown for a layer the style leaves at its default', () => {
    const { map, paint } = stubMap();
    // The river layer sets no opacity of its own.
    expect(paint.get('river/line-opacity')).toBeUndefined();
    const features = new BaseMapFeatures(map);
    features.set({ elevation: true, contour: true, river: false, railway: true });
    expect(paint.get('river/line-opacity')).toBe(0);
    features.set({ elevation: true, contour: true, river: true, railway: true });
    expect(paint.get('river/line-opacity')).toBe(1);
  });
});
