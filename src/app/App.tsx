import { useCallback, useState } from 'react';
import { config } from './config';
import { AmedasControls } from '../components/AmedasControls/AmedasControls';
import { MapControls } from '../components/MapControls/MapControls';
import { PanelSection } from '../components/PanelSection/PanelSection';
import { StationCard } from '../components/StationCard/StationCard';
import { WarningCard } from '../components/WarningCard/WarningCard';
import { WarningControls } from '../components/WarningControls/WarningControls';
import { WeatherMap } from '../components/WeatherMap/WeatherMap';
import type { LayerStatus } from '../components/WeatherMap/RainLayer';
import type { BaseMapFeature } from '../components/WeatherMap/baseMap';
import { Timeline } from '../components/Timeline/Timeline';
import { UpdateStatus } from '../components/UpdateStatus/UpdateStatus';
import { useRainMonitor } from '../hooks/useRainMonitor';
import { useAmedasMonitor } from '../hooks/useAmedasMonitor';
import { useTimelinePlayer } from '../hooks/useTimelinePlayer';
import { useSatelliteMonitor } from '../hooks/useSatelliteMonitor';
import { useWarningMonitor } from '../hooks/useWarningMonitor';
import type { AmedasMetric, AmedasStation } from '../weather/domain/AmedasObservation';
import type { WeatherFrame } from '../weather/domain/WeatherFrame';
import { isStale, latestObservation } from '../weather/services/monitor';
import { precipitationSource } from '../weather/adapters/jma/precipitation';
import { amedasSource } from '../weather/adapters/jma/amedas';
import { himawariSource } from '../weather/adapters/jma/himawari';
import { warningSource } from '../weather/adapters/jma/warning';
import { formatTime } from '../utils/time';

