export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = søndag
export type TaskKind = 'once' | 'recurring' | 'project';
export type Interval = { count: number; unit: 'day' | 'week' | 'month' };

export type Block = { eventId: string; start: string; end: string };
export type Session = Block & { status: 'planned' | 'done' };

export type Task = {
  id: string;
  title: string;
  durationMin: number;
  kind: TaskKind;
  interval?: Interval;
  note?: string;
  createdAt: string;
  scheduled?: Block;
  dueDate?: string;
  sessions?: Session[];
  completedAt?: string;
  history: string[];
};

export type TaskInput = {
  title: string;
  durationMin: number;
  kind: TaskKind;
  interval?: Interval;
  note?: string;
};

export type TimeWindow = { start: string; end: string }; // "HH:MM"

export type Settings = {
  windows: Record<Weekday, TimeWindow | null>;
  sundayReminderTime: string;
  surfaceDaysBefore: number;
  tasksCalendarId?: string;
  reminderEventId?: string;
};

export type AppData = { version: 1; tasks: Task[]; settings: Settings };
