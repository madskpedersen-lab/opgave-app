import { gfetch, isNotFound } from './http';

export type CalEvent = { id: string; title: string; start: string; end: string; taskId?: string };
export type NewEvent = { title: string; start: string; end: string; taskId: string };
export type Color = { bg: string; fg: string };
export type CalendarInfo = { id: string; selected: boolean; color: Color };
/** En begivenhed fra brugerens egne kalendere, som den vises i appen. */
export type ExternalEvent = {
  id: string;
  calendarId: string;
  title: string;
  /** ISO-tidspunkt, eller YYYY-MM-DD for heldagsbegivenheder. */
  start: string;
  end: string;
  allDay: boolean;
  color: Color;
  /** Optager tid, så opgaver ikke kan lægges her. */
  blocks: boolean;
};

export interface CalendarApi {
  listCalendars(): Promise<CalendarInfo[]>;
  calendarExists(id: string): Promise<boolean>;
  createCalendar(summary: string, timeZone: string): Promise<string>;
  /** Begivenheder i en af brugerens kalendere (uden aflyste og afviste). */
  listEvents(calendar: CalendarInfo, timeMin: string, timeMax: string): Promise<ExternalEvent[]>;
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
  colorId?: string;
  transparency?: string;
  attendees?: { self?: boolean; responseStatus?: string }[];
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

export function toExternalEvent(e: GEvent, cal: CalendarInfo, palette: Record<string, Color>): ExternalEvent | null {
  if (e.status === 'cancelled' || !e.start || !e.end) return null;
  if (e.attendees?.some((a) => a.self && a.responseStatus === 'declined')) return null;
  const allDay = !e.start.dateTime;
  return {
    id: e.id,
    calendarId: cal.id,
    title: e.summary || 'Optaget',
    start: allDay ? e.start.date! : new Date(e.start.dateTime!).toISOString(),
    end: allDay ? e.end.date! : new Date(e.end.dateTime!).toISOString(),
    allDay,
    color: (e.colorId && palette[e.colorId]) || cal.color,
    blocks: !allDay && e.transparency !== 'transparent',
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
  let palette: Promise<Record<string, Color>> | null = null;
  const eventPalette = () => {
    palette ??= json<{ event: Record<string, { background: string; foreground: string }> }>(`${BASE}/colors`)
      .then((r) => Object.fromEntries(Object.entries(r.event).map(([id, c]) => [id, { bg: c.background, fg: c.foreground }])))
      .catch((e) => {
        palette = null;
        throw e;
      });
    return palette;
  };

  return {
    async listCalendars() {
      const r = await json<{ items: { id: string; selected?: boolean; backgroundColor?: string; foregroundColor?: string }[] }>(
        `${BASE}/users/me/calendarList?fields=items(id,selected,backgroundColor,foregroundColor)`,
      );
      return r.items.map((i) => ({
        id: i.id,
        selected: i.selected === true,
        color: { bg: i.backgroundColor ?? '#9e9e9e', fg: i.foregroundColor ?? '#000000' },
      }));
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

    async listEvents(cal, timeMin, timeMax) {
      const url = `${BASE}/calendars/${enc(cal.id)}/events?singleEvents=true&maxResults=2500&timeMin=${enc(timeMin)}&timeMax=${enc(timeMax)}`;
      const [r, colors] = await Promise.all([json<{ items: GEvent[] }>(url), eventPalette()]);
      return r.items.map((e) => toExternalEvent(e, cal, colors)).filter((e): e is ExternalEvent => e !== null);
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
