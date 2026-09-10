import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setWorkerUrl } from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import './app/styles.css';
import { App } from './app/App';
import { registerRainTileProtocol } from './weather/adapters/jma/rainTiles';
// Bundle the worker and its imports instead of relying on a distribution-relative URL.
setWorkerUrl(mapWorkerUrl);
registerRainTileProtocol();
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
