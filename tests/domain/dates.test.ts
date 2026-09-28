import { describe, expect, test } from 'vitest';
import { addDays, addInterval, atTime, nextSunday, parseDateStr, toDateStr } from '../../src/domain/dates';

describe('toDateStr / parseDateStr', () => {
  test('bruger lokal dato', () => {
    expect(toDateStr(new Date(2026, 8, 28, 23, 59))).toBe('2026-09-28');
    expect(parseDateStr('2026-09-28').getTime()).toBe(new Date(2026, 8, 28).getTime());
  });
});

describe('addDays', () => {
  test('lægger dage til på tværs af måned', () => {
    expect(addDays('2026-09-28', 5)).toBe('2026-10-03');
    expect(addDays('2026-10-03', -7)).toBe('2026-09-26');
  });
});

describe('addInterval', () => {
  test('dage og uger', () => {
    expect(addInterval('2026-09-28', { count: 3, unit: 'day' })).toBe('2026-10-01');
    expect(addInterval('2026-09-28', { count: 3, unit: 'week' })).toBe('2026-10-19');
  });
  test('måneder', () => {
    expect(addInterval('2026-09-28', { count: 2, unit: 'month' })).toBe('2026-11-28');
    expect(addInterval('2026-11-15', { count: 3, unit: 'month' })).toBe('2027-02-15');
  });
  test('måned uden dagen bruger sidste dag', () => {
    expect(addInterval('2026-01-31', { count: 1, unit: 'month' })).toBe('2026-02-28');
    expect(addInterval('2028-01-31', { count: 1, unit: 'month' })).toBe('2028-02-29');
  });
});

describe('atTime', () => {
  test('sætter klokkeslæt på dagen', () => {
    const d = atTime(new Date(2026, 8, 28, 13, 45), '08:30');
    expect(d.getTime()).toBe(new Date(2026, 8, 28, 8, 30).getTime());
  });
});

describe('nextSunday', () => {
  test('fra mandag', () => {
    expect(nextSunday(new Date(2026, 8, 28, 12), '18:00').getTime()).toBe(new Date(2026, 9, 4, 18).getTime());
  });
  test('søndag før tidspunktet giver samme dag', () => {
    expect(nextSunday(new Date(2026, 9, 4, 17), '18:00').getTime()).toBe(new Date(2026, 9, 4, 18).getTime());
  });
  test('søndag efter tidspunktet giver næste søndag', () => {
    expect(nextSunday(new Date(2026, 9, 4, 19), '18:00').getTime()).toBe(new Date(2026, 9, 11, 18).getTime());
  });
});
