# Opgave-app Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En PWA til Android, hvor brugeren har opgaver (engang, tilbagevendende, store), trækker dem ind i ledige tidsrum i Google Calendar og mindes hver søndag via en gentagende kalenderbegivenhed.

**Architecture:** Statisk TypeScript-app (Vite) uden server. Ren domænelogik i `src/domain/*` (testet med Vitest). Google Calendar og Drive (appDataFolder) kaldes direkte fra browseren med et OAuth-token fra Google Identity Services. `Store` holder `AppData` og gemmer i Drive med versionstjek. `actions` orkestrerer kalender og store. UI er vanilla DOM + FullCalendar 6.

**Tech Stack:** TypeScript 5.9, Vite, Vitest (jsdom kun hvor nødvendigt), FullCalendar 6.1 (core, timegrid, interaction), Google Identity Services, Google Calendar API v3, Google Drive API v3, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-28-opgave-app-design.md`

**Konventioner:**
- Kode og identifikatorer på engelsk, al tekst i UI'et på dansk.
- Tidspunkter gemmes som UTC ISO-strenge (`Date.prototype.toISOString()`). Datoer (forfald, historik) som lokale `YYYY-MM-DD`-strenge.
- Tests ligger i `tests/` og spejler `src/`.
- Kør alle tests med `npm test`. Typetjek med `npm run typecheck`.

---

## Filstruktur

```
opgave-app/
  package.json, tsconfig.json, vite.config.ts, index.html, .gitignore, .env.example
  public/manifest.webmanifest, public/sw.js, public/icon.svg, public/icon-192.png, public/icon-512.png
  src/
    config.ts                 miljøvariabler (klient-ID, app-URL)
    main.ts                   indgang: CSS, service worker, startApp
    styles.css
    domain/
      types.ts                alle datatyper
      defaults.ts             standardindstillinger / tomme data
      dates.ts                datoregning (interval, næste søndag)
      tasks.ts                tilstandsskift og gruppering af opgaver
      availability.ts         ledige tidsrum, overlap, FullCalendar businessHours
      reconcile.ts            afstemning mod kalenderbegivenheder
    google/
      http.ts                 fetch med token + fejltyper
      auth.ts                 Google Identity Services-login
      drive.ts                DriveApi (load/save i appDataFolder)
      calendar.ts             CalendarApi
    store.ts                  AppData i hukommelse + localStorage + Drive
    actions.ts                orkestrering af kalender + store
    ui/
      dom.ts                  h()-hjælper
      sheet.ts                bundark-dialog (ask) + toast
      format.ts               danske tekster for datoer/varighed
      context.ts              Ctx-typen
      taskForm.ts             opret/rediger opgave
      tasks.ts                opgaveliste-skærm
      plan.ts                 planlæg-skærm (FullCalendar + skuffe)
      settings.ts             indstillinger-skærm
      prompts.ts              "Blev det gjort?"-dialoger
      app.ts                  skal, navigation, login, bannere, fejlhåndtering
  tests/
    fakes.ts                  FakeDrive, FakeCalendar, memoryStorage
    domain/*.test.ts, google/http.test.ts, store.test.ts, actions.test.ts, ui/format.test.ts
  .github/workflows/deploy.yml
  docs/opsaetning.md          brugerens guide til Google Cloud + GitHub Pages
```

---

### Task 1: Projektopsætning

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `.env.example`, `src/main.ts`, `tests/smoke.test.ts`

- [ ] **Step 1: Opret `package.json`**

```json
{
  "name": "opgave-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Installér afhængigheder**

Run:
```bash
npm install @fullcalendar/core@6.1.21 @fullcalendar/timegrid@6.1.21 @fullcalendar/interaction@6.1.21
npm install -D typescript@~5.9 vite vitest
```
Expected: `node_modules/` oprettes, ingen fejl.

- [ ] **Step 3: Opret `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Opret `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 5: Opret `index.html`**

```html
<!doctype html>
<html lang="da">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#2f6f5e" />
    <link rel="manifest" href="manifest.webmanifest" />
    <link rel="icon" href="icon.svg" type="image/svg+xml" />
    <title>Opgaver</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Opret `.gitignore` og `.env.example`**

`.gitignore`:
```
node_modules
dist
.env.local
```

`.env.example`:
```
VITE_GOOGLE_CLIENT_ID=123456789-xxxx.apps.googleusercontent.com
VITE_APP_URL=http://localhost:5173/
```

- [ ] **Step 7: Midlertidig `src/main.ts` og smoke-test**

`src/main.ts`:
```ts
document.getElementById('app')!.textContent = 'Opgaver';
```

`tests/smoke.test.ts`:
```ts
import { expect, test } from 'vitest';

test('testmiljøet kører', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 8: Kør test og typetjek**

Run: `npm test && npm run typecheck`
Expected: 1 test PASS, typetjek uden fejl.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: projektopsætning med Vite, TypeScript og Vitest"
```

---

### Task 2: Domænetyper og standardværdier

**Files:**
- Create: `src/domain/types.ts`, `src/domain/defaults.ts`
- Test: `tests/domain/defaults.test.ts`

- [ ] **Step 1: Opret `src/domain/types.ts`**

```ts
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
```

- [ ] **Step 2: Skriv fejlende test `tests/domain/defaults.test.ts`**

```ts
import { expect, test } from 'vitest';
import { defaultData } from '../../src/domain/defaults';

test('standarddata har hverdage 8-21 og weekend 9-18', () => {
  const d = defaultData();
  expect(d.version).toBe(1);
  expect(d.tasks).toEqual([]);
  expect(d.settings.windows[1]).toEqual({ start: '08:00', end: '21:00' });
  expect(d.settings.windows[5]).toEqual({ start: '08:00', end: '21:00' });
  expect(d.settings.windows[6]).toEqual({ start: '09:00', end: '18:00' });
  expect(d.settings.windows[0]).toEqual({ start: '09:00', end: '18:00' });
  expect(d.settings.sundayReminderTime).toBe('18:00');
  expect(d.settings.surfaceDaysBefore).toBe(7);
});

test('hvert kald giver et nyt objekt', () => {
  const a = defaultData();
  a.settings.windows[1]!.start = '10:00';
  expect(defaultData().settings.windows[1]!.start).toBe('08:00');
});
```

- [ ] **Step 3: Kør test og se den fejle**

Run: `npx vitest run tests/domain/defaults.test.ts`
Expected: FAIL, modulet `defaults` findes ikke.

- [ ] **Step 4: Opret `src/domain/defaults.ts`**

```ts
import type { AppData, Settings } from './types';

export function defaultSettings(): Settings {
  const weekday = () => ({ start: '08:00', end: '21:00' });
  const weekend = () => ({ start: '09:00', end: '18:00' });
  return {
    windows: { 0: weekend(), 1: weekday(), 2: weekday(), 3: weekday(), 4: weekday(), 5: weekday(), 6: weekend() },
    sundayReminderTime: '18:00',
    surfaceDaysBefore: 7,
  };
}

export function defaultData(): AppData {
  return { version: 1, tasks: [], settings: defaultSettings() };
}
```

- [ ] **Step 5: Kør test og se den bestå**

Run: `npx vitest run tests/domain/defaults.test.ts`
Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: domænetyper og standardindstillinger"
```

---

### Task 3: Datoregning

**Files:**
- Create: `src/domain/dates.ts`
- Test: `tests/domain/dates.test.ts`

Referencedatoer: 2026-09-28 er en mandag, 2026-10-04 er en søndag.

- [ ] **Step 1: Skriv fejlende tests `tests/domain/dates.test.ts`**

```ts
import { describe, expect, test } from 'vitest';
import { addDays, addInterval, atTime, nextSunday, parseDateStr, toDateStr } from '../../src/domain/dates';

describe('toDateStr / parseDateStr', () => {
  test('bruger lokal dato', () => {
    expect(toDateStr(new Date(2026, 8, 28, 23, 59))).toBe('2026-09-28');
    expect(parseDateStr('2026-09-28').getTime()).toBe(new Date(2026, 8, 28).getTime());
  });
});

describe('addDays', () => {
  test('lægger dage til på tværs af måned', () => {
    expect(addDays('2026-09-28', 5)).toBe('2026-10-03');
    expect(addDays('2026-10-03', -7)).toBe('2026-09-26');
  });
});

describe('addInterval', () => {
  test('dage og uger', () => {
    expect(addInterval('2026-09-28', { count: 3, unit: 'day' })).toBe('2026-10-01');
    expect(addInterval('2026-09-28', { count: 3, unit: 'week' })).toBe('2026-10-19');
  });
  test('måneder', () => {
    expect(addInterval('2026-09-28', { count: 2, unit: 'month' })).toBe('2026-11-28');
    expect(addInterval('2026-11-15', { count: 3, unit: 'month' })).toBe('2027-02-15');
  });
  test('måned uden dagen bruger sidste dag', () => {
    expect(addInterval('2026-01-31', { count: 1, unit: 'month' })).toBe('2026-02-28');
    expect(addInterval('2028-01-31', { count: 1, unit: 'month' })).toBe('2028-02-29');
  });
});

describe('atTime', () => {
  test('sætter klokkeslæt på dagen', () => {
    const d = atTime(new Date(2026, 8, 28, 13, 45), '08:30');
    expect(d.getTime()).toBe(new Date(2026, 8, 28, 8, 30).getTime());
  });
});

describe('nextSunday', () => {
  test('fra mandag', () => {
    expect(nextSunday(new Date(2026, 8, 28, 12), '18:00').getTime()).toBe(new Date(2026, 9, 4, 18).getTime());
  });
  test('søndag før tidspunktet giver samme dag', () => {
    expect(nextSunday(new Date(2026, 9, 4, 17), '18:00').getTime()).toBe(new Date(2026, 9, 4, 18).getTime());
  });
  test('søndag efter tidspunktet giver næste søndag', () => {
    expect(nextSunday(new Date(2026, 9, 4, 19), '18:00').getTime()).toBe(new Date(2026, 9, 11, 18).getTime());
  });
});
```

- [ ] **Step 2: Kør test og se den fejle**

Run: `npx vitest run tests/domain/dates.test.ts`
Expected: FAIL, modulet findes ikke.

- [ ] **Step 3: Opret `src/domain/dates.ts`**

```ts
import type { Interval } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseDateStr(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function addInterval(s: string, iv: Interval): string {
  if (iv.unit === 'day') return addDays(s, iv.count);
  if (iv.unit === 'week') return addDays(s, iv.count * 7);
  const d = parseDateStr(s);
  const target = new Date(d.getFullYear(), d.getMonth() + iv.count, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return toDateStr(target);
}

export function atTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}

export function nextSunday(now: Date, hhmm: string): Date {
  const d = atTime(now, hhmm);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  if (d <= now) d.setDate(d.getDate() + 7);
  return d;
}
```

- [ ] **Step 4: Kør test og se den bestå**

Run: `npx vitest run tests/domain/dates.test.ts`
Expected: alle tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: datoregning med intervaller og næste søndag"
```

---

### Task 4: Opgavelogik

**Files:**
- Create: `src/domain/tasks.ts`
- Test: `tests/domain/tasks.test.ts`

- [ ] **Step 1: Skriv fejlende tests `tests/domain/tasks.test.ts`**

```ts
import { describe, expect, test } from 'vitest';
import {
  activeBlocks, addBlock, completeSession, completeTask, editTask, finishProject,
  groupTasks, isOverdue, moveBlock, newTask, projectStats, removeBlock,
} from '../../src/domain/tasks';
import type { Task } from '../../src/domain/types';

const NOW = '2026-09-28T10:00:00.000Z';
const block = (id: string, start = '2026-09-29T14:00:00.000Z', end = '2026-09-29T15:00:00.000Z') => ({ eventId: id, start, end });

const once = (): Task => newTask({ title: ' Ring til VVS ', durationMin: 15, kind: 'once' }, 'o1', NOW);
const car = (): Task => newTask({ title: 'Vask bil', durationMin: 60, kind: 'recurring', interval: { count: 3, unit: 'week' } }, 'r1', NOW);
const house = (): Task => newTask({ title: 'Byg drivhus', durationMin: 180, kind: 'project' }, 'p1', NOW);

describe('newTask / editTask', () => {
  test('trimmer titel og sætter typespecifikke felter', () => {
    expect(once()).toEqual({ id: 'o1', title: 'Ring til VVS', durationMin: 15, kind: 'once', createdAt: NOW, history: [] });
    expect(car().interval).toEqual({ count: 3, unit: 'week' });
    expect(car().dueDate).toBeUndefined();
    expect(house().sessions).toEqual([]);
  });
  test('editTask ændrer felter men ikke type', () => {
    const t = editTask(car(), { title: 'Vask bilen', durationMin: 45, kind: 'once', interval: { count: 2, unit: 'week' }, note: ' husk fælge ' });
    expect(t.kind).toBe('recurring');
    expect(t.title).toBe('Vask bilen');
    expect(t.durationMin).toBe(45);
    expect(t.interval).toEqual({ count: 2, unit: 'week' });
    expect(t.note).toBe('husk fælge');
  });
  test('editTask fjerner tom note', () => {
    const t = editTask({ ...once(), note: 'x' }, { title: 'a', durationMin: 15, kind: 'once', note: '  ' });
    expect(t.note).toBeUndefined();
  });
});

describe('blokke', () => {
  test('engangsopgave får scheduled', () => {
    const t = addBlock(once(), block('e1'));
    expect(t.scheduled).toEqual(block('e1'));
    expect(activeBlocks(t)).toEqual([block('e1')]);
  });
  test('stor opgave får flere planlagte sessioner', () => {
    const t = addBlock(addBlock(house(), block('e1')), block('e2'));
    expect(t.scheduled).toBeUndefined();
    expect(t.sessions).toEqual([{ ...block('e1'), status: 'planned' }, { ...block('e2'), status: 'planned' }]);
    expect(activeBlocks(t).map((b) => b.eventId)).toEqual(['e1', 'e2']);
  });
  test('moveBlock flytter scheduled og sessioner', () => {
    const a = moveBlock(addBlock(once(), block('e1')), 'e1', 'S', 'E');
    expect(a.scheduled).toEqual({ eventId: 'e1', start: 'S', end: 'E' });
    const b = moveBlock(addBlock(house(), block('e1')), 'e1', 'S', 'E');
    expect(b.sessions![0]).toEqual({ eventId: 'e1', start: 'S', end: 'E', status: 'planned' });
  });
  test('removeBlock fjerner scheduled og sessioner', () => {
    expect(removeBlock(addBlock(once(), block('e1')), 'e1').scheduled).toBeUndefined();
    expect(removeBlock(addBlock(house(), block('e1')), 'e1').sessions).toEqual([]);
  });
});

describe('færdig', () => {
  test('engangsopgave får completedAt og beholder blokken, men ingen aktive blokke', () => {
    const t = completeTask(addBlock(once(), block('e1')), '2026-09-28', NOW);
    expect(t.completedAt).toBe(NOW);
    expect(t.history).toEqual(['2026-09-28']);
    expect(t.scheduled).toBeDefined();
    expect(activeBlocks(t)).toEqual([]);
  });
  test('tilbagevendende opgave får ny forfaldsdato og mister blokken', () => {
    const t = completeTask(addBlock(car(), block('e1')), '2026-09-28', NOW);
    expect(t.completedAt).toBeUndefined();
    expect(t.dueDate).toBe('2026-10-19');
    expect(t.scheduled).toBeUndefined();
    expect(t.history).toEqual(['2026-09-28']);
  });
  test('completeTask afviser store opgaver', () => {
    expect(() => completeTask(house(), '2026-09-28', NOW)).toThrow();
  });
  test('session markeres done og tæller i statistik', () => {
    let t = addBlock(house(), block('e1', '2026-09-26T08:00:00.000Z', '2026-09-26T11:00:00.000Z'));
    t = addBlock(t, block('e2'));
    t = completeSession(t, 'e1');
    expect(projectStats(t)).toEqual({ count: 1, minutes: 180 });
    expect(activeBlocks(t).map((b) => b.eventId)).toEqual(['e2']);
  });
  test('finishProject sætter completedAt', () => {
    expect(finishProject(house(), NOW).completedAt).toBe(NOW);
  });
});

describe('groupTasks', () => {
  const today = '2026-09-28';
  test('fordeler opgaver i grupper', () => {
    const ready = once();
    const scheduled = { ...addBlock(once(), block('e1')), id: 'o2' };
    const newRecurring = car();
    const dueSoon = { ...car(), id: 'r2', dueDate: '2026-10-05' };
    const overdue = { ...car(), id: 'r3', dueDate: '2026-09-20' };
    const resting = { ...car(), id: 'r4', dueDate: '2026-10-06' };
    const project = house();
    const done = { ...once(), id: 'o3', completedAt: NOW };
    const g = groupTasks([ready, scheduled, newRecurring, dueSoon, overdue, resting, project, done], 7, today);
    expect(g.ready.map((t) => t.id)).toEqual(['o1', 'r1']);
    expect(g.scheduled.map((t) => t.id)).toEqual(['o2']);
    expect(g.dueSoon.map((t) => t.id)).toEqual(['r3', 'r2']);
    expect(g.resting.map((t) => t.id)).toEqual(['r4']);
    expect(g.projects.map((t) => t.id)).toEqual(['p1']);
    expect(g.history.map((t) => t.id)).toEqual(['o3']);
  });
  test('isOverdue', () => {
    expect(isOverdue({ ...car(), dueDate: '2026-09-27' }, today)).toBe(true);
    expect(isOverdue({ ...car(), dueDate: '2026-09-28' }, today)).toBe(false);
    expect(isOverdue(addBlock({ ...car(), dueDate: '2026-09-27' }, block('e1')), today)).toBe(false);
  });
});
```

- [ ] **Step 2: Kør test og se den fejle**

Run: `npx vitest run tests/domain/tasks.test.ts`
Expected: FAIL, modulet findes ikke.

- [ ] **Step 3: Opret `src/domain/tasks.ts`**

```ts
import { addDays, addInterval } from './dates';
import type { Block, Task, TaskInput } from './types';

export function newTask(input: TaskInput, id: string, nowIso: string): Task {
  const t: Task = { id, title: input.title.trim(), durationMin: input.durationMin, kind: input.kind, createdAt: nowIso, history: [] };
  const note = input.note?.trim();
  if (note) t.note = note;
  if (input.kind === 'recurring') t.interval = input.interval;
  if (input.kind === 'project') t.sessions = [];
  return t;
}

export function editTask(t: Task, input: TaskInput): Task {
  const next: Task = { ...t, title: input.title.trim(), durationMin: input.durationMin };
  const note = input.note?.trim();
  if (note) next.note = note;
  else delete next.note;
  if (t.kind === 'recurring' && input.interval) next.interval = input.interval;
  return next;
}

export function addBlock(t: Task, b: Block): Task {
  if (t.kind === 'project') return { ...t, sessions: [...(t.sessions ?? []), { ...b, status: 'planned' }] };
  return { ...t, scheduled: { ...b } };
}

export function moveBlock(t: Task, eventId: string, start: string, end: string): Task {
  if (t.scheduled?.eventId === eventId) return { ...t, scheduled: { eventId, start, end } };
  return { ...t, sessions: t.sessions?.map((s) => (s.eventId === eventId ? { ...s, start, end } : s)) };
}

export function removeBlock(t: Task, eventId: string): Task {
  if (t.scheduled?.eventId === eventId) {
    const rest = { ...t };
    delete rest.scheduled;
    return rest;
  }
  return { ...t, sessions: t.sessions?.filter((s) => s.eventId !== eventId) };
}

export function completeTask(t: Task, doneDate: string, nowIso: string): Task {
  if (t.kind === 'project') throw new Error('Brug finishProject til store opgaver');
  const history = [...t.history, doneDate];
  if (t.kind === 'once') return { ...t, completedAt: nowIso, history };
  const rest = { ...t };
  delete rest.scheduled;
  return { ...rest, dueDate: addInterval(doneDate, t.interval!), history };
}

export function completeSession(t: Task, eventId: string): Task {
  return { ...t, sessions: t.sessions?.map((s) => (s.eventId === eventId ? { ...s, status: 'done' } : s)) };
}

export function finishProject(t: Task, nowIso: string): Task {
  return { ...t, completedAt: nowIso };
}

export function activeBlocks(t: Task): Block[] {
  if (t.completedAt) return [];
  if (t.kind === 'project') {
    return (t.sessions ?? []).filter((s) => s.status === 'planned').map(({ eventId, start, end }) => ({ eventId, start, end }));
  }
  return t.scheduled ? [t.scheduled] : [];
}

export function projectStats(t: Task): { count: number; minutes: number } {
  const done = (t.sessions ?? []).filter((s) => s.status === 'done');
  const ms = done.reduce((sum, s) => sum + (new Date(s.end).getTime() - new Date(s.start).getTime()), 0);
  return { count: done.length, minutes: Math.round(ms / 60000) };
}

export function isOverdue(t: Task, today: string): boolean {
  return t.kind === 'recurring' && !t.scheduled && !!t.dueDate && t.dueDate < today;
}

export type TaskGroups = {
  dueSoon: Task[];
  ready: Task[];
  scheduled: Task[];
  projects: Task[];
  resting: Task[];
  history: Task[];
};

export function groupTasks(tasks: Task[], surfaceDaysBefore: number, today: string): TaskGroups {
  const g: TaskGroups = { dueSoon: [], ready: [], scheduled: [], projects: [], resting: [], history: [] };
  for (const t of tasks) {
    if (t.completedAt) g.history.push(t);
    else if (t.kind === 'project') g.projects.push(t);
    else if (t.scheduled) g.scheduled.push(t);
    else if (t.kind === 'recurring' && t.dueDate) {
      if (addDays(t.dueDate, -surfaceDaysBefore) > today) g.resting.push(t);
      else g.dueSoon.push(t);
    } else g.ready.push(t);
  }
  const byDue = (a: Task, b: Task) => a.dueDate!.localeCompare(b.dueDate!);
  g.dueSoon.sort(byDue);
  g.resting.sort(byDue);
  g.scheduled.sort((a, b) => a.scheduled!.start.localeCompare(b.scheduled!.start));
  g.history.sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
  return g;
}
```

- [ ] **Step 4: Kør test og se den bestå**

Run: `npx vitest run tests/domain/tasks.test.ts`
Expected: alle tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: opgavelogik for engangs-, tilbagevendende og store opgaver"
```

---

### Task 5: Ledige tidsrum

**Files:**
- Create: `src/domain/availability.ts`
- Test: `tests/domain/availability.test.ts`

- [ ] **Step 1: Skriv fejlende tests `tests/domain/availability.test.ts`**

```ts
import { describe, expect, test } from 'vitest';
import { isValidPlacement, overlaps, toBusinessHours, windowsForRange } from '../../src/domain/availability';
import { defaultSettings } from '../../src/domain/defaults';

const w = defaultSettings().windows; // man-fre 8-21, lør-søn 9-18
const at = (d: number, h: number, m = 0) => new Date(2026, 8, d, h, m); // september 2026; 28 = mandag

describe('windowsForRange', () => {
  test('giver ét tidsrum pr. dag med indstillinger', () => {
    const r = windowsForRange(w, at(26, 0), at(29, 0)); // lør, søn, man
    expect(r).toEqual([
      { start: at(26, 9), end: at(26, 18) },
      { start: at(27, 9), end: at(27, 18) },
      { start: at(28, 8), end: at(28, 21) },
    ]);
  });
  test('springer dage uden tid over', () => {
    const r = windowsForRange({ ...w, 1: null }, at(28, 0), at(29, 0));
    expect(r).toEqual([]);
  });
});

describe('overlaps', () => {
  test('berøring er ikke overlap', () => {
    expect(overlaps({ start: at(28, 8), end: at(28, 9) }, { start: at(28, 9), end: at(28, 10) })).toBe(false);
    expect(overlaps({ start: at(28, 8), end: at(28, 9, 30) }, { start: at(28, 9), end: at(28, 10) })).toBe(true);
  });
});

describe('isValidPlacement', () => {
  const busy = [{ start: at(28, 12), end: at(28, 13) }];
  test('inden for tidsrum og ikke optaget', () => {
    expect(isValidPlacement({ start: at(28, 10), end: at(28, 11) }, w, busy)).toBe(true);
    expect(isValidPlacement({ start: at(28, 13), end: at(28, 14) }, w, busy)).toBe(true);
  });
  test('overlapper optaget tid', () => {
    expect(isValidPlacement({ start: at(28, 11, 30), end: at(28, 12, 30) }, w, busy)).toBe(false);
  });
  test('uden for tidsrum', () => {
    expect(isValidPlacement({ start: at(28, 7), end: at(28, 8, 30) }, w, busy)).toBe(false);
    expect(isValidPlacement({ start: at(28, 20, 30), end: at(28, 21, 30) }, w, busy)).toBe(false);
    expect(isValidPlacement({ start: at(26, 8), end: at(26, 9) }, w, busy)).toBe(false);
  });
});

describe('toBusinessHours', () => {
  test('laver FullCalendar-format', () => {
    expect(toBusinessHours({ ...w, 2: null, 3: null, 4: null, 5: null, 6: null })).toEqual([
      { daysOfWeek: [0], startTime: '09:00', endTime: '18:00' },
      { daysOfWeek: [1], startTime: '08:00', endTime: '21:00' },
    ]);
  });
});
```

- [ ] **Step 2: Kør test og se den fejle**

Run: `npx vitest run tests/domain/availability.test.ts`
Expected: FAIL, modulet findes ikke.

- [ ] **Step 3: Opret `src/domain/availability.ts`**

```ts
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
```

- [ ] **Step 4: Kør test og se den bestå**

Run: `npx vitest run tests/domain/availability.test.ts`
Expected: alle tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: ledige tidsrum og placeringsvalidering"
```

---

### Task 6: Afstemning mod kalenderen

**Files:**
- Create: `src/domain/reconcile.ts`
- Test: `tests/domain/reconcile.test.ts`

- [ ] **Step 1: Skriv fejlende tests `tests/domain/reconcile.test.ts`**

```ts
import { expect, test } from 'vitest';
import { reconcile, type EventTimes } from '../../src/domain/reconcile';
import { addBlock, newTask } from '../../src/domain/tasks';

const NOW_ISO = '2026-09-28T10:00:00.000Z';
const now = new Date('2026-09-30T12:00:00.000Z');
const past = { start: '2026-09-29T14:00:00.000Z', end: '2026-09-29T15:00:00.000Z' };
const future = { start: '2026-10-01T14:00:00.000Z', end: '2026-10-01T15:00:00.000Z' };

const once = addBlock(newTask({ title: 'Ring', durationMin: 60, kind: 'once' }, 'o1', NOW_ISO), { eventId: 'e1', ...future });
const project = addBlock(
  addBlock(newTask({ title: 'Drivhus', durationMin: 60, kind: 'project' }, 'p1', NOW_ISO), { eventId: 'e2', ...past }),
  { eventId: 'e3', ...future },
);

test('ingen ændringer når begivenheder er uændrede og i fremtiden', () => {
  const events = new Map<string, EventTimes>([['e1', future], ['e2', future], ['e3', future]]);
  const p2 = { ...project, sessions: project.sessions!.map((s) => ({ ...s, ...future })) };
  const r = reconcile([once, p2], events, now);
  expect(r.tasks).toEqual([once, p2]);
  expect(r.questions).toEqual([]);
});

test('flyttet begivenhed opdaterer tidspunkt', () => {
  const moved = { start: '2026-10-02T08:00:00.000Z', end: '2026-10-02T09:00:00.000Z' };
  const r = reconcile([once], new Map([['e1', moved]]), now);
  expect(r.tasks[0].scheduled).toEqual({ eventId: 'e1', ...moved });
});

test('samme tidspunkt i anden tidszone-notation er ikke en flytning', () => {
  const same = { start: '2026-10-01T16:00:00+02:00', end: '2026-10-01T17:00:00+02:00' };
  const r = reconcile([once], new Map([['e1', same]]), now);
  expect(r.tasks[0]).toBe(once);
});

test('slettet begivenhed fjerner blokken', () => {
  const r = reconcile([once, project], new Map<string, EventTimes>([['e1', null], ['e2', null]]), now);
  expect(r.tasks[0].scheduled).toBeUndefined();
  expect(r.tasks[1].sessions!.map((s) => s.eventId)).toEqual(['e3']);
});

test('overstået begivenhed giver spørgsmål', () => {
  const pastOnce = addBlock(newTask({ title: 'Ring', durationMin: 60, kind: 'once' }, 'o2', NOW_ISO), { eventId: 'e9', ...past });
  const r = reconcile([pastOnce, project], new Map<string, EventTimes>([['e9', past], ['e2', past], ['e3', future]]), now);
  expect(r.questions).toEqual([
    { taskId: 'o2', eventId: 'e9', title: 'Ring', start: past.start, kind: 'task' },
    { taskId: 'p1', eventId: 'e2', title: 'Drivhus', start: past.start, kind: 'session' },
  ]);
});

test('begivenheder der ikke er hentet, ignoreres', () => {
  const r = reconcile([once], new Map(), now);
  expect(r.tasks[0]).toBe(once);
  expect(r.questions).toEqual([]);
});
```

- [ ] **Step 2: Kør test og se den fejle**

Run: `npx vitest run tests/domain/reconcile.test.ts`
Expected: FAIL, modulet findes ikke.

- [ ] **Step 3: Opret `src/domain/reconcile.ts`**

```ts
import { activeBlocks, moveBlock, removeBlock } from './tasks';
import type { Task } from './types';

export type EventTimes = { start: string; end: string } | null; // null = slettet
export type Question = { taskId: string; eventId: string; title: string; start: string; kind: 'task' | 'session' };

const sameTime = (a: string, b: string) => new Date(a).getTime() === new Date(b).getTime();

export function reconcile(tasks: Task[], events: Map<string, EventTimes>, now: Date): { tasks: Task[]; questions: Question[] } {
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
      if (new Date(ev.end) < now) {
        questions.push({ taskId: t.id, eventId: b.eventId, title: t.title, start: new Date(ev.start).toISOString(), kind: t.kind === 'project' ? 'session' : 'task' });
      }
    }
    return t;
  });
  return { tasks: out, questions };
}
```

- [ ] **Step 4: Kør test og se den bestå**

Run: `npx vitest run tests/domain/reconcile.test.ts`
Expected: alle tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: afstemning af opgaver mod kalenderbegivenheder"
```

---

### Task 7: HTTP-lag med fejltyper

**Files:**
- Create: `src/google/http.ts`
- Test: `tests/google/http.test.ts`

- [ ] **Step 1: Skriv fejlende tests `tests/google/http.test.ts`**

```ts
import { afterEach, expect, test, vi } from 'vitest';
import { ApiError, AuthError, ConflictError, OfflineError, gfetch, isNotFound, setTokenProvider } from '../../src/google/http';

afterEach(() => vi.unstubAllGlobals());

test('sender bearer-token', async () => {
  setTokenProvider(() => 'tok');
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  await gfetch('https://x', { headers: { 'Content-Type': 'application/json' } });
  expect(fetchMock.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tok' });
});

test('uden token kastes AuthError', async () => {
  setTokenProvider(() => null);
  await expect(gfetch('https://x')).rejects.toBeInstanceOf(AuthError);
});

test('fejlkoder oversættes', async () => {
  setTokenProvider(() => 'tok');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('', { status: 401 })));
  await expect(gfetch('https://x')).rejects.toBeInstanceOf(AuthError);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('', { status: 412 })));
  await expect(gfetch('https://x')).rejects.toBeInstanceOf(ConflictError);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('nope', { status: 404 })));
  const err = await gfetch('https://x').catch((e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(isNotFound(err)).toBe(true);
});

test('netværksfejl bliver OfflineError', async () => {
  setTokenProvider(() => 'tok');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  await expect(gfetch('https://x')).rejects.toBeInstanceOf(OfflineError);
});
```

- [ ] **Step 2: Kør test og se den fejle**

Run: `npx vitest run tests/google/http.test.ts`
Expected: FAIL, modulet findes ikke.

- [ ] **Step 3: Opret `src/google/http.ts`**

```ts
export class AuthError extends Error {}
export class OfflineError extends Error {}
export class ConflictError extends Error {}
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function isNotFound(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 404 || e.status === 410);
}

let tokenProvider: () => string | null = () => null;

export function setTokenProvider(fn: () => string | null): void {
  tokenProvider = fn;
}

export async function gfetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = tokenProvider();
  if (!token) throw new AuthError('Ikke logget ind');
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` } });
  } catch {
    throw new OfflineError('Ingen forbindelse');
  }
  if (res.status === 401) throw new AuthError('Login udløbet');
  if (res.status === 412) throw new ConflictError('Filen er ændret et andet sted');
  if (!res.ok) throw new ApiError(res.status, `Google svarede ${res.status}: ${await res.text()}`);
  return res;
}
```

- [ ] **Step 4: Kør test og se den bestå**

Run: `npx vitest run tests/google/http.test.ts`
Expected: alle tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: http-lag til Google med fejltyper"
```

---

### Task 8: Drive-lager og testfakes

**Files:**
- Create: `src/google/drive.ts`, `tests/fakes.ts`

Drive-implementationen taler med det rigtige API og testes manuelt i Task 20. Her defineres interfacet og en fake, som bruges i tests af `Store` og `actions`.

- [ ] **Step 1: Opret `src/google/drive.ts`**

```ts
import type { AppData } from '../domain/types';
import { ConflictError, gfetch } from './http';

export type DriveLoad = { data: AppData | null; fileId: string | null; version: string | null };
export type DriveSaved = { fileId: string; version: string };

export interface DriveApi {
  load(): Promise<DriveLoad>;
  /** Kaster ConflictError hvis filen er ændret siden `version`. */
  save(data: AppData, fileId: string | null, version: string | null): Promise<DriveSaved>;
}

