import { describe, expect, it } from 'vitest';
import { windBearing, windLength } from './AmedasObservation';

describe('wind arrows', () => {
  it('turns the reported direction into the way the air travels', () => {
    // 北の風 (16) blows towards the south, 東の風 (4) towards the west.
    expect(windBearing(16)).toBe(180);
    expect(windBearing(4)).toBe(270);
    expect(windBearing(8)).toBe(0);
    expect(windBearing(12)).toBe(90);
  });

  it('has no bearing for calm or missing observations', () => {
    expect(windBearing(0)).toBeNull();
    expect(windBearing(null)).toBeNull();
    expect(windBearing(17)).toBeNull();
    expect(windBearing(1.5)).toBeNull();
  });

  it('scales the arrow with speed and drops it when there is no wind', () => {
    expect(windLength(0)).toBe(0);
    expect(windLength(null)).toBe(0);
    expect(windLength(20)).toBe(1);
    expect(windLength(30)).toBe(1);
    expect(windLength(10)).toBeCloseTo(0.65);
    expect(windLength(5)).toBeLessThan(windLength(15));
  });
});
