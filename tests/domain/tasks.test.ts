import { describe, expect, test } from 'vitest';
import {
  activeBlocks, addBlock, completeSession, completeTask, editTask, finishProject,
  groupTasks, isOverdue, moveBlock, newTask, projectStats, removeBlock,
} from '../../src/domain/tasks';
import type { Task } from '../../src/domain/types';

const NOW = '2026-09-28T10:00:00.000Z';
const block = (id: string, start = '2026-09-29T14:00:00.000Z', end = '2026-09-29T15:00:00.000Z') => ({ eventId: id, start, end });

const once = (): Task => newTask({ title: ' Ring til VVS ', durationMin: 15, kind: 'once' }, 'o1', NOW);
const car = (): Task => newTask({ title: 'Vask bil', durationMin: 60, kind: 'recurring', interval: { count: 3, unit: 'week' } }, 'r1', NOW);
const house = (): Task => newTask({ title: 'Byg drivhus', durationMin: 180, kind: 'project' }, 'p1', NOW);

describe('newTask / editTask', () => {
  test('trimmer titel og sætter typespecifikke felter', () => {
    expect(once()).toEqual({ id: 'o1', title: 'Ring til VVS', durationMin: 15, kind: 'once', createdAt: NOW, history: [] });
    expect(car().interval).toEqual({ count: 3, unit: 'week' });
    expect(car().dueDate).toBeUndefined();
    expect(house().sessions).toEqual([]);
  });
  test('editTask ændrer felter men ikke type', () => {
    const t = editTask(car(), { title: 'Vask bilen', durationMin: 45, kind: 'once', interval: { count: 2, unit: 'week' }, note: ' husk fælge ' });
    expect(t.kind).toBe('recurring');
    expect(t.title).toBe('Vask bilen');
    expect(t.durationMin).toBe(45);
    expect(t.interval).toEqual({ count: 2, unit: 'week' });
    expect(t.note).toBe('husk fælge');
  });
  test('editTask fjerner tom note', () => {
    const t = editTask({ ...once(), note: 'x' }, { title: 'a', durationMin: 15, kind: 'once', note: '  ' });
    expect(t.note).toBeUndefined();
  });
});

describe('blokke', () => {
  test('engangsopgave får scheduled', () => {
    const t = addBlock(once(), block('e1'));
    expect(t.scheduled).toEqual(block('e1'));
    expect(activeBlocks(t)).toEqual([block('e1')]);
  });
  test('stor opgave får flere planlagte sessioner', () => {
    const t = addBlock(addBlock(house(), block('e1')), block('e2'));
    expect(t.scheduled).toBeUndefined();
    expect(t.sessions).toEqual([{ ...block('e1'), status: 'planned' }, { ...block('e2'), status: 'planned' }]);
    expect(activeBlocks(t).map((b) => b.eventId)).toEqual(['e1', 'e2']);
  });
  test('moveBlock flytter scheduled og sessioner', () => {
    const a = moveBlock(addBlock(once(), block('e1')), 'e1', 'S', 'E');
    expect(a.scheduled).toEqual({ eventId: 'e1', start: 'S', end: 'E' });
    const b = moveBlock(addBlock(house(), block('e1')), 'e1', 'S', 'E');
    expect(b.sessions![0]).toEqual({ eventId: 'e1', start: 'S', end: 'E', status: 'planned' });
  });
  test('removeBlock fjerner scheduled og sessioner', () => {
    expect(removeBlock(addBlock(once(), block('e1')), 'e1').scheduled).toBeUndefined();
    expect(removeBlock(addBlock(house(), block('e1')), 'e1').sessions).toEqual([]);
  });
});

describe('færdig', () => {
  test('engangsopgave får completedAt og beholder blokken, men ingen aktive blokke', () => {
    const t = completeTask(addBlock(once(), block('e1')), '2026-09-28', NOW);
    expect(t.completedAt).toBe(NOW);
    expect(t.history).toEqual(['2026-09-28']);
    expect(t.scheduled).toBeDefined();
    expect(activeBlocks(t)).toEqual([]);
  });
  test('tilbagevendende opgave får ny forfaldsdato og mister blokken', () => {
    const t = completeTask(addBlock(car(), block('e1')), '2026-09-28', NOW);
    expect(t.completedAt).toBeUndefined();
    expect(t.dueDate).toBe('2026-10-19');
    expect(t.scheduled).toBeUndefined();
    expect(t.history).toEqual(['2026-09-28']);
  });
  test('completeTask afviser store opgaver', () => {
    expect(() => completeTask(house(), '2026-09-28', NOW)).toThrow();
  });
  test('session markeres done og tæller i statistik', () => {
    let t = addBlock(house(), block('e1', '2026-09-26T08:00:00.000Z', '2026-09-26T11:00:00.000Z'));
    t = addBlock(t, block('e2'));
    t = completeSession(t, 'e1');
    expect(projectStats(t)).toEqual({ count: 1, minutes: 180 });
    expect(activeBlocks(t).map((b) => b.eventId)).toEqual(['e2']);
  });
  test('finishProject sætter completedAt', () => {
    expect(finishProject(house(), NOW).completedAt).toBe(NOW);
  });
});

describe('groupTasks', () => {
  const today = '2026-09-28';
  test('fordeler opgaver i grupper', () => {
    const ready = once();
    const scheduled = { ...addBlock(once(), block('e1')), id: 'o2' };
    const newRecurring = car();
    const dueSoon = { ...car(), id: 'r2', dueDate: '2026-10-05' };
    const overdue = { ...car(), id: 'r3', dueDate: '2026-09-20' };
    const resting = { ...car(), id: 'r4', dueDate: '2026-10-06' };
    const project = house();
    const done = { ...once(), id: 'o3', completedAt: NOW };
    const g = groupTasks([ready, scheduled, newRecurring, dueSoon, overdue, resting, project, done], 7, today);
    expect(g.ready.map((t) => t.id)).toEqual(['o1', 'r1']);
    expect(g.scheduled.map((t) => t.id)).toEqual(['o2']);
    expect(g.dueSoon.map((t) => t.id)).toEqual(['r3', 'r2']);
    expect(g.resting.map((t) => t.id)).toEqual(['r4']);
    expect(g.projects.map((t) => t.id)).toEqual(['p1']);
    expect(g.history.map((t) => t.id)).toEqual(['o3']);
  });
  test('isOverdue', () => {
    expect(isOverdue({ ...car(), dueDate: '2026-09-27' }, today)).toBe(true);
    expect(isOverdue({ ...car(), dueDate: '2026-09-28' }, today)).toBe(false);
    expect(isOverdue(addBlock({ ...car(), dueDate: '2026-09-27' }, block('e1')), today)).toBe(false);
  });
});
