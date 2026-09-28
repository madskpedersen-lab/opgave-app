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
