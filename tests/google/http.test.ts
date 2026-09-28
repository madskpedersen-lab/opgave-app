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
