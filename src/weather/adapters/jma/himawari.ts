import { WeatherDataError, type WeatherFrame } from '../../domain/WeatherFrame';

const root = 'https://www.jma.go.jp/bosai/himawari/data/satimg';
export const himawariSource = {
  name: '気象庁',
  url: 'https://www.jma.go.jp/bosai/map.html?contents=himawari',
  attribution: '<a href="https://www.jma.go.jp/bosai/map.html?contents=himawari" target="_blank" rel="noopener noreferrer">気象庁「ひまわり」</a>',
};

function parseTime(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{14}$/.test(value)) {
    throw new WeatherDataError('format', '衛星画像の時刻形式が変わった可能性があります。');
  }
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}Z`;
  if (!Number.isFinite(Date.parse(iso))) throw new WeatherDataError('format', '衛星画像に不正な日時が含まれています。');
  return new Date(iso).toISOString();
}

export function normalizeHimawari(data: unknown, fetchedAt: string, now = Date.now()): WeatherFrame[] {
  if (!Array.isArray(data)) throw new WeatherDataError('format', '利用できる衛星画像の時刻一覧がありません。');
  const frames = data.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const row = item as { basetime?: unknown; validtime?: unknown };
    parseTime(row.basetime);
    const observedAt = parseTime(row.validtime);
    if (Date.parse(observedAt) > now) return [];
    return [{
      id: `satellite-${String(row.validtime)}`, observedAt, fetchedAt, layerType: 'satellite' as const,
      source: himawariSource.name,
      tileTemplate: `${root}/${String(row.basetime)}/fd/${String(row.validtime)}/B13/TBB/{z}/{x}/{y}.jpg`,
      minZoom: 3, maxZoom: 5, bounds: [80, -10, 180, 70] as [number, number, number, number],
      attribution: himawariSource.attribution,
    }];
  });
  const latest = frames.sort((a, b) => a.observedAt.localeCompare(b.observedAt)).at(-1);
  if (!latest) throw new WeatherDataError('format', '表示できる衛星画像がありません。');
  return [latest];
}

export async function fetchHimawari(signal: AbortSignal): Promise<WeatherFrame[]> {
  const timeout = AbortSignal.timeout(15_000);
  let response: Response;
  try {
    response = await fetch(`${root}/targetTimes_fd.json`, { signal: AbortSignal.any([signal, timeout]), cache: 'no-cache' });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new WeatherDataError('network', '衛星画像の時刻情報を取得できません。');
  }
  if (!response.ok) throw new WeatherDataError('network', `衛星画像の取得に失敗しました（HTTP ${response.status}）。`);
  try { return normalizeHimawari(await response.json(), new Date().toISOString()); }
  catch (error) {
    if (error instanceof WeatherDataError) throw error;
    throw new WeatherDataError('format', '衛星画像の時刻情報を読み取れません。');
  }
}
