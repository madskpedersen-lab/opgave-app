import { gfetch, isNotFound } from './http';

export type CalEvent = { id: string; title: string; start: string; end: string; taskId?: string };
export type NewEvent = { title: string; start: string; end: string; taskId: string };
export type BusyPeriod = { start: string; end: string };

export interface CalendarApi {
  listCalendarIds(): Promise<string[]>;
  calendarExists(id: string): Promise<boolean>;
  createCalendar(summary: string, timeZone: string): Promise<string>;
  freeBusy(calendarIds: string[], timeMin: string, timeMax: string): Promise<BusyPeriod[]>;
  /** Begivenheder i kalenderen med et taskId (dvs. ikke søndagsbegivenheden). */
  listTaskEvents(calendarId: string, timeMin: string, timeMax: string): Promise<CalEvent[]>;
  /** null hvis begivenheden er slettet. */
  getEvent(calendarId: string, eventId: string): Promise<CalEvent | null>;
  createEvent(calendarId: string, ev: NewEvent): Promise<CalEvent>;
  updateEventTime(calendarId: string, eventId: string, start: string, end: string): Promise<void>;
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
  /** Opretter eller opdaterer søndagsbegivenheden. Returnerer dens id. */
  upsertReminder(calendarId: string, existingId: string | undefined, start: Date, appUrl: string, timeZone: string): Promise<string>;
}

const BASE = 'https://www.googleapis.com/calendar/v3';
const enc = encodeURIComponent;

type GEvent = {
  id: string;
  status?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
};

function toCalEvent(e: GEvent): CalEvent {
  return {
    id: e.id,
    title: e.summary ?? '',
    start: new Date(e.start!.dateTime ?? e.start!.date!).toISOString(),
    end: new Date(e.end!.dateTime ?? e.end!.date!).toISOString(),
    taskId: e.extendedProperties?.private?.taskId,
  };
}

const jsonBody = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  return (await gfetch(url, init)).json() as Promise<T>;
}

export function createCalendarApi(): CalendarApi {
  return {
    async listCalendarIds() {
      const r = await json<{ items: { id: string }[] }>(`${BASE}/users/me/calendarList?fields=items(id)`);
      return r.items.map((i) => i.id);
    },

    async calendarExists(id) {
      try {
        await gfetch(`${BASE}/calendars/${enc(id)}?fields=id`);
        return true;
      } catch (e) {
        if (isNotFound(e)) return false;
        throw e;
      }
    },

    async createCalendar(summary, timeZone) {
      const r = await json<{ id: string }>(`${BASE}/calendars`, jsonBody('POST', { summary, timeZone }));
      return r.id;
    },

    async freeBusy(calendarIds, timeMin, timeMax) {
      if (calendarIds.length === 0) return [];
      const r = await json<{ calendars: Record<string, { busy?: BusyPeriod[] }> }>(
        `${BASE}/freeBusy`,
        jsonBody('POST', { timeMin, timeMax, items: calendarIds.map((id) => ({ id })) }),
      );
      return Object.values(r.calendars).flatMap((c) => c.busy ?? []);
    },

    async listTaskEvents(calendarId, timeMin, timeMax) {
      const url = `${BASE}/calendars/${enc(calendarId)}/events?singleEvents=true&maxResults=2500&timeMin=${enc(timeMin)}&timeMax=${enc(timeMax)}`;
      const r = await json<{ items: GEvent[] }>(url);
      return r.items
        .filter((e) => e.status !== 'cancelled' && e.start?.dateTime && e.extendedProperties?.private?.taskId)
        .map(toCalEvent);
    },

    async getEvent(calendarId, eventId) {
      try {
        const e = await json<GEvent>(`${BASE}/calendars/${enc(calendarId)}/events/${enc(eventId)}`);
        return e.status === 'cancelled' ? null : toCalEvent(e);
      } catch (e) {
        if (isNotFound(e)) return null;
        throw e;
      }
    },

    async createEvent(calendarId, ev) {
      const e = await json<GEvent>(
        `${BASE}/calendars/${enc(calendarId)}/events`,
        jsonBody('POST', {
          summary: ev.title,
          start: { dateTime: ev.start },
          end: { dateTime: ev.end },
          extendedProperties: { private: { taskId: ev.taskId } },
        }),
      );
      return toCalEvent(e);
    },

    async updateEventTime(calendarId, eventId, start, end) {
      await gfetch(
        `${BASE}/calendars/${enc(calendarId)}/events/${enc(eventId)}`,
        jsonBody('PATCH', { start: { dateTime: start }, end: { dateTime: end } }),
      );
    },

    async deleteEvent(calendarId, eventId) {
      try {
        await gfetch(`${BASE}/calendars/${enc(calendarId)}/events/${enc(eventId)}`, { method: 'DELETE' });
      } catch (e) {
        if (!isNotFound(e)) throw e;
      }
    },

    async upsertReminder(calendarId, existingId, start, appUrl, timeZone) {
      const end = new Date(start.getTime() + 15 * 60000);
      const body = {
        summary: '📋 Planlæg ugens opgaver',
        description: `Åbn opgave-appen: ${appUrl}`,
        start: { dateTime: start.toISOString(), timeZone },
        end: { dateTime: end.toISOString(), timeZone },
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=SU'],
        reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] },
      };
      if (existingId) {
        try {
          await gfetch(`${BASE}/calendars/${enc(calendarId)}/events/${enc(existingId)}`, jsonBody('PUT', body));
          return existingId;
        } catch (e) {
          if (!isNotFound(e)) throw e;
        }
      }
      const e = await json<GEvent>(`${BASE}/calendars/${enc(calendarId)}/events`, jsonBody('POST', body));
      return e.id;
    },
  };
}
