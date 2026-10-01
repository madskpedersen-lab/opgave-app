import { describe, expect, test } from 'vitest';
import { isValidPlacement, overlaps } from '../../src/domain/availability';

const at = (d: number, h: number, m = 0) => new Date(2026, 8, d, h, m);

describe('overlaps', () => {
  test('berøring er ikke overlap', () => {
    expect(overlaps({ start: at(28, 8), end: at(28, 9) }, { start: at(28, 9), end: at(28, 10) })).toBe(false);
    expect(overlaps({ start: at(28, 8), end: at(28, 9, 30) }, { start: at(28, 9), end: at(28, 10) })).toBe(true);
  });
});

describe('isValidPlacement', () => {
  const busy = [{ start: at(28, 12), end: at(28, 13) }];
  test('alle tidspunkter uden aftaler er tilladt, også sent og tidligt', () => {
    expect(isValidPlacement({ start: at(28, 10), end: at(28, 11) }, busy)).toBe(true);
    expect(isValidPlacement({ start: at(28, 13), end: at(28, 14) }, busy)).toBe(true);
    expect(isValidPlacement({ start: at(28, 5), end: at(28, 6) }, busy)).toBe(true);
    expect(isValidPlacement({ start: at(28, 22, 30), end: at(28, 23, 30) }, busy)).toBe(true);
  });
  test('overlap med optaget tid afvises', () => {
    expect(isValidPlacement({ start: at(28, 11, 30), end: at(28, 12, 30) }, busy)).toBe(false);
  });
});
