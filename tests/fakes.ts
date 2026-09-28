import type { AppData } from '../src/domain/types';
import type { BusyPeriod, CalEvent, CalendarApi, NewEvent } from '../src/google/calendar';
import type { DriveApi, DriveLoad, DriveSaved } from '../src/google/drive';
import { ConflictError, OfflineError } from '../src/google/http';

export class FakeDrive implements DriveApi {
  data: AppData | null = null;
  version = 0;
  saves = 0;
  offline = false;

  async load(): Promise<DriveLoad> {
    if (this.offline) throw new OfflineError('offline');
    return this.data
      ? { data: structuredClone(this.data), fileId: 'f1', version: String(this.version) }
      : { data: null, fileId: null, version: null };
  }

  async save(data: AppData, fileId: string | null, version: string | null): Promise<DriveSaved> {
    if (this.offline) throw new OfflineError('offline');
    if (fileId && version !== String(this.version)) throw new ConflictError('conflict');
    this.data = structuredClone(data);
    this.version++;
    this.saves++;
    return { fileId: 'f1', version: String(this.version) };
  }

  /** Simulerer en ændring fra en anden enhed. */
  externalChange(fn: (d: AppData) => AppData): void {
    this.data = fn(structuredClone(this.data!));
    this.version++;
  }
}

export function memoryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

export class FakeCalendar implements CalendarApi {
  calendars = new Map<string, CalEvent[]>([['primary', []]]);
  busy: BusyPeriod[] = [];
  reminders = new Map<string, { calendarId: string; start: Date }>();
  private seq = 0;

  private events(calendarId: string): CalEvent[] {
    const list = this.calendars.get(calendarId);
    if (!list) throw new Error(`ukendt kalender ${calendarId}`);
    return list;
  }

  async listCalendarIds() { return [...this.calendars.keys()]; }
  async calendarExists(id: string) { return this.calendars.has(id); }
  async createCalendar(summary: string) {
    const id = `cal-${summary}-${++this.seq}`;
    this.calendars.set(id, []);
    return id;
  }
  async freeBusy(ids: string[]) { return ids.includes('primary') ? this.busy : []; }
  async listTaskEvents(calendarId: string) { return this.events(calendarId).filter((e) => e.taskId); }
  async getEvent(calendarId: string, eventId: string) { return this.events(calendarId).find((e) => e.id === eventId) ?? null; }
  async createEvent(calendarId: string, ev: NewEvent) {
    const e: CalEvent = { id: `ev${++this.seq}`, ...ev };
    this.events(calendarId).push(e);
    return e;
  }
  async updateEventTime(calendarId: string, eventId: string, start: string, end: string) {
    const e = this.events(calendarId).find((x) => x.id === eventId)!;
    e.start = start;
    e.end = end;
  }
  async deleteEvent(calendarId: string, eventId: string) {
    this.calendars.set(calendarId, this.events(calendarId).filter((e) => e.id !== eventId));
  }
  async upsertReminder(calendarId: string, existingId: string | undefined, start: Date) {
    const id = existingId && this.reminders.has(existingId) ? existingId : `rem${++this.seq}`;
    this.reminders.set(id, { calendarId, start });
    return id;
  }
}
