import { config } from '../../../app/config';
import { rainTileScheme } from './rainTiles';
import { WeatherDataError, type WeatherFrame } from '../../domain/WeatherFrame';

const root = 'https://www.jma.go.jp/bosai/jmatile/data/nowc';
export const precipitationSource = {
  name: '気象庁',
  url: 'https://www.jma.go.jp/bosai/nowc/',
  attribution: '<a href="https://www.jma.go.jp/bosai/nowc/" target="_blank" rel="noopener noreferrer">気象庁「雨雲の動き」を加工して作成</a>',
};

function parseTime(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{14}$/.test(value)) {
    throw new WeatherDataError('format', '気象データの時刻形式が変わった可能性があります。');
  }
  const iso = value.slice(0, 4) + '-' + value.slice(4, 6) + '-' + value.slice(6, 8)
    + 'T' + value.slice(8, 10) + ':' + value.slice(10, 12) + ':' + value.slice(12, 14) + 'Z';
  if (!Number.isFinite(Date.parse(iso)) || new Date(iso).toISOString() !== iso.replace('Z', '.000Z')) {
    throw new WeatherDataError('format', '気象データに不正な日時が含まれています。');
  }
  return new Date(iso).toISOString();
}

export function normalizeFrames(data: unknown, fetchedAt: string, now = Date.now()): WeatherFrame[] {
  if (!Array.isArray(data) || data.length === 0) {
    throw new WeatherDataError('format', '利用できる気象データの時刻一覧がありません。');
  }
  const frames: WeatherFrame[] = [];
  for (const item of data) {
    if (!item || typeof item !== 'object' || !Array.isArray(item.elements)
      || !item.elements.every((element: unknown) => typeof element === 'string')) {
      throw new WeatherDataError('format', '気象データの形式が変わった可能性があります。');
    }
    const base = parseTime(item.basetime);
    const observedAt = parseTime(item.validtime);
    // Observations only. Forecasts must never enter the v0.1 timeline.
    if (!item.elements.includes('hrpns') || base !== observedAt || Date.parse(observedAt) > now) continue;
    frames.push({
      id: 'rain-' + item.validtime, observedAt, fetchedAt, layerType: 'precipitation',
      source: precipitationSource.name,
      // Requests go through the tile protocol, which fills the zoom levels JMA leaves empty.
      tileTemplate: rainTileScheme + '://' + root + '/' + item.basetime + '/none/' + item.validtime + '/surf/hrpns/{z}/{x}/{y}.png',
      minZoom: 4, maxZoom: 10, bounds: [100, 7, 170, 61], attribution: precipitationSource.attribution,
    });
  }
  if (!frames.length) throw new WeatherDataError('format', '表示できる降水実況データがありません。');
  return [...new Map(frames.map(frame => [frame.id, frame])).values()]
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt)).slice(-config.historyLimit);
}

export async function fetchPrecipitation(signal: AbortSignal): Promise<WeatherFrame[]> {
  const timeout = AbortSignal.timeout(config.requestTimeoutMs);
  let response: Response;
  try {
    response = await fetch(root + '/targetTimes_N1.json', {
      signal: AbortSignal.any([signal, timeout]), cache: 'no-cache',
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new WeatherDataError('network', '気象データを取得できません。通信状態を確認してください。');
  }
  if (!response.ok) throw new WeatherDataError('network', '気象データの取得に失敗しました（HTTP ' + response.status + '）。');
  let data: unknown;
  try { data = await response.json(); }
  catch (error) {
    if (signal.aborted) throw error;
    if (!(error instanceof SyntaxError)) {
      throw new WeatherDataError('network', '気象データの受信が中断されました。時間をおいて再試行してください。');
    }
    throw new WeatherDataError('format', '気象データを読み取れません。配信形式が変わった可能性があります。');
  }
  return normalizeFrames(data, new Date().toISOString());
}
