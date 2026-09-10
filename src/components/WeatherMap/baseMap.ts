import type { StyleSpecification } from 'maplibre-gl';

/**
 * Base map built to stay out of the way of the weather layers.
 *
 * GSI vector tiles carry each feature separately, so roads, road numbers,
 * railways, buildings and contour lines can be left out and only the coastline,
 * borders and place names drawn. They stop publishing land and coastline above
 * zoom 6, so from there the pale raster map fades in underneath, washed out
 * until little more than the land and sea tone survives.
 */
const vectorTiles = 'https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/{z}/{x}/{y}.pbf';
const rasterTiles = 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png';
const gsi = (label: string) =>
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">' + label + '</a>';

const land = '#f2f5f1';
const sea = '#d9e8ee';

export const baseMapStyle: StyleSpecification = {
  version: 8,
  glyphs: 'https://gsi-cyberjapan.github.io/optimal_bvmap/glyphs/{fontstack}/{range}.pbf',
  sources: {
    basemap: {
      type: 'raster', tiles: [rasterTiles], tileSize: 256, minzoom: 2, maxzoom: 18,
      attribution: gsi('地理院タイル'),
    },
    detail: {
      type: 'vector', tiles: [vectorTiles], minzoom: 4, maxzoom: 16,
      attribution: gsi('地理院タイル（最適化ベクトルタイル）'),
    },
  },
  layers: [
    { id: 'ocean', type: 'background', paint: { 'background-color': sea } },
    // Administrative areas stand in for a land fill, and reach up to zoom 6.
    { id: 'land', type: 'fill', source: 'detail', 'source-layer': 'AdmArea', paint: { 'fill-color': land } },
    {
      id: 'tone', type: 'raster', source: 'basemap',
      paint: {
        // Fades in exactly where the vector tiles stop carrying land and coastline.
        'raster-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0, 7.5, 1],
        'raster-saturation': 0.1,
        'raster-contrast': -0.5,
        'raster-brightness-min': 0.84,
      },
    },
    { id: 'water', type: 'fill', source: 'detail', 'source-layer': 'WA', paint: { 'fill-color': sea } },
    {
      id: 'coastline', type: 'line', source: 'detail', 'source-layer': 'Cstline',
      filter: ['==', ['get', 'vt_code'], 5101],
      paint: { 'line-color': '#8facb9', 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 6, 0.9] },
    },
    {
      // vt_code 1211 marks prefecture borders and 1212 the municipal ones.
      id: 'prefecture-border', type: 'line', source: 'detail', 'source-layer': 'AdmBdry',
      filter: ['==', ['get', 'vt_code'], 1212],
      paint: {
        'line-color': '#a8bcc5',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 8, 1.1, 12, 1.6],
      },
    },
    {
      id: 'place-label', type: 'symbol', source: 'detail', 'source-layer': 'Anno', minzoom: 6,
      filter: ['all', ['==', ['geometry-type'], 'Point'], ['in', ['get', 'vt_code'], ['literal', [110, 140]]]],
      layout: {
        'text-field': ['get', 'vt_text'],
        'text-font': ['NotoSansJP-Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 6, 11, 9, 13, 12, 14],
        'text-max-width': 6,
        // Observations are the reason for the map, so a name never hides one.
        'text-ignore-placement': true,
      },
      paint: { 'text-color': '#54707e', 'text-halo-color': '#ffffffdd', 'text-halo-width': 1.4 },
    },
  ],
};
