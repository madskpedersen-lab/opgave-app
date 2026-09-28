import { expect, test } from 'vitest';
import { defaultData } from '../../src/domain/defaults';

test('standarddata har hverdage 8-21 og weekend 9-18', () => {
  const d = defaultData();
  expect(d.version).toBe(1);
  expect(d.tasks).toEqual([]);
  expect(d.settings.windows[1]).toEqual({ start: '08:00', end: '21:00' });
  expect(d.settings.windows[5]).toEqual({ start: '08:00', end: '21:00' });
  expect(d.settings.windows[6]).toEqual({ start: '09:00', end: '18:00' });
  expect(d.settings.windows[0]).toEqual({ start: '09:00', end: '18:00' });
  expect(d.settings.sundayReminderTime).toBe('18:00');
  expect(d.settings.surfaceDaysBefore).toBe(7);
});

test('hvert kald giver et nyt objekt', () => {
  const a = defaultData();
  a.settings.windows[1]!.start = '10:00';
  expect(defaultData().settings.windows[1]!.start).toBe('08:00');
});
