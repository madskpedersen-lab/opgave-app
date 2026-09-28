import { atTime } from './dates';
import type { Settings, Weekday } from './types';

export type Span = { start: Date; end: Date };
type Windows = Settings['windows'];

export function windowsForRange(windows: Windows, from: Date, to: Date): Span[] {
  const out: Span[] = [];
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (day < to) {
    const w = windows[day.getDay() as Weekday];
    if (w) out.push({ start: atTime(day, w.start), end: atTime(day, w.end) });
    day.setDate(day.getDate() + 1);
  }
  return out;
}

export function overlaps(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end;
}

export function isValidPlacement(block: Span, windows: Windows, busy: Span[]): boolean {
  const inside = windowsForRange(windows, block.start, block.end).some((w) => w.start <= block.start && block.end <= w.end);
  return inside && !busy.some((b) => overlaps(b, block));
}

export function toBusinessHours(windows: Windows): { daysOfWeek: number[]; startTime: string; endTime: string }[] {
  return ([0, 1, 2, 3, 4, 5, 6] as Weekday[])
    .filter((d) => windows[d])
    .map((d) => ({ daysOfWeek: [d], startTime: windows[d]!.start, endTime: windows[d]!.end }));
}
