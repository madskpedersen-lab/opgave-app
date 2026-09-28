import { parseDateStr } from '../domain/dates';
import { isOverdue, projectStats } from '../domain/tasks';
import type { Interval, Task } from '../domain/types';

const DAYS = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const UNITS = { day: 'dag', week: 'uge', month: 'måned' } as const;
const pad = (n: number) => String(n).padStart(2, '0');

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  if (!m) return `${h} t`;
  return `${h} t ${m} min`;
}

const dayLabel = (d: Date) => `${DAYS[d.getDay()]} ${d.getDate()}. ${MONTHS[d.getMonth()]}`;

export function formatDate(s: string): string {
  return dayLabel(parseDateStr(s));
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${dayLabel(d)} kl. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatInterval(iv: Interval): string {
  return iv.count === 1 ? `hver ${UNITS[iv.unit]}` : `hver ${iv.count}. ${UNITS[iv.unit]}`;
}

export function taskMeta(t: Task, today: string): string {
  if (t.kind === 'project') {
    const s = projectStats(t);
    return [`${formatDuration(t.durationMin)} pr. gang`, `${s.count} ${s.count === 1 ? 'blok' : 'blokke'}`, `${formatDuration(s.minutes)} i alt`].join(' · ');
  }
  const parts = [formatDuration(t.durationMin)];
  if (t.kind === 'recurring' && t.interval) parts.push(formatInterval(t.interval));
  if (t.scheduled && !t.completedAt) parts.push(`planlagt ${formatDateTime(t.scheduled.start)}`);
  else if (isOverdue(t, today)) parts.push(`forsinket, skulle være gjort ${formatDate(t.dueDate!)}`);
  else if (t.dueDate) parts.push(`forfalder ${formatDate(t.dueDate)}`);
  return parts.join(' · ');
}