const FILE = 'data.json';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

export function createDrive(): DriveApi {
  return {
    async load() {
      const q = encodeURIComponent(`name='${FILE}'`);
      const list = await (await gfetch(`${API}?spaces=appDataFolder&q=${q}&fields=files(id,version)`)).json();
      const f = list.files?.[0];
      if (!f) return { data: null, fileId: null, version: null };
      const data = (await (await gfetch(`${API}/${f.id}?alt=media`)).json()) as AppData;
      return { data, fileId: f.id, version: String(f.version) };
    },
    async save(data, fileId, version) {
      const body = JSON.stringify(data);
      let res: Response;
      if (!fileId) {
        const boundary = 'opgaveapp' + Math.random().toString(36).slice(2);
        const meta = JSON.stringify({ name: FILE, parents: ['appDataFolder'] });
        const multipart =
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
          `--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
        res = await gfetch(`${UPLOAD}?uploadType=multipart&fields=id,version`, {
          method: 'POST',
          headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
          body: multipart,
        });
      } else {
        const current = await (await gfetch(`${API}/${fileId}?fields=version`)).json();
        if (String(current.version) !== version) throw new ConflictError('Filen er ændret et andet sted');
        res = await gfetch(`${UPLOAD}/${fileId}?uploadType=media&fields=id,version`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
      }
      const j = await res.json();
      return { fileId: j.id, version: String(j.version) };
    },
  };
}
```

- [ ] **Step 2: Opret `tests/fakes.ts` (kun Drive-delen nu; kalenderdelen tilføjes i Task 10)**

```ts
import type { AppData } from '../src/domain/types';
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
```

- [ ] **Step 3: Typetjek**

Run: `npm run typecheck`
Expected: ingen fejl.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: Drive-lager i appDataFolder og testfake"
```

---

### Task 9: Store

**Files:**
- Create: `src/store.ts`
- Test: `tests/store.test.ts`

- [ ] **Step 1: Skriv fejlende tests `tests/store.test.ts`**

```ts
import { expect, test } from 'vitest';
import { defaultData } from '../src/domain/defaults';
import { newTask } from '../src/domain/tasks';
import type { AppData } from '../src/domain/types';
import { OfflineError } from '../src/google/http';
import { Store } from '../src/store';
import { FakeDrive, memoryStorage } from './fakes';

const addTask = (id: string) => (d: AppData): AppData => ({
  ...d,
  tasks: [...d.tasks, newTask({ title: id, durationMin: 30, kind: 'once' }, id, '2026-09-28T10:00:00.000Z')],
});

test('starter med standarddata og gemmer i Drive ved første sync', async () => {
  const drive = new FakeDrive();
  const store = new Store(drive, memoryStorage());
  expect(store.data).toEqual(defaultData());
  await store.sync();
  expect(drive.data).toEqual(defaultData());
});

test('sync henter data fra Drive og cacher lokalt', async () => {
  const drive = new FakeDrive();
  drive.data = addTask('a')(defaultData());
  const storage = memoryStorage();
  const store = new Store(drive, storage);
  await store.sync();
  expect(store.data.tasks.map((t) => t.id)).toEqual(['a']);
  expect(new Store(drive, storage).data.tasks.map((t) => t.id)).toEqual(['a']);
});

test('update gemmer og giver besked til lyttere', async () => {
  const drive = new FakeDrive();
  const store = new Store(drive, memoryStorage());
  await store.sync();
  let calls = 0;
  store.subscribe(() => calls++);
  await store.update(addTask('a'));
  expect(drive.data!.tasks.map((t) => t.id)).toEqual(['a']);
  expect(calls).toBeGreaterThan(0);
});

test('versionskonflikt: henter nyeste og anvender ændringen igen', async () => {
  const drive = new FakeDrive();
  const store = new Store(drive, memoryStorage());
  await store.sync();
  drive.externalChange(addTask('fra-anden-enhed'));
  await store.update(addTask('lokal'));
  expect(drive.data!.tasks.map((t) => t.id)).toEqual(['fra-anden-enhed', 'lokal']);
  expect(store.data.tasks.map((t) => t.id)).toEqual(['fra-anden-enhed', 'lokal']);
});

test('updates køres i rækkefølge', async () => {
  const drive = new FakeDrive();
  const store = new Store(drive, memoryStorage());
  await store.sync();
  await Promise.all([store.update(addTask('a')), store.update(addTask('b'))]);
  expect(drive.data!.tasks.map((t) => t.id)).toEqual(['a', 'b']);
});

test('fejl ved gem kastes videre og blokerer ikke næste update', async () => {
  const drive = new FakeDrive();
  const store = new Store(drive, memoryStorage());
  await store.sync();
  drive.offline = true;
  await expect(store.update(addTask('a'))).rejects.toBeInstanceOf(OfflineError);
  drive.offline = false;
  await store.update(addTask('b'));
  expect(drive.data!.tasks.map((t) => t.id)).toEqual(['a', 'b']);
});
```

- [ ] **Step 2: Kør test og se den fejle**

Run: `npx vitest run tests/store.test.ts`
Expected: FAIL, modulet findes ikke.

- [ ] **Step 3: Opret `src/store.ts`**

```ts
import { defaultData } from './domain/defaults';
import type { AppData } from './domain/types';
import type { DriveApi } from './google/drive';
import { ConflictError } from './google/http';

const KEY = 'opgave-app:data';
type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export class Store {
  data: AppData;
  private fileId: string | null = null;
  private version: string | null = null;
  private listeners = new Set<() => void>();
  private queue: Promise<void> = Promise.resolve();

  constructor(private drive: DriveApi, private storage: KV) {
    const raw = storage.getItem(KEY);
    this.data = raw ? (JSON.parse(raw) as AppData) : defaultData();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(d: AppData): void {
    this.data = d;
    this.storage.setItem(KEY, JSON.stringify(d));
    this.listeners.forEach((fn) => fn());
  }

  sync(): Promise<void> {
    return this.enqueue(async () => {
      const remote = await this.drive.load();
      this.fileId = remote.fileId;
      this.version = remote.version;
      if (remote.data) this.set(remote.data);
      else await this.persist();
    });
  }

  update(fn: (d: AppData) => AppData): Promise<void> {
    return this.enqueue(async () => {
      this.set(fn(this.data));
      for (let attempt = 0; ; attempt++) {
        try {
          await this.persist();
          return;
        } catch (e) {
          if (!(e instanceof ConflictError) || attempt >= 2) throw e;
          const remote = await this.drive.load();
          this.fileId = remote.fileId;
          this.version = remote.version;
          this.set(fn(remote.data ?? defaultData()));
        }
      }
    });
  }

  clearLocal(): void {
    this.storage.removeItem(KEY);
  }

  private async persist(): Promise<void> {
    const saved = await this.drive.save(this.data, this.fileId, this.version);
    this.fileId = saved.fileId;
    this.version = saved.version;
  }

  private enqueue(job: () => Promise<void>): Promise<void> {
    const p = this.queue.then(job);
    this.queue = p.catch(() => {});
    return p;
  }
}
```

- [ ] **Step 4: Kør test og se den bestå**

Run: `npx vitest run tests/store.test.ts`
Expected: alle tests PASS.

Bemærk testen "fejl ved gem": efter den fejlede `update` er `a` stadig i `store.data` (lokalt), så `b` lægges oven på, og begge gemmes. Det er forventet.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: store med lokal cache og Drive-synkronisering"
```

---

### Task 10: Kalender-API og kalender-fake

**Files:**
- Create: `src/google/calendar.ts`
- Modify: `tests/fakes.ts` (tilføj `FakeCalendar`)

- [ ] **Step 1: Opret `src/google/calendar.ts`**

```ts
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
```

- [ ] **Step 2: Tilføj `FakeCalendar` nederst i `tests/fakes.ts`**

Tilføj importen øverst i filen:
```ts
import type { BusyPeriod, CalEvent, CalendarApi, NewEvent } from '../src/google/calendar';
```

Tilføj nederst:
```ts
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
```

- [ ] **Step 3: Typetjek og kør alle tests**

Run: `npm run typecheck && npm test`
Expected: ingen typefejl, alle tests PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: Google Calendar-API og kalender-fake"
```

---

### Task 11: Actions (orkestrering)

**Files:**
- Create: `src/actions.ts`
- Test: `tests/actions.test.ts`

- [ ] **Step 1: Skriv fejlende tests `tests/actions.test.ts`**

```ts
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
  test('loadRange henter optaget tid fra andre kalendere og opgaveblokke', async () => {
    cal.busy = [{ start: new Date(2026, 8, 29, 12).toISOString(), end: new Date(2026, 8, 29, 13).toISOString() }];
    await actions.createTask({ title: 'A', durationMin: 60, kind: 'once' });
    await actions.schedule('t1', new Date(2026, 8, 29, 14), new Date(2026, 8, 29, 15));
    const r = await actions.loadRange(new Date(2026, 8, 28), new Date(2026, 9, 1));
    expect(r.busy).toEqual([{ start: new Date(2026, 8, 29, 12), end: new Date(2026, 8, 29, 13) }]);
    expect(r.taskEvents.map((e) => e.taskId)).toEqual(['t1']);
  });
});
```

- [ ] **Step 2: Kør test og se den fejle**

Run: `npx vitest run tests/actions.test.ts`
Expected: FAIL, modulet findes ikke.

- [ ] **Step 3: Opret `src/actions.ts`**

```ts
import type { Span } from './domain/availability';
import { nextSunday, toDateStr } from './domain/dates';
import { reconcile, type EventTimes, type Question } from './domain/reconcile';
import {
  activeBlocks, addBlock, completeSession, completeTask, editTask, finishProject, moveBlock, newTask, removeBlock,
} from './domain/tasks';
import type { AppData, Settings, Task, TaskInput } from './domain/types';
import type { CalEvent, CalendarApi } from './google/calendar';
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
      const previousTime = store.data.settings.sundayReminderTime;
      await setSettings(patch);
      const s = store.data.settings;
      if (s.sundayReminderTime !== previousTime) {
        const id = await calendar.upsertReminder(
          calId(), s.reminderEventId, nextSunday(deps.now(), s.sundayReminderTime), deps.appUrl, deps.timeZone,
        );
        if (id !== s.reminderEventId) await setSettings({ reminderEventId: id });
      }
    },

    async loadRange(from: Date, to: Date): Promise<{ busy: Span[]; taskEvents: CalEvent[] }> {
      requireOnline();
      const own = calId();
      const others = (await calendar.listCalendarIds()).filter((id) => id !== own);
      const [busy, taskEvents] = await Promise.all([
        calendar.freeBusy(others, from.toISOString(), to.toISOString()),
        calendar.listTaskEvents(own, from.toISOString(), to.toISOString()),
      ]);
      return { busy: busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) })), taskEvents };
    },
  };
}

