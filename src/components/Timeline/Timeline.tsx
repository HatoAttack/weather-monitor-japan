import type { PlaybackSpeed, PlaybackSpeedId } from '../../app/config';
import type { WeatherFrame } from '../../weather/domain/WeatherFrame';
import { formatTime } from '../../utils/time';
type Props = {
  frames: WeatherFrame[]; selectedId: string | null; onSelect: (id: string) => void;
  playing: boolean; canPlay: boolean; speedId: PlaybackSpeedId; speeds: readonly PlaybackSpeed[]; loop: boolean;
  onTogglePlay: () => void; onSpeed: (id: PlaybackSpeedId) => void; onLoop: (loop: boolean) => void;
};
export function Timeline({ frames, selectedId, onSelect, playing, canPlay, speedId, speeds, loop, onTogglePlay, onSpeed, onLoop }: Props) {
  const index = frames.findIndex(frame => frame.id === selectedId);
  // "Now" is the newest observation, never the far end of the forecast.
  const now = frames.filter(frame => frame.kind === 'observation').at(-1);
  return <section className="timeline" aria-label="降水データの時刻切替">
    <div className="timeline-heading">
      <label htmlFor="frame-time">表示する時刻 <span className="muted">日本時間</span></label>
      <button disabled={!now || selectedId === now.id} onClick={() => onSelect(now!.id)}>現在へ</button>
    </div>
    <div className="timeline-controls">
      <button aria-label="1つ前の時刻" disabled={index <= 0} onClick={() => onSelect(frames[index - 1].id)}>←</button>
      <select id="frame-time" value={selectedId ?? ''} disabled={!frames.length} onChange={event => onSelect(event.target.value)}>
        {!frames.length && <option value="">時刻を取得中</option>}
        {frames.map(frame => <option key={frame.id} value={frame.id}>
          {formatTime(frame.observedAt)}{frame.kind === 'forecast' ? '（予測）' : frame.id === now?.id ? '（現在）' : ''}
        </option>)}
      </select>
      <button aria-label="1つ後の時刻" disabled={index < 0 || index >= frames.length - 1} onClick={() => onSelect(frames[index + 1].id)}>→</button>
    </div>
    <input aria-label="降水データの時間軸" type="range" min="0" max={Math.max(0, frames.length - 1)}
      value={Math.max(0, index)} disabled={frames.length < 2}
      aria-valuetext={formatTime(frames[index]?.observedAt)}
      onChange={event => onSelect(frames[Number(event.target.value)].id)} />
    <div className="timeline-ends">
      <span>{formatTime(frames[0]?.observedAt)}</span>
      {now && frames.at(-1)?.kind === 'forecast' && <span className="timeline-now">現在 {formatTime(now.observedAt)}</span>}
      <span>{formatTime(frames.at(-1)?.observedAt)}{frames.at(-1)?.kind === 'forecast' ? ' 予測' : ''}</span>
    </div>
    <div className="timeline-player">
      <button className="play-button" aria-pressed={playing} disabled={!canPlay} onClick={onTogglePlay}>
        <span aria-hidden="true">{playing ? '❙❙' : '▶'}</span>{playing ? '一時停止' : '再生'}
      </button>
      <fieldset className="speed-picker" disabled={!canPlay}>
        <legend>再生速度</legend>
        <div>{speeds.map(speed => <button key={speed.id} aria-pressed={speed.id === speedId} onClick={() => onSpeed(speed.id)}>{speed.label}</button>)}</div>
      </fieldset>
    </div>
    <label className="toggle repeat-toggle">
      <input type="checkbox" checked={loop} disabled={!canPlay} onChange={event => onLoop(event.target.checked)} />繰り返し
    </label>
  </section>;
}
