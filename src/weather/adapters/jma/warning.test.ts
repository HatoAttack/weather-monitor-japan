import { describe, expect, it } from 'vitest';
import type { Polygon } from 'geojson';
import { normalizeAreaShapes, normalizeAreaTree, normalizeMunicipalityShape, normalizeWarnings } from './warning';

const square: Polygon = { type: 'Polygon', coordinates: [[[139, 35], [140, 35], [140, 36], [139, 36], [139, 35]]] };
const shapes = [
  { code: '130010', name: '東京地方', shape: square },
  { code: '130020', name: '伊豆諸島北部', shape: square },
  { code: '140010', name: '東部', shape: square },
];
type Item = { areaCode: string; kinds: { code?: string; status: string }[] };
const report = (time: string, items: Item[], municipal: Item[] = []) => ({
  reportDatetime: time, infoType: '発表', warning: { class10Items: items, class20Items: municipal },
});
const tree = normalizeAreaTree({
  class15s: { '130011': { parent: '130010' } },
  class20s: { '1310100': { name: '千代田区', parent: '130011' }, '1310200': { name: '中央区', parent: '130011' } },
});

describe('JMA warnings', () => {
  it('joins the hazard groups an office reports separately into one state per area', () => {
    const data = [
      report('2026-09-11T20:00:00+09:00', [{ areaCode: '130010', kinds: [{ code: '10', status: '発表' }] }]),
      report('2026-09-11T21:00:00+09:00', [{ areaCode: '130010', kinds: [{ code: '29', status: '継続' }] }]),
      report('2026-09-11T19:00:00+09:00', [{ areaCode: '130010', kinds: [{ code: '43', status: '発表' }] }]),
    ];
    const snapshot = normalizeWarnings(data, shapes, tree, 'fetched');
    const tokyo = snapshot.areas.find(area => area.code === '130010')!;
    // Most severe first: the level 4 danger warning leads.
    expect(tokyo.kinds.map(kind => kind.name))
      .toEqual(['レベル４大雨危険警報', 'レベル２大雨注意報', 'レベル２土砂災害注意報']);
    expect(tokyo.kinds[0]).toMatchObject({ tier: 'danger', level: 4 });
    expect(tokyo.reportedAt).toBe('2026-09-11T21:00:00+09:00');
    expect(snapshot.reportedAt).toBe('2026-09-11T21:00:00+09:00');
  });

  it('drops lifted warnings and areas with nothing in force', () => {
    const data = [report('2026-09-11T20:00:00+09:00', [
      { areaCode: '130010', kinds: [{ code: '03', status: '解除' }, { code: '14', status: '発表' }] },
      { areaCode: '130020', kinds: [{ status: '発表警報・注意報はなし' }] },
    ])];
    const snapshot = normalizeWarnings(data, shapes, tree, 'fetched');
    expect(snapshot.areas.find(area => area.code === '130010')!.kinds.map(kind => kind.code)).toEqual(['14']);
    expect(snapshot.areas.find(area => area.code === '130020')!.kinds).toEqual([]);
    // Every area keeps its shape, so the map can still draw it when nothing is in force.
    expect(snapshot.areas).toHaveLength(3);
  });

  it('reports codes it cannot name instead of guessing their severity', () => {
    const data = [report('2026-09-11T20:00:00+09:00', [
      { areaCode: '140010', kinds: [{ code: '99', status: '発表' }, { code: '15', status: '発表' }] },
    ])];
    const snapshot = normalizeWarnings(data, shapes, tree, 'fetched');
    expect(snapshot.unknownCodes).toEqual(['99']);
    expect(snapshot.areas.find(area => area.code === '140010')!.kinds.map(kind => kind.code)).toEqual(['15']);
  });

  it('names the new 2026 codes from the official table', () => {
    const data = [report('2026-09-11T20:00:00+09:00', [
      { areaCode: '130010', kinds: [{ code: '48', status: '発表' }, { code: '39', status: '発表' }] },
    ])];
    const kinds = normalizeWarnings(data, shapes, tree, 'fetched').areas[0].kinds;
    expect(kinds).toEqual([
      { code: '39', name: 'レベル５土砂災害特別警報', tier: 'special', level: 5 },
      { code: '48', name: 'レベル４高潮危険警報', tier: 'danger', level: 4 },
    ]);
  });

  it('rejects a feed whose shape has changed', () => {
    expect(() => normalizeWarnings({}, shapes, tree, 'fetched')).toThrow();
    expect(() => normalizeWarnings([{ reportDatetime: 'x' }], shapes, tree, 'fetched')).toThrow();
  });

  it('reads area boundaries and skips features it cannot use', () => {
    const areas = normalizeAreaShapes({ type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { code: '130010', name: '東京地方' }, geometry: square },
      { type: 'Feature', properties: { code: 'hoppo' }, geometry: square },
      { type: 'Feature', properties: { code: '1', name: 'x' }, geometry: { type: 'Point', coordinates: [0, 0] } },
    ] });
    expect(areas.map(area => area.code)).toEqual(['130010']);
    expect(() => normalizeAreaShapes({ type: 'FeatureCollection', features: [] })).toThrow();
  });

  it('keeps the state of each municipality, the unit warnings are actually issued for', () => {
    const data = [
      report('2026-09-11T20:00:00+09:00', [], [
        { areaCode: '1310100', kinds: [{ code: '03', status: '発表' }] },
        { areaCode: '1310200', kinds: [{ status: '発表警報・注意報はなし' }] },
        { areaCode: '9999999', kinds: [{ code: '14', status: '発表' }] },
      ]),
      report('2026-09-11T21:00:00+09:00', [], [{ areaCode: '1310100', kinds: [{ code: '29', status: '発表' }] }]),
    ];
    const { municipalities } = normalizeWarnings(data, shapes, tree, 'fetched');
    // Only municipalities with something in force, and only those the area list knows.
    expect(municipalities).toEqual([{
      code: '1310100', name: '千代田区', area: '130010', reportedAt: '2026-09-11T21:00:00+09:00',
      kinds: [
        { code: '03', name: 'レベル３大雨警報', tier: 'warning', level: 3 },
        { code: '29', name: 'レベル２土砂災害注意報', tier: 'advisory', level: 2 },
      ],
    }]);
  });

  it('resolves each municipality to its area through the class15 level', () => {
    expect(tree.get('1310200')).toEqual({ name: '中央区', area: '130010' });
    expect(() => normalizeAreaTree({ class15s: {}, class20s: {} })).toThrow();
    expect(() => normalizeAreaTree([])).toThrow();
  });

  it('reads one municipality boundary and gives nothing for an unusable file', () => {
    const file = { type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { code: '1310100', name: '千代田区' }, geometry: square },
    ] };
    expect(normalizeMunicipalityShape(file, '1310100')).toMatchObject({ code: '1310100', name: '千代田区' });
    expect(normalizeMunicipalityShape(file, '1310200')).toBeNull();
    expect(normalizeMunicipalityShape({ features: [] }, '1310100')).toBeNull();
  });
});
