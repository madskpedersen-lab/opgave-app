/** Stille fornyelse af Google-login via omdirigering (prompt=none): ingen dialog, hvis brugeren allerede er logget ind hos Google. */

export function buildSilentAuthUrl(o: { clientId: string; redirectUri: string; scopes: string[]; state: string; loginHint?: string }): string {
  const p = new URLSearchParams({
    client_id: o.clientId,
    redirect_uri: o.redirectUri,
    response_type: 'token',
    scope: o.scopes.join(' '),
    prompt: 'none',
    include_granted_scopes: 'true',
    state: o.state,
  });
  if (o.loginHint) p.set('login_hint', o.loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export type TokenResult = { token: string; expiresAt: number } | { error: string };

/** Læser Googles svar fra URL'ens #-del. null hvis det ikke er et login-svar. */
export function parseTokenHash(hash: string, expectedState: string | null, now: number): TokenResult | null {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  if (!p.has('access_token') && !p.has('error')) return null;
  if (p.get('state') !== expectedState) return { error: 'state_mismatch' };
  const error = p.get('error');
  if (error) return { error };
  return { token: p.get('access_token')!, expiresAt: now + Number(p.get('expires_in') ?? 0) * 1000 };
}
