import type { PlaybackSpeed, PlaybackSpeedId } from '../../app/config';
import type { WeatherFrame } from '../../weather/domain/WeatherFrame';
import type { ReactNode } from 'react';
import { formatTime } from '../../utils/time';
type Props = {
  hint?: ReactNode;
  frames: WeatherFrame[]; selectedId: string | null; onSelect: (id: string) => void;
  playing: boolean; canPlay: boolean; speedId: PlaybackSpeedId; speeds: readonly PlaybackSpeed[]; loop: boolean;
  onTogglePlay: () => void; onSpeed: (id: PlaybackSpeedId) => void; onLoop: (loop: boolean) => void;
};
/** One triangle for the slowest speed, three for the fastest. */
const speedIcon = (count: number) => <svg viewBox="0 0 24 16" aria-hidden="true" focusable="false">
  {Array.from({ length: count }, (_, index) => <path
    key={index} d="M0 2.4 7 8l-7 5.6z" fill="currentColor"
    transform={`translate(${12 - count * 4 + index * 8} 0)`}
  />)}
</svg>;

export function Timeline({ hint, frames, selectedId, onSelect, playing, canPlay, speedId, speeds, loop, onTogglePlay, onSpeed, onLoop }: Props) {
  const index = frames.findIndex(frame => frame.id === selectedId);
  // "Now" is the newest observation, never the far end of the forecast.
  const now = frames.filter(frame => frame.kind === 'observation').at(-1);
  return <section className="timeline" aria-label="降水データの時刻切替">
    <div className="timeline-heading">
      <label htmlFor="frame-time">表示する時刻 <span className="muted">日本時間</span></label>
      <button disabled={!now || selectedId === now.id} onClick={() => onSelect(now!.id)}>現在へ</button>
      {hint}
    </div>
    <div className="timeline-controls">
      <button aria-label="1つ前の時刻" disabled={index <= 0} onClick={() => onSelect(frames[index - 1].id)}>
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M12.5 3.5 6 10l6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <select id="frame-time" value={selectedId ?? ''} disabled={!frames.length} onChange={event => onSelect(event.target.value)}>
        {!frames.length && <option value="">時刻を取得中</option>}
        {frames.map(frame => <option key={frame.id} value={frame.id}>
          {formatTime(frame.observedAt)}{frame.kind === 'forecast' ? '（予測）' : frame.id === now?.id ? '（現在）' : ''}
        </option>)}
      </select>
      <button aria-label="1つ後の時刻" disabled={index < 0 || index >= frames.length - 1} onClick={() => onSelect(frames[index + 1].id)}>
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M7.5 3.5 14 10l-6.5 6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
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
      <button
        className="play-button" aria-label={playing ? '一時停止' : '再生'} aria-pressed={playing}
        disabled={!canPlay} onClick={onTogglePlay}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          {playing
            ? <><rect x="7" y="5" width="3.4" height="14" rx="1.2" fill="currentColor" /><rect x="13.6" y="5" width="3.4" height="14" rx="1.2" fill="currentColor" /></>
            : <path d="M8 5.2 19 12 8 18.8z" fill="currentColor" />}
        </svg>
      </button>
      <fieldset className="segmented speed-picker" disabled={!canPlay}>
        <legend className="visually-hidden">再生速度</legend>
        {speeds.map((speed, position) => <button
          key={speed.id} type="button" aria-label={speed.label} aria-pressed={speed.id === speedId}
          onClick={() => onSpeed(speed.id)}
        >{speedIcon(position + 1)}</button>)}
      </fieldset>
    </div>
    <label className="toggle repeat-toggle">
      <input type="checkbox" className="switch" checked={loop} disabled={!canPlay} onChange={event => onLoop(event.target.checked)} />繰り返し
    </label>
  </section>;
}
