import { describe, expect, it } from 'vitest';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { baseMapStyle } from './baseMap';

describe('base map style', () => {
  it('is a valid MapLibre style', () => {
    expect(validateStyleMin(baseMapStyle).map(error => error.message)).toEqual([]);
  });

  it('leaves out the source layers that carry roads, railways and buildings', () => {
    const used = baseMapStyle.layers.map(layer => 'source-layer' in layer ? layer['source-layer'] : null);
    for (const noisy of ['RdCL', 'RailCL', 'BldA', 'Cntr', 'PwrTrnsmL']) expect(used).not.toContain(noisy);
    expect(used).toContain('Cstline');
    expect(used).toContain('AdmBdry');
  });

  it('only draws place names, never road numbers', () => {
    const labels = baseMapStyle.layers.find(layer => layer.id === 'place-label') as { filter?: unknown };
    // 2901/2903/2904/7701 are the road number annotations.
    expect(JSON.stringify(labels.filter)).not.toMatch(/2901|2903|2904|7701/);
    expect(JSON.stringify(labels.filter)).toContain('110');
  });
});
