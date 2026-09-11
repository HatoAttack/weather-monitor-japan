import type { MultiPolygon, Polygon } from 'geojson';
import { config } from '../../../app/config';
import { WeatherDataError } from '../../domain/WeatherFrame';
import type { WarningArea, WarningKind, WarningMunicipality, WarningSnapshot } from '../../domain/Warning';
import { tierRank } from '../../domain/Warning';

const root = 'https://www.jma.go.jp/bosai';
// The pre-2026 feed under warning/data/warning/ stopped updating on 2026-05-28.
const mapUrl = root + '/warning/data/r8/map.json';
const areaUrl = root + '/common/const/geojson/class10s.json';
const treeUrl = root + '/common/const/area.json';
const municipalityUrl = (code: string) => root + '/common/const/geojson/class20s/' + code + '.json';

export const warningSource = {
  name: '気象庁',
  url: 'https://www.jma.go.jp/bosai/warning/',
};

/**
 * Warning kinds from the JMA disaster information XML code table
 * (code.WeatherWarning, jmaxml_20260826_code.xlsx). Names follow the 2026
 * system, where heavy rain, landslide and storm surge carry an alert level.
 */
const kinds: Record<string, Omit<WarningKind, 'code'>> = {
  '02': { name: '暴風雪警報', tier: 'warning' },
  '03': { name: 'レベル３大雨警報', tier: 'warning', level: 3 },
  '04': { name: '洪水警報', tier: 'warning' },
  '05': { name: '暴風警報', tier: 'warning' },
  '06': { name: '大雪警報', tier: 'warning' },
  '07': { name: '波浪警報', tier: 'warning' },
  '08': { name: 'レベル３高潮警報', tier: 'warning', level: 3 },
  '09': { name: 'レベル３土砂災害警報', tier: 'warning', level: 3 },
  '10': { name: 'レベル２大雨注意報', tier: 'advisory', level: 2 },
  '12': { name: '大雪注意報', tier: 'advisory' },
  '13': { name: '風雪注意報', tier: 'advisory' },
  '14': { name: '雷注意報', tier: 'advisory' },
  '15': { name: '強風注意報', tier: 'advisory' },
  '16': { name: '波浪注意報', tier: 'advisory' },
  '17': { name: '融雪注意報', tier: 'advisory' },
  '18': { name: '洪水注意報', tier: 'advisory' },
  '19': { name: 'レベル２高潮注意報', tier: 'advisory', level: 2 },
  '20': { name: '濃霧注意報', tier: 'advisory' },
  '21': { name: '乾燥注意報', tier: 'advisory' },
  '22': { name: 'なだれ注意報', tier: 'advisory' },
  '23': { name: '低温注意報', tier: 'advisory' },
  '24': { name: '霜注意報', tier: 'advisory' },
  '25': { name: '着氷注意報', tier: 'advisory' },
  '26': { name: '着雪注意報', tier: 'advisory' },
  '27': { name: 'その他の注意報', tier: 'advisory' },
  '29': { name: 'レベル２土砂災害注意報', tier: 'advisory', level: 2 },
  '32': { name: '暴風雪特別警報', tier: 'special' },
  '33': { name: 'レベル５大雨特別警報', tier: 'special', level: 5 },
  '35': { name: '暴風特別警報', tier: 'special' },
  '36': { name: '大雪特別警報', tier: 'special' },
  '37': { name: '波浪特別警報', tier: 'special' },
  '38': { name: 'レベル５高潮特別警報', tier: 'special', level: 5 },
  '39': { name: 'レベル５土砂災害特別警報', tier: 'special', level: 5 },
  '43': { name: 'レベル４大雨危険警報', tier: 'danger', level: 4 },
  '48': { name: 'レベル４高潮危険警報', tier: 'danger', level: 4 },
  '49': { name: 'レベル４土砂災害危険警報', tier: 'danger', level: 4 },
};

// Only these states mean the warning is in force; 解除 lifts it.
const active = new Set(['発表', '継続']);

