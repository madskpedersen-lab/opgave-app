import { describe, expect, test } from 'vitest';
import { isValidPlacement, overlaps, toBusinessHours, windowsForRange } from '../../src/domain/availability';
import { defaultSettings } from '../../src/domain/defaults';

const w = defaultSettings().windows; // man-fre 8-21, lør-søn 9-18
const at = (d: number, h: number, m = 0) => new Date(2026, 8, d, h, m); // september 2026; 28 = mandag

describe('windowsForRange', () => {
  test('giver ét tidsrum pr. dag med indstillinger', () => {
    const r = windowsForRange(w, at(26, 0), at(29, 0)); // lør, søn, man
    expect(r).toEqual([
      { start: at(26, 9), end: at(26, 18) },
      { start: at(27, 9), end: at(27, 18) },
      { start: at(28, 8), end: at(28, 21) },
    ]);
  });
  test('springer dage uden tid over', () => {
    const r = windowsForRange({ ...w, 1: null }, at(28, 0), at(29, 0));
    expect(r).toEqual([]);
  });
});

describe('overlaps', () => {
  test('berøring er ikke overlap', () => {
    expect(overlaps({ start: at(28, 8), end: at(28, 9) }, { start: at(28, 9), end: at(28, 10) })).toBe(false);
    expect(overlaps({ start: at(28, 8), end: at(28, 9, 30) }, { start: at(28, 9), end: at(28, 10) })).toBe(true);
  });
});

describe('isValidPlacement', () => {
  const busy = [{ start: at(28, 12), end: at(28, 13) }];
  test('inden for tidsrum og ikke optaget', () => {
    expect(isValidPlacement({ start: at(28, 10), end: at(28, 11) }, w, busy)).toBe(true);
    expect(isValidPlacement({ start: at(28, 13), end: at(28, 14) }, w, busy)).toBe(true);
  });
  test('overlapper optaget tid', () => {
    expect(isValidPlacement({ start: at(28, 11, 30), end: at(28, 12, 30) }, w, busy)).toBe(false);
  });
  test('uden for tidsrum', () => {
    expect(isValidPlacement({ start: at(28, 7), end: at(28, 8, 30) }, w, busy)).toBe(false);
    expect(isValidPlacement({ start: at(28, 20, 30), end: at(28, 21, 30) }, w, busy)).toBe(false);
    expect(isValidPlacement({ start: at(26, 8), end: at(26, 9) }, w, busy)).toBe(false);
  });
});

describe('toBusinessHours', () => {
  test('laver FullCalendar-format', () => {
    expect(toBusinessHours({ ...w, 2: null, 3: null, 4: null, 5: null, 6: null })).toEqual([
      { daysOfWeek: [0], startTime: '09:00', endTime: '18:00' },
      { daysOfWeek: [1], startTime: '08:00', endTime: '21:00' },
    ]);
  });
});
