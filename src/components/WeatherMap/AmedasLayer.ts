import type {
  ExpressionSpecification,
  FilterSpecification,
  GeoJSONSource,
  Map as LibreMap,
  MapLayerMouseEvent,
} from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
import type { AmedasMetric, AmedasSnapshot, AmedasStation } from '../../weather/domain/AmedasObservation';

const sourceId = 'amedas-observations';
const circleId = 'amedas-circles';

type StationProperties = {
  id: string;
  name: string;
  temperature: number;
  precipitation: number;
  wind: number;
  hasTemperature: boolean;
  hasPrecipitation: boolean;
  hasWind: boolean;
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
  return ['interpolate', ['linear'], ['get', 'wind'], 0, '#d8e5e9', 5, '#49a9cf', 10, '#286aa9', 20, '#7048a1', 30, '#a62f63'];
}

function radii(metric: AmedasMetric): ExpressionSpecification {
  const value: ExpressionSpecification = ['get', property(metric)];
  const valueRadius: number | ExpressionSpecification = metric === 'temperature'
    ? 1
    : ['interpolate', ['linear'], value, 0, 0.7, metric === 'precipitation' ? 30 : 20, 1.7];
  return ['interpolate', ['linear'], ['zoom'],
    3, ['*', 2.2, valueRadius], 6, ['*', 5.2, valueRadius], 10, ['*', 8, valueRadius]];
}

export class AmedasLayer {
  private stations = new Map<string, AmedasStation>();

  constructor(private readonly map: LibreMap, private readonly onStation: (station: AmedasStation) => void) {
    map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
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
    map.on('click', circleId, this.handleClick);
    map.on('mouseenter', circleId, this.handleEnter);
    map.on('mouseleave', circleId, this.handleLeave);
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
    this.map.setFilter(circleId, filter);
    this.map.setPaintProperty(circleId, 'circle-color', colors(metric));
    this.map.setPaintProperty(circleId, 'circle-radius', radii(metric));
  }

  setVisible(visible: boolean) {
    const visibility = visible ? 'visible' : 'none';
    this.map.setLayoutProperty(circleId, 'visibility', visibility);
  }

  destroy() {
    this.map.off('click', circleId, this.handleClick);
    this.map.off('mouseenter', circleId, this.handleEnter);
    this.map.off('mouseleave', circleId, this.handleLeave);
    if (this.map.getLayer(circleId)) this.map.removeLayer(circleId);
    if (this.map.getSource(sourceId)) this.map.removeSource(sourceId);
    this.stations.clear();
  }
}
