import { describe, it, expect, vi, afterEach } from 'vitest';
import { isAllowedEmail, fetchUserEmail } from '../../src/lib/auth/allowlist';

describe('isAllowedEmail', () => {
  it('matches the exact allowed email', () => {
    expect(isAllowedEmail('kalaiselvant0@gmail.com', 'kalaiselvant0@gmail.com')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isAllowedEmail('Kalaiselvant0@Gmail.com', 'kalaiselvant0@gmail.com')).toBe(true);
  });

  it('rejects any other email', () => {
    expect(isAllowedEmail('someoneelse@gmail.com', 'kalaiselvant0@gmail.com')).toBe(false);
  });

  it('rejects empty input', () => {
    expect(isAllowedEmail('', 'kalaiselvant0@gmail.com')).toBe(false);
  });
});

describe('fetchUserEmail', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the email from a successful Drive about response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: { emailAddress: 'kalaiselvant0@gmail.com', displayName: 'Kalai' } }),
    }));
    const email = await fetchUserEmail('fake-token');
    expect(email).toBe('kalaiselvant0@gmail.com');
    expect(fetch).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/about?fields=user',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer fake-token' }) })
    );
  });

  it('throws when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(fetchUserEmail('bad-token')).rejects.toThrow();
  });
});
