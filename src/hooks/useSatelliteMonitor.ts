import { useCallback, useEffect, useReducer, useRef } from 'react';
import { config } from '../app/config';
import { fetchHimawari } from '../weather/adapters/jma/himawari';
import { WeatherDataError } from '../weather/domain/WeatherFrame';
import { initialMonitorState, monitorReducer } from '../weather/services/monitor';

export function useSatelliteMonitor(loader = fetchHimawari) {
  const [state, dispatch] = useReducer(monitorReducer, initialMonitorState);
  const active = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    dispatch({ type: 'start' });
    try {
      const frames = await loader(controller.signal);
      if (!controller.signal.aborted) dispatch({ type: 'success', frames, at: new Date().toISOString() });
    } catch (error) {
      if (!controller.signal.aborted) dispatch({ type: 'failure', kind: error instanceof WeatherDataError ? error.kind : 'network', message: error instanceof Error ? error.message : '衛星画像を取得できません。' });
    } finally { if (active.current === controller) active.current = null; }
  }, [loader]);
  useEffect(() => {
    void refresh();
    return () => { active.current?.abort(); active.current = null; };
  }, [refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, config.satellitePollIntervalMs);
    const visible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);
  return { ...state, refresh, selected: state.frames.at(-1) };
}
