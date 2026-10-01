import type { Span } from './domain/availability';
import { nextSunday, toDateStr } from './domain/dates';
import { reconcile, type EventTimes, type Question } from './domain/reconcile';
import {
  activeBlocks, addBlock, completeSession, completeTask, editTask, finishProject, moveBlock, newTask, removeBlock,
  restoreTask,
} from './domain/tasks';
import type { AppData, Settings, Task, TaskInput } from './domain/types';
import type { CalEvent, CalendarApi, Color, ExternalEvent } from './google/calendar';
import { OfflineError } from './google/http';
import type { Store } from './store';

export type ActionDeps = {
  store: Store;
  calendar: CalendarApi;
  now: () => Date;
  newId: () => string;
  appUrl: string;
  timeZone: string;
  isOnline: () => boolean;
};

export function createActions(deps: ActionDeps) {
  const { store, calendar } = deps;

  const requireOnline = () => {
    if (!deps.isOnline()) throw new OfflineError('Ingen forbindelse');
  };
  const calId = () => {
    const id = store.data.settings.tasksCalendarId;
    if (!id) throw new Error('Opgaver-kalenderen er ikke sat op endnu');
    return id;
  };
  const find = (id: string): Task => {
    const t = store.data.tasks.find((x) => x.id === id);
    if (!t) throw new Error('Opgaven findes ikke');
    return t;
  };
  const mapTask = (id: string, fn: (t: Task) => Task) =>
    store.update((d: AppData) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? fn(t) : t)) }));
  const setSettings = (patch: Partial<Settings>) =>
    store.update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));

  return {
    async ensureSetup(): Promise<void> {
      requireOnline();
      const s = store.data.settings;
      let tasksCalendarId = s.tasksCalendarId;
      let reminderEventId = s.reminderEventId;
      if (!tasksCalendarId || !(await calendar.calendarExists(tasksCalendarId))) {
        tasksCalendarId = await calendar.createCalendar('Opgaver', deps.timeZone);
        reminderEventId = undefined;
      }
      if (!reminderEventId) {
        reminderEventId = await calendar.upsertReminder(
          tasksCalendarId, undefined, nextSunday(deps.now(), s.sundayReminderTime), deps.appUrl, deps.timeZone,
        );
      }
      if (tasksCalendarId !== s.tasksCalendarId || reminderEventId !== s.reminderEventId) {
        await setSettings({ tasksCalendarId, reminderEventId });
      }
    },

    async createTask(input: TaskInput): Promise<void> {
      requireOnline();
      const t = newTask(input, deps.newId(), deps.now().toISOString());
      await store.update((d) => ({ ...d, tasks: [...d.tasks, t] }));
    },

    async editTask(id: string, input: TaskInput): Promise<void> {
      requireOnline();
      await mapTask(id, (t) => editTask(t, input));
    },

    async deleteTask(id: string, deleteEvents: boolean): Promise<void> {
      requireOnline();
      if (deleteEvents) {
        for (const b of activeBlocks(find(id))) await calendar.deleteEvent(calId(), b.eventId);
      }
      await store.update((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
    },

    async schedule(taskId: string, start: Date, end: Date): Promise<void> {
      requireOnline();
      const t = find(taskId);
      const ev = await calendar.createEvent(calId(), {
        title: t.kind === 'project' ? `🔨 ${t.title}` : t.title,
        start: start.toISOString(),
        end: end.toISOString(),
        taskId,
      });
      await mapTask(taskId, (x) => addBlock(x, { eventId: ev.id, start: ev.start, end: ev.end }));
    },

    async move(taskId: string, eventId: string, start: Date, end: Date): Promise<void> {
      requireOnline();
      await calendar.updateEventTime(calId(), eventId, start.toISOString(), end.toISOString());
      await mapTask(taskId, (t) => moveBlock(t, eventId, start.toISOString(), end.toISOString()));
    },

    async unschedule(taskId: string, eventId: string): Promise<void> {
      requireOnline();
      await calendar.deleteEvent(calId(), eventId);
      await mapTask(taskId, (t) => removeBlock(t, eventId));
    },

    async markDone(taskId: string): Promise<void> {
      requireOnline();
      const now = deps.now();
      await mapTask(taskId, (t) => completeTask(t, toDateStr(now), now.toISOString()));
    },

    async markSessionDone(taskId: string, eventId: string): Promise<void> {
      requireOnline();
      await mapTask(taskId, (t) => completeSession(t, eventId));
    },

    async finishProject(taskId: string): Promise<void> {
      requireOnline();
      await mapTask(taskId, (t) => finishProject(t, deps.now().toISOString()));
    },

    async restoreTask(taskId: string): Promise<void> {
      requireOnline();
      await mapTask(taskId, (t) => restoreTask(t, deps.now()));
    },

    async reconcile(): Promise<Question[]> {
      requireOnline();
      const blocks = store.data.tasks.flatMap(activeBlocks);
      if (blocks.length === 0) return [];
      const events = new Map<string, EventTimes>();
      await Promise.all(
        blocks.map(async (b) => {
          const ev = await calendar.getEvent(calId(), b.eventId);
          events.set(b.eventId, ev && { start: ev.start, end: ev.end });
        }),
      );
      const result = reconcile(store.data.tasks, events, deps.now());
      if (JSON.stringify(result.tasks) !== JSON.stringify(store.data.tasks)) {
        await store.update((d) => ({ ...d, tasks: reconcile(d.tasks, events, deps.now()).tasks }));
      }
      return result.questions;
    },

    async answer(q: Question, yes: boolean): Promise<void> {
      requireOnline();
      if (!yes) {
        await calendar.deleteEvent(calId(), q.eventId);
        await mapTask(q.taskId, (t) => removeBlock(t, q.eventId));
      } else if (q.kind === 'session') {
        await mapTask(q.taskId, (t) => completeSession(t, q.eventId));
      } else {
        await mapTask(q.taskId, (t) => completeTask(t, toDateStr(new Date(q.start)), deps.now().toISOString()));
      }
    },

    async updateSettings(patch: Partial<Settings>): Promise<void> {
      requireOnline();
      const s = store.data.settings;
      const merged = { ...s, ...patch };
      if (merged.sundayReminderTime !== s.sundayReminderTime) {
        const id = await calendar.upsertReminder(
          calId(), s.reminderEventId, nextSunday(deps.now(), merged.sundayReminderTime), deps.appUrl, deps.timeZone,
        );
        await setSettings({ ...patch, reminderEventId: id });
      } else {
        await setSettings(patch);
      }
    },

    /** Henter alt til kalendervisningen: aftaler fra synlige kalendere, optaget tid og opgaveblokke. */
    async loadRange(from: Date, to: Date): Promise<{ external: ExternalEvent[]; busy: Span[]; taskEvents: CalEvent[]; taskColor?: Color }> {
      requireOnline();
      const own = calId();
      const [min, max] = [from.toISOString(), to.toISOString()];
      const calendars = await calendar.listCalendars();
      const shown = calendars.filter((c) => c.selected && c.id !== own);
      const [lists, taskEvents] = await Promise.all([
        Promise.all(shown.map((c) => calendar.listEvents(c, min, max))),
        calendar.listTaskEvents(own, min, max),
      ]);
      const external = lists.flat();
      const busy = external.filter((e) => e.blocks).map((e) => ({ start: new Date(e.start), end: new Date(e.end) }));
      return { external, busy, taskEvents, taskColor: calendars.find((c) => c.id === own)?.color };
    },
  };
}

export type Actions = ReturnType<typeof createActions>;
