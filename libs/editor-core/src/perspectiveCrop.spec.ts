import { describe, expect, it } from 'vitest';
import { mapUnitToQuad } from './perspectiveWarp';
import type { Quad } from './perspectiveWarp';

describe('perspective crop mapping', () => {
  it('mapUnitToQuad hits the four corners', () => {
    const q: Quad = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 0, y: 50 },
    ];
    expect(mapUnitToQuad(q, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(mapUnitToQuad(q, 1, 0).x).toBeCloseTo(100, 5);
    expect(mapUnitToQuad(q, 1, 1).y).toBeCloseTo(50, 5);
    expect(mapUnitToQuad(q, 0, 1).x).toBeCloseTo(0, 5);
  });
});
