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

let scriptLoad: Promise<void> | null = null;

export async function initAuth(): Promise<void> {
  setTokenProvider(() => read()?.token ?? null);
  // Start indlæsning af scriptet, men lad ikke opstart af appen fejle offline.
  scriptLoad = loadScript('https://accounts.google.com/gsi/client');
  scriptLoad.catch(() => {});
}

/** Skal kaldes fra et klik (ellers blokerer browseren popup'en). */
export async function signIn(): Promise<void> {
  try {
    await (scriptLoad ?? loadScript('https://accounts.google.com/gsi/client'));
  } catch {
    throw new Error('Kunne ikke hente Google-login – tjek din forbindelse');
  }
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