export type WarningAreaShape = { code: string; name: string; shape: Polygon | MultiPolygon };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function normalizeAreaShapes(data: unknown): WarningAreaShape[] {
  if (!isRecord(data) || !Array.isArray(data.features)) {
    throw new WeatherDataError('format', '警報区域の境界データを読み取れません。');
  }
  const shapes: WarningAreaShape[] = [];
  for (const feature of data.features) {
    if (!isRecord(feature) || !isRecord(feature.properties) || !isRecord(feature.geometry)) continue;
    const { code, name } = feature.properties;
    const geometry = feature.geometry as Partial<Polygon | MultiPolygon>;
    if (typeof code !== 'string' || typeof name !== 'string') continue;
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') continue;
    shapes.push({ code, name, shape: geometry as Polygon | MultiPolygon });
  }
  if (!shapes.length) throw new WeatherDataError('format', '警報区域の境界データが空です。');
  return shapes;
}

/** Municipality names and the area each belongs to, via the intermediate class15 level. */
export type WarningAreaTree = Map<string, { name: string; area: string }>;

export function normalizeAreaTree(data: unknown): WarningAreaTree {
  if (!isRecord(data) || !isRecord(data.class15s) || !isRecord(data.class20s)) {
    throw new WeatherDataError('format', '警報区域の一覧を読み取れません。');
  }
  const class15s = data.class15s;
  const tree: WarningAreaTree = new Map();
  for (const [code, info] of Object.entries(data.class20s)) {
    if (!isRecord(info) || typeof info.name !== 'string' || typeof info.parent !== 'string') continue;
    const middle = class15s[info.parent];
    if (!isRecord(middle) || typeof middle.parent !== 'string') continue;
    tree.set(code, { name: info.name, area: middle.parent });
  }
  if (!tree.size) throw new WeatherDataError('format', '警報区域の一覧が空です。');
  return tree;
}

type Accumulated = { kinds: Map<string, WarningKind>; reportedAt: string | null };

const bySeverity = (a: WarningKind, b: WarningKind) => tierRank(b.tier) - tierRank(a.tier) || a.code.localeCompare(b.code);

/**
 * The feed holds the newest report per forecast office and hazard group, so an
 * area's current state is the union of the kinds in force across those reports.
 * The same applies to the municipalities each report lists.
 */
export function normalizeWarnings(
  data: unknown, shapes: WarningAreaShape[], tree: WarningAreaTree, fetchedAt: string,
): WarningSnapshot {
  if (!Array.isArray(data)) throw new WeatherDataError('format', '警報・注意報の一覧を読み取れません。');
  const areas = new Map<string, Accumulated>();
  const municipalities = new Map<string, Accumulated>();
  const unknown = new Set<string>();
  let newest: string | null = null;
  const collect = (target: Map<string, Accumulated>, items: unknown, reportedAt: string | null) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!isRecord(item) || typeof item.areaCode !== 'string' || !Array.isArray(item.kinds)) continue;
      const entry = target.get(item.areaCode) ?? { kinds: new Map(), reportedAt: null };
      target.set(item.areaCode, entry);
      if (reportedAt && (!entry.reportedAt || Date.parse(reportedAt) > Date.parse(entry.reportedAt))) {
        entry.reportedAt = reportedAt;
      }
      for (const kind of item.kinds) {
        if (!isRecord(kind) || typeof kind.code !== 'string' || !active.has(String(kind.status))) continue;
        const known = kinds[kind.code];
        if (known) entry.kinds.set(kind.code, { code: kind.code, ...known });
        else unknown.add(kind.code);
      }
    }
  };
  for (const report of data) {
    if (!isRecord(report) || !isRecord(report.warning)) {
      throw new WeatherDataError('format', '警報・注意報の形式が変わった可能性があります。');
    }
    const reportedAt = typeof report.reportDatetime === 'string' ? report.reportDatetime : null;
    if (reportedAt && (!newest || Date.parse(reportedAt) > Date.parse(newest))) newest = reportedAt;
    collect(areas, report.warning.class10Items, reportedAt);
    collect(municipalities, report.warning.class20Items, reportedAt);
  }
  const shownAreas: WarningArea[] = shapes.map(({ code, name, shape }) => ({
    code, name, shape,
    kinds: [...(areas.get(code)?.kinds.values() ?? [])].sort(bySeverity),
    reportedAt: areas.get(code)?.reportedAt ?? null,
  }));
  const shownMunicipalities: WarningMunicipality[] = [];
  for (const [code, entry] of municipalities) {
    const place = tree.get(code);
    if (!place || !entry.kinds.size) continue;
    shownMunicipalities.push({
      code, name: place.name, area: place.area,
      kinds: [...entry.kinds.values()].sort(bySeverity), reportedAt: entry.reportedAt,
    });
  }
  return {
    areas: shownAreas, municipalities: shownMunicipalities,
    reportedAt: newest, fetchedAt, unknownCodes: [...unknown].sort(),
  };
}

