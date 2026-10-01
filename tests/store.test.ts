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

test('data fra en ældre version omlægges både lokalt og fra Drive', async () => {
  const old = { version: 1, tasks: [], settings: { windows: {}, sundayReminderTime: '18:00', surfaceDaysBefore: 7 } };
  const storage = memoryStorage();
  storage.setItem('opgave-app:data', JSON.stringify(old));
  const drive = new FakeDrive();
  expect(new Store(drive, storage).data.settings.visibleHours).toEqual({ start: 6, end: 23 });
  drive.data = old as unknown as AppData;
  const store = new Store(drive, memoryStorage());
  await store.sync();
  expect(store.data.settings).not.toHaveProperty('windows');
  expect(store.data.settings.visibleHours).toEqual({ start: 6, end: 23 });
});