export type Actions = ReturnType<typeof createActions>;
```

- [ ] **Step 4: Kør test og se den bestå**

Run: `npx vitest run tests/actions.test.ts`
Expected: alle tests PASS.

- [ ] **Step 5: Kør alle tests og typetjek**

Run: `npm test && npm run typecheck`
Expected: alt PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: actions der binder kalender og store sammen"
```

---

### Task 12: Konfiguration og Google-login

**Files:**
- Create: `src/config.ts`, `src/google/auth.ts`

Login kræver en rigtig browser og Google-konto og testes manuelt i Task 20.

- [ ] **Step 1: Opret `src/config.ts`**

```ts
export const CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
export const APP_URL: string = import.meta.env.VITE_APP_URL ?? location.origin + import.meta.env.BASE_URL;
```

- [ ] **Step 2: Opret `src/google/auth.ts`**

```ts
import { CLIENT_ID } from '../config';
import { setTokenProvider } from './http';

const SCOPES = ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/drive.appdata'];
const KEY = 'opgave-app:token';

type Saved = { token: string; expiresAt: number };
type TokenResponse = { access_token: string; expires_in: number; error?: string };

// Minimal typning af Google Identity Services.
declare const google: {
  accounts: {
    oauth2: {
      initTokenClient(cfg: {
        client_id: string;
        scope: string;
        callback: (r: TokenResponse) => void;
        error_callback?: (e: { type: string }) => void;
      }): { requestAccessToken(o?: { prompt?: string }): void };
      hasGrantedAllScopes(r: TokenResponse, ...scopes: string[]): boolean;
      revoke(token: string, done: () => void): void;
    };
  };
};

function read(): Saved | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null;
    return s && s.expiresAt > Date.now() + 60_000 ? s : null;
  } catch {
    return null;
  }
}

export function hasValidToken(): boolean {
  return read() !== null;
}

/** Har brugeren nogensinde været logget ind på denne enhed? */
export function wasSignedIn(): boolean {
  return localStorage.getItem(KEY) !== null;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Kunne ikke hente Google-login'));
    document.head.append(s);
  });
}

export async function initAuth(): Promise<void> {
  setTokenProvider(() => read()?.token ?? null);
  await loadScript('https://accounts.google.com/gsi/client');
}

/** Skal kaldes fra et klik (ellers blokerer browseren popup'en). */
export function signIn(): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES.join(' '),
      callback: (r) => {
        if (r.error) return reject(new Error(r.error));
        if (!google.accounts.oauth2.hasGrantedAllScopes(r, ...SCOPES)) {
          return reject(new Error('Appen skal have adgang til både Kalender og Drive'));
        }
        localStorage.setItem(KEY, JSON.stringify({ token: r.access_token, expiresAt: Date.now() + r.expires_in * 1000 }));
        resolve();
      },
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'Login blev afbrudt' : e.type)),
    });
    client.requestAccessToken({ prompt: wasSignedIn() ? '' : 'consent' });
  });
}

export function signOut(): void {
  const s = read();
  if (s) google.accounts.oauth2.revoke(s.token, () => {});
  localStorage.removeItem(KEY);
}
```

