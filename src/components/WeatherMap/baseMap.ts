import type { StyleSpecification } from 'maplibre-gl';
export const baseMapStyle: StyleSpecification = {
  version: 8,
  sources: {
    basemap: { type: 'raster', tiles: ['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'],
      tileSize: 256, minzoom: 2, maxzoom: 18,
      attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">地理院タイル</a>' },
  },
  layers: [
    { id: 'ocean', type: 'background', paint: { 'background-color': '#d9e8ee' } },
    { id: 'basemap', type: 'raster', source: 'basemap', paint: { 'raster-saturation': -0.65 } },
  ],
};
