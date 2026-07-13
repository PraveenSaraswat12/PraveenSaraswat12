import { describe, it, expect } from 'vitest';
import { parseAuthCallbackUrl } from '../cloud.js';

// The native Google sign-in bug: the app used to redirect to a plain web URL,
// which Google refuses to load inside its WebView and Android bounces out to
// Chrome with no way back. The fix redirects to this custom scheme instead;
// this is the parser that pulls the session out of what comes back.
describe('parseAuthCallbackUrl', () => {
  it('extracts access_token + refresh_token from the callback fragment', () => {
    const url = 'com.kithra.app://auth-callback#access_token=abc123&refresh_token=xyz789&expires_in=3600&token_type=bearer';
    expect(parseAuthCallbackUrl(url)).toEqual({ access_token: 'abc123', refresh_token: 'xyz789' });
  });

  it('falls back to the query string if the fragment got flattened', () => {
    const url = 'com.kithra.app://auth-callback?access_token=abc123&refresh_token=xyz789';
    expect(parseAuthCallbackUrl(url)).toEqual({ access_token: 'abc123', refresh_token: 'xyz789' });
  });

  it('ignores URLs that are not our callback scheme', () => {
    expect(parseAuthCallbackUrl('https://praveensaraswat12.github.io/PraveenSaraswat12/#access_token=abc&refresh_token=xyz')).toBeNull();
    expect(parseAuthCallbackUrl('https://example.com/')).toBeNull();
  });

  it('returns null on an OAuth error callback (cancelled / denied) instead of throwing', () => {
    expect(parseAuthCallbackUrl('com.kithra.app://auth-callback?error=access_denied&error_description=denied')).toBeNull();
  });

  it('returns null for missing/empty input', () => {
    expect(parseAuthCallbackUrl('')).toBeNull();
    expect(parseAuthCallbackUrl(null)).toBeNull();
    expect(parseAuthCallbackUrl(undefined)).toBeNull();
  });

  it('requires BOTH tokens — a partial callback is not a valid session', () => {
    expect(parseAuthCallbackUrl('com.kithra.app://auth-callback#access_token=abc123')).toBeNull();
    expect(parseAuthCallbackUrl('com.kithra.app://auth-callback#refresh_token=xyz789')).toBeNull();
  });
});
