import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { config } from '../app/config';
import { fetchPrecipitation } from '../weather/adapters/jma/precipitation';
import { WeatherDataError } from '../weather/domain/WeatherFrame';
import { initialMonitorState, monitorReducer } from '../weather/services/monitor';

export function useRainMonitor(loader = fetchPrecipitation) {
  const [state, dispatch] = useReducer(monitorReducer, initialMonitorState);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [now, setNow] = useState(Date.now);
  const active = useRef<AbortController | null>(null);
  const lastAttempt = useRef(0);
  const refresh = useCallback(async () => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    lastAttempt.current = Date.now();
    dispatch({ type: 'start' });
    try {
      const frames = await loader(controller.signal);
      if (!controller.signal.aborted) dispatch({ type: 'success', frames, at: new Date().toISOString() });
    } catch (error) {
      if (!controller.signal.aborted) dispatch({
        type: 'failure', kind: error instanceof WeatherDataError ? error.kind : 'network',
        message: error instanceof Error ? error.message : '気象データを取得できません。',
      });
    } finally {
      if (active.current === controller) active.current = null;
    }
  }, [loader]);

  useEffect(() => {
    void refresh();
    return () => { active.current?.abort(); active.current = null; };
  }, [refresh]);
  useEffect(() => {
    if (!autoUpdate) return;
    let timer: number;
    const tick = () => {
      window.clearTimeout(timer);
      if (document.hidden) return;
      const remaining = config.pollIntervalMs - (Date.now() - lastAttempt.current);
      if (remaining <= 0) void refresh();
      // Recheck at the actual deadline, including after a manual update.
      timer = window.setTimeout(tick, remaining > 0 ? remaining : config.pollIntervalMs);
    };
    timer = window.setTimeout(tick, config.pollIntervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', tick); };
  }, [autoUpdate, refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), config.clockIntervalMs);
    return () => window.clearInterval(timer);
  }, []);
  return { ...state, autoUpdate, setAutoUpdate, now, refresh,
    select: (id: string) => dispatch({ type: 'select', id }),
    selected: state.frames.find(frame => frame.id === state.selectedId),
  };
}
