import { beforeEach, describe, expect, test } from 'vitest';
import { createActions, type Actions } from '../src/actions';
import { OfflineError } from '../src/google/http';
import { Store } from '../src/store';
import { FakeCalendar, FakeDrive, memoryStorage } from './fakes';

let cal: FakeCalendar;
let store: Store;
let actions: Actions;
let now: Date;
let online: boolean;
let ids: number;

beforeEach(async () => {
  cal = new FakeCalendar();
  store = new Store(new FakeDrive(), memoryStorage());
  now = new Date(2026, 8, 28, 10); // mandag 28. sep 2026 kl. 10
  online = true;
  ids = 0;
  actions = createActions({
    store,
    calendar: cal,
    now: () => now,
    newId: () => `t${++ids}`,
    appUrl: 'https://example.test/',
    timeZone: 'Europe/Copenhagen',
    isOnline: () => online,
  });
  await store.sync();
  await actions.ensureSetup();
});

const task = () => store.data.tasks[0];
const tasksCal = () => store.data.settings.tasksCalendarId!;

describe('ensureSetup', () => {
  test('opretter Opgaver-kalender og søndagspåmindelse én gang', async () => {
    expect(tasksCal()).toMatch(/^cal-Opgaver/);
    const rem = cal.reminders.get(store.data.settings.reminderEventId!)!;
    expect(rem.start.getTime()).toBe(new Date(2026, 9, 4, 18).getTime());
    await actions.ensureSetup();
    expect(cal.reminders.size).toBe(1);
  });
  test('genopretter hvis kalenderen er slettet', async () => {
    cal.calendars.delete(tasksCal());
    await actions.ensureSetup();
    expect(cal.calendars.has(tasksCal())).toBe(true);
    expect(cal.reminders.get(store.data.settings.reminderEventId!)!.calendarId).toBe(tasksCal());
  });
});

describe('planlægning', () => {
  test('schedule opretter begivenhed og blok', async () => {
    await actions.createTask({ title: 'Vask bil', durationMin: 60, kind: 'recurring', interval: { count: 3, unit: 'week' } });
    await actions.schedule('t1', new Date(2026, 8, 29, 14), new Date(2026, 8, 29, 15));
    const [ev] = cal.calendars.get(tasksCal())!;
    expect(ev.title).toBe('Vask bil');
    expect(ev.taskId).toBe('t1');
    expect(task().scheduled?.eventId).toBe(ev.id);
  });
  test('store opgaver får hammer i titlen', async () => {
    await actions.createTask({ title: 'Drivhus', durationMin: 120, kind: 'project' });
    await actions.schedule('t1', new Date(2026, 8, 29, 14), new Date(2026, 8, 29, 16));
    expect(cal.calendars.get(tasksCal())![0].title).toBe('🔨 Drivhus');
  });
  test('move og unschedule', async () => {
    await actions.createTask({ title: 'A', durationMin: 60, kind: 'once' });
    await actions.schedule('t1', new Date(2026, 8, 29, 14), new Date(2026, 8, 29, 15));
    const id = task().scheduled!.eventId;
    await actions.move('t1', id, new Date(2026, 8, 30, 9), new Date(2026, 8, 30, 10));
    expect(task().scheduled!.start).toBe(new Date(2026, 8, 30, 9).toISOString());
    expect((await cal.getEvent(tasksCal(), id))!.start).toBe(new Date(2026, 8, 30, 9).toISOString());
    await actions.unschedule('t1', id);
    expect(task().scheduled).toBeUndefined();
    expect(await cal.getEvent(tasksCal(), id)).toBeNull();
  });
  test('uden net afvises ændringer', async () => {
    online = false;
    await expect(actions.createTask({ title: 'A', durationMin: 60, kind: 'once' })).rejects.toBeInstanceOf(OfflineError);
    expect(store.data.tasks).toEqual([]);
  });
});

