import { atTime } from './dates';
import { activeBlocks, moveBlock, removeBlock } from './tasks';
import type { Task } from './types';

export type EventTimes = { start: string; end: string } | null; // null = slettet
export type Question = { taskId: string; eventId: string; title: string; start: string; kind: 'task' | 'session' };

const sameTime = (a: string, b: string) => new Date(a).getTime() === new Date(b).getTime();

/** Hvornår der må spørges til en blok: når den er slut, men tidligst på spørgetidspunktet samme dag. */
export function askTime(end: Date, askAfter: string): Date {
  if (askAfter === 'immediately') return end;
  const at = atTime(end, askAfter);
  return at > end ? at : end;
}

export function reconcile(
  tasks: Task[],
  events: Map<string, EventTimes>,
  now: Date,
  askAfter = 'immediately',
): { tasks: Task[]; questions: Question[] } {
  const questions: Question[] = [];
  const out = tasks.map((original) => {
    let t = original;
    for (const b of activeBlocks(original)) {
      if (!events.has(b.eventId)) continue;
      const ev = events.get(b.eventId)!;
      if (ev === null) {
        t = removeBlock(t, b.eventId);
        continue;
      }
      if (!sameTime(ev.start, b.start) || !sameTime(ev.end, b.end)) {
        t = moveBlock(t, b.eventId, new Date(ev.start).toISOString(), new Date(ev.end).toISOString());
      }
      if (askTime(new Date(ev.end), askAfter) <= now) {
        questions.push({ taskId: t.id, eventId: b.eventId, title: t.title, start: new Date(ev.start).toISOString(), kind: t.kind === 'project' ? 'session' : 'task' });
      }
    }
    return t;
  });
  return { tasks: out, questions };
}
