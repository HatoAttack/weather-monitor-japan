import type {
  ExpressionSpecification,
  FilterSpecification,
  GeoJSONSource,
  Map as LibreMap,
  MapLayerMouseEvent,
} from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
import type { AmedasMetric, AmedasSnapshot, AmedasStation } from '../../weather/domain/AmedasObservation';
import { windBearing, windLength } from '../../weather/domain/AmedasObservation';
import { arrowHeight, windArrowImage } from './windArrow';

const sourceId = 'amedas-observations';
const circleId = 'amedas-circles';
const hitCircleId = 'amedas-click-targets';
const arrowId = 'amedas-wind-arrows';
const arrowImageId = 'amedas-wind-arrow';

type StationProperties = {
  id: string;
  name: string;
  temperature: number;
  precipitation: number;
  wind: number;
  hasTemperature: boolean;
  hasPrecipitation: boolean;
  hasWind: boolean;
  hasWindArrow: boolean;
  windBearing: number;
  windLength: number;
};

function stationFeatures(snapshot: AmedasSnapshot): FeatureCollection<Point, StationProperties> {
  return {
    type: 'FeatureCollection',
    features: snapshot.stations.map(station => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: station.coordinates },
      properties: {
        id: station.id,
        name: station.name,
        temperature: station.temperature ?? 0,
        precipitation: station.precipitation1h ?? 0,
        wind: station.windSpeed ?? 0,
        hasTemperature: station.temperature !== null,
        hasPrecipitation: station.precipitation1h !== null,
        hasWind: station.windSpeed !== null && station.windDirection !== null,
        hasWindArrow: windBearing(station.windDirection) !== null && windLength(station.windSpeed) > 0,
        windBearing: windBearing(station.windDirection) ?? 0,
        windLength: windLength(station.windSpeed),
      },
    })),
  };
}

function property(metric: AmedasMetric): string {
  return metric === 'temperature' ? 'temperature' : metric === 'precipitation' ? 'precipitation' : 'wind';
}

function hasProperty(metric: AmedasMetric): string {
  return metric === 'temperature' ? 'hasTemperature' : metric === 'precipitation' ? 'hasPrecipitation' : 'hasWind';
}

function colors(metric: AmedasMetric): ExpressionSpecification {
  if (metric === 'temperature') {
    return ['interpolate', ['linear'], ['get', 'temperature'], -20, '#314bb8', 0, '#3a9bdc', 15, '#42a76b', 25, '#e6b836', 35, '#de4735'];
  }
  if (metric === 'precipitation') {
    return ['interpolate', ['linear'], ['get', 'precipitation'], 0, '#d8e5e9', 1, '#63bce1', 10, '#168bc3', 30, '#674bb6', 80, '#a12670'];
  }
  // Wind is read from the arrows first, so the scale only needs clearly separated hues.
  return ['interpolate', ['linear'], ['get', 'wind'], 0, '#a9bcc4', 3, '#2f9e8f', 7, '#5aa832', 12, '#e0a92c', 18, '#e2662c', 25, '#c22f2f'];
}

function radii(metric: AmedasMetric): ExpressionSpecification {
  const value: ExpressionSpecification = ['get', property(metric)];
  // Wind size lives in the arrow length, so its dot stays a plain position marker.
  const valueRadius: number | ExpressionSpecification = metric === 'temperature' ? 1
    : metric === 'wind' ? 0.62
      : ['interpolate', ['linear'], value, 0, 0.7, 30, 1.7];
  return ['interpolate', ['linear'], ['zoom'],
    3, ['*', 2.2, valueRadius], 6, ['*', 5.2, valueRadius], 10, ['*', 8, valueRadius]];
}

const hitRadius: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 3, 10, 6, 12, 10, 14];

// Zoom decides how long the longest arrow is; the observation decides its share of that.
const arrowSize: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'],
  4, ['*', 0.42, ['get', 'windLength']],
  8, ['*', 0.78, ['get', 'windLength']],
  12, ['*', 1.05, ['get', 'windLength']]];

