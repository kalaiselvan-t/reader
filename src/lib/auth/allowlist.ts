/** Case-insensitive exact match against the single allowed owner email. */
export function isAllowedEmail(email: string, allowed: string): boolean {
  if (!email || !allowed) return false;
  return email.trim().toLowerCase() === allowed.trim().toLowerCase();
}

/**
 * Fetch the signed-in Google account's email via Drive's own `about` endpoint
 * — covered by the `drive.readonly` scope already requested, so no separate
 * identity scope (e.g. userinfo.email) is needed on the consent screen.
 */
export async function fetchUserEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Drive about request failed: ${res.status}`);
  }
  const data = await res.json();
  return data.user.emailAddress as string;
}
