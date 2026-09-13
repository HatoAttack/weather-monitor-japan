import { useEffect, useState } from 'react';
import { config } from '../app/config';

/** Wall clock for the panel header. Separate from the monitors' own clocks,
 *  which tick slowly because they only judge how old the data is. */
export function useClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), config.wallClockIntervalMs);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
