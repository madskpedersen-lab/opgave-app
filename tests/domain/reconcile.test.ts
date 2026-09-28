import { expect, test } from 'vitest';
import { reconcile, type EventTimes } from '../../src/domain/reconcile';
import { addBlock, newTask } from '../../src/domain/tasks';

const NOW_ISO = '2026-09-28T10:00:00.000Z';
const now = new Date('2026-09-30T12:00:00.000Z');
const past = { start: '2026-09-29T14:00:00.000Z', end: '2026-09-29T15:00:00.000Z' };
const future = { start: '2026-10-01T14:00:00.000Z', end: '2026-10-01T15:00:00.000Z' };

const once = addBlock(newTask({ title: 'Ring', durationMin: 60, kind: 'once' }, 'o1', NOW_ISO), { eventId: 'e1', ...future });
const project = addBlock(
  addBlock(newTask({ title: 'Drivhus', durationMin: 60, kind: 'project' }, 'p1', NOW_ISO), { eventId: 'e2', ...past }),
  { eventId: 'e3', ...future },
);

test('ingen ændringer når begivenheder er uændrede og i fremtiden', () => {
  const events = new Map<string, EventTimes>([['e1', future], ['e2', future], ['e3', future]]);
  const p2 = { ...project, sessions: project.sessions!.map((s) => ({ ...s, ...future })) };
  const r = reconcile([once, p2], events, now);
  expect(r.tasks).toEqual([once, p2]);
  expect(r.questions).toEqual([]);
});

test('flyttet begivenhed opdaterer tidspunkt', () => {
  const moved = { start: '2026-10-02T08:00:00.000Z', end: '2026-10-02T09:00:00.000Z' };
  const r = reconcile([once], new Map([['e1', moved]]), now);
  expect(r.tasks[0].scheduled).toEqual({ eventId: 'e1', ...moved });
});

test('samme tidspunkt i anden tidszone-notation er ikke en flytning', () => {
  const same = { start: '2026-10-01T16:00:00+02:00', end: '2026-10-01T17:00:00+02:00' };
  const r = reconcile([once], new Map([['e1', same]]), now);
  expect(r.tasks[0]).toBe(once);
});

test('slettet begivenhed fjerner blokken', () => {
  const r = reconcile([once, project], new Map<string, EventTimes>([['e1', null], ['e2', null]]), now);
  expect(r.tasks[0].scheduled).toBeUndefined();
  expect(r.tasks[1].sessions!.map((s) => s.eventId)).toEqual(['e3']);
});

test('overstået begivenhed giver spørgsmål', () => {
  const pastOnce = addBlock(newTask({ title: 'Ring', durationMin: 60, kind: 'once' }, 'o2', NOW_ISO), { eventId: 'e9', ...past });
  const r = reconcile([pastOnce, project], new Map<string, EventTimes>([['e9', past], ['e2', past], ['e3', future]]), now);
  expect(r.questions).toEqual([
    { taskId: 'o2', eventId: 'e9', title: 'Ring', start: past.start, kind: 'task' },
    { taskId: 'p1', eventId: 'e2', title: 'Drivhus', start: past.start, kind: 'session' },
  ]);
});

test('begivenheder der ikke er hentet, ignoreres', () => {
  const r = reconcile([once], new Map(), now);
  expect(r.tasks[0]).toBe(once);
  expect(r.questions).toEqual([]);
});
