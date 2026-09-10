import { useEffect, useRef, useState } from 'react';
import { Map, NavigationControl } from 'maplibre-gl';
import { config } from '../../app/config';
import type { WeatherFrame } from '../../weather/domain/WeatherFrame';
import type { AmedasMetric, AmedasSnapshot, AmedasStation } from '../../weather/domain/AmedasObservation';
import { baseMapStyle, type BaseMapFeature } from './baseMap';
import { BaseMapFeatures } from './BaseMapFeatures';
import { AmedasLayer } from './AmedasLayer';
import { RainLayer, type LayerStatus } from './RainLayer';
import { SatelliteLayer } from './SatelliteLayer';

type Props = {
  frame?: WeatherFrame; visible: boolean; retry: number;
  amedasSnapshot: AmedasSnapshot | null;
  amedasMetric: AmedasMetric;
  amedasVisible: boolean;
  onDisplay: (frame: WeatherFrame) => void;
  onStatus: (status: LayerStatus) => void;
  onStation: (station: AmedasStation) => void;
  satelliteFrame?: WeatherFrame;
  satelliteVisible: boolean;
  satelliteRetry: number;
  onSatelliteDisplay: (frame: WeatherFrame) => void;
  onSatelliteStatus: (status: LayerStatus) => void;
  baseMapFeatures: Record<BaseMapFeature, boolean>;
};
export function WeatherMap({
  frame, visible, retry, amedasSnapshot, amedasMetric, amedasVisible, onDisplay, onStatus, onStation,
  satelliteFrame, satelliteVisible, satelliteRetry, onSatelliteDisplay, onSatelliteStatus,
  baseMapFeatures,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const features = useRef<BaseMapFeatures | null>(null);
  const rain = useRef<RainLayer | null>(null);
  const amedas = useRef<AmedasLayer | null>(null);
  const satellite = useRef<SatelliteLayer | null>(null);
  const lastRetry = useRef(retry);
  const lastSatelliteRetry = useRef(satelliteRetry);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  useEffect(() => {
    if (!container.current) return;
    // A recreated map (including development hot reload) has new layer instances.
    // Reset readiness so the current frame and visibility are applied after load.
    setReady(false);
    let map: Map;
    try {
      map = new Map({
        container: container.current, style: baseMapStyle,
        center: config.map.center, zoom: config.map.zoom, minZoom: config.map.minZoom, maxZoom: config.map.maxZoom,
        maxBounds: [[110, 10], [165, 58]], renderWorldCopies: false, attributionControl: { compact: false },
        dragRotate: false, pitchWithRotate: false, touchPitch: false,
      });
    } catch {
      setMapError('地図を起動できません。WebGL が利用できるブラウザで開いてください。');
      return;
    }
    map.keyboard.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.getCanvas().setAttribute('aria-label', '日本の降水地図。矢印キーで移動、プラスとマイナスキーで拡大縮小。');
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(container.current);
    map.on('load', () => {
      features.current = new BaseMapFeatures(map);
      rain.current = new RainLayer(map, onDisplay, onStatus);
      satellite.current = new SatelliteLayer(map, onSatelliteDisplay, onSatelliteStatus);
      amedas.current = new AmedasLayer(map, onStation);
      setReady(true);
    });
    map.on('error', (event) => {
      const sourceId = (event as { sourceId?: string }).sourceId;
      if (sourceId === 'basemap' || sourceId === 'detail') setMapError('背景地図の一部を取得できません。読み込み済みの範囲を表示しています。');
    });
    map.on('sourcedata', event => {
      if ((event.sourceId === 'basemap' || event.sourceId === 'detail') && event.sourceDataType === 'content') setMapError(null);
    });
    return () => {
      resize.disconnect();
      rain.current?.destroy();
      rain.current = null;
      satellite.current?.destroy();
      satellite.current = null;
      amedas.current?.destroy();
      amedas.current = null;
      features.current = null;
      map.remove();
    };
  }, [onDisplay, onStatus, onStation, onSatelliteDisplay, onSatelliteStatus]);

  useEffect(() => {
    if (ready && satelliteFrame) {
      const force = satelliteRetry !== lastSatelliteRetry.current;
      lastSatelliteRetry.current = satelliteRetry;
      satellite.current?.setFrame(satelliteFrame, force);
    }
  }, [ready, satelliteFrame, satelliteRetry]);
  useEffect(() => { satellite.current?.setVisible(satelliteVisible); }, [satelliteVisible, ready]);
  useEffect(() => {
    if (ready && frame) {
      const force = retry !== lastRetry.current;
      lastRetry.current = retry;
      rain.current?.setFrame(frame, force);
    }
  }, [ready, frame, retry]);
  useEffect(() => { rain.current?.setVisible(visible); }, [visible, ready]);
  useEffect(() => { if (ready) features.current?.set(baseMapFeatures); }, [ready, baseMapFeatures]);
  useEffect(() => { if (ready && amedasSnapshot) amedas.current?.setSnapshot(amedasSnapshot); }, [ready, amedasSnapshot]);
  useEffect(() => { amedas.current?.setMetric(amedasMetric); }, [ready, amedasMetric]);
  useEffect(() => { amedas.current?.setVisible(amedasVisible); }, [ready, amedasVisible]);
  return <section className="map-region" aria-label="雨雲、アメダス、ひまわり衛星画像の地図">
    <div className="map" ref={container} />
    {mapError && <p className="map-error" role="status">{mapError}</p>}
  </section>;
}
