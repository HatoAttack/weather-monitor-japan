import type { WarningKind } from '../../weather/domain/Warning';
import { warningColours } from '../WeatherMap/WarningLayer';
import { formatTime } from '../../utils/time';

type Place = { name: string; kinds: WarningKind[]; reportedAt: string | null };

/** Warnings in force for the chosen area or municipality, shown over the map like a station card. */
export function WarningCard({ area, onClose }: { area: Place; onClose: () => void }) {
  return <aside className="station-card warning-card" aria-label="選択した区域の警報・注意報" aria-live="polite">
    <header>
      <div><h2>{area.name}</h2><span>{area.reportedAt ? formatTime(area.reportedAt) + ' 発表' : '発表なし'}</span></div>
      <button className="close" type="button" onClick={onClose}>閉じる</button>
    </header>
    {area.kinds.length
      ? <ul className="warning-kinds">
        {area.kinds.map(kind => <li key={kind.code}>
          <i aria-hidden="true" style={{ background: warningColours[kind.tier] }} />{kind.name}
        </li>)}
      </ul>
      : <p className="legend-note">発表中の警報・注意報はありません。</p>}
  </aside>;
}