export function App() {
  const monitor = useRainMonitor();
  const amedasMonitor = useAmedasMonitor();
  const satelliteMonitor = useSatelliteMonitor();
  const warningMonitor = useWarningMonitor();
  const [warningVisible, setWarningVisible] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedAreaCode, setSelectedAreaCode] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const [amedasVisible, setAmedasVisible] = useState(true);
  const [satelliteVisible, setSatelliteVisible] = useState(false);
  const [amedasMetric, setAmedasMetric] = useState<AmedasMetric>('temperature');
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [displayed, setDisplayed] = useState<WeatherFrame | null>(null);
  const [layerStatus, setLayerStatus] = useState<LayerStatus>({ phase: 'idle' });
  const [retry, setRetry] = useState(0);
  const [satelliteRetry, setSatelliteRetry] = useState(0);
  const [satelliteDisplayed, setSatelliteDisplayed] = useState<WeatherFrame | null>(null);
  const [satelliteStatus, setSatelliteStatus] = useState<LayerStatus>({ phase: 'idle' });
  const [mapFeatures, setMapFeatures] = useState<Record<BaseMapFeature, boolean>>({
    elevation: true, contour: true, river: true, railway: true,
  });
  const onDisplay = useCallback((frame: WeatherFrame) => setDisplayed(frame), []);
  // One card at a time: choosing a station or an area replaces the other.
  const onStation = useCallback((station: AmedasStation) => {
    setSelectedStationId(station.id); setSelectedAreaCode(null);
  }, []);
  const onWarningArea = useCallback((code: string) => {
    setSelectedAreaCode(code); setSelectedStationId(null);
  }, []);
  const player = useTimelinePlayer({
    frames: monitor.frames, selectedId: monitor.selectedId, displayedId: displayed?.id ?? null,
    enabled: visible, onSelect: monitor.select,
  });
  // Playback swaps frames continuously; per-frame notices would only flicker the panel.
  const pending = !player.playing && monitor.selected && monitor.selected.id !== displayed?.id;
  const selectedStation = amedasMonitor.snapshot?.stations.find(station => station.id === selectedStationId) ?? null;
  const newestObservation = latestObservation(monitor.frames);
  // Areas are chosen on the national map; municipalities once zoomed in.
  const selectedArea = warningMonitor.snapshot?.areas.find(area => area.code === selectedAreaCode)
    ?? warningMonitor.snapshot?.municipalities.find(place => place.code === selectedAreaCode) ?? null;
  const hasForecast = monitor.frames.some(frame => frame.kind === 'forecast');
  const satelliteStale = !!satelliteMonitor.selected
    && monitor.now - Date.parse(satelliteMonitor.selected.observedAt) > config.satelliteStaleAfterMs;
  return <main className="app">
    <div className="workspace">
      <WeatherMap
        frame={monitor.selected}
        visible={visible}
        retry={retry}
        amedasSnapshot={amedasMonitor.snapshot}
        amedasMetric={amedasMetric}
        amedasVisible={amedasVisible}
        onDisplay={onDisplay}
        onStatus={setLayerStatus}
        onStation={onStation}
        satelliteFrame={satelliteMonitor.selected}
        satelliteVisible={satelliteVisible}
        satelliteRetry={satelliteRetry}
        onSatelliteDisplay={setSatelliteDisplayed}
        onSatelliteStatus={setSatelliteStatus}
        baseMapFeatures={mapFeatures}
        warningSnapshot={warningMonitor.snapshot}
        warningVisible={warningVisible}
        onWarningArea={onWarningArea}
      />
      {selectedStation && amedasVisible
        && <StationCard station={selectedStation} onClose={() => setSelectedStationId(null)} />}
      {selectedArea && warningVisible
        && <WarningCard area={selectedArea} onClose={() => setSelectedAreaCode(null)} />}
      <aside className={'panel' + (sheetOpen ? ' panel-open' : '')} aria-label="表示と更新の操作">
        <div className="panel-header">
          {/* On a narrow screen the panel is a bottom sheet; this opens and closes it.
              A button rather than a drag gesture, so it works with a keyboard too. */}
          <button
            className="sheet-handle" id="panel-handle" aria-expanded={sheetOpen} aria-controls="panel-body"
            onClick={() => setSheetOpen(open => !open)}
          ><span className="sheet-grip" aria-hidden="true" />{sheetOpen ? '操作を閉じる' : '表示と更新の操作'}</button>
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">☂</span>
            <div><p>WEATHER MONITOR JAPAN <span>v0.7</span></p><h1>日本の気象観測</h1></div>
          </div>
        </div>
        <div className="panel-body" id="panel-body">
          <WarningControls
            state={warningMonitor}
            visible={warningVisible}
            hasSelection={!!selectedArea && warningVisible}
            now={monitor.now}
            onVisible={setWarningVisible}
            onRefresh={() => void warningMonitor.refresh()}
          />
          <AmedasControls
            state={amedasMonitor}
            metric={amedasMetric}
            visible={amedasVisible}
            hasSelection={!!selectedStation && amedasVisible}
            now={monitor.now}
            onMetric={setAmedasMetric}
            onVisible={setAmedasVisible}
            onRefresh={() => void amedasMonitor.refresh()}
          />
          <PanelSection
            id="section-satellite" className="satellite-controls" title="ひまわり" subtitle="赤外画像"
            status={<><span className={'status-dot ' + (satelliteMonitor.error || satelliteStale ? 'warning' : '')} />
              <span data-testid="satellite-time">{satelliteVisible && satelliteDisplayed ? formatTime(satelliteDisplayed.observedAt) : '未表示'}</span></>}
          >
            <label className="toggle"><input type="checkbox" checked={satelliteVisible} onChange={event => setSatelliteVisible(event.target.checked)} />衛星画像を表示</label>
            <UpdateStatus state={satelliteMonitor} autoUpdate={true} stale={satelliteStale} intervalMs={config.satellitePollIntervalMs} staleAfterMs={config.satelliteStaleAfterMs} />
            <button className="subtle-button" disabled={satelliteMonitor.phase === 'loading' || satelliteStatus.phase === 'loading'} onClick={() => { setSatelliteRetry(value => value + 1); void satelliteMonitor.refresh(); }}>衛星画像を更新</button>
            <div className="layer-status" role="status">{satelliteStatus.phase === 'loading' && '衛星画像を読み込み中…'}{satelliteStatus.phase === 'error' && <p className="warning-text">{satelliteStatus.message}</p>}</div>
          </PanelSection>
          <PanelSection
            id="section-rain" className="rain-controls" title="雨雲" subtitle="降水実況" defaultOpen
            status={<><span className={'status-dot ' + (monitor.error || isStale(newestObservation, monitor.now) ? 'warning' : '')} />
              <span data-testid="displayed-time">{visible && displayed ? formatTime(displayed.observedAt) : '未表示'}</span>
              {visible && displayed?.kind === 'forecast' && <span className="muted">予測</span>}</>}
          >
            <p className="display-note">{visible ? '地図に表示中のデータ時刻（日本時間）' : '降水レイヤーは非表示'}</p>
            {visible && displayed?.kind === 'forecast'
              && <p className="forecast-note">予測 <time>{formatTime(displayed.issuedAt)}</time>時点の1時間先までの見通し</p>}
            {pending && isStale(displayed, monitor.now) && <p className="warning-text">表示中の画像は{config.staleAfterMs / 60_000}分以上前のデータです。</p>}
            {pending && <p className="pending-time">選択中 {formatTime(monitor.selected?.observedAt)}</p>}
            <label className="toggle"><input type="checkbox" checked={visible} onChange={event => setVisible(event.target.checked)} />降水レイヤーを表示</label>
            <Timeline frames={monitor.frames} selectedId={monitor.selectedId} onSelect={player.select}
              playing={player.playing} canPlay={player.canPlay} speedId={player.speedId} speeds={player.speeds}
              loop={player.loop} onTogglePlay={player.toggle} onSpeed={player.setSpeed} onLoop={player.setLoop} />
            <UpdateStatus state={monitor} autoUpdate={monitor.autoUpdate} stale={isStale(newestObservation, monitor.now)} />
            {!hasForecast && monitor.frames.length > 0
              && <p className="warning-text">降水予測を取得できていません。実況のみ表示しています。</p>}
            <label className="toggle"><input type="checkbox" checked={monitor.autoUpdate} onChange={event => monitor.setAutoUpdate(event.target.checked)} />自動更新</label>
            <button className="refresh" disabled={monitor.phase === 'loading' || layerStatus.phase === 'loading'} onClick={() => { setRetry(value => value + 1); void monitor.refresh(); }}>雨雲を更新</button>
            <div className="layer-status" role="status">
              {!player.playing && layerStatus.phase === 'loading' && '降水画像を読み込み中…'}
              {layerStatus.phase === 'error' && <><p className="warning-text">{layerStatus.message}</p><button onClick={() => setRetry(value => value + 1)}>画像を再試行</button></>}
            </div>
          </PanelSection>
          <MapControls
            shown={mapFeatures}
            onChange={(feature, shown) => setMapFeatures(current => ({ ...current, [feature]: shown }))}
          />
          <p className="source-note">出典：<a href={precipitationSource.url} target="_blank" rel="noreferrer">気象庁「雨雲の動き」</a>・<a href={amedasSource.url} target="_blank" rel="noreferrer">「アメダス」</a>・<a href={himawariSource.url} target="_blank" rel="noreferrer">「ひまわり」</a>・<a href={warningSource.url} target="_blank" rel="noreferrer">「警報・注意報」</a>を加工して表示</p>
        </div>
      </aside>
      <p className="map-hint">ドラッグで移動 · ＋ / − で拡大縮小</p>
    </div>
  </main>;
}
