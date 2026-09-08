import { useCallback, useEffect, useReducer, useRef } from 'react';
import { config } from '../app/config';
import { fetchAmedas } from '../weather/adapters/jma/amedas';
import { WeatherDataError } from '../weather/domain/WeatherFrame';
import { amedasReducer, initialAmedasState } from '../weather/services/amedasMonitor';

export function useAmedasMonitor(loader = fetchAmedas) {
  const [state, dispatch] = useReducer(amedasReducer, initialAmedasState);
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
      if (!controller.signal.aborted) {
        dispatch({ type: 'success', snapshot, at: new Date().toISOString() });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        dispatch({
          type: 'failure',
          kind: error instanceof WeatherDataError ? error.kind : 'network',
          message: error instanceof Error ? error.message : 'アメダスを取得できません。',
        });
      }
    } finally {
      if (active.current === controller) active.current = null;
    }
  }, [loader]);

  useEffect(() => {
    void refresh();
    return () => {
      active.current?.abort();
      active.current = null;
    };
  }, [refresh]);

  useEffect(() => {
    const tick = () => {
      if (!document.hidden && Date.now() - lastAttempt.current >= config.amedasPollIntervalMs) void refresh();
    };
    const timer = window.setInterval(tick, config.amedasPollIntervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refresh]);

  return { ...state, refresh };
}
