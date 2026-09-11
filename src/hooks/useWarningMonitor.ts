import { useCallback, useEffect, useReducer, useRef } from 'react';
import { config } from '../app/config';
import { fetchWarnings } from '../weather/adapters/jma/warning';
import { WeatherDataError } from '../weather/domain/WeatherFrame';
import { initialWarningState, warningReducer } from '../weather/services/warningMonitor';

export function useWarningMonitor(loader = fetchWarnings) {
  const [state, dispatch] = useReducer(warningReducer, initialWarningState);
  const active = useRef<AbortController | null>(null);
  const lastAttempt = useRef(0);

  const refresh = useCallback(async () => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    lastAttempt.current = Date.now();
    dispatch({ type: 'start' });
    try {
      const snapshot = await loader(controller.signal);
      if (!controller.signal.aborted) dispatch({ type: 'success', snapshot, at: new Date().toISOString() });
    } catch (error) {
      if (!controller.signal.aborted) {
        dispatch({
          type: 'failure',
          kind: error instanceof WeatherDataError ? error.kind : 'network',
          message: error instanceof Error ? error.message : '警報・注意報を取得できません。',
        });
      }
    } finally {
      if (active.current === controller) active.current = null;
    }
  }, [loader]);

  useEffect(() => {
    void refresh();
    return () => { active.current?.abort(); active.current = null; };
  }, [refresh]);

  useEffect(() => {
    let timer: number;
    const tick = () => {
      window.clearTimeout(timer);
      if (document.hidden) return;
      const remaining = config.warningPollIntervalMs - (Date.now() - lastAttempt.current);
      if (remaining <= 0) void refresh();
      timer = window.setTimeout(tick, remaining > 0 ? remaining : config.warningPollIntervalMs);
    };
    timer = window.setTimeout(tick, config.warningPollIntervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', tick); };
  }, [refresh]);

  return { ...state, refresh };
}
