import { config } from '../../app/config';
import type { WeatherFrame } from '../domain/WeatherFrame';

export type MonitorState = {
  frames: WeatherFrame[];
  selectedId: string | null;
  phase: 'idle' | 'loading' | 'updated' | 'unchanged' | 'network-error' | 'format-error';
  lastSuccessAt: string | null;
  error: string | null;
};
export const initialMonitorState: MonitorState = {
  frames: [], selectedId: null, phase: 'idle', lastSuccessAt: null, error: null,
};
export type MonitorAction =
  | { type: 'start' }
  | { type: 'success'; frames: WeatherFrame[]; at: string }
  | { type: 'failure'; kind: 'network' | 'format'; message: string }
  | { type: 'select'; id: string };

export function monitorReducer(state: MonitorState, action: MonitorAction): MonitorState {
  if (action.type === 'start') return { ...state, phase: 'loading', error: null };
  if (action.type === 'failure') return { ...state, phase: action.kind === 'format' ? 'format-error' : 'network-error', error: action.message };
  if (action.type === 'select') return state.frames.some(frame => frame.id === action.id)
    ? { ...state, selectedId: action.id } : state;
  const merged = [...new Map([...state.frames, ...action.frames].map(frame => [frame.id, frame])).values()]
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  const frames = merged.slice(-config.historyLimit);
  const newest = frames.at(-1);
  const wasLatest = !state.selectedId || state.selectedId === state.frames.at(-1)?.id;
  // Keep a manually selected older frame, even as the rolling history advances.
  const pinned = state.frames.find(frame => frame.id === state.selectedId);
  if (!wasLatest && pinned && !frames.some(frame => frame.id === pinned.id)) frames.unshift(pinned);
  return {
    frames, selectedId: wasLatest ? newest?.id ?? null : state.selectedId,
    phase: frames.some(frame => !state.frames.some(old => old.id === frame.id)) ? 'updated' : 'unchanged',
    lastSuccessAt: action.at, error: null,
  };
}

export function isStale(frame: WeatherFrame | undefined | null, now: number): boolean {
  return !!frame && now - Date.parse(frame.observedAt) > config.staleAfterMs;
}
