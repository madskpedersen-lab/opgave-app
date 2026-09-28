import { expect, test } from 'vitest';
import { addBlock, completeSession, newTask } from '../../src/domain/tasks';
import { formatDate, formatDateTime, formatDuration, formatInterval, taskMeta } from '../../src/ui/format';

test('formatDuration', () => {
  expect(formatDuration(15)).toBe('15 min');
  expect(formatDuration(60)).toBe('1 t');
  expect(formatDuration(90)).toBe('1 t 30 min');
});

test('formatDate og formatDateTime', () => {
  expect(formatDate('2026-10-05')).toBe('man 5. okt');
  expect(formatDateTime(new Date(2026, 9, 4, 18, 5).toISOString())).toBe('søn 4. okt kl. 18:05');
});

test('formatInterval', () => {
  expect(formatInterval({ count: 1, unit: 'week' })).toBe('hver uge');
  expect(formatInterval({ count: 3, unit: 'week' })).toBe('hver 3. uge');
  expect(formatInterval({ count: 6, unit: 'month' })).toBe('hver 6. måned');
});

test('taskMeta', () => {
  const now = '2026-09-28T10:00:00.000Z';
  const car = { ...newTask({ title: 'Bil', durationMin: 60, kind: 'recurring', interval: { count: 3, unit: 'week' } }, 'r', now), dueDate: '2026-09-27' };
  expect(taskMeta(car, '2026-09-28')).toBe('1 t · hver 3. uge · forsinket, skulle være gjort søn 27. sep');
  expect(taskMeta({ ...car, dueDate: '2026-10-05' }, '2026-09-28')).toBe('1 t · hver 3. uge · forfalder man 5. okt');
  const planned = addBlock(newTask({ title: 'A', durationMin: 30, kind: 'once' }, 'o', now), {
    eventId: 'e', start: new Date(2026, 8, 29, 14).toISOString(), end: new Date(2026, 8, 29, 14, 30).toISOString(),
  });
  expect(taskMeta(planned, '2026-09-28')).toBe('30 min · planlagt tir 29. sep kl. 14:00');
  let p = addBlock(newTask({ title: 'D', durationMin: 180, kind: 'project' }, 'p', now), {
    eventId: 'e', start: new Date(2026, 8, 26, 9).toISOString(), end: new Date(2026, 8, 26, 12).toISOString(),
  });
  p = completeSession(p, 'e');
  expect(taskMeta(p, '2026-09-28')).toBe('3 t pr. gang · 1 blok · 3 t i alt');
});
