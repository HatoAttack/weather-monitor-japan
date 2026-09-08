import { config } from '../../app/config';
import type { AmedasMetric, AmedasSnapshot, AmedasStation } from '../../weather/domain/AmedasObservation';
import { windDirectionName } from '../../weather/domain/AmedasObservation';
import type { AmedasMonitorState } from '../../weather/services/amedasMonitor';
import { isAmedasStale } from '../../weather/services/amedasMonitor';
import { formatTime } from '../../utils/time';

const phaseLabels = {
  idle: '準備中',
  loading: '更新を確認中',
  updated: '更新済み',
  unchanged: '新規データなし',
  'network-error': '一時的な取得失敗',
  'format-error': 'データ形式エラー',
};

const metrics: { id: AmedasMetric; label: string }[] = [
  { id: 'temperature', label: '気温' },
  { id: 'precipitation', label: '1時間降水量' },
  { id: 'wind', label: '風' },
];

const scaleLabels: Record<AmedasMetric, [string, string]> = {
  temperature: ['−20℃', '35℃'],
  precipitation: ['0mm', '80mm以上'],
  wind: ['0m/s', '30m/s'],
};

function value(value: number | null, unit: string): string {
  return value === null ? '欠測' : `${value.toFixed(1)}${unit}`;
}

function StationDetails({ station }: { station: AmedasStation }) {
  return <div className="station-details" aria-live="polite">
    <div><strong>{station.name}</strong><span>標高 {station.altitude}m</span></div>
    <dl>
      <div><dt>気温</dt><dd>{value(station.temperature, '℃')}</dd></div>
      <div><dt>1時間降水量</dt><dd>{value(station.precipitation1h, 'mm')}</dd></div>
      <div><dt>風向</dt><dd>{windDirectionName(station.windDirection)}</dd></div>
      <div><dt>風速</dt><dd>{value(station.windSpeed, 'm/s')}</dd></div>
    </dl>
  </div>;
}

type Props = {
  state: AmedasMonitorState;
  metric: AmedasMetric;
  visible: boolean;
  selectedStation: AmedasStation | null;
  now: number;
  onMetric: (metric: AmedasMetric) => void;
  onVisible: (visible: boolean) => void;
  onRefresh: () => void;
};

export function AmedasControls({
  state, metric, visible, selectedStation, now, onMetric, onVisible, onRefresh,
}: Props) {
  const snapshot = state.snapshot as AmedasSnapshot | null;
  const stale = isAmedasStale(snapshot, now);
  return <section className="amedas-controls" aria-labelledby="amedas-heading">
    <div className="section-heading">
      <div><h2 id="amedas-heading">アメダス</h2><span>{snapshot ? `${snapshot.stations.length.toLocaleString('ja-JP')}地点` : '観測地点'}</span></div>
      <time>{formatTime(snapshot?.observedAt)}</time>
    </div>
    <label className="toggle"><input type="checkbox" checked={visible} onChange={event => onVisible(event.target.checked)} />観測値を地図に表示</label>
    <fieldset className="metric-picker" disabled={!snapshot || !visible}>
      <legend>地図に表示する観測値</legend>
      {metrics.map(item => <button key={item.id} type="button" aria-pressed={metric === item.id} onClick={() => onMetric(item.id)}>{item.label}</button>)}
    </fieldset>
    <p className="legend-note">
      {metric === 'temperature' && '寒色から暖色へ、気温の低い地点から高い地点を示します。'}
      {metric === 'precipitation' && '青から紫へ、直近1時間の降水量が多い地点を示します。'}
      {metric === 'wind' && '色は風速を示します。地点詳細で風向を確認できます。'}
    </p>
    <div className={`metric-scale ${metric}`} aria-label={`${scaleLabels[metric][0]}から${scaleLabels[metric][1]}までの色分け`}>
      <span>{scaleLabels[metric][0]}</span><i aria-hidden="true" /><span>{scaleLabels[metric][1]}</span>
    </div>
    <div className="amedas-status" role="status">
      <span className={'status-dot ' + (state.error || stale ? 'warning' : '')} />
      <strong>{phaseLabels[state.phase]}</strong>
      <span>{config.amedasPollIntervalMs / 60_000}分ごとに確認</span>
    </div>
    {stale && <p className="warning-text">観測データが{config.amedasStaleAfterMs / 60_000}分以上古くなっています。</p>}
    {state.error && <p className="warning-text">{state.error}{snapshot && ' 取得済みの観測値を維持しています。'}</p>}
    {selectedStation ? <StationDetails station={selectedStation} /> : <p className="station-prompt">地図上の観測地点を選ぶと詳細を表示します。</p>}
    <button className="subtle-button" type="button" disabled={state.phase === 'loading'} onClick={onRefresh}>アメダスを更新</button>
  </section>;
}
