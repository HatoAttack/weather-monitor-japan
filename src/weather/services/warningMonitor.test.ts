import { describe, expect, it } from 'vitest';
import { initialWarningState, isWarningStale, warningReducer } from './warningMonitor';
import type { WarningSnapshot } from '../domain/Warning';
import { config } from '../../app/config';

const snapshot = (reportedAt: string): WarningSnapshot => ({ areas: [], municipalities: [], reportedAt, fetchedAt: 'now', unknownCodes: [] });

describe('warning monitor state', () => {
  it('keeps the last warnings on the map when a check fails', () => {
    const loaded = warningReducer(initialWarningState, { type: 'success', snapshot: snapshot('t1'), at: '2026-09-11T12:00:00Z' });
    const failed = warningReducer(loaded, { type: 'failure', kind: 'network', message: 'offline' });
    expect(failed.snapshot).toBe(loaded.snapshot);
    expect(failed.phase).toBe('network-error');
    expect(failed.lastSuccessAt).toBe('2026-09-11T12:00:00Z');
  });

  it('tells a new report from an unchanged one', () => {
    const first = warningReducer(initialWarningState, { type: 'success', snapshot: snapshot('t1'), at: 'a' });
    expect(first.phase).toBe('updated');
    expect(warningReducer(first, { type: 'success', snapshot: snapshot('t1'), at: 'b' }).phase).toBe('unchanged');
    expect(warningReducer(first, { type: 'success', snapshot: snapshot('t2'), at: 'b' }).phase).toBe('updated');
  });

  it('judges staleness by the last successful check, not by the report time', () => {
    const at = Date.parse('2026-09-11T12:00:00Z');
    const state = { ...initialWarningState, lastSuccessAt: new Date(at).toISOString() };
    expect(isWarningStale(state, at + config.warningStaleAfterMs - 1)).toBe(false);
    expect(isWarningStale(state, at + config.warningStaleAfterMs + 1)).toBe(true);
    expect(isWarningStale(initialWarningState, at)).toBe(false);
  });
});