- [ ] **Step 3: Typetjek**

Run: `npm run typecheck`
Expected: ingen fejl.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: konfiguration og Google-login"
```

---

### Task 13: UI-hjælpere og danske formater

**Files:**
- Create: `src/ui/dom.ts`, `src/ui/sheet.ts`, `src/ui/format.ts`, `src/ui/context.ts`
- Test: `tests/ui/format.test.ts`

- [ ] **Step 1: Skriv fejlende tests `tests/ui/format.test.ts`**

```ts
import { expect, test } from 'vitest';
import { addBlock, completeSession, newTask } from '../../src/domain/tasks';
import { formatDate, formatDateTime, formatDuration, formatInterval, taskMeta } from '../../src/ui/format';

test('formatDuration', () => {
  expect(formatDuration(15)).toBe('15 min');
  expect(formatDuration(60)).toBe('1 t');
  expect(formatDuration(90)).toBe('1 t 30 min');
});

test('formatDate og formatDateTime', () => {
  expect(formatDate('2026-10-05')).toBe('man 5. okt');
  expect(formatDateTime(new Date(2026, 9, 4, 18, 5).toISOString())).toBe('søn 4. okt kl. 18:05');
});

test('formatInterval', () => {
  expect(formatInterval({ count: 1, unit: 'week' })).toBe('hver uge');
  expect(formatInterval({ count: 3, unit: 'week' })).toBe('hver 3. uge');
  expect(formatInterval({ count: 6, unit: 'month' })).toBe('hver 6. måned');
});

