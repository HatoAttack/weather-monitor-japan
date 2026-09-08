import { config } from '../../app/config';
import type { AmedasSnapshot } from '../domain/AmedasObservation';

export type AmedasMonitorState = {
  snapshot: AmedasSnapshot | null;
  phase: 'idle' | 'loading' | 'updated' | 'unchanged' | 'network-error' | 'format-error';
  lastSuccessAt: string | null;
  error: string | null;
};

export const initialAmedasState: AmedasMonitorState = {
  snapshot: null,
  phase: 'idle',
  lastSuccessAt: null,
  error: null,
};

export type AmedasAction =
  | { type: 'start' }
  | { type: 'success'; snapshot: AmedasSnapshot; at: string }
  | { type: 'failure'; kind: 'network' | 'format'; message: string };

export function amedasReducer(state: AmedasMonitorState, action: AmedasAction): AmedasMonitorState {
  if (action.type === 'start') return { ...state, phase: 'loading', error: null };
  if (action.type === 'failure') {
    return {
      ...state,
      phase: action.kind === 'format' ? 'format-error' : 'network-error',
      error: action.message,
    };
  }
  return {
    snapshot: action.snapshot,
    phase: state.snapshot?.observedAt === action.snapshot.observedAt ? 'unchanged' : 'updated',
    lastSuccessAt: action.at,
    error: null,
  };
}

export function isAmedasStale(snapshot: AmedasSnapshot | null, now: number): boolean {
  return !!snapshot && now - Date.parse(snapshot.observedAt) > config.amedasStaleAfterMs;
}
