import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAmedas, normalizeAmedas, parseLatestTime } from './amedas';
import { windDirectionArrow, windDirectionName } from '../../domain/AmedasObservation';

const metadata = {
  '44132': { lat: [35, 41.4], lon: [139, 45.0], alt: 25, kjName: '東京' },
  '62078': { lat: [34, 40.9], lon: [135, 31.1], alt: 23, kjName: '大阪' },
  invalid: { lat: [0, 0], lon: [0, 0], alt: 0, kjName: '除外' },
};
const observations = {
  '44132': { temp: [31.2, 0], precipitation1h: [2.5, 0], windDirection: [4, 0], wind: [3.6, 0] },
  '62078': { temp: [null, 5], precipitation1h: [0, 0], windDirection: [8, 0], wind: [4.1, 0] },
};
const observedAt = '2026-09-08T14:30:00.000Z';
const fetchedAt = '2026-09-08T14:31:00.000Z';

afterEach(() => vi.unstubAllGlobals());

describe('JMA AMeDAS adapter', () => {
  it('converts the latest JST timestamp to the data path and UTC instant', () => {
    expect(parseLatestTime('2026-09-08T23:30:00+09:00')).toEqual({
      observedAt,
      stamp: '20260908233000',
    });
  });

  it('joins station metadata to quality-checked observations', () => {
    const snapshot = normalizeAmedas(metadata, observations, observedAt, fetchedAt);
    expect(snapshot.stations).toHaveLength(2);
    expect(snapshot.stations[0]).toEqual({
      id: '44132', name: '東京', coordinates: [139.75, 35.69], altitude: 25,
      temperature: 31.2, precipitation1h: 2.5, windDirection: 4, windSpeed: 3.6,
    });
    expect(snapshot.stations[1].temperature).toBeNull();
    expect(snapshot.stations[1].precipitation1h).toBe(0);
  });

  it('formats the JMA 16-point wind direction for display', () => {
    expect(windDirectionName(4)).toBe('東');
    expect(windDirectionArrow(4)).toBe('←');
    expect(windDirectionName(null)).toBe('欠測');
  });

  it.each([
    ['', 'time'],
    ['2026/09/08 23:30', 'time'],
  ])('rejects an invalid latest timestamp: %s', value => {
    expect(() => parseLatestTime(value)).toThrow(/観測時刻/);
  });

  it.each([
    [null, observations],
    [metadata, null],
    [{}, {}],
  ])('rejects malformed or empty station data', (table, data) => {
    expect(() => normalizeAmedas(table, data, observedAt, fetchedAt)).toThrow();
  });

  it('requests the exact observation file announced by the latest-time endpoint', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('2026-09-08T23:30:00+09:00'))
      .mockResolvedValueOnce(Response.json(metadata))
      .mockResolvedValueOnce(Response.json(observations));
    vi.stubGlobal('fetch', fetchMock);
    const snapshot = await fetchAmedas(new AbortController().signal);
    expect(fetchMock.mock.calls[2][0]).toContain('/data/map/20260908233000.json');
    expect(snapshot.observedAt).toBe(observedAt);
  });

  it('classifies HTTP and malformed JSON failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    await expect(fetchAmedas(new AbortController().signal)).rejects.toMatchObject({ kind: 'network' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not a time')));
    await expect(fetchAmedas(new AbortController().signal)).rejects.toMatchObject({ kind: 'format' });
  });
});
