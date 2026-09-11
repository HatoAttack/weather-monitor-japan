import { describe, expect, it } from 'vitest';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { baseMapFeatureLayers, baseMapStyle, weatherLayerBefore } from './baseMap';

describe('base map style', () => {
  it('is a valid MapLibre style', () => {
    expect(validateStyleMin(baseMapStyle).map(error => error.message)).toEqual([]);
  });

  it('leaves out the source layers that carry roads and buildings', () => {
    const used = baseMapStyle.layers.map(layer => 'source-layer' in layer ? layer['source-layer'] : null);
    for (const noisy of ['RdCL', 'BldA', 'PwrTrnsmL']) expect(used).not.toContain(noisy);
    for (const wanted of ['Cstline', 'AdmBdry', 'RailCL', 'RvrCL', 'Cntr']) expect(used).toContain(wanted);
  });

  it('keeps elevation colouring off the nationwide view', () => {
    const layer = baseMapStyle.layers.find(item => item.id === 'elevation-colour') as
      { paint?: { 'raster-opacity'?: unknown } };
    // The sea floor would otherwise compete with the precipitation layer.
    expect(layer.paint!['raster-opacity']).toEqual(
      ['interpolate', ['linear'], ['zoom'], 6.5, 0, 8, 0.45]);
  });

  it('waits for the zoom where contours and rivers are published', () => {
    for (const id of ['contour', 'river']) {
      const layer = baseMapStyle.layers.find(item => item.id === id) as { minzoom?: number };
      expect(layer.minzoom).toBe(10);
    }
  });

  it('only draws place names, never road numbers', () => {
    const labels = baseMapStyle.layers.find(layer => layer.id === 'place-label') as { filter?: unknown };
    // 2901/2903/2904/7701 are the road number annotations.
    expect(JSON.stringify(labels.filter)).not.toMatch(/2901|2903|2904|7701/);
    expect(JSON.stringify(labels.filter)).toContain('110');
  });

  it('names style layers that exist for every switchable feature', () => {
    const ids = baseMapStyle.layers.map(layer => layer.id);
    for (const layers of Object.values(baseMapFeatureLayers)) {
      for (const layer of layers) expect(ids).toContain(layer);
    }
  });

  it('keeps relief, borders and names above where the weather layers go', () => {
    const ids = baseMapStyle.layers.map(layer => layer.id);
    const insertion = ids.indexOf(weatherLayerBefore);
    expect(insertion).toBeGreaterThan(-1);
    // Lakes must be painted before the rain, or they would punch holes in it.
    for (const below of ['ocean', 'land', 'tone', 'elevation-colour', 'water']) {
      expect(ids.indexOf(below)).toBeLessThan(insertion);
    }
    for (const above of ['relief', 'coastline', 'prefecture-border', 'place-label']) {
      expect(ids.indexOf(above)).toBeGreaterThanOrEqual(insertion);
    }
  });
});
