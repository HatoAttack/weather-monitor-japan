import { config } from '../../app/config';
import type { MonitorState } from '../../weather/services/monitor';
import { formatTime } from '../../utils/time';
const labels = {
  idle: '準備中', loading: '更新を確認中', updated: '更新済み', unchanged: '新規データなし',
  'network-error': '一時的な取得失敗', 'format-error': 'データ形式エラー',
};
export function UpdateStatus({ state, autoUpdate, stale }: { state: MonitorState; autoUpdate: boolean; stale: boolean }) {
  return <div className="update-status" role="status">
    <div><span className={'status-dot ' + (state.error || stale ? 'warning' : '')} /><strong>{labels[state.phase]}</strong>
      <span className="muted">{autoUpdate ? (config.pollIntervalMs / 60_000) + '分ごとに確認' : '自動更新は停止中'}</span></div>
    <p>最終確認成功 <time>{formatTime(state.lastSuccessAt)}</time></p>
    {stale && <p className="warning-text">最新の取得データが{config.staleAfterMs / 60_000}分以上古くなっています。</p>}
    {state.error && <p className="warning-text">{state.error}{state.frames.length > 0 && ' 取得済みのデータを保持しています。'}</p>}
  </div>;
}