test('taskMeta', () => {
  const now = '2026-09-28T10:00:00.000Z';
  const car = { ...newTask({ title: 'Bil', durationMin: 60, kind: 'recurring', interval: { count: 3, unit: 'week' } }, 'r', now), dueDate: '2026-09-27' };
  expect(taskMeta(car, '2026-09-28')).toBe('1 t · hver 3. uge · forsinket, skulle være gjort søn 27. sep');
  expect(taskMeta({ ...car, dueDate: '2026-10-05' }, '2026-09-28')).toBe('1 t · hver 3. uge · forfalder man 5. okt');
  const planned = addBlock(newTask({ title: 'A', durationMin: 30, kind: 'once' }, 'o', now), {
    eventId: 'e', start: new Date(2026, 8, 29, 14).toISOString(), end: new Date(2026, 8, 29, 14, 30).toISOString(),
  });
  expect(taskMeta(planned, '2026-09-28')).toBe('30 min · planlagt tir 29. sep kl. 14:00');
  let p = addBlock(newTask({ title: 'D', durationMin: 180, kind: 'project' }, 'p', now), {
    eventId: 'e', start: new Date(2026, 8, 26, 9).toISOString(), end: new Date(2026, 8, 26, 12).toISOString(),
  });
  p = completeSession(p, 'e');
  expect(taskMeta(p, '2026-09-28')).toBe('3 t pr. gang · 1 blok · 3 t i alt');
});
```

- [ ] **Step 2: Kør test og se den fejle**

Run: `npx vitest run tests/ui/format.test.ts`
Expected: FAIL, modulet findes ikke.

- [ ] **Step 3: Opret `src/ui/format.ts`**

```ts
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
```

Bemærk: `formatDuration(0)` giver `"0 min"`, hvilket er fint for en stor opgave uden færdige blokke.

- [ ] **Step 4: Kør test og se den bestå**

Run: `npx vitest run tests/ui/format.test.ts`
Expected: alle tests PASS.

- [ ] **Step 5: Opret `src/ui/dom.ts`**

```ts
type AttrValue = string | number | boolean | undefined | ((e: Event) => void);
type Child = Node | string | null | undefined | false;

/** Lille hjælper til at bygge DOM: h('button', { class: 'btn', onclick: fn }, 'Tekst'). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, AttrValue> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}
```

- [ ] **Step 6: Opret `src/ui/sheet.ts`**

```ts
import { h } from './dom';

export type SheetOption<T> = { label: string; value: T; kind?: 'primary' | 'danger' };

/** Viser et bundark. Resolver med den valgte værdi, eller null hvis brugeren trykker udenfor. */
export function ask<T>(title: string, body: Node | null, options: SheetOption<T>[]): Promise<T | null> {
  return new Promise((resolve) => {
    const close = (v: T | null) => {
      overlay.remove();
      resolve(v);
    };
    const overlay = h(
      'div',
      { class: 'overlay', onclick: (e: Event) => { if (e.target === overlay) close(null); } },
      h(
        'div',
        { class: 'sheet' },
        h('h3', {}, title),
        body,
        h('div', { class: 'sheet-buttons' }, ...options.map((o) => h('button', { class: `btn ${o.kind ?? ''}`, onclick: () => close(o.value) }, o.label))),
      ),
    );
    document.body.append(overlay);
  });
}

export function toast(message: string): void {
  const el = h('div', { class: 'toast' }, message);
  document.body.append(el);
  setTimeout(() => el.remove(), 3500);
}
```

- [ ] **Step 7: Opret `src/ui/context.ts`**

```ts
import type { Actions } from '../actions';
import type { Store } from '../store';

export type Ctx = {
  store: Store;
  actions: Actions;
  /** Kører fn og viser fejl pænt. Returnerer undefined hvis fn fejlede. */
  guard: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  today: () => string;
  signOut: () => void;
};
```

- [ ] **Step 8: Typetjek og alle tests**

Run: `npm run typecheck && npm test`
Expected: alt PASS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: UI-hjælpere og danske formater"
```

---

### Task 14: Opgaveformular og opgaveliste

**Files:**
- Create: `src/ui/taskForm.ts`, `src/ui/tasks.ts`

UI testes manuelt i Task 20. Hver fil skal typetjekke.

- [ ] **Step 1: Opret `src/ui/taskForm.ts`**

