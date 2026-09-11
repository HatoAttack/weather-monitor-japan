import type { BrowserContext, Page } from '@playwright/test';

const square = (west: number, south: number, east: number, north: number) =>
  ({ type: 'Polygon', coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] });

/** A square area around the configured map centre, so a click there lands on it. */
export const centreArea = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: { code: '999010', name: '検証地方' }, geometry: square(135.5, 34.5, 138.5, 37.5) }],
};

/** One municipality inside that area, also covering the map centre. */
export const centreMunicipality = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: { code: '9990100', name: '検証市' }, geometry: square(136.8, 35.8, 137.2, 36.2) }],
};

export const areaTree = {
  class15s: { '999011': { name: '検証北部', parent: '999010' } },
  class20s: { '9990100': { name: '検証市', parent: '999011' } },
};

export const warningReport = (
  kinds: { code?: string; status: string }[], time = '2026-09-11T20:00:00+09:00',
  municipal: { code?: string; status: string }[] = [],
) => [{
  reportDatetime: time, infoType: '発表',
  warning: {
    class10Items: [{ areaCode: '999010', kinds }],
    class20Items: municipal.length ? [{ areaCode: '9990100', kinds: municipal }] : [],
  },
}];

/** Keeps warning requests off the network for tests that are about something else. */
export async function stubWarnings(target: Page | BrowserContext, reports: unknown = []) {
  await target.route('**/geojson/class10s.json', route => route.fulfill({ json: centreArea }));
  await target.route('**/geojson/class20s/*.json', route => route.fulfill({ json: centreMunicipality }));
  await target.route('**/common/const/area.json', route => route.fulfill({ json: areaTree }));
  await target.route('**/warning/data/r8/map.json', route => route.fulfill({ json: reports }));
}
