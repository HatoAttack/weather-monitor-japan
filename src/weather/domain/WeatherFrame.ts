export type WeatherFrame = {
  id: string;
  observedAt: string;
  fetchedAt: string;
  layerType: 'precipitation';
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