```ts
import type { Interval, Task, TaskInput, TaskKind } from '../domain/types';
import type { Ctx } from './context';
import { h } from './dom';
import { ask, toast } from './sheet';

const PRESETS = [15, 30, 45, 60, 90, 120, 180];

/** Åbner formularen. Uden `existing` oprettes en ny opgave. */
export async function openTaskForm(ctx: Ctx, existing?: Task): Promise<void> {
  const title = h('input', { type: 'text', placeholder: 'F.eks. Vask bil', value: existing?.title ?? '' });
  const duration = h('input', { type: 'number', min: 5, step: 5, value: existing?.durationMin ?? 60 });
  const presets = h(
    'div',
    { class: 'chips' },
    ...PRESETS.map((m) =>
      h('button', { type: 'button', class: 'chip', onclick: () => { duration.value = String(m); } }, m < 60 ? `${m} min` : `${m / 60} t`),
    ),
  );
  const kind = h(
    'select',
    { disabled: !!existing },
    h('option', { value: 'once' }, 'Engang'),
    h('option', { value: 'recurring' }, 'Tilbagevendende'),
    h('option', { value: 'project' }, 'Stor opgave'),
  );
  kind.value = existing?.kind ?? 'once';
  const count = h('input', { type: 'number', min: 1, value: existing?.interval?.count ?? 3 });
  const unit = h(
    'select',
    {},
    h('option', { value: 'day' }, 'dage'),
    h('option', { value: 'week' }, 'uger'),
    h('option', { value: 'month' }, 'måneder'),
  );
  unit.value = existing?.interval?.unit ?? 'week';
  const intervalRow = h('label', {}, 'Gentag', h('div', { class: 'row' }, count, unit), h('small', {}, 'efter opgaven er løst'));
  const note = h('textarea', { rows: 2, placeholder: 'Note (valgfri)' }, existing?.note ?? '');
  const syncInterval = () => { intervalRow.hidden = kind.value !== 'recurring'; };
  kind.addEventListener('change', syncInterval);
  syncInterval();

  const body = h(
    'div',
    { class: 'form' },
    h('label', {}, 'Navn', title),
    h('label', {}, 'Ca. varighed (minutter)', duration, presets),
    h('label', {}, 'Type', kind),
    intervalRow,
    h('label', {}, 'Note', note),
  );

  const choice = await ask(existing ? 'Rediger opgave' : 'Ny opgave', body, [
    { label: 'Gem', value: 'save' as const, kind: 'primary' },
    { label: 'Annuller', value: 'cancel' as const },
  ]);
  if (choice !== 'save') return;

  const minutes = Number(duration.value);
  if (!title.value.trim() || !(minutes > 0)) {
    toast('Opgaven skal have et navn og en varighed');
    return;
  }
  const input: TaskInput = {
    title: title.value,
    durationMin: minutes,
    kind: kind.value as TaskKind,
    note: note.value,
    interval: kind.value === 'recurring' ? ({ count: Math.max(1, Number(count.value)), unit: unit.value } as Interval) : undefined,
  };
  await ctx.guard(() => (existing ? ctx.actions.editTask(existing.id, input) : ctx.actions.createTask(input)));
}
```

- [ ] **Step 2: Opret `src/ui/tasks.ts`**

```ts
import { activeBlocks, groupTasks, isOverdue } from '../domain/tasks';
import type { Task } from '../domain/types';
import type { Ctx } from './context';
import { h } from './dom';
import { taskMeta } from './format';
import { ask } from './sheet';
import { openTaskForm } from './taskForm';

export async function openTaskActions(ctx: Ctx, t: Task): Promise<void> {
  type A = 'edit' | 'done' | 'finish' | 'delete';
  const options: { label: string; value: A; kind?: 'primary' | 'danger' }[] = [];
  if (!t.completedAt && t.kind !== 'project') options.push({ label: 'Færdig', value: 'done', kind: 'primary' });
  if (!t.completedAt && t.kind === 'project') options.push({ label: 'Afslut projekt', value: 'finish', kind: 'primary' });
  if (!t.completedAt) options.push({ label: 'Rediger', value: 'edit' });
  options.push({ label: 'Slet', value: 'delete', kind: 'danger' });

  const choice = await ask(t.title, h('p', { class: 'muted' }, taskMeta(t, ctx.today())), options);
  if (choice === 'done') await ctx.guard(() => ctx.actions.markDone(t.id));
  if (choice === 'finish') await ctx.guard(() => ctx.actions.finishProject(t.id));
  if (choice === 'edit') await openTaskForm(ctx, t);
  if (choice === 'delete') {
    let deleteEvents = false;
    if (activeBlocks(t).length > 0) {
      const r = await ask('Opgaven ligger i kalenderen', h('p', {}, 'Skal kalenderbegivenhederne også slettes?'), [
        { label: 'Ja, slet dem', value: true, kind: 'danger' },
        { label: 'Nej, behold dem', value: false },
      ]);
      if (r === null) return;
      deleteEvents = r;
    }
    await ctx.guard(() => ctx.actions.deleteTask(t.id, deleteEvents));
  }
}

export function taskItem(ctx: Ctx, t: Task): HTMLElement {
  return h(
    'div',
    {
      class: `task-item${isOverdue(t, ctx.today()) ? ' overdue' : ''}`,
      'data-task-id': t.id,
      'data-title': t.title,
      'data-duration': t.durationMin,
      onclick: () => openTaskActions(ctx, t),
    },
    h('div', { class: 'task-title' }, t.kind === 'project' ? `🔨 ${t.title}` : t.title),
    h('div', { class: 'task-meta' }, taskMeta(t, ctx.today())),
  );
}

export function mountTasks(ctx: Ctx, root: HTMLElement): () => void {
  const list = h('div', { class: 'task-list' });
  const fab = h('button', { class: 'fab', 'aria-label': 'Ny opgave', onclick: () => openTaskForm(ctx) }, '+');
  root.append(list, fab);

  const section = (title: string, tasks: Task[], collapsed = false): HTMLElement | null => {
    if (tasks.length === 0) return null;
    const items = tasks.map((t) => taskItem(ctx, t));
    if (!collapsed) return h('section', {}, h('h2', {}, title), ...items);
    return h('details', {}, h('summary', {}, `${title} (${tasks.length})`), ...items);
  };

  const render = () => {
    const g = groupTasks(ctx.store.data.tasks, ctx.store.data.settings.surfaceDaysBefore, ctx.today());
    const sections = [
      section('Forfalder snart', g.dueSoon),
      section('Klar', g.ready),
      section('Planlagt', g.scheduled),
      section('Store opgaver', g.projects),
      section('Hviler', g.resting, true),
      section('Historik', g.history, true),
    ].filter((s): s is HTMLElement => s !== null);
    list.replaceChildren(...(sections.length ? sections : [h('p', { class: 'empty' }, 'Ingen opgaver endnu. Tryk + for at oprette en.')]));
  };
  render();
  return ctx.store.subscribe(render);
}
```

- [ ] **Step 3: Typetjek**

Run: `npm run typecheck`
Expected: ingen fejl.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: opgaveliste og opgaveformular"
```

---

### Task 15: Planlæg-skærm med FullCalendar

**Files:**
- Create: `src/ui/plan.ts`

- [ ] **Step 1: Opret `src/ui/plan.ts`**

```ts
import { Calendar, type EventApi, type EventInput } from '@fullcalendar/core';
import daLocale from '@fullcalendar/core/locales/da';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import { isValidPlacement, toBusinessHours, type Span } from '../domain/availability';
import { activeBlocks, groupTasks } from '../domain/tasks';
import type { CalEvent } from '../google/calendar';
import type { Ctx } from './context';
import { h } from './dom';
import { ask, toast } from './sheet';
import { openTaskForm } from './taskForm';
import { taskItem } from './tasks';

export function mountPlan(ctx: Ctx, root: HTMLElement): () => void {
  const calEl = h('div', { class: 'cal' });
  const drawerList = h('div', { class: 'drawer-list' });
  const drawer = h(
    'div',
    { class: 'drawer' },
    h('button', { class: 'drawer-handle', onclick: () => drawer.classList.toggle('open') }, 'Opgaver – hold og træk op i kalenderen'),
    drawerList,
  );
  root.append(calEl, drawer);

  let busy: Span[] = [];
  let taskEvents: CalEvent[] = [];
  const settings = () => ctx.store.data.settings;
  const findTask = (id: string) => ctx.store.data.tasks.find((t) => t.id === id);

  const occupied = (exceptEventId?: string): Span[] => [
    ...busy,
    ...taskEvents.filter((e) => e.id !== exceptEventId).map((e) => ({ start: new Date(e.start), end: new Date(e.end) })),
  ];
  const allowed = (start: Date, end: Date, exceptEventId?: string) =>
    isValidPlacement({ start, end }, settings().windows, occupied(exceptEventId));

  const toEvents = (): EventInput[] => {
    const active = new Set(ctx.store.data.tasks.flatMap(activeBlocks).map((b) => b.eventId));
    return [
      ...busy.map((b) => ({ start: b.start, end: b.end, display: 'background', classNames: ['busy'] })),
      ...taskEvents.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        editable: active.has(e.id),
        classNames: active.has(e.id) ? ['task-block'] : ['task-block', 'done'],
        extendedProps: { taskId: e.taskId, active: active.has(e.id) },
      })),
    ];
  };

  const calendar = new Calendar(calEl, {
    plugins: [timeGridPlugin, interactionPlugin],
    locale: daLocale,
    initialView: 'timeGrid3',
    views: { timeGrid3: { type: 'timeGrid', duration: { days: 3 }, buttonText: '3 dage' } },
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGrid3,timeGridWeek' },
    firstDay: 1,
    slotMinTime: '06:00:00',
    slotMaxTime: '23:00:00',
    slotDuration: '00:30:00',
    snapDuration: '00:15:00',
    allDaySlot: false,
    height: '100%',
    nowIndicator: true,
    longPressDelay: 300,
    eventLongPressDelay: 300,
    businessHours: toBusinessHours(settings().windows),
    editable: true,
    droppable: true,
    eventAllow: (span, moving) => allowed(span.start, span.end, moving?.id || undefined),
    events: (info, success) => {
      ctx
        .guard(async () => {
          const r = await ctx.actions.loadRange(info.start, info.end);
          busy = r.busy;
          taskEvents = r.taskEvents;
          return true;
        })
        .then(() => success(toEvents()));
    },
    drop: (info) => {
      const t = findTask(info.draggedEl.dataset.taskId ?? '');
      if (!t) return;
      const end = new Date(info.date.getTime() + t.durationMin * 60000);
      if (!allowed(info.date, end)) {
        toast('Der er ikke plads her');
        return;
      }
      ctx.guard(() => ctx.actions.schedule(t.id, info.date, end)).then(() => calendar.refetchEvents());
    },
    eventDrop: (info) => onChanged(info.event, info.revert),
    eventResize: (info) => onChanged(info.event, info.revert),
    eventClick: (info) => openBlock(info.event),
  });

  function onChanged(ev: EventApi, revert: () => void) {
    const taskId = ev.extendedProps.taskId as string;
    ctx.guard(async () => {
      await ctx.actions.move(taskId, ev.id, ev.start!, ev.end!);
      return true;
    }).then((ok) => {
      if (!ok) revert();
      calendar.refetchEvents();
    });
  }

  async function openBlock(ev: EventApi) {
    if (ev.display === 'background') return;
    const t = findTask(ev.extendedProps.taskId as string);
    if (!t) return;
    if (!ev.extendedProps.active) {
      toast('Denne blok er afsluttet');
      return;
    }
    const choice = await ask(t.title, null, [
      { label: t.kind === 'project' ? 'Færdig med denne blok' : 'Færdig', value: 'done' as const, kind: 'primary' },
      { label: 'Fjern fra kalender', value: 'remove' as const, kind: 'danger' },
      { label: 'Rediger opgave', value: 'edit' as const },
    ]);
    if (choice === 'done') {
      await ctx.guard(() => (t.kind === 'project' ? ctx.actions.markSessionDone(t.id, ev.id) : ctx.actions.markDone(t.id)));
    }
    if (choice === 'remove') await ctx.guard(() => ctx.actions.unschedule(t.id, ev.id));
    if (choice === 'edit') await openTaskForm(ctx, t);
    calendar.refetchEvents();
  }

  const renderDrawer = () => {
    const g = groupTasks(ctx.store.data.tasks, settings().surfaceDaysBefore, ctx.today());
    const items = [...g.dueSoon, ...g.ready, ...g.projects].map((t) => taskItem(ctx, t));
    drawerList.replaceChildren(...(items.length ? items : [h('p', { class: 'empty' }, 'Ingen opgaver venter.')]));
  };

  const draggable = new Draggable(drawerList, {
    itemSelector: '.task-item',
    longPressDelay: 250,
    eventData: (el) => ({
      title: (el as HTMLElement).dataset.title,
      duration: { minutes: Number((el as HTMLElement).dataset.duration) },
      create: false,
    }),
  });

  renderDrawer();
  calendar.render();
  const unsubscribe = ctx.store.subscribe(() => {
    renderDrawer();
    calendar.setOption('businessHours', toBusinessHours(settings().windows));
  });

  return () => {
    unsubscribe();
    draggable.destroy();
    calendar.destroy();
  };
}
```

- [ ] **Step 2: Typetjek**

Run: `npm run typecheck`
Expected: ingen fejl. Hvis `daLocale`-importen ikke har typer, så brug `import daLocale from '@fullcalendar/core/locales/da.js';` (se `node_modules/@fullcalendar/core/locales/`).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: planlæg-skærm med træk-og-slip i kalenderen"
```

