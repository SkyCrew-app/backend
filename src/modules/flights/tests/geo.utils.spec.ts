import {
  computeBearing,
  greatCirclePoints,
  haversineDistance,
  intermediatePoint,
} from '../utils/geo.utils';

describe('geo.utils', () => {
  it('calculates Paris-JFK distance around 5834 km', () => {
    const distance = haversineDistance(49.0097, 2.5479, 40.6398, -73.7789);
    expect(distance).toBeGreaterThan(5750);
    expect(distance).toBeLessThan(5950);
  });

  it('returns same point for identical coordinates', () => {
    const point = intermediatePoint(10, 20, 10, 20, 0.4);
    expect(point).toEqual({ lat: 10, lon: 20 });
  });

  it('creates expected number of great circle points', () => {
    const points = greatCirclePoints(48.8566, 2.3522, 43.6047, 1.4442, 5);
    expect(points).toHaveLength(5);
  });

  it('handles antipodes', () => {
    const distance = haversineDistance(0, 0, 0, 180);
    expect(distance).toBeGreaterThan(20000);
    expect(distance).toBeLessThan(20160);
  });

  describe('computeBearing', () => {
    it('computes bearing from Paris to Toulouse as roughly SSW (~189°)', () => {
      const bearing = computeBearing(49.0097, 2.5479, 43.6291, 1.36382);
      expect(bearing).toBeGreaterThan(185);
      expect(bearing).toBeLessThan(195);
    });

    it('computes bearing from Paris to JFK as roughly W (~290°)', () => {
      const bearing = computeBearing(49.0097, 2.5479, 40.6398, -73.7789);
      expect(bearing).toBeGreaterThan(275);
      expect(bearing).toBeLessThan(310);
    });

    it('computes bearing from Toulouse to Paris as roughly N-NE (~8°)', () => {
      const bearing = computeBearing(43.6291, 1.36382, 49.0097, 2.5479);
      expect(bearing).toBeGreaterThan(5);
      expect(bearing).toBeLessThan(15);
    });

    it('returns 0 for due north', () => {
      const bearing = computeBearing(0, 0, 10, 0);
      expect(bearing).toBeCloseTo(0, 0);
    });

    it('returns 90 for due east', () => {
      const bearing = computeBearing(0, 0, 0, 10);
      expect(bearing).toBeCloseTo(90, 0);
    });
  });
});
