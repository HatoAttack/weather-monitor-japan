import { describe, expect, it } from 'vitest';
import { nativeZoomFor, resolveRainTile } from './rainTiles';

const url = (z: number, x: number, y: number) =>
  `jma-rain://https://www.jma.go.jp/bosai/jmatile/data/nowc/T/none/T/surf/hrpns/${z}/${x}/${y}.png`;

describe('precipitation tile levels', () => {
  it('keeps published zoom levels and falls back to the nearest lower one', () => {
    expect([3, 4, 5, 6, 7, 8, 9, 10, 11].map(nativeZoomFor)).toEqual([4, 4, 4, 6, 6, 8, 8, 10, 10]);
  });

  it('requests the published level directly when one exists', () => {
    expect(resolveRainTile(url(8, 227, 102)))
      .toEqual({ source: expect.stringContaining('/surf/hrpns/8/227/102.png'), delta: 0, x: 227, y: 102 });
  });

  it('maps a missing level onto its parent tile and remembers the requested one', () => {
    const request = resolveRainTile(url(9, 455, 205));
    expect(request.source).toContain('/surf/hrpns/8/227/102.png');
    expect(request).toMatchObject({ delta: 1, x: 455, y: 205 });
    expect(resolveRainTile(url(5, 28, 12)).source).toContain('/surf/hrpns/4/14/6.png');
  });

  it('rejects a request it cannot read', () => {
    expect(() => resolveRainTile('jma-rain://https://example.com/tiles/a/b/c.png')).toThrow();
  });
});
