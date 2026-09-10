import type { BaseMapFeature } from '../WeatherMap/baseMap';
import { PanelSection } from '../PanelSection/PanelSection';

const features: { id: BaseMapFeature; label: string; note: string }[] = [
  { id: 'elevation', label: '標高の色分け', note: '広域表示では出ません' },
  { id: 'contour', label: '等高線', note: '拡大時のみ' },
  { id: 'river', label: '河川', note: '拡大時のみ' },
  { id: 'railway', label: '鉄道', note: '' },
];

type Props = {
  shown: Record<BaseMapFeature, boolean>;
  onChange: (feature: BaseMapFeature, shown: boolean) => void;
};

export function MapControls({ shown, onChange }: Props) {
  const count = features.filter(feature => shown[feature.id]).length;
  return <PanelSection
    id="section-map" className="map-controls" title="地図" subtitle="背景の要素"
    status={<span>{count}/{features.length}</span>}
  >
    <p className="legend-note">背景地図に重ねる要素を選べます。海岸線、県境、地名は常に表示します。</p>
    {features.map(feature => <label key={feature.id} className="toggle">
      <input type="checkbox" checked={shown[feature.id]} onChange={event => onChange(feature.id, event.target.checked)} />
      {feature.label}{feature.note && <span className="muted"> {feature.note}</span>}
    </label>)}
  </PanelSection>;
}
