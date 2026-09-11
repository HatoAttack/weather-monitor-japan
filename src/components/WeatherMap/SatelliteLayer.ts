import type { Map as LibreMap } from 'maplibre-gl';
import { config } from '../../app/config';
import type { WeatherFrame } from '../../weather/domain/WeatherFrame';
import { weatherLayerBefore } from './baseMap';
import type { LayerStatus } from './RainLayer';

type Entry = { source: string; layer: string; frame: WeatherFrame };

export class SatelliteLayer {
  private current: Entry | null = null;
  private pending: Entry | null = null;
  private timer: number | null = null;
  private sequence = 0;
  private visible = false;

  constructor(private map: LibreMap, private onDisplay: (frame: WeatherFrame) => void, private onStatus: (status: LayerStatus) => void) {
    map.on('render', this.handleRender);
    map.on('error', this.handleError);
  }

  private remove(entry: Entry) {
    if (this.map.getLayer(entry.layer)) this.map.removeLayer(entry.layer);
    if (this.map.getSource(entry.source)) this.map.removeSource(entry.source);
  }

  private clearPending(remove = true) {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    if (remove && this.pending) this.remove(this.pending);
    this.pending = null;
  }

  private fail() {
    this.clearPending();
    this.onStatus({ phase: 'error', message: this.current ? '衛星画像を更新できません。直前の画像を維持しています。' : '衛星画像を表示できません。時間をおいて再試行してください。' });
  }

  private startTimer() {
    if (this.timer === null) this.timer = window.setTimeout(() => this.fail(), config.tileTimeoutMs);
  }

  private handleError = (event: unknown) => {
    const sourceId = (event as { sourceId?: string }).sourceId;
    if (this.visible && this.pending?.source === sourceId) this.fail();
  };

  private handleRender = () => {
    if (!this.pending || !this.map.isSourceLoaded(this.pending.source)) return;
    const entry = this.pending;
    this.clearPending(false);
    this.map.setPaintProperty(entry.layer, 'raster-opacity', this.visible ? 0.55 : 0);
    const previous = this.current;
    this.current = entry;
    if (previous) this.remove(previous);
    this.onDisplay(entry.frame);
    this.onStatus({ phase: 'ready' });
  };

  setVisible(visible: boolean) {
    this.visible = visible;
    if (this.current) this.map.setPaintProperty(this.current.layer, 'raster-opacity', visible ? 0.55 : 0);
    if (this.pending) {
      // A fully transparent raster can be skipped by the renderer. Use an
      // imperceptible opacity while loading after the user enables it.
      this.map.setPaintProperty(this.pending.layer, 'raster-opacity', visible ? 0.001 : 0);
      if (visible) { this.startTimer(); this.map.triggerRepaint(); }
    }
  }

  setFrame(frame: WeatherFrame, force = false) {
    if (this.current?.frame.id === frame.id && !force) return;
    this.clearPending();
    const id = `satellite-${++this.sequence}`;
    const entry = { source: id, layer: `${id}-layer`, frame };
    this.pending = entry;
    this.onStatus({ phase: 'loading' });
    try {
      this.map.addSource(entry.source, { type: 'raster', tiles: [frame.tileTemplate], tileSize: 256, minzoom: frame.minZoom, maxzoom: frame.maxZoom, bounds: frame.bounds, attribution: frame.attribution });
      this.map.addLayer({ id: entry.layer, type: 'raster', source: entry.source, paint: { 'raster-opacity': this.visible ? 0.001 : 0, 'raster-opacity-transition': { duration: 0 }, 'raster-fade-duration': 0 } },
        this.map.getLayer(weatherLayerBefore) ? weatherLayerBefore : undefined);
      if (this.visible) this.startTimer();
    } catch { this.fail(); }
  }

  destroy() {
    this.map.off('render', this.handleRender);
    this.map.off('error', this.handleError);
    this.clearPending();
    if (this.current) this.remove(this.current);
    this.current = null;
  }
}
