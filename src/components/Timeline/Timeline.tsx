import type { WeatherFrame } from '../../weather/domain/WeatherFrame';
import { formatTime } from '../../utils/time';
type Props = { frames: WeatherFrame[]; selectedId: string | null; onSelect: (id: string) => void };
export function Timeline({ frames, selectedId, onSelect }: Props) {
  const index = frames.findIndex(frame => frame.id === selectedId);
  return <section className="timeline" aria-label="降水データの時刻切替">
    <div className="timeline-heading">
      <label htmlFor="frame-time">表示する時刻 <span className="muted">日本時間</span></label>
      <button disabled={!frames.length || index === frames.length - 1} onClick={() => onSelect(frames.at(-1)!.id)}>最新へ</button>
    </div>
    <div className="timeline-controls">
      <button aria-label="1つ前の時刻" disabled={index <= 0} onClick={() => onSelect(frames[index - 1].id)}>←</button>
      <select id="frame-time" value={selectedId ?? ''} disabled={!frames.length} onChange={event => onSelect(event.target.value)}>
        {!frames.length && <option value="">時刻を取得中</option>}
        {frames.map((frame, i) => <option key={frame.id} value={frame.id}>{formatTime(frame.observedAt)}{i === frames.length - 1 ? '（最新）' : ''}</option>)}
      </select>
      <button aria-label="1つ後の時刻" disabled={index < 0 || index >= frames.length - 1} onClick={() => onSelect(frames[index + 1].id)}>→</button>
    </div>
    <input aria-label="降水データの時間軸" type="range" min="0" max={Math.max(0, frames.length - 1)}
      value={Math.max(0, index)} disabled={frames.length < 2}
      aria-valuetext={formatTime(frames[index]?.observedAt)}
      onChange={event => onSelect(frames[Number(event.target.value)].id)} />
    <div className="timeline-ends"><span>{formatTime(frames[0]?.observedAt)}</span><span>{formatTime(frames.at(-1)?.observedAt)}</span></div>
  </section>;
}
