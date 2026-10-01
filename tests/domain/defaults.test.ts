import { expect, test } from 'vitest';
import { defaultData, normalizeData } from '../../src/domain/defaults';

test('standarddata viser 06-23 og har søndagspåmindelse kl. 18', () => {
  const d = defaultData();
  expect(d.version).toBe(1);
  expect(d.tasks).toEqual([]);
  expect(d.settings.visibleHours).toEqual({ start: 6, end: 23 });
  expect(d.settings.sundayReminderTime).toBe('18:00');
  expect(d.settings.surfaceDaysBefore).toBe(7);
});

test('hvert kald giver et nyt objekt', () => {
  const a = defaultData();
  a.settings.visibleHours.start = 8;
  expect(defaultData().settings.visibleHours.start).toBe(6);
});

test('normalizeData fjerner gamle ledige tidsrum og tilføjer vist tidsrum', () => {
  const old = {
    version: 1,
    tasks: [],
    settings: { windows: { 1: { start: '08:00', end: '21:00' } }, sundayReminderTime: '19:00', surfaceDaysBefore: 3, tasksCalendarId: 'c' },
  };
  const d = normalizeData(old as never);
  expect(d.settings).toEqual({ visibleHours: { start: 6, end: 23 }, sundayReminderTime: '19:00', surfaceDaysBefore: 3, tasksCalendarId: 'c' });
});

test('normalizeData bevarer et valgt vist tidsrum', () => {
  const d = defaultData();
  d.settings.visibleHours = { start: 7, end: 22 };
  expect(normalizeData(d).settings.visibleHours).toEqual({ start: 7, end: 22 });
});
