import type { AppData, Settings } from './types';

export function defaultSettings(): Settings {
  return {
    visibleHours: { start: 6, end: 23 },
    sundayReminderTime: '18:00',
    surfaceDaysBefore: 7,
  };
}

export function defaultData(): AppData {
  return { version: 1, tasks: [], settings: defaultSettings() };
}

/** Bringer gemte data (også fra ældre versioner af appen) på den nuværende form. */
export function normalizeData(d: AppData): AppData {
  const { windows: _old, ...settings } = d.settings as Settings & { windows?: unknown };
  return { ...d, settings: { ...defaultSettings(), ...settings } };
}
