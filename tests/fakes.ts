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
