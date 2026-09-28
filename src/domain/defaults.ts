import type { AppData, Settings } from './types';

export function defaultSettings(): Settings {
  const weekday = () => ({ start: '08:00', end: '21:00' });
  const weekend = () => ({ start: '09:00', end: '18:00' });
  return {
    windows: { 0: weekend(), 1: weekday(), 2: weekday(), 3: weekday(), 4: weekday(), 5: weekday(), 6: weekend() },
    sundayReminderTime: '18:00',
    surfaceDaysBefore: 7,
  };
}

export function defaultData(): AppData {
  return { version: 1, tasks: [], settings: defaultSettings() };
}
