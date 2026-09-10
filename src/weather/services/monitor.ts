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
  const observed = (frames: WeatherFrame[]) => frames.filter(frame => frame.kind === 'observation');
  const byTime = (a: WeatherFrame, b: WeatherFrame) => a.observedAt.localeCompare(b.observedAt);
  const observations = [...new Map([...observed(state.frames), ...observed(action.frames)]
    .map(frame => [frame.id, frame])).values()].sort(byTime).slice(-config.historyLimit);
  // A forecast describes one base observation, so the previous set is replaced, never merged.
  const forecast = action.frames.filter(frame => frame.kind === 'forecast').sort(byTime);
  const frames = [...observations, ...forecast];
  const newest = observations.at(-1);
  const wasLatest = !state.selectedId || state.selectedId === observed(state.frames).at(-1)?.id;
  // Keep a manually selected older observation, even as the rolling history advances.
  const pinned = state.frames.find(frame => frame.id === state.selectedId);
  if (!wasLatest && pinned?.kind === 'observation' && !frames.some(frame => frame.id === pinned.id)) {
    frames.unshift(pinned);
  }
  const keepsSelection = !wasLatest && frames.some(frame => frame.id === state.selectedId);
  return {
    frames, selectedId: keepsSelection ? state.selectedId : newest?.id ?? null,
    phase: frames.some(frame => !state.frames.some(old => old.id === frame.id)) ? 'updated' : 'unchanged',
    lastSuccessAt: action.at, error: null,
  };
}

/** Newest frame that reports what happened, ignoring anything forecast. */
export function latestObservation(frames: WeatherFrame[]): WeatherFrame | undefined {
  return frames.filter(frame => frame.kind === 'observation').at(-1);
}

export function isStale(frame: WeatherFrame | undefined | null, now: number): boolean {
  return !!frame && now - Date.parse(frame.observedAt) > config.staleAfterMs;
}
