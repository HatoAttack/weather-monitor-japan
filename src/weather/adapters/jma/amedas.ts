import { config } from '../../../app/config';
import type { AmedasSnapshot, AmedasStation } from '../../domain/AmedasObservation';
import { WeatherDataError } from '../../domain/WeatherFrame';

const root = 'https://www.jma.go.jp/bosai/amedas';
const latestTimeUrl = root + '/data/latest_time.txt';
const stationTableUrl = root + '/const/amedastable.json';

export const amedasSource = {
  name: '気象庁',
  url: 'https://www.jma.go.jp/bosai/map.html#contents=amedas',
};

type StationMetadata = {
  lat?: unknown;
  lon?: unknown;
  alt?: unknown;
  kjName?: unknown;
};

type RawObservation = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function coordinate(value: unknown): number | null {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isFinite)) return null;
  return Number(value[0]) + Number(value[1]) / 60;
}

function observationValue(value: unknown): number | null {
  if (!Array.isArray(value) || value.length < 2 || !Number.isFinite(value[0]) || value[1] !== 0) return null;
  return Number(value[0]);
}

export function parseLatestTime(value: string): { observedAt: string; stamp: string } {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[+-]\d{2}:\d{2})$/);
  if (!match) throw new WeatherDataError('format', 'アメダスの観測時刻形式が変わった可能性があります。');
  const observedAt = new Date(value.trim());
  if (!Number.isFinite(observedAt.getTime())) {
    throw new WeatherDataError('format', 'アメダスの観測時刻を読み取れません。');
  }
  return { observedAt: observedAt.toISOString(), stamp: match.slice(1, 7).join('') };
}

export function normalizeAmedas(
  metadata: unknown,
  observations: unknown,
  observedAt: string,
  fetchedAt: string,
): AmedasSnapshot {
  if (!isRecord(metadata) || !isRecord(observations)) {
    throw new WeatherDataError('format', 'アメダスの地点または観測データの形式が変わった可能性があります。');
  }
  const stations: AmedasStation[] = [];
  for (const [id, rawMeta] of Object.entries(metadata)) {
    if (!/^\d{5}$/.test(id) || !isRecord(rawMeta) || !isRecord(observations[id])) continue;
    const meta = rawMeta as StationMetadata;
    const observation = observations[id] as RawObservation;
    const latitude = coordinate(meta.lat);
    const longitude = coordinate(meta.lon);
    if (latitude === null || longitude === null || typeof meta.kjName !== 'string'
      || !Number.isFinite(meta.alt)) continue;
    const temperature = observationValue(observation.temp);
    const precipitation1h = observationValue(observation.precipitation1h);
    const windDirection = observationValue(observation.windDirection);
    const windSpeed = observationValue(observation.wind);
    if ([temperature, precipitation1h, windSpeed].every(value => value === null)) continue;
    stations.push({
      id,
      name: meta.kjName,
      coordinates: [longitude, latitude],
      altitude: Number(meta.alt),
      temperature,
      precipitation1h,
      windDirection,
      windSpeed,
    });
  }
  if (!stations.length) throw new WeatherDataError('format', '表示できるアメダス観測値がありません。');
  return { observedAt, fetchedAt, source: '気象庁', stations };
}

async function readResponse(response: Response, kind: 'text' | 'json'): Promise<unknown> {
  if (!response.ok) throw new WeatherDataError('network', `アメダスを取得できません（HTTP ${response.status}）。`);
  try {
    return kind === 'text' ? await response.text() : await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new WeatherDataError('format', 'アメダスのデータを読み取れません。配信形式が変わった可能性があります。');
    }
    throw new WeatherDataError('network', 'アメダスの受信が中断されました。時間をおいて再試行してください。');
  }
}

export async function fetchAmedas(signal: AbortSignal): Promise<AmedasSnapshot> {
  const combined = AbortSignal.any([signal, AbortSignal.timeout(config.requestTimeoutMs)]);
  try {
    const latestResponse = await fetch(latestTimeUrl, { signal: combined, cache: 'no-cache' });
    const latestText = await readResponse(latestResponse, 'text');
    const { observedAt, stamp } = parseLatestTime(String(latestText));
    const [metadataResponse, observationResponse] = await Promise.all([
      fetch(stationTableUrl, { signal: combined, cache: 'force-cache' }),
      fetch(root + '/data/map/' + stamp + '.json', { signal: combined, cache: 'no-cache' }),
    ]);
    const [metadata, observations] = await Promise.all([
      readResponse(metadataResponse, 'json'),
      readResponse(observationResponse, 'json'),
    ]);
    return normalizeAmedas(metadata, observations, observedAt, new Date().toISOString());
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof WeatherDataError) throw error;
    throw new WeatherDataError('network', 'アメダスを取得できません。通信状態を確認してください。');
  }
}
