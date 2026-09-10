import type { Map as LibreMap } from 'maplibre-gl';

// The opacity property differs per layer type, so its value is passed through untyped.
type SetOpacity = (layer: string, property: string, value: unknown) => void;
import { baseMapFeatureLayers, type BaseMapFeature } from './baseMap';

const opacityProperty = (type: string) =>
  type === 'raster' ? 'raster-opacity' : type === 'line' ? 'line-opacity' : 'fill-opacity';

/**
 * Switches base map details by fading them out instead of hiding the layer.
 * A hidden raster layer does not reliably come back until the map moves, so the
 * layer stays in place and only its opacity changes.
 */
export class BaseMapFeatures {
  private readonly shownValue = new Map<string, unknown>();

  constructor(private readonly map: LibreMap) {
    for (const layers of Object.values(baseMapFeatureLayers)) {
      for (const id of layers) {
        const layer = map.getLayer(id);
        if (!layer) continue;
        this.shownValue.set(id, map.getPaintProperty(id, opacityProperty(layer.type)) ?? 1);
      }
    }
  }

  set(shown: Record<BaseMapFeature, boolean>) {
    for (const [feature, layers] of Object.entries(baseMapFeatureLayers)) {
      for (const id of layers) {
        const layer = this.map.getLayer(id);
        if (!layer) continue;
        const property = opacityProperty(layer.type);
        (this.map.setPaintProperty as SetOpacity)(id, property, shown[feature as BaseMapFeature] ? this.shownValue.get(id) : 0);
      }
    }
  }
}
