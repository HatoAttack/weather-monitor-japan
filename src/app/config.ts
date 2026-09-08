export const config = {
  pollIntervalMs: 5 * 60_000,
  amedasPollIntervalMs: 10 * 60_000,
  requestTimeoutMs: 15_000,
  tileTimeoutMs: 20_000,
  staleAfterMs: 15 * 60_000,
  amedasStaleAfterMs: 30 * 60_000,
  clockIntervalMs: 30_000,
  historyLimit: 13,
  map: { center: [137, 36] as [number, number], zoom: 4.5, minZoom: 3, maxZoom: 12 },
} as const;
