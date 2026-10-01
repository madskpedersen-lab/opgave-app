import { addDays, addInterval } from './dates';
import type { Block, Task, TaskInput } from './types';

export function newTask(input: TaskInput, id: string, nowIso: string): Task {
  const t: Task = { id, title: input.title.trim(), durationMin: input.durationMin, kind: input.kind, createdAt: nowIso, history: [] };
  const note = input.note?.trim();
  if (note) t.note = note;
  if (input.kind === 'recurring') t.interval = input.interval;
  if (input.kind === 'project') t.sessions = [];
  return t;
}

export function editTask(t: Task, input: TaskInput): Task {
  const next: Task = { ...t, title: input.title.trim(), durationMin: input.durationMin };
  const note = input.note?.trim();
  if (note) next.note = note;
  else delete next.note;
  if (t.kind === 'recurring' && input.interval) next.interval = input.interval;
  return next;
}

export function addBlock(t: Task, b: Block): Task {
  if (t.kind === 'project') return { ...t, sessions: [...(t.sessions ?? []), { ...b, status: 'planned' }] };
  return { ...t, scheduled: { ...b } };
}

export function moveBlock(t: Task, eventId: string, start: string, end: string): Task {
  if (t.scheduled?.eventId === eventId) return { ...t, scheduled: { eventId, start, end } };
  return { ...t, sessions: t.sessions?.map((s) => (s.eventId === eventId ? { ...s, start, end } : s)) };
}

export function removeBlock(t: Task, eventId: string): Task {
  if (t.scheduled?.eventId === eventId) {
    const rest = { ...t };
    delete rest.scheduled;
    return rest;
  }
  return { ...t, sessions: t.sessions?.filter((s) => s.eventId !== eventId) };
}

export function completeTask(t: Task, doneDate: string, nowIso: string): Task {
  if (t.kind === 'project') throw new Error('Brug finishProject til store opgaver');
  const history = [...t.history, doneDate];
  if (t.kind === 'once') return { ...t, completedAt: nowIso, history };
  const rest = { ...t };
  delete rest.scheduled;
  return { ...rest, dueDate: addInterval(doneDate, t.interval!), history };
}

export function completeSession(t: Task, eventId: string): Task {
  return { ...t, sessions: t.sessions?.map((s) => (s.eventId === eventId ? { ...s, status: 'done' } : s)) };
}

export function finishProject(t: Task, nowIso: string): Task {
  return { ...t, completedAt: nowIso };
}

/** Gør en færdig opgave aktiv igen. En blok der allerede er overstået, fjernes. */
export function restoreTask(t: Task, now: Date): Task {
  const next = { ...t };
  delete next.completedAt;
  if (t.kind === 'project') return next;
  next.history = t.history.slice(0, -1);
  if (next.scheduled && new Date(next.scheduled.end) <= now) delete next.scheduled;
  return next;
}

export function activeBlocks(t: Task): Block[] {
  if (t.completedAt) return [];
  if (t.kind === 'project') {
    return (t.sessions ?? []).filter((s) => s.status === 'planned').map(({ eventId, start, end }) => ({ eventId, start, end }));
  }
  return t.scheduled ? [t.scheduled] : [];
}

export function projectStats(t: Task): { count: number; minutes: number } {
  const done = (t.sessions ?? []).filter((s) => s.status === 'done');
  const ms = done.reduce((sum, s) => sum + (new Date(s.end).getTime() - new Date(s.start).getTime()), 0);
  return { count: done.length, minutes: Math.round(ms / 60000) };
}

export function isOverdue(t: Task, today: string): boolean {
  return t.kind === 'recurring' && !t.scheduled && !!t.dueDate && t.dueDate < today;
}

export type TaskGroups = {
  dueSoon: Task[];
  ready: Task[];
  scheduled: Task[];
  projects: Task[];
  resting: Task[];
  history: Task[];
};

export function groupTasks(tasks: Task[], surfaceDaysBefore: number, today: string): TaskGroups {
  const g: TaskGroups = { dueSoon: [], ready: [], scheduled: [], projects: [], resting: [], history: [] };
  for (const t of tasks) {
    if (t.completedAt) g.history.push(t);
    else if (t.kind === 'project') g.projects.push(t);
    else if (t.scheduled) g.scheduled.push(t);
    else if (t.kind === 'recurring' && t.dueDate) {
      if (addDays(t.dueDate, -surfaceDaysBefore) > today) g.resting.push(t);
      else g.dueSoon.push(t);
    } else g.ready.push(t);
  }
  const byDue = (a: Task, b: Task) => a.dueDate!.localeCompare(b.dueDate!);
  g.dueSoon.sort(byDue);
  g.resting.sort(byDue);
  g.scheduled.sort((a, b) => a.scheduled!.start.localeCompare(b.scheduled!.start));
  g.history.sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
  return g;
}
