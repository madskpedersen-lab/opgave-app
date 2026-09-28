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
