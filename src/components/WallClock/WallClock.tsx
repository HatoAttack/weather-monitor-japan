import { useClock } from '../../hooks/useClock';
import { formatClock } from '../../utils/time';

/** Its own component so the second-by-second tick does not re-render the panel. */
export function WallClock() {
  return <time className="wall-clock" aria-label="現在の日本時間">{formatClock(useClock())}</time>;
}
