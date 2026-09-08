import { useCallback, useState } from 'react';
import { config } from './config';
import { AmedasControls } from '../components/AmedasControls/AmedasControls';
import { WeatherMap } from '../components/WeatherMap/WeatherMap';
import type { LayerStatus } from '../components/WeatherMap/RainLayer';
import { Timeline } from '../components/Timeline/Timeline';
import { UpdateStatus } from '../components/UpdateStatus/UpdateStatus';
import { useRainMonitor } from '../hooks/useRainMonitor';
import { useAmedasMonitor } from '../hooks/useAmedasMonitor';
import type { AmedasMetric, AmedasStation } from '../weather/domain/AmedasObservation';
import type { WeatherFrame } from '../weather/domain/WeatherFrame';
import { isStale } from '../weather/services/monitor';
import { precipitationSource } from '../weather/adapters/jma/precipitation';
import { amedasSource } from '../weather/adapters/jma/amedas';
import { formatTime } from '../utils/time';

export function App() {
  const monitor = useRainMonitor();
  const amedasMonitor = useAmedasMonitor();
  const [visible, setVisible] = useState(true);
  const [amedasVisible, setAmedasVisible] = useState(true);
  const [amedasMetric, setAmedasMetric] = useState<AmedasMetric>('temperature');
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [displayed, setDisplayed] = useState<WeatherFrame | null>(null);
  const [layerStatus, setLayerStatus] = useState<LayerStatus>({ phase: 'idle' });
  const [retry, setRetry] = useState(0);
  const onDisplay = useCallback((frame: WeatherFrame) => setDisplayed(frame), []);
  const onStation = useCallback((station: AmedasStation) => setSelectedStationId(station.id), []);
  const pending = monitor.selected && monitor.selected.id !== displayed?.id;
  const selectedStation = amedasMonitor.snapshot?.stations.find(station => station.id === selectedStationId) ?? null;
  return <main className="app">
    <header className="app-header">
      <div className="brand"><span className="brand-mark" aria-hidden="true">☂</span><div><p>WEATHER MONITOR JAPAN <span>v0.2</span></p><h1>日本の気象観測</h1></div></div>
      <span className="header-note">雨雲・アメダス</span>
    </header>
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
      />
      <aside className="panel" aria-label="表示と更新の操作">
        <AmedasControls
          state={amedasMonitor}
          metric={amedasMetric}
          visible={amedasVisible}
          selectedStation={selectedStation}
          now={monitor.now}
          onMetric={setAmedasMetric}
          onVisible={setAmedasVisible}
          onRefresh={() => void amedasMonitor.refresh()}
        />
        <section className="rain-controls" aria-labelledby="rain-heading">
          <div className="section-heading"><div><h2 id="rain-heading">雨雲</h2><span>降水実況</span></div></div>
          <div className="display-time"><span>{visible ? '地図に表示中のデータ時刻' : '降水レイヤーは非表示'}</span>
            <strong data-testid="displayed-time">{displayed ? formatTime(displayed.observedAt) : '未表示'}</strong><small>日本時間（JST）</small>
          </div>
          {pending && isStale(displayed, monitor.now) && <p className="warning-text">表示中の画像は{config.staleAfterMs / 60_000}分以上前のデータです。</p>}
          {pending && <p className="pending-time">選択中 {formatTime(monitor.selected?.observedAt)}</p>}
          <label className="toggle"><input type="checkbox" checked={visible} onChange={event => setVisible(event.target.checked)} />降水レイヤーを表示</label>
          <Timeline frames={monitor.frames} selectedId={monitor.selectedId} onSelect={monitor.select} />
          <UpdateStatus state={monitor} autoUpdate={monitor.autoUpdate} stale={isStale(monitor.frames.at(-1), monitor.now)} />
          <label className="toggle"><input type="checkbox" checked={monitor.autoUpdate} onChange={event => monitor.setAutoUpdate(event.target.checked)} />自動更新</label>
          <button className="refresh" disabled={monitor.phase === 'loading' || layerStatus.phase === 'loading'} onClick={() => { setRetry(value => value + 1); void monitor.refresh(); }}>雨雲を更新</button>
          <div className="layer-status" role="status">
            {layerStatus.phase === 'loading' && '降水画像を読み込み中…'}
            {layerStatus.phase === 'error' && <><p className="warning-text">{layerStatus.message}</p><button onClick={() => setRetry(value => value + 1)}>画像を再試行</button></>}
          </div>
        </section>
        <p className="source-note">出典：<a href={precipitationSource.url} target="_blank" rel="noreferrer">気象庁「雨雲の動き」</a>・<a href={amedasSource.url} target="_blank" rel="noreferrer">「アメダス」</a>を加工して表示</p>
      </aside>
      <p className="map-hint">ドラッグで移動 · ＋ / − で拡大縮小</p>
    </div>
  </main>;
}
