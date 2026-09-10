const tileTimeoutMs = 20_000;

export const config = {
  pollIntervalMs: 5 * 60_000,
  amedasPollIntervalMs: 10 * 60_000,
  satellitePollIntervalMs: 10 * 60_000,
  satelliteStaleAfterMs: 30 * 60_000,
  requestTimeoutMs: 15_000,
  tileTimeoutMs,
  staleAfterMs: 15 * 60_000,
  amedasStaleAfterMs: 30 * 60_000,
  clockIntervalMs: 30_000,
  historyLimit: 13,
  map: { center: [137, 36] as [number, number], zoom: 4.5, minZoom: 3, maxZoom: 12 },
  playback: {
    speeds: [
      { id: 'slow', label: '低速', frameIntervalMs: 1_200 },
      { id: 'normal', label: '標準', frameIntervalMs: 700 },
      { id: 'fast', label: '高速', frameIntervalMs: 350 },
    ],
    defaultSpeedId: 'normal',
    // Pause on the newest frame before looping back to the oldest.
    lastFrameHoldMs: 1_800,
    // Stop waiting for a frame that never finishes loading, so playback keeps running.
    frameWaitMs: tileTimeoutMs,
  },
} as const;

export type PlaybackSpeed = (typeof config.playback.speeds)[number];
export type PlaybackSpeedId = PlaybackSpeed['id'];
