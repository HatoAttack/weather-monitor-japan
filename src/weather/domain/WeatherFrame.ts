export type WeatherFrame = {
  id: string;
  observedAt: string;
  fetchedAt: string;
  /** Observations report what happened; a forecast reports what is expected. */
  kind: 'observation' | 'forecast';
  /** Observation time a forecast was calculated from. */
  issuedAt?: string;
  layerType: 'precipitation' | 'satellite';
  source: string;
  tileTemplate: string;
  minZoom: number;
  maxZoom: number;
  bounds: [number, number, number, number];
  attribution: string;
};
export class WeatherDataError extends Error {
  constructor(public readonly kind: 'network' | 'format', message: string) {
    super(message);
    this.name = 'WeatherDataError';
  }
}
