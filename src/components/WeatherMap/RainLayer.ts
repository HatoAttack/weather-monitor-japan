import type { Map as LibreMap } from 'maplibre-gl';
import { config } from '../../app/config';
import type { WeatherFrame } from '../../weather/domain/WeatherFrame';

export type LayerStatus = { phase: 'idle' | 'loading' | 'ready' | 'error'; message?: string };
type LayerEntry = { source: string; layer: string; frame: WeatherFrame };

/** Load a second raster source before replacing the last successful display. */
export class RainLayer {
  private current: LayerEntry | null = null;
  private cancelPending: (() => void) | null = null;
  private sequence = 0;
  private visible = true;

  constructor(
    private readonly map: LibreMap,
    private readonly onDisplay: (frame: WeatherFrame) => void,
    private readonly onStatus: (status: LayerStatus) => void,
  ) {
    this.map.on('error', this.onCurrentError);
  }

  private onCurrentError = (event: unknown) => {
    if (this.current && (event as { sourceId?: string }).sourceId === this.current.source) {
      this.onStatus({ phase: 'error', message: '表示範囲の降水画像を一部取得できません。読み込み済みの画像を維持しています。' });
    }
  };

  setVisible(visible: boolean) {
    this.visible = visible;
    if (this.current) this.map.setPaintProperty(this.current.layer, 'raster-opacity', visible ? 0.75 : 0);
  }

  private remove(entry: LayerEntry) {
    if (this.map.getLayer(entry.layer)) this.map.removeLayer(entry.layer);
    if (this.map.getSource(entry.source)) this.map.removeSource(entry.source);
  }

  setFrame(frame: WeatherFrame, force = false) {
    this.cancelPending?.();
    if (this.current?.frame.id === frame.id && !force) {
      this.onStatus({ phase: 'ready' });
      return;
    }
    const id = 'rain-' + ++this.sequence;
    const entry = { source: id, layer: id + '-layer', frame };
    let settled = false;
    const cleanListeners = () => {
      clearTimeout(timer);
      this.map.off('render', onData);
      this.map.off('error', onError);
      this.cancelPending = null;
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanListeners();
      this.remove(entry);
      this.onStatus({
        phase: 'error',
        message: this.current
          ? '降水画像を取得できません。直前に表示できた時刻の画像を維持しています。'
          : '降水画像を取得できません。時間をおいて再試行してください。',
      });
    };
    const onError = (event: unknown) => {
      if ((event as { sourceId?: string }).sourceId === entry.source) fail();
    };
    const onData = () => {
      if (settled || !this.map.isSourceLoaded(entry.source)) return;
      settled = true;
      cleanListeners();
      this.map.setPaintProperty(entry.layer, 'raster-opacity', this.visible ? 0.75 : 0);
      const previous = this.current;
      this.current = entry;
      if (previous) this.remove(previous);
      this.onDisplay(frame);
      this.onStatus({ phase: 'ready' });
    };
    this.cancelPending = () => {
      settled = true;
      cleanListeners();
      this.remove(entry);
    };
    this.onStatus({ phase: 'loading' });
    // The background map or another weather source can keep the map busy.
    // After a render, check only the rain source instead of waiting for global idle.
    this.map.on('render', onData);
    this.map.on('error', onError);
    const timer = setTimeout(fail, config.tileTimeoutMs);
    try {
      this.map.addSource(entry.source, {
        type: 'raster', tiles: [frame.tileTemplate], tileSize: 256,
        minzoom: frame.minZoom, maxzoom: frame.maxZoom, bounds: frame.bounds,
        attribution: frame.attribution,
      });
      this.map.addLayer({
        id: entry.layer, type: 'raster', source: entry.source,
        paint: { 'raster-opacity': 0, 'raster-opacity-transition': { duration: 0 }, 'raster-fade-duration': 0 },
      });
    } catch { fail(); }
  }

  destroy() {
    this.map.off('error', this.onCurrentError);
    this.cancelPending?.();
    if (this.current) this.remove(this.current);
    this.current = null;
  }
}