---

### Task 16: Indstillinger og "Blev det gjort?"-dialoger

**Files:**
- Create: `src/ui/settings.ts`, `src/ui/prompts.ts`

- [ ] **Step 1: Opret `src/ui/prompts.ts`**

```ts
import type { Question } from '../domain/reconcile';
import type { Ctx } from './context';
import { h } from './dom';
import { formatDateTime } from './format';
import { ask } from './sheet';

export async function runQuestions(ctx: Ctx, questions: Question[]): Promise<void> {
  for (const q of questions) {
    const text = q.kind === 'session'
      ? `Fik du arbejdet på «${q.title}» ${formatDateTime(q.start)}?`
      : `«${q.title}» var planlagt ${formatDateTime(q.start)}. Blev den gjort?`;
    const yes = await ask('Hvordan gik det?', h('p', {}, text), [
      { label: 'Ja', value: true, kind: 'primary' },
      { label: 'Nej', value: false },
    ]);
    if (yes === null) continue; // spørges igen næste gang
    await ctx.guard(() => ctx.actions.answer(q, yes));
  }
}
```

- [ ] **Step 2: Opret `src/ui/settings.ts`**

```ts
import type { Settings, Weekday } from '../domain/types';
import type { Ctx } from './context';
import { h } from './dom';
import { toast } from './sheet';

const DAYS: [Weekday, string][] = [[1, 'Mandag'], [2, 'Tirsdag'], [3, 'Onsdag'], [4, 'Torsdag'], [5, 'Fredag'], [6, 'Lørdag'], [0, 'Søndag']];

export function mountSettings(ctx: Ctx, root: HTMLElement): () => void {
  const s = ctx.store.data.settings;
  const rows = DAYS.map(([d, name]) => {
    const w = s.windows[d];
    const on = h('input', { type: 'checkbox', checked: !!w });
    const from = h('input', { type: 'time', value: w?.start ?? '09:00' });
    const to = h('input', { type: 'time', value: w?.end ?? '18:00' });
    const sync = () => { from.disabled = to.disabled = !on.checked; };
    on.addEventListener('change', sync);
    sync();
    return { d, on, from, to, el: h('div', { class: 'day-row' }, h('label', { class: 'check' }, on, name), from, '–', to) };
  });
  const reminder = h('input', { type: 'time', value: s.sundayReminderTime });
  const surface = h('input', { type: 'number', min: 0, max: 60, value: s.surfaceDaysBefore });

  const save = async () => {
    const windows = { ...s.windows };
    for (const r of rows) {
      if (r.on.checked && r.from.value >= r.to.value) {
        toast('Sluttid skal være efter starttid');
        return;
      }
      windows[r.d] = r.on.checked ? { start: r.from.value, end: r.to.value } : null;
    }
    const patch: Partial<Settings> = { windows, sundayReminderTime: reminder.value, surfaceDaysBefore: Math.max(0, Number(surface.value)) };
    const ok = await ctx.guard(async () => { await ctx.actions.updateSettings(patch); return true; });
    if (ok) toast('Gemt');
  };

  root.append(
    h(
      'div',
      { class: 'settings' },
      h('h2', {}, 'Ledige tidsrum'),
      h('p', { class: 'muted' }, 'Opgaver kan kun lægges inden for disse tidsrum.'),
      ...rows.map((r) => r.el),
      h('h2', {}, 'Søndagspåmindelse'),
      h('label', {}, 'Tidspunkt', reminder),
      h('h2', {}, 'Tilbagevendende opgaver'),
      h('label', {}, 'Vis dem på listen så mange dage før forfald', surface),
      h('button', { class: 'btn primary', onclick: save }, 'Gem indstillinger'),
      h('button', { class: 'btn danger', onclick: () => ctx.signOut() }, 'Log ud'),
    ),
  );
  return () => {};
}
```

- [ ] **Step 3: Typetjek**

Run: `npm run typecheck`
Expected: ingen fejl.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: indstillinger og opfølgningsspørgsmål"
```

---

### Task 17: App-skal, login, bannere og styling

**Files:**
- Create: `src/ui/app.ts`, `src/styles.css`
- Modify: `src/main.ts` (erstat hele indholdet)

- [ ] **Step 1: Opret `src/ui/app.ts`**

```ts
import { createActions } from '../actions';
import { APP_URL, CLIENT_ID } from '../config';
import { toDateStr } from '../domain/dates';
import { hasValidToken, initAuth, signIn, signOut, wasSignedIn } from '../google/auth';
import { createCalendarApi } from '../google/calendar';
import { createDrive } from '../google/drive';
import { AuthError, OfflineError } from '../google/http';
import { Store } from '../store';
import type { Ctx } from './context';
import { h } from './dom';
import { mountPlan } from './plan';
import { runQuestions } from './prompts';
import { mountSettings } from './settings';
import { toast } from './sheet';
import { mountTasks } from './tasks';

type Tab = 'plan' | 'tasks' | 'settings';

export async function startApp(root: HTMLElement): Promise<void> {
  if (!CLIENT_ID) {
    root.replaceChildren(h('p', { class: 'empty' }, 'VITE_GOOGLE_CLIENT_ID mangler. Se docs/opsaetning.md.'));
    return;
  }
  await initAuth();

  const store = new Store(createDrive(), localStorage);
  const actions = createActions({
    store,
    calendar: createCalendarApi(),
    now: () => new Date(),
    newId: () => crypto.randomUUID(),
    appUrl: APP_URL,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    isOnline: () => navigator.onLine,
  });

  const banner = h('div', { class: 'banner', hidden: true });
  const main = h('main', {});
  const nav = h('nav', {});
  let currentTab: Tab = 'plan';
  let unmount: () => void = () => {};

  const showBanner = (text: string, button?: { label: string; onClick: () => void }) => {
    banner.replaceChildren(h('span', {}, text), button ? h('button', { class: 'btn small', onclick: button.onClick }, button.label) : null);
    banner.hidden = false;
  };
  const hideBanner = () => { banner.hidden = true; };

  const guard: Ctx['guard'] = async (fn) => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof AuthError) showBanner('Du skal logge ind igen.', { label: 'Log ind', onClick: login });
      else if (e instanceof OfflineError) showBanner('Ingen forbindelse – du kan se dine opgaver, men ikke ændre dem.');
      else {
        console.error(e);
        toast(`Noget gik galt: ${(e as Error).message}`);
      }
      return undefined;
    }
  };

  const ctx: Ctx = {
    store,
    actions,
    guard,
    today: () => toDateStr(new Date()),
    signOut: () => {
      signOut();
      store.clearLocal();
      location.reload();
    },
  };

  const show = (tab: Tab) => {
    currentTab = tab;
    unmount();
    main.replaceChildren();
    main.className = `screen-${tab}`;
    unmount = tab === 'plan' ? mountPlan(ctx, main) : tab === 'tasks' ? mountTasks(ctx, main) : mountSettings(ctx, main);
    nav.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  };

  const tabButton = (tab: Tab, label: string) => h('button', { 'data-tab': tab, onclick: () => show(tab) }, label);
  nav.append(tabButton('plan', '📅 Planlæg'), tabButton('tasks', '✅ Opgaver'), tabButton('settings', '⚙️ Indstillinger'));

  let syncing = false;
  async function syncAll() {
    if (syncing || !hasValidToken()) return;
    syncing = true;
    const ok = await guard(async () => {
      await store.sync();
      await actions.ensureSetup();
      return actions.reconcile();
    });
    syncing = false;
    if (ok) {
      hideBanner();
      show(currentTab); // genindlæs kalenderen efter sync
      await runQuestions(ctx, ok);
    }
  }

  async function login() {
    try {
      await signIn();
      await syncAll();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  const bootShell = () => {
    root.replaceChildren(banner, main, nav);
    show('plan');
    if (!hasValidToken()) showBanner('Du skal logge ind igen.', { label: 'Log ind', onClick: login });
    else void syncAll();
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncAll();
  });
  window.addEventListener('offline', () => showBanner('Ingen forbindelse – du kan se dine opgaver, men ikke ændre dem.'));
  window.addEventListener('online', () => void syncAll());

  if (wasSignedIn()) {
    bootShell();
    return;
  }
  root.replaceChildren(
    h(
      'div',
      { class: 'login' },
      h('h1', {}, 'Opgaver'),
      h('p', {}, 'Hold styr på dine opgaver og træk dem ind i din Google-kalender.'),
      h('button', {
        class: 'btn primary',
        onclick: async () => {
          try {
            await signIn();
            bootShell();
          } catch (e) {
            toast((e as Error).message);
          }
        },
      }, 'Log ind med Google'),
    ),
  );
}
```

- [ ] **Step 2: Erstat `src/main.ts`**

```ts
import './styles.css';
import { startApp } from './ui/app';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
}

startApp(document.getElementById('app')!);
```

- [ ] **Step 3: Opret `src/styles.css`**

```css
:root {
  --bg: #f6f7f5;
  --surface: #ffffff;
  --text: #1c2421;
  --muted: #5f6b66;
  --accent: #2f6f5e;
  --accent-soft: #dcebe5;
  --danger: #b3261e;
  --busy: #c9cdd0;
  --border: #e1e4e2;
  --free: #ffffff;
  --closed: #eceeed;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #121614;
    --surface: #1b211e;
    --text: #e7ece9;
    --muted: #9aa6a0;
    --accent: #6fbfa6;
    --accent-soft: #23372f;
    --danger: #f2b8b5;
    --busy: #3a4240;
    --border: #2b332f;
    --free: #1b211e;
    --closed: #141816;
  }
}

* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--text); font: 16px/1.4 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
#app { height: 100dvh; display: flex; flex-direction: column; }
main { flex: 1; min-height: 0; overflow: auto; position: relative; }
button { font: inherit; }
[hidden] { display: none !important; }

nav { display: flex; border-top: 1px solid var(--border); background: var(--surface); padding-bottom: env(safe-area-inset-bottom); }
nav button { flex: 1; padding: 12px 4px; border: 0; background: none; color: var(--muted); font-size: 14px; }
nav button.active { color: var(--accent); font-weight: 600; }

.banner { display: flex; gap: 12px; align-items: center; justify-content: space-between; padding: 10px 16px; background: var(--accent-soft); }

.btn { border: 1px solid var(--border); background: var(--surface); color: var(--text); padding: 12px 16px; border-radius: 12px; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn.danger { color: var(--danger); }
.btn.small { padding: 6px 12px; }

.login { margin: auto; padding: 32px 16px; max-width: 420px; text-align: center; }

/* Planlæg */
.screen-plan { display: flex; flex-direction: column; overflow: hidden; }
.cal { flex: 1; min-height: 0; padding: 8px 8px 0; }
.fc { --fc-border-color: var(--border); --fc-page-bg-color: var(--free); --fc-non-business-color: var(--closed); --fc-today-bg-color: transparent; }
.fc .fc-toolbar-title { font-size: 16px; }
.fc .fc-button { padding: 4px 8px; font-size: 13px; }
.fc .busy { background: var(--busy); opacity: 0.8; }
.fc .task-block { background: var(--accent); border-color: var(--accent); }
.fc .task-block.done { opacity: 0.45; }

.drawer { background: var(--surface); border-top: 1px solid var(--border); max-height: 56px; overflow: hidden; transition: max-height 0.2s; }
.drawer.open { max-height: 45dvh; overflow: auto; }
.drawer-handle { width: 100%; padding: 16px; border: 0; background: none; color: var(--muted); font-size: 14px; }
.drawer-list { padding: 0 12px 12px; }

/* Opgaver */
.task-list { padding: 8px 16px 96px; }
.task-list h2, .settings h2 { font-size: 14px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin: 20px 0 8px; }
.task-list summary { font-size: 14px; color: var(--muted); margin: 20px 0 8px; }
.task-item { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; margin-bottom: 8px; touch-action: pan-y; user-select: none; }
.task-item.overdue { border-color: var(--danger); }
.task-item.overdue .task-meta { color: var(--danger); }
.task-title { font-weight: 600; }
.task-meta { font-size: 13px; color: var(--muted); }
.fab { position: absolute; right: 16px; bottom: 16px; width: 56px; height: 56px; border-radius: 50%; border: 0; background: var(--accent); color: #fff; font-size: 28px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
.empty, .muted { color: var(--muted); }
.empty { text-align: center; padding: 24px 0; }

/* Ark og formularer */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: flex-end; z-index: 100; }
.sheet { width: 100%; max-height: 90dvh; overflow: auto; background: var(--surface); border-radius: 16px 16px 0 0; padding: 20px 16px calc(16px + env(safe-area-inset-bottom)); }
.sheet h3 { margin: 0 0 12px; }
.sheet-buttons { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
.form label, .settings label { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; font-size: 14px; color: var(--muted); }
input, select, textarea { font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 10px; }
.row { display: flex; gap: 8px; }
.row > * { flex: 1; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { border: 1px solid var(--border); background: var(--bg); color: var(--text); border-radius: 999px; padding: 4px 10px; font-size: 13px; }

.settings { padding: 8px 16px 32px; display: flex; flex-direction: column; }
.settings .btn { margin-top: 12px; }
.day-row { display: grid; grid-template-columns: 1fr auto auto auto; gap: 6px; align-items: center; margin-bottom: 6px; }
.day-row input[type='time'] { padding: 6px; }
.settings label.check { flex-direction: row; align-items: center; gap: 8px; margin: 0; color: var(--text); }

.toast { position: fixed; left: 16px; right: 16px; bottom: 80px; background: var(--text); color: var(--bg); padding: 12px 16px; border-radius: 12px; z-index: 200; text-align: center; }
```

- [ ] **Step 4: Typetjek, tests og build**

Run: `npm run typecheck && npm test && npm run build`
Expected: ingen fejl, `dist/` oprettes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: app-skal med navigation, login, bannere og styling"
```

---

### Task 18: PWA (manifest, ikoner, service worker)

**Files:**
- Create: `public/manifest.webmanifest`, `public/icon.svg`, `public/icon-192.png`, `public/icon-512.png`, `public/sw.js`

- [ ] **Step 1: Opret `public/icon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#2f6f5e"/><path d="M150 270l70 70 150-170" fill="none" stroke="#fff" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/></svg>
```

- [ ] **Step 2: Lav PNG-ikoner med macOS' `sips`**

Run:
```bash
sips -s format png -z 192 192 public/icon.svg --out public/icon-192.png
sips -s format png -z 512 512 public/icon.svg --out public/icon-512.png
```
Expected: to PNG-filer i `public/`.

- [ ] **Step 3: Opret `public/manifest.webmanifest`**

```json
{
  "name": "Opgaver",
  "short_name": "Opgaver",
  "start_url": ".",
  "scope": ".",
  "display": "standalone",
  "background_color": "#f6f7f5",
  "theme_color": "#2f6f5e",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 4: Opret `public/sw.js`**

```js
const CACHE = 'opgave-app-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Netværk først, cache som reserve. Kun egne filer; Google-kald går udenom.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match(self.registration.scope))),
  );
});
```

- [ ] **Step 5: Build og tjek at filerne kommer med**

Run: `npm run build && ls dist`
Expected: `dist` indeholder `index.html`, `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`, `icon.svg`, `assets/`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: PWA-manifest, ikoner og service worker"
```

---

### Task 19: Deploy og opsætningsguide

**Files:**
- Create: `.github/workflows/deploy.yml`, `docs/opsaetning.md`

- [ ] **Step 1: Opret `.github/workflows/deploy.yml`**

```yaml
name: Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          BASE_PATH: /${{ github.event.repository.name }}/
          VITE_GOOGLE_CLIENT_ID: ${{ vars.GOOGLE_CLIENT_ID }}
          VITE_APP_URL: https://${{ github.repository_owner }}.github.io/${{ github.event.repository.name }}/
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Opret `docs/opsaetning.md`**

````markdown
# Opsætning

Du skal gøre dette én gang. Det tager ca. 15 minutter.

## 1. GitHub

1. Opret en gratis konto på https://github.com, hvis du ikke har en.
2. Opret et nyt, **tomt** repository med navnet `opgave-app` (Public).
3. I Terminal, i mappen `~/opgave-app`:
   ```bash
   git branch -M main
   git remote add origin https://github.com/DIT-BRUGERNAVN/opgave-app.git
   git push -u origin main
   ```
4. På GitHub: **Settings → Pages → Source: GitHub Actions**.

Appens adresse bliver `https://DIT-BRUGERNAVN.github.io/opgave-app/`.

## 2. Google Cloud

1. Gå til https://console.cloud.google.com og opret et nyt projekt: "Opgave-app".
2. **APIs & Services → Library**: Slå **Google Calendar API** og **Google Drive API** til.
3. **APIs & Services → OAuth consent screen** (Google Auth Platform):
   - User type: **External**
   - App name: Opgaver, og din e-mail som support og kontakt
   - Under **Audience / Test users**: tilføj din egen Gmail-adresse
   - Under **Data access / Scopes**: tilføj `.../auth/calendar` og `.../auth/drive.appdata`
4. **Credentials / Clients → Create OAuth client ID**:
   - Type: **Web application**
   - Authorized JavaScript origins:
     - `https://DIT-BRUGERNAVN.github.io`
     - `http://localhost:5173`
   - Kopiér **Client ID** (ender på `.apps.googleusercontent.com`).

## 3. Sæt klient-ID ind

- **GitHub:** Settings → Secrets and variables → Actions → **Variables** → New variable: `GOOGLE_CLIENT_ID` = dit klient-ID. Kør derefter workflowet "Deploy" igen under **Actions**.
- **Lokalt:** Kopiér `.env.example` til `.env.local` og indsæt klient-ID'et.

## 4. På telefonen

1. Åbn `https://DIT-BRUGERNAVN.github.io/opgave-app/` i Chrome.
2. Log ind med Google. Du får en advarsel om, at appen ikke er verificeret. Det er normalt, fordi det er din egen app: tryk **Fortsæt**.
3. Chrome-menuen (⋮) → **Føj til startskærm / Installer app**.
4. Tjek i Google Kalender-appen, at kalenderen **Opgaver** er slået til (☰ → sæt flueben), så du får søndagspåmindelsen.
````

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: GitHub Pages-deploy og opsætningsguide"
```

---

### Task 20: Manuel test (sammen med brugeren)

Kræver at brugeren har gennemført `docs/opsaetning.md` trin 2–3 (mindst `.env.local`).

- [ ] **Step 1: Lokalt i browseren**

Run: `npm run dev` og åbn `http://localhost:5173` (i Chrome med mobilvisning).

Tjek:
- [ ] Login med Google virker, og kalenderen "Opgaver" dukker op i Google Kalender.
- [ ] Søndagsbegivenheden "📋 Planlæg ugens opgaver" findes med påmindelse.
- [ ] Filen `data.json` bliver oprettet (Google Drive → Indstillinger → Administrer apps viser appen med skjulte data).
- [ ] Opret én af hver type: "Ring til VVS" (engang), "Vask bil" (hver 3. uge), "Byg drivhus" (stor opgave).
- [ ] Træk "Vask bil" ind i et ledigt tidsrum → begivenhed i Google Kalender.
- [ ] Træk en opgave hen over en aftale eller uden for tidsrum → afvises.
- [ ] Flyt og forlæng en blok → ændringen ses i Google Kalender.
- [ ] Træk "Byg drivhus" ind to gange → to blokke, opgaven er stadig i skuffen.
- [ ] Tryk på en blok → "Færdig" → "Vask bil" flytter til "Hviler" med forfaldsdato om 3 uger.
- [ ] Flyt en opgavebegivenhed i Google Kalender, og skift tilbage til appen → den nye tid vises.
- [ ] Planlæg en 15-minutters opgave, der starter lige om lidt. Vent til tiden er gået, og skift væk fra og tilbage til appen → "Blev den gjort?" vises.
- [ ] Indstillinger: ændr søndagstidspunkt → begivenheden flyttes i Google Kalender.

- [ ] **Step 2: På telefonen**

Efter `git push` og vellykket deploy:
- [ ] Åbn appen i Chrome på Android, log ind, installer på startskærmen.
- [ ] Hold og træk opgaver fra skuffen op i kalenderen med fingeren.
- [ ] Slå flytilstand til og åbn appen → opgavelisten vises, banneret "Ingen forbindelse" vises.
- [ ] Efter 1 time: banneret "Log ind igen" vises, og ét tryk virker.

- [ ] **Step 3: Ret fundne fejl**

Hver fejl rettes med superpowers:systematic-debugging og committes separat.
