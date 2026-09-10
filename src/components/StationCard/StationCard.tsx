import type { AmedasStation } from '../../weather/domain/AmedasObservation';
import { windDirectionName } from '../../weather/domain/AmedasObservation';

const value = (value: number | null, unit: string) => value === null ? '欠測' : `${value.toFixed(1)}${unit}`;

/** Selected station detail, shown over the map so the side panel stays short. */
export function StationCard({ station, onClose }: { station: AmedasStation; onClose: () => void }) {
  return <aside className="station-card" aria-label="選択した観測地点" aria-live="polite">
    <header>
      <div><h2>{station.name}</h2><span>標高 {station.altitude}m</span></div>
      <button className="close" type="button" onClick={onClose}>閉じる</button>
    </header>
    <dl>
      <div><dt>気温</dt><dd>{value(station.temperature, '℃')}</dd></div>
      <div><dt>1時間降水量</dt><dd>{value(station.precipitation1h, 'mm')}</dd></div>
      <div><dt>風向</dt><dd>{windDirectionName(station.windDirection)}</dd></div>
      <div><dt>風速</dt><dd>{value(station.windSpeed, 'm/s')}</dd></div>
    </dl>
  </aside>;
}
