import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPrecipitation, normalizeFrames } from './precipitation';
const at = '2026-09-08T14:00:00.000Z';
const row = (time: string, valid = time, elements = ['hrpns']) => ({ basetime: time, validtime: valid, elements });
afterEach(() => vi.unstubAllGlobals());
describe('JMA adapter', () => {
  it('normalizes observations, sorts, deduplicates and excludes forecasts and future dates', () => {
    const data = [row('20260908135500'), row('20260908135000'), row('20260908135500'),
      row('20260908135500', '20260908140000'), row('20260908140500'), row('20260908134000', undefined, ['other'])];
    const frames = normalizeFrames(data, at, Date.parse(at));
    expect(frames.map(frame => frame.observedAt)).toEqual(['2026-09-08T13:50:00.000Z', '2026-09-08T13:55:00.000Z']);
    expect(frames[1]).toMatchObject({ layerType: 'precipitation', fetchedAt: at, source: '気象庁' });
    expect(frames[1].tileTemplate).toContain('/20260908135500/none/20260908135500/surf/hrpns/{z}/{x}/{y}.png');
  });
  it.each([null, {}, [], [row('../202609081400')], [row('20260230140000')], [{}],
    [row('20260908140000', undefined, [])]])('rejects malformed or unusable payloads: %j', data => {
    expect(() => normalizeFrames(data, at, Date.parse(at))).toThrow();
  });
  it('limits the timeline to 13 observations', () => {
    const rows = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.parse(at) - i * 300_000).toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
      return row(d);
    });
    expect(normalizeFrames(rows, at, Date.parse(at))).toHaveLength(13);
  });
  it('classifies HTTP/network errors separately from malformed JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    await expect(fetchPrecipitation(new AbortController().signal)).rejects.toMatchObject({ kind: 'network' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not JSON')));
    await expect(fetchPrecipitation(new AbortController().signal)).rejects.toMatchObject({ kind: 'format' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: () => Promise.reject(new DOMException('Timed out', 'TimeoutError')),
    }));
    await expect(fetchPrecipitation(new AbortController().signal)).rejects.toMatchObject({ kind: 'network' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(fetchPrecipitation(new AbortController().signal)).rejects.toMatchObject({ kind: 'network' });
  });
});
