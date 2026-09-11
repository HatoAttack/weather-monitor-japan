import { config } from '../../app/config';
import type { WarningSnapshot } from '../domain/Warning';

export type WarningMonitorState = {
  snapshot: WarningSnapshot | null;
  phase: 'idle' | 'loading' | 'updated' | 'unchanged' | 'network-error' | 'format-error';
  lastSuccessAt: string | null;
  error: string | null;
};

export const initialWarningState: WarningMonitorState = {
  snapshot: null, phase: 'idle', lastSuccessAt: null, error: null,
};

export type WarningAction =
  | { type: 'start' }
  | { type: 'success'; snapshot: WarningSnapshot; at: string }
  | { type: 'failure'; kind: 'network' | 'format'; message: string };

export function warningReducer(state: WarningMonitorState, action: WarningAction): WarningMonitorState {
  if (action.type === 'start') return { ...state, phase: 'loading', error: null };
  // A failed check keeps the last warnings on the map; they only change on a new report.
  if (action.type === 'failure') {
    return { ...state, phase: action.kind === 'format' ? 'format-error' : 'network-error', error: action.message };
  }
  return {
    snapshot: action.snapshot,
    phase: state.snapshot?.reportedAt === action.snapshot.reportedAt ? 'unchanged' : 'updated',
    lastSuccessAt: action.at,
    error: null,
  };
}

/** Reports can be hours apart, so only a failing check makes the data stale. */
export function isWarningStale(state: WarningMonitorState, now: number): boolean {
  return !!state.lastSuccessAt && now - Date.parse(state.lastSuccessAt) > config.warningStaleAfterMs;
}
