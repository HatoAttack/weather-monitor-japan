import type { ExpressionSpecification, GeoJSONSource, Map as LibreMap, MapLayerMouseEvent } from 'maplibre-gl';
import type { FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';
import { config } from '../../app/config';
import type { WarningSnapshot, WarningTier } from '../../weather/domain/Warning';
import { tierRank, topTier } from '../../weather/domain/Warning';
import { fetchMunicipalityShapes, type WarningAreaShape } from '../../weather/adapters/jma/warning';
import { hitCircleId } from './AmedasLayer';
import { weatherLayerBefore } from './baseMap';

const areaSource = 'warning-areas';
const municipalSource = 'warning-municipalities';
const areaFill = 'warning-fill';
const areaLine = 'warning-outline';
const municipalFill = 'warning-municipal-fill';
const municipalLine = 'warning-municipal-outline';

/** Alert level colours used by JMA and the Cabinet Office (level 2 to 5). */
export const warningColours: Record<WarningTier, string> = {
  advisory: '#f2e700',
  warning: '#ff2800',
  danger: '#aa00aa',
  special: '#0c000c',
};

const byRank = (values: [WarningTier, number | string][], fallback: number | string): ExpressionSpecification =>
  ['match', ['get', 'rank'], ...values.flatMap(([tier, value]) => [tierRank(tier), value]), fallback] as unknown as ExpressionSpecification;

const fillColour = byRank(Object.entries(warningColours) as [WarningTier, string][], 'rgba(0,0,0,0)');
// Advisories cover much of the country on an ordinary day, so they stay lighter than warnings.
const fillOpacity = byRank([['advisory', 0.38], ['warning', 0.42], ['danger', 0.48], ['special', 0.55]], 0);
const lineWidth = byRank([['advisory', 0.8], ['warning', 1.6], ['danger', 2], ['special', 2.4]], 0);

type Box = [number, number, number, number];
type ShapeProperties = { code: string; rank: number };
type ShapeLoader = (codes: string[]) => Promise<WarningAreaShape[]>;

function boxOf(shape: Polygon | MultiPolygon): Box {
  const rings: Position[][] = shape.type === 'Polygon' ? shape.coordinates : shape.coordinates.flat();
  const box: Box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const ring of rings) for (const [x, y] of ring) {
    box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y);
    box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y);
  }
  return box;
}

const overlaps = (a: Box, b: Box) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

/**
 * Areas at the national scale; once zoomed in, the municipalities warnings are
 * actually issued for. Municipality shapes load only for the areas in view.
 */
export class WarningLayer {
  private snapshot: WarningSnapshot | null = null;
  private readonly boxes = new WeakMap<Polygon | MultiPolygon, Box>();
  private sequence = 0;
  private settle = 0;

  constructor(
    private readonly map: LibreMap,
    private readonly onArea: (code: string) => void,
    private readonly loadShapes: ShapeLoader = fetchMunicipalityShapes,
  ) {
    const before = map.getLayer(weatherLayerBefore) ? weatherLayerBefore : undefined;
    const switchAt = config.warningMunicipalZoom;
    for (const [source, fill, line, zoom] of [
      [areaSource, areaFill, areaLine, { maxzoom: switchAt }],
      [municipalSource, municipalFill, municipalLine, { minzoom: switchAt }],
    ] as const) {
      map.addSource(source, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: fill, type: 'fill', source, ...zoom, filter: ['>', ['get', 'rank'], 0],
        paint: { 'fill-color': fillColour, 'fill-opacity': fillOpacity },
      }, before);
      map.addLayer({
        id: line, type: 'line', source, ...zoom, filter: ['>', ['get', 'rank'], 0],
        paint: { 'line-color': fillColour, 'line-width': lineWidth, 'line-opacity': 0.9 },
      }, before);
      map.on('click', fill, this.handleClick);
    }
    map.on('moveend', this.scheduleMunicipalities);
  }

  // Zooming in by several steps fires one moveend each; only the view it ends on is loaded.
  private scheduleMunicipalities = () => {
    window.clearTimeout(this.settle);
    this.settle = window.setTimeout(() => void this.showMunicipalities(), config.warningShapeSettleMs);
  };

  private handleClick = (event: MapLayerMouseEvent) => {
    // A station sits on top of an area; a click on it belongs to the station.
    if (this.map.getLayer(hitCircleId) && this.map.queryRenderedFeatures(event.point, { layers: [hitCircleId] }).length) return;
    const code = event.features?.[0]?.properties?.code;
    if (typeof code === 'string') this.onArea(code);
  };

  private box(shape: Polygon | MultiPolygon): Box {
    let box = this.boxes.get(shape);
    if (!box) { box = boxOf(shape); this.boxes.set(shape, box); }
    return box;
  }

  private showMunicipalities = async () => {
    const snapshot = this.snapshot;
    if (!snapshot || this.map.getZoom() < config.warningMunicipalZoom) return;
    const bounds = this.map.getBounds();
    const view: Box = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
    const inView = new Set(snapshot.areas.filter(area => area.kinds.length && overlaps(this.box(area.shape), view))
      .map(area => area.code));
    const wanted = snapshot.municipalities.filter(place => inView.has(place.area));
    const sequence = ++this.sequence;
    const shapes = await this.loadShapes(wanted.map(place => place.code));
    // A later move or report has already asked for a newer set.
    if (sequence !== this.sequence || this.snapshot !== snapshot) return;
    const rank = new Map(wanted.map(place => [place.code, tierRank(topTier(place.kinds))]));
    this.setData(municipalSource, shapes.map(({ code, shape }) => ({ code, shape, rank: rank.get(code) ?? 0 })));
  };

  private setData(source: string, items: { code: string; shape: Polygon | MultiPolygon; rank: number }[]) {
    const data: FeatureCollection<Polygon | MultiPolygon, ShapeProperties> = {
      type: 'FeatureCollection',
      features: items.map(({ code, shape, rank }) => ({ type: 'Feature', geometry: shape, properties: { code, rank } })),
    };
    (this.map.getSource(source) as GeoJSONSource).setData(data);
  }

  setSnapshot(snapshot: WarningSnapshot) {
    this.snapshot = snapshot;
    this.setData(areaSource, snapshot.areas.map(area => ({ code: area.code, shape: area.shape, rank: tierRank(topTier(area.kinds)) })));
    void this.showMunicipalities();
  }

  setVisible(visible: boolean) {
    for (const id of [areaFill, areaLine, municipalFill, municipalLine]) {
      this.map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }
  }

  destroy() {
    this.sequence++;
    window.clearTimeout(this.settle);
    this.map.off('moveend', this.scheduleMunicipalities);
    for (const id of [areaFill, municipalFill]) this.map.off('click', id, this.handleClick);
    for (const id of [municipalLine, municipalFill, areaLine, areaFill]) if (this.map.getLayer(id)) this.map.removeLayer(id);
    for (const id of [municipalSource, areaSource]) if (this.map.getSource(id)) this.map.removeSource(id);
  }
}
