import { defaultData, normalizeData } from './domain/defaults';
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
    this.data = raw ? normalizeData(JSON.parse(raw) as AppData) : defaultData();
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
      if (remote.data) this.set(normalizeData(remote.data));
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
          this.set(fn(remote.data ? normalizeData(remote.data) : defaultData()));
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