async function readJson(url: string, signal: AbortSignal, label: string): Promise<unknown> {
  const timeout = AbortSignal.timeout(config.requestTimeoutMs);
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.any([signal, timeout]), cache: 'no-cache' });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new WeatherDataError('network', label + 'を取得できません。通信状態を確認してください。');
  }
  if (!response.ok) throw new WeatherDataError('network', label + 'の取得に失敗しました（HTTP ' + response.status + '）。');
  try { return await response.json(); }
  catch (error) {
    if (signal.aborted) throw error;
    throw new WeatherDataError('format', label + 'を読み取れません。配信形式が変わった可能性があります。');
  }
}

// Boundaries and the area list do not change between reports, so each is fetched
// once per session. Shared requests carry their own signal: one caller giving up
// must not fail them for the next.
let shapeCache: Promise<WarningAreaShape[]> | null = null;
let treeCache: Promise<WarningAreaTree> | null = null;

function areaShapes(): Promise<WarningAreaShape[]> {
  if (!shapeCache) {
    shapeCache = readJson(areaUrl, new AbortController().signal, '警報区域の境界データ').then(normalizeAreaShapes);
    shapeCache.catch(() => { shapeCache = null; });
  }
  return shapeCache;
}

function areaTree(): Promise<WarningAreaTree> {
  if (!treeCache) {
    treeCache = readJson(treeUrl, new AbortController().signal, '警報区域の一覧').then(normalizeAreaTree);
    treeCache.catch(() => { treeCache = null; });
  }
  return treeCache;
}

export async function fetchWarnings(signal: AbortSignal): Promise<WarningSnapshot> {
  const [shapes, tree, data] = await Promise.all([areaShapes(), areaTree(), readJson(mapUrl, signal, '警報・注意報')]);
  return normalizeWarnings(data, shapes, tree, new Date().toISOString());
}

/** One municipality boundary; a file without a usable polygon gives nothing. */
export function normalizeMunicipalityShape(data: unknown, code: string): WarningAreaShape | null {
  try {
    return normalizeAreaShapes(data).find(shape => shape.code === code) ?? null;
  } catch {
    return null;
  }
}

const municipalShapes = new Map<string, Promise<WarningAreaShape | null>>();

/**
 * Municipality boundaries are published one file each, so only the ones asked
 * for are fetched, a few at a time, and kept for the rest of the session.
 * A file that fails is dropped from the cache, so a later view can try it again.
 */
export async function fetchMunicipalityShapes(codes: string[]): Promise<WarningAreaShape[]> {
  const queue = codes.filter(code => !municipalShapes.has(code));
  const load = (code: string) => {
    const pending = readJson(municipalityUrl(code), new AbortController().signal, '市町村の境界データ')
      .then(data => normalizeMunicipalityShape(data, code))
      .catch(() => null);
    municipalShapes.set(code, pending);
    return pending.then(shape => { if (!shape) municipalShapes.delete(code); });
  };
  const workers = Array.from({ length: Math.min(config.warningShapeConcurrency, queue.length) }, async () => {
    for (let code = queue.shift(); code; code = queue.shift()) await load(code);
  });
  await Promise.all(workers);
  const shapes = await Promise.all(codes.map(code => municipalShapes.get(code) ?? Promise.resolve(null)));
  return shapes.filter((shape): shape is WarningAreaShape => !!shape);
}
