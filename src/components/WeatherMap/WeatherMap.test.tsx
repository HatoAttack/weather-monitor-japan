import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { WeatherMap } from './WeatherMap';
import { normalizeFrames } from '../../weather/adapters/jma/precipitation';

const mocks = vi.hoisted(() => ({
  loads: [] as (() => void)[],
  rain: [] as { setFrame: ReturnType<typeof vi.fn>; setVisible: ReturnType<typeof vi.fn> }[],
  features: [] as { set: ReturnType<typeof vi.fn> }[],
}));
vi.mock('maplibre-gl', () => ({
  Map: class {
    keyboard = { disableRotation: vi.fn() };
    addControl() {}
    getCanvas() { return document.createElement('canvas'); }
    resize() {}
    remove() {}
    on(type: string, callback: () => void) { if (type === 'load') mocks.loads.push(callback); }
  },
  NavigationControl: class {},
}));
vi.mock('./BaseMapFeatures', () => ({
  BaseMapFeatures: class {
    set = vi.fn();
    constructor() { mocks.features.push(this); }
  },
}));
vi.mock('./RainLayer', () => ({
  RainLayer: class {
    setFrame = vi.fn();
    setVisible = vi.fn();
    constructor() { mocks.rain.push(this); }
    destroy() {}
  },
}));
vi.mock('./SatelliteLayer', () => ({
  SatelliteLayer: class {
    setFrame() {}
    setVisible() {}
    destroy() {}
  },
}));
vi.mock('./AmedasLayer', () => ({
  AmedasLayer: class {
    setSnapshot() {}
    setMetric() {}
    setVisible() {}
    destroy() {}
  },
}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); mocks.loads.length = 0; mocks.rain.length = 0; mocks.features.length = 0; });

it('reapplies the selected rain image when the map is recreated', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const frame = normalizeFrames([
    { basetime: '20260909000000', validtime: '20260909000000', elements: ['hrpns'] },
  ], '2026-09-09T00:10:00Z', Date.parse('2026-09-09T00:10:00Z'))[0];
  const props = {
    frame, visible: true, retry: 0, amedasSnapshot: null, amedasMetric: 'temperature' as const,
    amedasVisible: true, onDisplay: vi.fn(), onStatus: vi.fn(), onStation: vi.fn(),
    satelliteVisible: false, satelliteRetry: 0, onSatelliteDisplay: vi.fn(), onSatelliteStatus: vi.fn(),
    baseMapFeatures: { elevation: true, contour: true, river: true, railway: true },
  };
  const view = render(<WeatherMap {...props} />);
  act(() => mocks.loads[0]());
  expect(mocks.rain[0].setFrame).toHaveBeenCalledWith(frame, false);
  // Changing a callback recreates the map just as an effect reload can during development.
  view.rerender(<WeatherMap {...props} onStation={vi.fn()} />);
  act(() => mocks.loads[1]());
  expect(mocks.rain[1].setFrame).toHaveBeenCalledWith(frame, false);
  expect(mocks.rain[1].setVisible).toHaveBeenCalledWith(true);
});

it('passes the chosen base map details to the map once it is loaded', () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const shown = { elevation: true, contour: true, river: true, railway: true };
  const props = {
    frame: undefined, visible: true, retry: 0, amedasSnapshot: null, amedasMetric: 'temperature' as const,
    amedasVisible: true, onDisplay: vi.fn(), onStatus: vi.fn(), onStation: vi.fn(),
    satelliteVisible: false, satelliteRetry: 0, onSatelliteDisplay: vi.fn(), onSatelliteStatus: vi.fn(),
    baseMapFeatures: shown,
  };
  const view = render(<WeatherMap {...props} />);
  act(() => mocks.loads[0]());
  expect(mocks.features[0].set).toHaveBeenCalledWith(shown);

  const hidden = { ...shown, railway: false };
  view.rerender(<WeatherMap {...props} baseMapFeatures={hidden} />);
  expect(mocks.features[0].set).toHaveBeenLastCalledWith(hidden);
});
