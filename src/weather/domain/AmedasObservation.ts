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

/**
 * JMA reports the direction the wind blows *from*, in 16 steps (1 = 北北東, 16 = 北).
 * Map arrows point the way the air travels, so the reported bearing is turned around.
 */
export function windBearing(direction: number | null): number | null {
  if (direction === null || !Number.isInteger(direction) || direction < 1 || direction > 16) return null;
  return (direction * 22.5 + 180) % 360;
}

/** Arrow length as a share of the longest arrow, so speed is readable without colour. */
export function windLength(speed: number | null, longest = 20): number {
  if (speed === null || !(speed > 0)) return 0;
  return 0.3 + Math.min(speed, longest) / longest * 0.7;
}
