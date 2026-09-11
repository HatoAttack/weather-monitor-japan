import { config } from '../../app/config';
import type { WarningMonitorState } from '../../weather/services/warningMonitor';
import { isWarningStale } from '../../weather/services/warningMonitor';
import { topTier, warningTierLabels, warningTiers } from '../../weather/domain/Warning';
import { warningColours } from '../WeatherMap/WarningLayer';
import { PanelSection } from '../PanelSection/PanelSection';
import { formatTime } from '../../utils/time';

const phaseLabels = {
  idle: '準備中', loading: '更新を確認中', updated: '更新済み', unchanged: '新規発表なし',
  'network-error': '一時的な取得失敗', 'format-error': 'データ形式エラー',
};

type Props = {
  state: WarningMonitorState;
  visible: boolean;
  hasSelection: boolean;
  now: number;
  onVisible: (visible: boolean) => void;
  onRefresh: () => void;
};

export function WarningControls({ state, visible, hasSelection, now, onVisible, onRefresh }: Props) {
  const snapshot = state.snapshot;
  const stale = isWarningStale(state, now);
  const counts = Object.fromEntries(warningTiers.map(tier =>
    [tier, snapshot?.areas.filter(area => topTier(area.kinds) === tier).length ?? 0]));
  const serious = warningTiers.slice(1).reduce((sum, tier) => sum + counts[tier], 0);
  return <PanelSection
    id="section-warning" className="warning-controls" title="警報・注意報"
    subtitle={snapshot ? (serious ? `警報以上 ${serious}区域` : '警報なし') : '発表区域'}
    status={<><span className={'status-dot ' + (state.error || stale ? 'warning' : '')} /><time>{formatTime(snapshot?.reportedAt ?? undefined)}</time></>}
  >
    <label className="toggle"><input type="checkbox" checked={visible} onChange={event => onVisible(event.target.checked)} />警報・注意報を地図に表示</label>
    <ul className="warning-legend" aria-label="発表中の区域数">
      {[...warningTiers].reverse().map(tier => <li key={tier}>
        <i aria-hidden="true" style={{ background: warningColours[tier] }} />
        <span>{warningTierLabels[tier]}</span><strong>{counts[tier]}</strong><span className="muted">区域</span>
      </li>)}
    </ul>
    <p className="legend-note">区域ごとに、発表中で最も重いものの色で塗ります。最新の発表 {formatTime(snapshot?.reportedAt ?? undefined)}</p>
    <div className="amedas-status" role="status">
      <span className={'status-dot ' + (state.error || stale ? 'warning' : '')} />
      <strong>{phaseLabels[state.phase]}</strong>
      <span>{config.warningPollIntervalMs / 60_000}分ごとに確認</span>
    </div>
    {stale && <p className="warning-text">{config.warningStaleAfterMs / 60_000}分以上、更新を確認できていません。</p>}
    {state.error && <p className="warning-text">{state.error}{snapshot && ' 取得済みの発表状況を表示しています。'}</p>}
    {!!snapshot?.unknownCodes.length
      && <p className="warning-text">アプリが名称を持たない種別コード（{snapshot.unknownCodes.join('、')}）が含まれています。地図には反映していません。</p>}
    {!hasSelection && <p className="station-prompt">地図上の区域を選ぶと、発表中の警報・注意報を表示します。</p>}
    <button className="subtle-button" type="button" disabled={state.phase === 'loading'} onClick={onRefresh}>警報・注意報を更新</button>
  </PanelSection>;
}
