import { describe, expect, it } from 'vitest';
import type { AmedasSnapshot } from '../domain/AmedasObservation';
import { amedasReducer, initialAmedasState, isAmedasStale } from './amedasMonitor';

const snapshot = (minute: number): AmedasSnapshot => ({
  observedAt: new Date(Date.UTC(2026, 8, 8, 14, minute)).toISOString(),
  fetchedAt: '2026-09-08T14:31:00.000Z',
  source: '気象庁',
  stations: [],
});

describe('AMeDAS monitor state', () => {
  it('distinguishes a new observation from an unchanged response', () => {
    const first = amedasReducer(initialAmedasState, { type: 'success', snapshot: snapshot(20), at: 'first' });
    expect(first.phase).toBe('updated');
    const unchanged = amedasReducer(first, { type: 'success', snapshot: snapshot(20), at: 'second' });
    expect(unchanged.phase).toBe('unchanged');
    expect(unchanged.lastSuccessAt).toBe('second');
  });

  it('retains the last snapshot and success time on failures', () => {
    const first = amedasReducer(initialAmedasState, { type: 'success', snapshot: snapshot(20), at: 'first' });
    const failed = amedasReducer(first, { type: 'failure', kind: 'network', message: 'offline' });
    expect(failed.snapshot).toBe(first.snapshot);
    expect(failed.lastSuccessAt).toBe('first');
    expect(failed.phase).toBe('network-error');
  });

  it('marks observations older than 30 minutes as stale', () => {
    expect(isAmedasStale(snapshot(0), Date.parse(snapshot(31).observedAt))).toBe(true);
    expect(isAmedasStale(snapshot(0), Date.parse(snapshot(30).observedAt))).toBe(false);
    expect(isAmedasStale(null, Date.now())).toBe(false);
  });
});
