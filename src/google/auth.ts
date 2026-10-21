import { APP_URL, CLIENT_ID } from '../config';
import { setTokenProvider } from './http';
import { buildSilentAuthUrl, parseTokenHash } from './oauthRedirect';

const SCOPES = ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/drive.appdata'];
const KEY = 'opgave-app:token';
const ACCOUNT_KEY = 'opgave-app:account';
const STATE_KEY = 'opgave-app:oauth-state';
const ATTEMPT_KEY = 'opgave-app:silent-attempt';

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

function save(token: string, expiresAt: number): void {
  localStorage.setItem(KEY, JSON.stringify({ token, expiresAt }));
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
    scriptLoad = null; // så næste tryk på "Log ind" prøver at hente scriptet igen
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
        save(r.access_token, Date.now() + r.expires_in * 1000);
        resolve();
      },
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'Login blev afbrudt' : e.type)),
    });
    client.requestAccessToken({ prompt: wasSignedIn() ? '' : 'consent' });
  });
}

export function signOut(): void {
  const s = read();
  if (s && typeof google !== 'undefined') google.accounts.oauth2.revoke(s.token, () => {});
  localStorage.removeItem(KEY);
  localStorage.removeItem(ACCOUNT_KEY);
}

/** Husk Google-kontoen, så stille fornyelse ikke skal vælge konto. */
export function rememberAccount(email: string | undefined): void {
  if (email) localStorage.setItem(ACCOUNT_KEY, email);
}

export function hasRememberedAccount(): boolean {
  return localStorage.getItem(ACCOUNT_KEY) !== null;
}

/** Tager imod Googles svar efter en stille fornyelse (kaldes ved opstart). */
export function consumeRedirect(): void {
  const r = parseTokenHash(location.hash, sessionStorage.getItem(STATE_KEY), Date.now());
  if (!r) return;
  history.replaceState(null, '', location.pathname + location.search);
  sessionStorage.removeItem(STATE_KEY);
  if ('token' in r) save(r.token, r.expiresAt);
}

/**
 * Fornyer et udløbet login uden dialog ved at sende siden forbi Google og tilbage.
 * Returnerer true, hvis siden er på vej væk. Prøver højst hvert 5. minut, så en
 * fejl (fx at Google vil have brugeren til at vælge konto) ikke giver en løkke.
 */
export function trySilentSignIn(): boolean {
  if (!wasSignedIn() || hasValidToken() || !navigator.onLine) return false;
  const last = Number(sessionStorage.getItem(ATTEMPT_KEY) ?? 0);
  if (Date.now() - last < 5 * 60_000) return false;
  sessionStorage.setItem(ATTEMPT_KEY, String(Date.now()));
  const state = crypto.randomUUID();
  sessionStorage.setItem(STATE_KEY, state);
  location.assign(
    buildSilentAuthUrl({ clientId: CLIENT_ID, redirectUri: APP_URL, scopes: SCOPES, state, loginHint: localStorage.getItem(ACCOUNT_KEY) ?? undefined }),
  );
  return true;
}
