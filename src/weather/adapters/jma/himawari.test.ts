import { describe, expect, it } from 'vitest';
import { normalizeHimawari } from './himawari';

describe('Himawari adapter', () => {
  it('selects the latest non-future infrared image', () => {
    const frames = normalizeHimawari([
      { basetime: '20260909000000', validtime: '20260909000000' },
      { basetime: '20260909001000', validtime: '20260909001000' },
      { basetime: '20260909002000', validtime: '20260909002000' },
    ], '2026-09-09T00:15:00Z', Date.parse('2026-09-09T00:15:00Z'));
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ observedAt: '2026-09-09T00:10:00.000Z', layerType: 'satellite' });
    expect(frames[0].tileTemplate).toContain('/B13/TBB/{z}/{x}/{y}.jpg');
  });

  it('rejects an incompatible response', () => {
    expect(() => normalizeHimawari({}, '2026-09-09T00:15:00Z')).toThrow(/時刻一覧/);
  });
});