describe('færdig og afstemning', () => {
  test('markDone på tilbagevendende sætter ny forfaldsdato fra i dag', async () => {
    await actions.createTask({ title: 'Vask bil', durationMin: 60, kind: 'recurring', interval: { count: 3, unit: 'week' } });
    await actions.markDone('t1');
    expect(task().dueDate).toBe('2026-10-19');
  });
  test('reconcile spørger om overståede blokke; ja bruger planlagt dato', async () => {
    await actions.createTask({ title: 'Vask bil', durationMin: 60, kind: 'recurring', interval: { count: 1, unit: 'week' } });
    await actions.schedule('t1', new Date(2026, 8, 29, 14), new Date(2026, 8, 29, 15));
    now = new Date(2026, 9, 1, 9);
    const qs = await actions.reconcile();
    expect(qs).toHaveLength(1);
    await actions.answer(qs[0], true);
    expect(task().dueDate).toBe('2026-10-06');
    expect(task().scheduled).toBeUndefined();
  });
  test('nej sletter begivenheden og gør opgaven klar igen', async () => {
    await actions.createTask({ title: 'A', durationMin: 60, kind: 'once' });
    await actions.schedule('t1', new Date(2026, 8, 29, 14), new Date(2026, 8, 29, 15));
    const id = task().scheduled!.eventId;
    now = new Date(2026, 9, 1, 9);
    const [q] = await actions.reconcile();
    await actions.answer(q, false);
    expect(task().scheduled).toBeUndefined();
    expect(await cal.getEvent(tasksCal(), id)).toBeNull();
  });
  test('stor opgave: ja markerer sessionen', async () => {
    await actions.createTask({ title: 'Drivhus', durationMin: 120, kind: 'project' });
    await actions.schedule('t1', new Date(2026, 8, 29, 14), new Date(2026, 8, 29, 16));
    now = new Date(2026, 9, 1, 9);
    const [q] = await actions.reconcile();
    expect(q.kind).toBe('session');
    await actions.answer(q, true);
    expect(task().sessions![0].status).toBe('done');
    expect(task().completedAt).toBeUndefined();
  });
  test('reconcile opdager slettet begivenhed', async () => {
    await actions.createTask({ title: 'A', durationMin: 60, kind: 'once' });
    await actions.schedule('t1', new Date(2026, 8, 29, 14), new Date(2026, 8, 29, 15));
    await cal.deleteEvent(tasksCal(), task().scheduled!.eventId);
    expect(await actions.reconcile()).toEqual([]);
    expect(task().scheduled).toBeUndefined();
  });
  test('restoreTask genopretter en færdig engangsopgave', async () => {
    await actions.createTask({ title: 'A', durationMin: 60, kind: 'once' });
    await actions.markDone('t1');
    expect(task().completedAt).toBeDefined();
    await actions.restoreTask('t1');
    expect(task().completedAt).toBeUndefined();
    expect(task().history).toEqual([]);
  });
  test('deleteTask kan slette begivenheder', async () => {
    await actions.createTask({ title: 'Drivhus', durationMin: 120, kind: 'project' });
    await actions.schedule('t1', new Date(2026, 8, 29, 14), new Date(2026, 8, 29, 16));
    await actions.deleteTask('t1', true);
    expect(store.data.tasks).toEqual([]);
    expect(cal.calendars.get(tasksCal())).toEqual([]);
  });
});

describe('indstillinger og visning', () => {
  test('nyt påmindelsestidspunkt opdaterer søndagsbegivenheden', async () => {
    await actions.updateSettings({ sundayReminderTime: '19:30' });
    const rem = cal.reminders.get(store.data.settings.reminderEventId!)!;
    expect(rem.start.getTime()).toBe(new Date(2026, 9, 4, 19, 30).getTime());
    expect(store.data.settings.sundayReminderTime).toBe('19:30');
  });
  test('fejl ved upsertReminder gemmer ikke indstillinger', async () => {
    cal.upsertReminder = async () => { throw new Error('boom'); };
    await expect(actions.updateSettings({ sundayReminderTime: '19:30', surfaceDaysBefore: 3 })).rejects.toThrow();
    expect(store.data.settings.sundayReminderTime).toBe('18:00');
    expect(store.data.settings.surfaceDaysBefore).toBe(7);
  });
  test('loadRange viser synlige kalendere med farver og regner kun blokerende aftaler som optaget', async () => {
    const at = (h: number) => new Date(2026, 8, 29, h).toISOString();
    cal.external.set('primary', [
      { id: 'x1', calendarId: 'primary', title: 'Tandlæge', start: at(12), end: at(13), allDay: false, color: { bg: '#f00', fg: '#fff' }, blocks: true },
      { id: 'x2', calendarId: 'primary', title: 'Ferie', start: '2026-09-29', end: '2026-09-30', allDay: true, color: { bg: '#f00', fg: '#fff' }, blocks: false },
    ]);
    cal.calendars.set('skjult', []);
    cal.hidden.add('skjult');
    cal.external.set('skjult', [
      { id: 'x3', calendarId: 'skjult', title: 'Skjult', start: at(16), end: at(17), allDay: false, color: { bg: '#0f0', fg: '#000' }, blocks: true },
    ]);
    await actions.createTask({ title: 'A', durationMin: 60, kind: 'once' });
    await actions.schedule('t1', new Date(2026, 8, 29, 14), new Date(2026, 8, 29, 15));
    const r = await actions.loadRange(new Date(2026, 8, 28), new Date(2026, 9, 1));
    expect(r.external.map((e) => e.title)).toEqual(['Tandlæge', 'Ferie']);
    expect(r.busy).toEqual([{ start: new Date(2026, 8, 29, 12), end: new Date(2026, 8, 29, 13) }]);
    expect(r.taskEvents.map((e) => e.taskId)).toEqual(['t1']);
    expect(r.taskColor).toEqual({ bg: '#123456', fg: '#ffffff' });
  });
});
