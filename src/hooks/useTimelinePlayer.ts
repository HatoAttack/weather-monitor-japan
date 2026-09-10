import { useCallback, useEffect, useRef, useState } from 'react';
import { config, type PlaybackSpeedId } from '../app/config';
import type { WeatherFrame } from '../weather/domain/WeatherFrame';

type Options = {
  frames: WeatherFrame[];
  selectedId: string | null;
  /** Frame currently drawn on the map. Playback waits for it before advancing. */
  displayedId: string | null;
  enabled: boolean;
  onSelect: (id: string) => void;
};

const speedOf = (id: PlaybackSpeedId) =>
  config.playback.speeds.find(speed => speed.id === id) ?? config.playback.speeds[0];

/** Steps through the retained frames, one loaded image at a time. */
export function useTimelinePlayer({ frames, selectedId, displayedId, enabled, onSelect }: Options) {
  const [requested, setRequested] = useState(false);
  const [speedId, setSpeedId] = useState<PlaybackSpeedId>(config.playback.defaultSpeedId);
  // Read through a ref so an unmemoized callback cannot restart the frame timer.
  const select = useRef(onSelect);
  useEffect(() => { select.current = onSelect; });

  const canPlay = enabled && frames.length > 1;
  const playing = requested && canPlay;

  useEffect(() => {
    if (!playing) return;
    const index = frames.findIndex(frame => frame.id === selectedId);
    const next = frames[(index + 1) % frames.length];
    const delay = displayedId !== selectedId ? config.playback.frameWaitMs
      : index === frames.length - 1 ? config.playback.lastFrameHoldMs
        : speedOf(speedId).frameIntervalMs;
    let timer = 0;
    const start = () => {
      window.clearTimeout(timer);
      // A background tab cannot show the animation, so it should not request tiles for it.
      if (document.hidden) return;
      timer = window.setTimeout(() => select.current(next.id), delay);
    };
    start();
    document.addEventListener('visibilitychange', start);
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', start); };
  }, [playing, frames, selectedId, displayedId, speedId]);

  return {
    playing, canPlay, speedId, speeds: config.playback.speeds,
    toggle: useCallback(() => setRequested(value => !value), []),
    setSpeed: useCallback((id: PlaybackSpeedId) => setSpeedId(id), []),
    // Choosing a time by hand stops playback, so the chosen frame stays on screen.
    select: useCallback((id: string) => { setRequested(false); onSelect(id); }, [onSelect]),
  };
}
