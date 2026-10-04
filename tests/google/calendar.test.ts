import { describe, expect, test } from 'vitest';
import { toExternalEvent } from '../../src/google/calendar';

const cal = { id: 'arbejde', selected: true, color: { bg: '#9fc6e7', fg: '#000000' } };
const palette = { '11': { bg: '#dc2127', fg: '#ffffff' } };

describe('toExternalEvent', () => {
  test('begivenhed med klokkeslæt får titel og kalenderfarve', () => {
    const e = toExternalEvent(
      { id: 'a', summary: 'Tandlæge', start: { dateTime: '2026-09-30T10:00:00+02:00' }, end: { dateTime: '2026-09-30T11:00:00+02:00' } },
      cal,
      palette,
    );
    expect(e).toEqual({
      id: 'a',
      calendarId: 'arbejde',
      title: 'Tandlæge',
      start: '2026-09-30T08:00:00.000Z',
      end: '2026-09-30T09:00:00.000Z',
      allDay: false,
      color: { bg: '#9fc6e7', fg: '#000000' },
    });
  });

  test('begivenhedens egen farve går forud for kalenderens', () => {
    const e = toExternalEvent(
      { id: 'a', colorId: '11', start: { dateTime: '2026-09-30T10:00:00Z' }, end: { dateTime: '2026-09-30T11:00:00Z' } },
      cal,
      palette,
    );
    expect(e!.color).toEqual({ bg: '#dc2127', fg: '#ffffff' });
  });

  test('uden titel vises "Optaget"', () => {
    const e = toExternalEvent({ id: 'a', start: { dateTime: '2026-09-30T10:00:00Z' }, end: { dateTime: '2026-09-30T11:00:00Z' } }, cal, palette);
    expect(e!.title).toBe('Optaget');
  });

  test('heldagsbegivenhed beholder datoer', () => {
    const e = toExternalEvent({ id: 'a', summary: 'Ferie', start: { date: '2026-10-12' }, end: { date: '2026-10-17' } }, cal, palette);
    expect(e).toMatchObject({ start: '2026-10-12', end: '2026-10-17', allDay: true });
  });

  test('aflyste og afviste begivenheder udelades', () => {
    const base = { id: 'a', start: { dateTime: '2026-09-30T10:00:00Z' }, end: { dateTime: '2026-09-30T11:00:00Z' } };
    expect(toExternalEvent({ ...base, status: 'cancelled' }, cal, palette)).toBeNull();
    expect(toExternalEvent({ ...base, attendees: [{ self: true, responseStatus: 'declined' }] }, cal, palette)).toBeNull();
    expect(toExternalEvent({ ...base, attendees: [{ self: false, responseStatus: 'declined' }] }, cal, palette)).not.toBeNull();
  });
});
