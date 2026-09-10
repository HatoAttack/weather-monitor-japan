import type { StyleSpecification } from 'maplibre-gl';

/**
 * Base map built to stay out of the way of the weather layers.
 *
 * GSI vector tiles carry each feature separately, so roads, road numbers and
 * buildings can be left out while the coastline, borders, railways, rivers,
 * contour lines and place names are drawn. They stop publishing land and
 * coastline above zoom 6, so from there the pale raster map fades in
 * underneath, washed out until little more than the land and sea tone survives,
 * with elevation colouring joining it once the map is on a single region.
 */
const vectorTiles = 'https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/{z}/{x}/{y}.pbf';
const rasterTiles = 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png';
const shadeTiles = 'https://cyberjapandata.gsi.go.jp/xyz/hillshademap/{z}/{x}/{y}.png';
const elevationTiles = 'https://cyberjapandata.gsi.go.jp/xyz/relief/{z}/{x}/{y}.png';
const gsi = (label: string) =>
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">' + label + '</a>';

const land = '#e7eede';
const sea = '#d9e8ee';

export const baseMapStyle: StyleSpecification = {
  version: 8,
  glyphs: 'https://gsi-cyberjapan.github.io/optimal_bvmap/glyphs/{fontstack}/{range}.pbf',
  sources: {
    basemap: {
      type: 'raster', tiles: [rasterTiles], tileSize: 256, minzoom: 2, maxzoom: 18,
      attribution: gsi('地理院タイル'),
    },
    shade: {
      type: 'raster', tiles: [shadeTiles], tileSize: 256, minzoom: 2, maxzoom: 16,
      attribution: gsi('陰影起伏図'),
    },
    elevation: {
      type: 'raster', tiles: [elevationTiles], tileSize: 256, minzoom: 5, maxzoom: 15,
      attribution: gsi('色別標高図'),
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
        'raster-saturation': 0.2,
        'raster-contrast': -0.15,
        'raster-brightness-min': 0.45,
      },
    },
    {
      // Elevation colouring also paints the sea floor, which would take over the
      // nationwide view, so it only joins once the map is on a region.
      id: 'elevation-colour', type: 'raster', source: 'elevation',
      paint: {
        'raster-opacity': ['interpolate', ['linear'], ['zoom'], 6.5, 0, 8, 0.45],
        'raster-saturation': -0.15,
      },
    },
    {
      // Relief shading carries no text or roads, so terrain can be read without clutter.
      id: 'relief', type: 'raster', source: 'shade',
      paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.3, 8, 0.4, 12, 0.42] },
    },
    { id: 'water', type: 'fill', source: 'detail', 'source-layer': 'WA', paint: { 'fill-color': sea } },
    {
      // Contours only reach the tiles from zoom 10, and stay faint under everything else.
      id: 'contour', type: 'line', source: 'detail', 'source-layer': 'Cntr', minzoom: 10,
      paint: {
        'line-color': '#b3a48c',
        'line-width': 0.5,
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.45, 13, 0.75],
      },
    },
    {
      id: 'river', type: 'line', source: 'detail', 'source-layer': 'RvrCL', minzoom: 10,
      paint: {
        'line-color': '#9dc2d4',
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 14, 1.3],
      },
    },
    {
      id: 'railway', type: 'line', source: 'detail', 'source-layer': 'RailCL',
      paint: {
        'line-color': '#93a3ab',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.4, 10, 0.7, 13, 1.1],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 10, 0.8],
      },
    },
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
      paint: { 'text-color': '#3d5561', 'text-halo-color': '#ffffffdd', 'text-halo-width': 1.4 },
    },
  ],
};

/** Base map details the viewer can switch off, and the style layers behind each. */
export const baseMapFeatureLayers = {
  elevation: ['elevation-colour'],
  contour: ['contour'],
  river: ['river'],
  railway: ['railway'],
} as const;

export type BaseMapFeature = keyof typeof baseMapFeatureLayers;