export class AmedasLayer {
  private stations = new Map<string, AmedasStation>();
  private metric: AmedasMetric = 'temperature';
  private visible = true;

  constructor(private readonly map: LibreMap, private readonly onStation: (station: AmedasStation) => void) {
    map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: hitCircleId,
      type: 'circle',
      source: sourceId,
      filter: ['==', ['get', 'hasTemperature'], true],
      paint: { 'circle-radius': hitRadius, 'circle-opacity': 0 },
    });
    map.addLayer({
      id: circleId,
      type: 'circle',
      source: sourceId,
      filter: ['==', ['get', 'hasTemperature'], true],
      paint: {
        'circle-color': colors('temperature'),
        'circle-radius': radii('temperature'),
        'circle-opacity': 0.9,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 8, 1.5],
      },
    });
    if (!map.hasImage(arrowImageId)) map.addImage(arrowImageId, windArrowImage(), { pixelRatio: 2 });
    map.addLayer({
      id: arrowId,
      type: 'symbol',
      source: sourceId,
      filter: ['==', ['get', 'hasWindArrow'], true],
      layout: {
        visibility: 'none',
        'icon-image': arrowImageId,
        'icon-size': arrowSize,
        'icon-rotate': ['get', 'windBearing'],
        'icon-rotation-alignment': 'map',
        // The tail sits on the station, so the arrow reaches out the way the air travels.
        'icon-anchor': 'bottom',
        'icon-offset': [0, arrowHeight * 0.06],
        'icon-padding': 3,
        // Crowded areas keep the strongest winds and reveal the rest as the map zooms in.
        'symbol-sort-key': ['-', 0, ['get', 'wind']],
      },
    });
    map.on('click', hitCircleId, this.handleClick);
    map.on('mouseenter', hitCircleId, this.handleEnter);
    map.on('mouseleave', hitCircleId, this.handleLeave);
  }

  private handleClick = (event: MapLayerMouseEvent) => {
    const id = event.features?.[0]?.properties?.id;
    if (typeof id === 'string') {
      const station = this.stations.get(id);
      if (station) this.onStation(station);
    }
  };

  private handleEnter = () => {
    this.map.getCanvas().style.cursor = 'pointer';
  };

  private handleLeave = () => {
    this.map.getCanvas().style.cursor = '';
  };

  setSnapshot(snapshot: AmedasSnapshot) {
    this.stations = new Map(snapshot.stations.map(station => [station.id, station]));
    (this.map.getSource(sourceId) as GeoJSONSource).setData(stationFeatures(snapshot));
  }

  setMetric(metric: AmedasMetric) {
    const filter: FilterSpecification = ['==', ['get', hasProperty(metric)], true];
    this.map.setFilter(hitCircleId, filter);
    this.map.setFilter(circleId, filter);
    this.map.setPaintProperty(circleId, 'circle-color', colors(metric));
    this.map.setPaintProperty(circleId, 'circle-radius', radii(metric));
    this.metric = metric;
    this.applyArrowVisibility();
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.map.setLayoutProperty(circleId, 'visibility', visible ? 'visible' : 'none');
    this.applyArrowVisibility();
  }

  private applyArrowVisibility() {
    const shown = this.visible && this.metric === 'wind';
    this.map.setLayoutProperty(arrowId, 'visibility', shown ? 'visible' : 'none');
  }

  destroy() {
    this.map.off('click', hitCircleId, this.handleClick);
    this.map.off('mouseenter', hitCircleId, this.handleEnter);
    this.map.off('mouseleave', hitCircleId, this.handleLeave);
    if (this.map.getLayer(arrowId)) this.map.removeLayer(arrowId);
    if (this.map.getLayer(hitCircleId)) this.map.removeLayer(hitCircleId);
    if (this.map.getLayer(circleId)) this.map.removeLayer(circleId);
    if (this.map.getSource(sourceId)) this.map.removeSource(sourceId);
    this.stations.clear();
  }
}
