import { expect, test } from 'vitest';
import { buildSilentAuthUrl, parseTokenHash } from '../../src/google/oauthRedirect';

test('bygger en stille login-adresse uden brugerdialog', () => {
  const url = new URL(buildSilentAuthUrl({ clientId: 'cid', redirectUri: 'https://x.test/app/', scopes: ['a', 'b'], state: 's1', loginHint: 'mig@gmail.com' }));
  expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
  expect(Object.fromEntries(url.searchParams)).toEqual({
    client_id: 'cid',
    redirect_uri: 'https://x.test/app/',
    response_type: 'token',
    scope: 'a b',
    prompt: 'none',
    include_granted_scopes: 'true',
    state: 's1',
    login_hint: 'mig@gmail.com',
  });
});

test('uden login-hint udelades parameteren', () => {
  const url = new URL(buildSilentAuthUrl({ clientId: 'cid', redirectUri: 'r', scopes: ['a'], state: 's' }));
  expect(url.searchParams.has('login_hint')).toBe(false);
});

test('læser token fra svaret når state passer', () => {
  const r = parseTokenHash('#state=s1&access_token=tok&token_type=Bearer&expires_in=3599&scope=a', 's1', 1000);
  expect(r).toEqual({ token: 'tok', expiresAt: 1000 + 3599 * 1000 });
});

test('fejl, forkert state og andre hashes', () => {
  expect(parseTokenHash('#state=s1&error=interaction_required', 's1', 0)).toEqual({ error: 'interaction_required' });
  expect(parseTokenHash('#state=andet&access_token=tok&expires_in=10', 's1', 0)).toEqual({ error: 'state_mismatch' });
  expect(parseTokenHash('', 's1', 0)).toBeNull();
  expect(parseTokenHash('#noget-andet', 's1', 0)).toBeNull();
});
