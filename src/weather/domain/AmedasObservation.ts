export type AmedasMetric = 'temperature' | 'precipitation' | 'wind';

export type AmedasStation = {
  id: string;
  name: string;
  coordinates: [number, number];
  altitude: number;
  temperature: number | null;
  precipitation1h: number | null;
  windDirection: number | null;
  windSpeed: number | null;
};

export type AmedasSnapshot = {
  observedAt: string;
  fetchedAt: string;
  source: '気象庁';
  stations: AmedasStation[];
};

export const windDirections = [
  '静穏', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東',
  '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西', '北',
] as const;

export function windDirectionName(value: number | null): string {
  return value !== null && Number.isInteger(value) && value >= 0 && value < windDirections.length
    ? windDirections[value]
    : '欠測';
}

export function windDirectionArrow(value: number | null): string {
  if (value === null || value === 0) return value === 0 ? '・' : '';
  return ['↓', '↙', '←', '↖', '↑', '↗', '→', '↘'][Math.round((value - 1) / 2) % 8];
}
