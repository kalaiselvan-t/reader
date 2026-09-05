# Reader — Plan 3: Google Drive Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the reader to the owner's Google Drive so EPUBs in a chosen folder sync into the local library, gated by a single-account allowlist — fully testable on `localhost`, with no deploy dependency.

**Architecture:** 100% client-side OAuth via Google Identity Services' token client (no backend, no PKCE/code-exchange server). The access token is requested with a single scope — `drive.readonly` — which covers both listing/downloading files AND identifying the signed-in account (via Drive's own `about` endpoint, so no separate `userinfo.email` scope is needed — fewer scopes on the consent screen, one less thing to misconfigure). The token lives in memory only (React state), never persisted — matches the spec's existing design where already-cached books stay available offline regardless of Drive connection state. A pasted Drive folder link/ID (no Google Picker API, no extra API to enable) tells the app which folder to sync. Downloaded bytes flow through the *existing* Plan 1 pipeline (`hashBytes` → `parseEpubMetadata` → `BookRecord`), so a book synced from Drive and the same book opened locally de-duplicate for free.

**Tech Stack:** Google Identity Services (`accounts.google.com/gsi/client`, loaded via a `<script>` tag, no npm package needed), plain `fetch` against the Drive v3 REST API (no `googleapis` SDK — keeps the bundle small and matches the existing minimal-dependency style). Existing: React 18, TypeScript, Vitest, IndexedDB (`idb`), the Plan 1 `ReaderBook`/`parseEpubMetadata`/`hashBytes`/storage layer.

## Global Constraints

- Single user, no backend. Only `kalaiselvant0@gmail.com` may ever see synced content — any other Google account must be signed out immediately with a clear message.
- OAuth scope: exactly `https://www.googleapis.com/auth/drive.readonly` — no broader Drive scope, no write access, no separate identity scope (email comes from Drive's own `about` endpoint under this same scope).
- No Google Picker API. Folder selection is a pasted Drive link or bare folder ID, parsed client-side, and verified against the real Drive API (folder existence check) before syncing — never trusted on format alone.
- If `VITE_OWNER_EMAIL` is unset, that is a **misconfiguration**, distinct from a wrong-account rejection — the app must say so plainly, not silently deny every sign-in attempt (which would look identical to "wrong account" and invite an implementer to "fix" the allowlist logic itself).
- Access tokens are **never persisted** (not IndexedDB, not localStorage) — in-memory only for the session. Reconnecting each session (or after ~1hr token expiry) is expected and acceptable.
- `VITE_GOOGLE_CLIENT_ID` and `VITE_OWNER_EMAIL` are read from Vite env vars (`.env.local`, gitignored — already covered by the existing `.gitignore`). A committed `.env.example` documents the required names with no real values.
- Synced books reuse the exact Plan 1 schema: `BookRecord.id = hashBytes(data)`, `source: 'drive'`, `driveFileId` set. No schema migration needed beyond one new optional `SettingsRecord.driveFolderId` field.
- Palette/typography unchanged from Plan 1 (bg `#0B0B0D`, surface `#17171A`, text `#E8E4DC`, secondary `#9A968E`, accent `#E0B15D`).
- TDD for all pure logic (`allowlist`, `folderLink`). Frequent commits — every task ends with a commit.

## Known operational caveat (documented, not a bug to fix)

Google's OAuth "Testing" publishing status caps sessions: **a test user's authorization can require re-consent after 7 days**, and access tokens themselves are short-lived (~1 hour) regardless of publishing status. The app must treat "no valid token" as a normal, recoverable state (show "Connect Drive" again), never as an error. This is called out explicitly so no task tries to "fix" it by requesting a refresh token — that would need a backend token endpoint, which is out of scope by design.

---

## File Structure

```
reader/
  .env.example                     # documents VITE_GOOGLE_CLIENT_ID / VITE_OWNER_EMAIL
  docs/superpowers/
    google-drive-setup-runbook.md  # step-by-step Google Cloud Console guide (owner-performed)
  src/
    lib/
      auth/
        google.ts                  # GIS script loader + token client wrapper
        allowlist.ts                # isAllowedEmail, fetchUserEmail (via Drive's about endpoint)
      drive/
        folderLink.ts               # parseFolderId (pure, TDD)
        driveClient.ts              # listEpubFiles, downloadFile
      storage/
        db.ts                       # + driveFolderId setting field (MODIFY)
    state/
      auth.tsx                      # AuthProvider / useAuth
      library.tsx                   # + syncDriveFolder (MODIFY)
    components/
      DriveSyncPanel.tsx            # connect / paste folder / sync UI
      Library.tsx                   # mounts DriveSyncPanel (MODIFY)
    App.tsx                         # wraps app in AuthProvider (MODIFY)
  test/
    auth/
      allowlist.test.ts
    drive/
      folderLink.test.ts
    storage/
      db.test.ts                    # + driveFolderId round-trip (MODIFY)
```

Split rationale: `auth/` and `drive/` are pure/network modules with no React dependency, so their logic (allowlist matching, folder-link parsing) is unit-tested without a browser; `auth.tsx`/`library.tsx` hold the only React state; `DriveSyncPanel` is a single focused UI surface rather than folding Drive concerns into the already-busy `Library.tsx`.

---

### Task 1: Google Cloud Console setup runbook

**Files:**
- Create: `docs/superpowers/google-drive-setup-runbook.md`
- Create: `.env.example`
- Modify: nothing else (no code yet)

**Interfaces:**
- Consumes: nothing.
- Produces: a document the owner (kalai) follows themselves to create a Google Cloud project, OAuth consent screen, and OAuth Client ID — an external prerequisite for Task 7's live verification. Also produces the `.env.example` template.

**This task cannot be "tested" by code — it is written and self-checked against the checklist below.**

- [ ] **Step 1: Write `docs/superpowers/google-drive-setup-runbook.md`**

```markdown
# Google Drive Setup Runbook (owner-performed, one time)

This connects Reader to your Google Drive. You do these steps yourself in
your own Google account — nothing here can be automated on your behalf,
since it requires your Google login.

**Time:** ~10 minutes. **Cost:** free.

## 1. Create a Google Cloud project

1. Go to https://console.cloud.google.com/projectcreate
2. Project name: `reader-app` (or anything you like). No organization needed.
3. Click **Create**, wait for it to finish, then make sure the new project
   is selected in the project switcher at the top of the console.

## 2. Enable the Drive API

1. Go to https://console.cloud.google.com/apis/library/drive.googleapis.com
   (with your new project selected).
2. Click **Enable**.

## 3. Configure the OAuth consent screen

1. Go to https://console.cloud.google.com/auth/branding (Google's current
   name for this page is "OAuth consent screen" / "Branding" / "Audience" —
   the console reorganizes this occasionally; look for "OAuth consent
   screen" in the left sidebar under "APIs & Services" if the link above
   has moved).
2. **User type:** External (this is fine for a single-user app that will
   stay in Testing mode — you don't need Internal/Workspace).
3. Fill in: App name (`Reader`), User support email (yours), Developer
   contact email (yours). Skip everything optional.
4. **Scopes:** add this one:
   - `.../auth/drive.readonly`
   (This single scope also lets the app read your account's email via
   Drive's own "about" info, so no separate identity scope is needed.)
5. **Audience / Test users:** add your own email
   (`kalaiselvant0@gmail.com`) as a test user. **Publishing status: keep it
   on "Testing"** — do not submit for verification. Testing mode is exactly
   what the spec calls for: Google refuses sign-in for any email not on
   this list, which is the actual security boundary.

## 4. Create an OAuth Client ID

1. Go to https://console.cloud.google.com/apis/credentials
2. **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: `reader-web`
5. **Authorized JavaScript origins:** add
   - `http://localhost:5173` (Vite's default dev port)
   You'll add the GitHub Pages origin here later, in Plan 4 — no need to
   add it now.
6. Click **Create**. Copy the **Client ID** shown (looks like
   `123456789-abc...apps.googleusercontent.com`). This is **not a secret**
   — it's a public identifier — but keep it in `.env.local` anyway so the
   code stays configuration-free.

## 5. Set your local environment

In the `reader/` project root, create `.env.local` (already gitignored):

```
VITE_GOOGLE_CLIENT_ID=<paste the Client ID from step 4>
VITE_OWNER_EMAIL=kalaiselvant0@gmail.com
```

## Known limitations (by design, not bugs)

- **Testing mode re-consent:** Google may ask you to re-approve access
  after 7 days, and access tokens themselves expire after about an hour
  regardless. The app treats this as normal — you'll just see "Connect
  Drive" again. This is a deliberate trade-off for staying backend-free;
  fixing it would require a server-side token-refresh endpoint, which is
  out of scope for this project.
- **100 test-user cap / unverified-app warning:** since the app stays in
  Testing mode with only you as a test user, Google will show an
  "unverified app" warning on each fresh consent. That's expected and
  safe to click through (it's your own app, your own data).

## Sources consulted while writing this runbook

- https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid
- https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow
- https://developers.google.com/workspace/guides/configure-oauth-consent
- https://support.google.com/cloud/answer/15549945 (Testing vs. published,
  7-day test-user authorization expiry)
```

- [ ] **Step 2: Write `.env.example`**

```
# Copy to .env.local and fill in real values (see docs/superpowers/google-drive-setup-runbook.md)
VITE_GOOGLE_CLIENT_ID=
VITE_OWNER_EMAIL=kalaiselvant0@gmail.com
```

- [ ] **Step 3: Self-check the runbook**

Confirm the document covers, in order: project creation, enabling the Drive
API, OAuth consent screen (External, Testing, both scopes, test user added),
OAuth Client ID creation (Web application, localhost origin), and the
`.env.local` values to set. Confirm the "known limitations" section is
present so the owner isn't surprised by the 7-day re-consent or the
unverified-app warning.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/google-drive-setup-runbook.md .env.example
git commit -m "docs: add Google Cloud Console setup runbook for Drive OAuth"
```

---

### Task 2: Allowlist + email lookup (`auth/allowlist.ts`)

**Files:**
- Create: `src/lib/auth/allowlist.ts`
- Test: `test/auth/allowlist.test.ts`

**Interfaces:**
- Consumes: nothing (pure function) for `isAllowedEmail`; `fetch` (global) for `fetchUserEmail`.
- Produces:
  - `isAllowedEmail(email: string, allowed: string): boolean` — case-insensitive exact match.
  - `fetchUserEmail(accessToken: string): Promise<string>` — calls Drive's `about` endpoint (covered by the `drive.readonly` scope already requested — no separate identity scope needed) with the bearer token and returns the signed-in user's email. Throws on a non-OK response.

- [ ] **Step 1: Write the failing tests**

`test/auth/allowlist.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/auth/allowlist.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/auth/allowlist.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/auth/allowlist.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/allowlist.ts test/auth/allowlist.test.ts
git commit -m "feat: email allowlist matching and Google userinfo lookup"
```

---

### Task 3: Drive folder-link parsing (`drive/folderLink.ts`)

**Files:**
- Create: `src/lib/drive/folderLink.ts`
- Test: `test/drive/folderLink.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseFolderId(input: string): string | null` — extracts a Drive folder ID from a pasted share link in either of Drive's common URL shapes, or accepts a bare ID directly. Returns `null` for anything unrecognized.

- [ ] **Step 1: Write the failing tests**

`test/drive/folderLink.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseFolderId } from '../../src/lib/drive/folderLink';

describe('parseFolderId', () => {
  it('extracts the id from a standard folder share link', () => {
    expect(parseFolderId('https://drive.google.com/drive/folders/1AbC-XyZ_0123456789')).toBe('1AbC-XyZ_0123456789');
  });

  it('extracts the id from a link with a user index and query string', () => {
    expect(parseFolderId('https://drive.google.com/drive/u/0/folders/1AbC-XyZ_0123456789?usp=sharing')).toBe('1AbC-XyZ_0123456789');
  });

  it('accepts a bare folder id with no link', () => {
    expect(parseFolderId('1AbC-XyZ_0123456789')).toBe('1AbC-XyZ_0123456789');
  });

  it('trims surrounding whitespace', () => {
    expect(parseFolderId('  1AbC-XyZ_0123456789  ')).toBe('1AbC-XyZ_0123456789');
  });

  it('returns null for an unrelated url', () => {
    expect(parseFolderId('https://example.com/not-drive')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseFolderId('')).toBeNull();
  });

  it('returns null for a string with invalid id characters', () => {
    expect(parseFolderId('not a valid id!')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/drive/folderLink.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/drive/folderLink.ts`**

```ts
// Drive folder/file IDs are URL-safe base64-ish: letters, digits, - and _.
const ID_PATTERN = /^[A-Za-z0-9_-]{10,}$/;

/**
 * Extract a Drive folder ID from a pasted share link, or accept a bare ID.
 * Returns null if nothing recognizable is found.
 */
export function parseFolderId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const linkMatch = trimmed.match(/\/folders\/([A-Za-z0-9_-]{10,})/);
  if (linkMatch) return linkMatch[1];

  if (ID_PATTERN.test(trimmed)) return trimmed;

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/drive/folderLink.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/drive/folderLink.ts test/drive/folderLink.test.ts
git commit -m "feat: parse a Drive folder id from a pasted share link or bare id"
```

---

### Task 4: GIS token client wrapper (`auth/google.ts`)

**Files:**
- Create: `src/lib/auth/google.ts`

**Interfaces:**
- Consumes: the Google Identity Services script (loaded at runtime, not an npm dependency), `import.meta.env.VITE_GOOGLE_CLIENT_ID`.
- Produces:
  - `loadGis(): Promise<void>` — injects the GIS `<script>` tag once and resolves when `window.google.accounts.oauth2` is available.
  - `requestAccessToken(): Promise<string>` — resolves with a fresh access token (scoped to `drive.readonly` only), rejecting if the user cancels or an error occurs. Calling it again always requests a token (no silent caching here — that's the caller's job).

**Verification note:** this task's live popup-and-token flow cannot be meaningfully verified without the owner's completed Google Cloud setup (Task 1) and a real `VITE_GOOGLE_CLIENT_ID`. Don't attempt that here — it's verified once, together with the full Drive sync flow and the `fetchUserEmail` scope pairing, in Task 7 Step 5. This task only needs to type-check and confirm the clear "not configured" error path (below).

- [ ] **Step 1: Implement `src/lib/auth/google.ts`**

```ts
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }): { requestAccessToken: (opts?: { prompt?: string }) => void };
        };
      };
    };
  }
}

let loadPromise: Promise<void> | null = null;

/** Inject the Google Identity Services script once and wait for it to be ready. */
export function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
  return loadPromise;
}

/**
 * Request a fresh OAuth access token via Google's consent popup. Always
 * prompts the user (no silent/cached token here — the caller decides when
 * to call this, typically on an explicit "Connect Drive" click).
 */
export async function requestAccessToken(): Promise<string> {
  await loadGis();
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
  if (!clientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID is not set (see docs/superpowers/google-drive-setup-runbook.md)');
  }
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error || 'No access token returned'));
          return;
        }
        resolve(resp.access_token);
      },
    });
    client.requestAccessToken();
  });
}
```

- [ ] **Step 2: Type-check + the one verification possible without the owner's setup**

Run: `npx tsc -b`
Expected: clean.

Then confirm (build + `npm run preview`, do not leave a server running) that with no `.env.local` present, calling `requestAccessToken()` throws the clear "VITE_GOOGLE_CLIENT_ID is not set" error rather than a confusing low-level failure. This is the only part of this task verifiable without the owner's completed Google Cloud setup. The full popup-and-token flow (and whether `fetchUserEmail`'s scope pairing actually resolves) is verified once, together, in Task 7 Step 5 — do not attempt it here.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/google.ts
git commit -m "feat: Google Identity Services token client wrapper"
```

---

### Task 5: Auth context (`state/auth.tsx`)

**Files:**
- Create: `src/state/auth.tsx`

**Interfaces:**
- Consumes: `requestAccessToken` (Task 4), `fetchUserEmail`, `isAllowedEmail` (Task 2).
- Produces: `AuthProvider` + `useAuth(): { status: 'signed-out' | 'connecting' | 'signed-in' | 'denied' | 'misconfigured'; email: string | null; accessToken: string | null; deniedEmail: string | null; connect: () => Promise<void>; signOut: () => void }`.
  - `connect()`: if `VITE_OWNER_EMAIL` is unset/empty, sets `status: 'misconfigured'` immediately and does **not** attempt to sign in at all — this is a distinct case from "wrong account" so an implementer can never mistake "the allowlist isn't configured" for "the allowlist is rejecting the right person" and go fix the matching logic instead of the `.env.local` file.
  - Otherwise: requests a token, fetches the email, checks the allowlist. If allowed → `status: 'signed-in'`, token and email stored in memory. If NOT allowed → immediately discards the token, sets `status: 'denied'` with `deniedEmail` set to what was rejected, and does **not** retain the token or email anywhere.
  - `signOut()`: clears everything back to `'signed-out'`.

- [ ] **Step 1: Implement `src/state/auth.tsx`**

```tsx
import { createContext, useContext, useState, type ReactNode } from 'react';
import { requestAccessToken } from '../lib/auth/google';
import { fetchUserEmail, isAllowedEmail } from '../lib/auth/allowlist';

type Status = 'signed-out' | 'connecting' | 'signed-in' | 'denied' | 'misconfigured';

interface AuthCtx {
  status: Status;
  email: string | null;
  accessToken: string | null;
  deniedEmail: string | null;
  connect: () => Promise<void>;
  signOut: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

const OWNER_EMAIL = (import.meta.env.VITE_OWNER_EMAIL as string) || '';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('signed-out');
  const [email, setEmail] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [deniedEmail, setDeniedEmail] = useState<string | null>(null);

  const connect = async () => {
    if (!OWNER_EMAIL) {
      // Distinct from "denied": the allowlist itself isn't configured yet.
      // Never attempt sign-in in this state, and never let it look like a
      // rejected account — see docs/superpowers/google-drive-setup-runbook.md.
      setStatus('misconfigured');
      return;
    }
    setStatus('connecting');
    setDeniedEmail(null);
    try {
      const token = await requestAccessToken();
      const signedInEmail = await fetchUserEmail(token);
      if (isAllowedEmail(signedInEmail, OWNER_EMAIL)) {
        setAccessToken(token);
        setEmail(signedInEmail);
        setStatus('signed-in');
      } else {
        setAccessToken(null);
        setEmail(null);
        setDeniedEmail(signedInEmail);
        setStatus('denied');
      }
    } catch {
      setStatus('signed-out');
    }
  };

  const signOut = () => {
    setAccessToken(null);
    setEmail(null);
    setDeniedEmail(null);
    setStatus('signed-out');
  };

  return (
    <Ctx.Provider value={{ status, email, accessToken, deniedEmail, connect, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used within AuthProvider');
  return v;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/state/auth.tsx
git commit -m "feat: auth context enforcing the single-owner email allowlist"
```

---

### Task 6: Drive client (`drive/driveClient.ts`) + settings field + library sync

**Files:**
- Create: `src/lib/drive/driveClient.ts`
- Modify: `src/lib/storage/db.ts` (add `driveFolderId?: string` to `SettingsRecord`)
- Modify: `src/state/library.tsx` (add `syncDriveFolder`)
- Test: `test/storage/db.test.ts` (add a round-trip case for the new field)

**Interfaces:**
- Consumes: `getAllBooks`/`putBook` (existing), `hashBytes`, `parseEpubMetadata` (existing, Plan 1), `parseFolderId` (Task 3).
- Produces:
  - `verifyFolder(accessToken: string, folderId: string): Promise<void>` — confirms the ID actually refers to an existing, non-trashed Drive **folder** the account can see; throws a specific "folder not found" error otherwise. This exists because `parseFolderId` (Task 3) only checks the *shape* of a pasted string, not whether it's real — without this check, a bogus ID silently produces "Added 0, already had 0", indistinguishable from a real, empty folder.
  - `listEpubFiles(accessToken: string, folderId: string): Promise<{ id: string; name: string }[]>` — lists non-trashed EPUB files in the folder (filters by name ending `.epub` or Drive's epub mimetype).
  - `downloadFile(accessToken: string, fileId: string): Promise<ArrayBuffer>`.
  - `useLibrary()` gains `syncDriveFolder(accessToken: string, folderInput: string): Promise<{ added: number; skipped: number; failed: number }>` — parses the folder input, verifies the folder exists, lists files, skips any whose `driveFileId` is already in the library, downloads + imports the rest as `source: 'drive'` books. Each file's download/parse/import is individually try/caught — one corrupt EPUB is counted in `failed` and does not abort the sync or lose books already added earlier in the same run. Throws (does not swallow) on a parse failure of the folder input itself or a "folder not found" — those are whole-sync failures, unlike a single bad file.

- [ ] **Step 1: Add the failing settings test**

Add to `test/storage/db.test.ts` (inside the existing `describe('storage/db', ...)` block):
```ts
  it('round-trips an optional driveFolderId setting', async () => {
    await putSettings({ ...DEFAULT_SETTINGS, driveFolderId: '1AbC-XyZ_0123456789' });
    expect((await getSettings()).driveFolderId).toBe('1AbC-XyZ_0123456789');
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run test/storage/db.test.ts`
Expected: FAIL — `driveFolderId` not a known property.

- [ ] **Step 3: Add the field in `src/lib/storage/db.ts`**

Add to the `SettingsRecord` interface (after `speedMode`):
```ts
  speedMode: 'rsvp' | 'bionic';
  driveFolderId?: string;
```
No change needed to `DEFAULT_SETTINGS` — it's optional and the existing merge (`{ ...DEFAULT_SETTINGS, ...stored }`) already handles it.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run test/storage/db.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement `src/lib/drive/driveClient.ts`**

```ts
const API = 'https://www.googleapis.com/drive/v3/files';

interface DriveApiFile {
  id: string;
  name: string;
  mimeType: string;
}

const FOLDER_MIME = 'application/vnd.google-apps.folder';

/**
 * Confirm `folderId` is a real, visible, non-trashed Drive folder — not just
 * a string that happens to look like one. Without this, a bogus pasted ID
 * would silently list zero files, indistinguishable from a real empty folder.
 */
export async function verifyFolder(accessToken: string, folderId: string): Promise<void> {
  const url = `${API}/${folderId}?fields=${encodeURIComponent('id,mimeType,trashed')}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error("That folder wasn't found (check the link, or that you have access to it).");
  }
  const meta: { mimeType: string; trashed: boolean } = await res.json();
  if (meta.trashed || meta.mimeType !== FOLDER_MIME) {
    throw new Error("That link doesn't point to a Drive folder.");
  }
}

/** List non-trashed EPUB files directly inside the given Drive folder. */
export async function listEpubFiles(
  accessToken: string,
  folderId: string
): Promise<{ id: string; name: string }[]> {
  const q = `'${folderId}' in parents and trashed = false`;
  const url = `${API}?q=${encodeURIComponent(q)}&fields=${encodeURIComponent('files(id,name,mimeType)')}&pageSize=1000`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`Drive list failed: ${res.status}`);
  }
  const data: { files: DriveApiFile[] } = await res.json();
  return data.files
    .filter((f) => f.mimeType === 'application/epub+zip' || f.name.toLowerCase().endsWith('.epub'))
    .map((f) => ({ id: f.id, name: f.name }));
}

/** Download a Drive file's raw bytes. */
export async function downloadFile(accessToken: string, fileId: string): Promise<ArrayBuffer> {
  const res = await fetch(`${API}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Drive download failed: ${res.status}`);
  }
  return res.arrayBuffer();
}
```

- [ ] **Step 6: Add `syncDriveFolder` to `src/state/library.tsx`**

Add these imports at the top:
```tsx
import { parseFolderId } from '../lib/drive/folderLink';
import { verifyFolder, listEpubFiles, downloadFile } from '../lib/drive/driveClient';
import { parseEpubMetadata } from '../lib/epub/book';
```
(`parseEpubMetadata` and `hashBytes` are likely already imported in this file from Plan 1 — check before duplicating the import.)

Add to the `LibraryCtx` interface:
```ts
  syncDriveFolder: (accessToken: string, folderInput: string) => Promise<{ added: number; skipped: number; failed: number }>;
```

Add the implementation inside `LibraryProvider`, alongside the existing `importFile`/`remove`:
```tsx
  const syncDriveFolder = async (
    accessToken: string,
    folderInput: string
  ): Promise<{ added: number; skipped: number; failed: number }> => {
    const folderId = parseFolderId(folderInput);
    if (!folderId) {
      throw new Error("Couldn't find a folder id in that link.");
    }
    // Confirm this is a real, visible folder before listing — a bogus id
    // would otherwise silently produce "0 added", indistinguishable from a
    // real empty folder.
    await verifyFolder(accessToken, folderId);
    const files = await listEpubFiles(accessToken, folderId);
    const existingDriveIds = new Set(
      (await getAllBooks()).map((b) => b.driveFileId).filter(Boolean)
    );
    let added = 0;
    let skipped = 0;
    let failed = 0;
    for (const file of files) {
      if (existingDriveIds.has(file.id)) {
        skipped += 1;
        continue;
      }
      // Each file is isolated: one corrupt/unparseable EPUB is counted and
      // skipped, not allowed to abort the whole sync and lose books already
      // added earlier in this same run.
      try {
        const data = await downloadFile(accessToken, file.id);
        const id = hashBytes(data);
        const meta = await parseEpubMetadata(data);
        await putBook({
          id,
          title: meta.title,
          author: meta.author,
          coverDataUrl: meta.coverDataUrl,
          source: 'drive',
          driveFileId: file.id,
          data,
          addedAt: Date.now(),
        });
        added += 1;
      } catch {
        failed += 1;
      }
    }
    await refresh();
    return { added, skipped, failed };
  };
```
Add `syncDriveFolder` to the provider's context value alongside `books`, `importFile`, `remove`.

- [ ] **Step 7: Type-check + full test run**

Run: `npx tsc -b && npx vitest run`
Expected: both clean; test count grows by 1 (the new settings round-trip).

- [ ] **Step 8: Commit**

```bash
git add src/lib/drive/driveClient.ts src/lib/storage/db.ts src/state/library.tsx test/storage/db.test.ts
git commit -m "feat: Drive file listing/download and library sync, dedup by driveFileId"
```

---

### Task 7: `DriveSyncPanel` UI + wire into `Library` and `App`

**Files:**
- Create: `src/components/DriveSyncPanel.tsx`
- Modify: `src/components/Library.tsx` (mount the panel)
- Modify: `src/App.tsx` (wrap in `AuthProvider`)

**Interfaces:**
- Consumes: `useAuth` (Task 5), `useLibrary().syncDriveFolder` (Task 6).
- Produces: a self-contained panel that shows, depending on `status`:
  - `signed-out`: a "Connect Drive" button.
  - `connecting`: a disabled/loading state.
  - `misconfigured`: a distinct message that the app itself isn't set up yet (pointing at the runbook), never phrased like a rejected sign-in.
  - `denied`: a clear message naming the rejected email and the one allowed account, with a "Try a different account" button that calls `signOut()`.
  - `signed-in`: a folder-link text input (pre-filled from `settings.driveFolderId` if present) + a "Sync" button; on sync, calls `syncDriveFolder`, shows a result summary ("Added 3, already had 5, 1 failed" — omitting the failed clause when it's zero) or an error message, and persists the successfully-parsed folder id to settings for next time.

- [ ] **Step 1: Implement `src/components/DriveSyncPanel.tsx`**

```tsx
import { useState } from 'react';
import { useAuth } from '../state/auth';
import { useLibrary } from '../state/library';
import { useSettings } from '../state/settings';
import { parseFolderId } from '../lib/drive/folderLink';

export function DriveSyncPanel() {
  const { status, deniedEmail, connect, signOut, accessToken } = useAuth();
  const { syncDriveFolder } = useLibrary();
  const { settings, update } = useSettings();
  const [folderInput, setFolderInput] = useState(settings.driveFolderId ?? '');
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const panelStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 10, padding: 16,
    background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 'var(--radius)', marginBottom: 20, maxWidth: 480,
  };

  if (status === 'signed-out') {
    return (
      <div style={panelStyle}>
        <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Sync EPUBs from a Google Drive folder.</span>
        <button onClick={connect}>Connect Drive</button>
      </div>
    );
  }

  if (status === 'connecting') {
    return (
      <div style={panelStyle}>
        <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Connecting…</span>
      </div>
    );
  }

  if (status === 'misconfigured') {
    return (
      <div style={panelStyle}>
        <span style={{ color: 'var(--text-2)', fontSize: 13 }}>
          Drive sync isn't set up yet — see
          docs/superpowers/google-drive-setup-runbook.md to configure it.
        </span>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div style={panelStyle}>
        <span style={{ color: 'var(--text-2)', fontSize: 13 }}>
          Signed in as <b>{deniedEmail}</b>, but this app only works with one specific Google
          account. Try connecting with the right one.
        </span>
        <button onClick={signOut}>Try a different account</button>
      </div>
    );
  }

  // signed-in
  const onSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const result = await syncDriveFolder(accessToken!, folderInput);
      update({ driveFolderId: parseFolderId(folderInput) ?? undefined });
      const failedPart = result.failed > 0 ? `, ${result.failed} failed` : '';
      setMessage(`Added ${result.added}, already had ${result.skipped}${failedPart}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={panelStyle}>
      <label style={{ fontSize: 13, color: 'var(--text-2)' }}>
        Drive folder link or ID
        <input
          value={folderInput}
          onChange={(e) => setFolderInput(e.target.value)}
          placeholder="https://drive.google.com/drive/folders/..."
          style={{ width: '100%', marginTop: 4 }}
        />
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onSync} disabled={syncing || !folderInput.trim()}>
          {syncing ? 'Syncing…' : 'Sync'}
        </button>
        <button onClick={signOut}>Disconnect</button>
      </div>
      {message && <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{message}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Mount it in `src/components/Library.tsx`**

Add the import:
```tsx
import { DriveSyncPanel } from './DriveSyncPanel';
```
Render it above the existing "Open EPUB" button (inside the same padded container, before the `<input type="file" ...>` / button block):
```tsx
      <DriveSyncPanel />
```

- [ ] **Step 3: Wrap `App.tsx` in `AuthProvider`**

Add the import:
```tsx
import { AuthProvider } from './state/auth';
```
Wrap the existing provider nesting so `AuthProvider` is outermost (Drive sync needs auth state available anywhere `useLibrary` is used):
```tsx
    <AuthProvider>
      <SettingsProvider>
        <LibraryProvider>
          {/* ...unchanged... */}
        </LibraryProvider>
      </SettingsProvider>
    </AuthProvider>
```

- [ ] **Step 4: Type-check + build**

Run: `npx tsc -b && npm run build`
Expected: both succeed.

- [ ] **Step 5: Browser verification (core acceptance)**

Two independent things to verify here — do both regardless of whether the owner's Google Cloud setup (Task 1) is complete yet.

**A. Offline resilience of the *existing* Plan 1 library (no external dependency — always verifiable).** This plan adds a component (`DriveSyncPanel`) that mounts unconditionally at the top of the library screen, so it must not be able to break the already-shipped offline reading experience. Build + `npm run preview` + drive the in-app browser, with the network set to offline (DevTools/browser offline toggle):
1. The library screen still loads; any already-cached books are still listed and still open normally.
2. The panel renders its `signed-out` "Connect Drive" state without throwing (no error boundary, no blank screen) — merely rendering the button must not touch the network.
3. Clicking "Connect Drive" while offline fails gracefully back to `signed-out` (the GIS script load rejects, `connect()`'s catch handles it) — not an unhandled crash.

**B. Full Drive sign-in and sync flow — requires the owner's completed Task 1 setup.** This requires `.env.local` to contain a working `VITE_GOOGLE_CLIENT_ID` from the owner's own completed Google Cloud Console setup. If that hasn't been done yet, stop here and report exactly that for this half — do not fabricate a verification. If it has been done, back online:
1. Library shows a "Connect Drive" button (not `misconfigured` — confirms the env var is being read). Clicking it opens Google's consent popup.
2. Signing in with the allowed account (`kalaiselvant0@gmail.com`) shows the folder-link input. **Confirm `fetchUserEmail`'s scope pairing actually works** — the account's real email must come back from `drive/v3/about?fields=user` under the `drive.readonly`-only scope; if it 401s or returns no email, that's a real finding to report, not something to silently patch.
3. Pasting a real Drive folder link (containing at least one EPUB) and clicking Sync downloads and adds it to the library; re-clicking Sync reports it as already-had (skipped), not re-added.
4. Pasting an unrelated or nonexistent ID (e.g. a random 20-character string) surfaces the "wasn't found" message from `verifyFolder`, not a silent "Added 0".
5. The synced book opens and renders exactly like a locally-imported one.
6. If a second Google account is available to test with, confirm it is rejected with the "denied" message and never appears in the library.

Record the actual result of both halves (including if only A is verifiable) in the task report.

- [ ] **Step 6: Commit**

```bash
git add src/components/DriveSyncPanel.tsx src/components/Library.tsx src/App.tsx
git commit -m "feat: Drive connect/sync panel wired into the library"
```

---

## Self-Review

**1. Spec coverage (design spec §4 + §5 + Global Constraints):**
- OAuth Testing mode + email allowlist (§4.1, §4.2) → Tasks 1, 2, 5. ✅
- Client-side token flow, `drive.readonly` scope, no backend (§4.3) → Tasks 4, 5, 6. ✅ (identity for the allowlist check comes from Drive's own `about` endpoint under this same scope — no separate identity scope needed, simpler than the spec's own phrasing implied.)
- Choose a folder → list EPUBs → download + cache in IndexedDB (§5, Google Drive) → Tasks 3, 6. ✅ (folder selection via pasted link per this plan's confirmed decision, not the Picker API; a real Drive-side existence check in Task 6 prevents a bogus pasted ID from silently looking like an empty folder.)
- Re-sync refreshes the list; cached books stay available offline (§5) → Task 6's dedup-by-`driveFileId` + Task 7's repeatable Sync button; already-cached books are untouched by a Drive-connection failure since the token is only used at sync time. ✅
- Local files baseline (§5) — unchanged, already shipped in Plan 1. Not touched by this plan.
- Play Books bridge (§5) — documentation-only per spec; not a code task, no plan action needed.

**2. Placeholder scan:** No "TBD"/"handle errors appropriately" — every step has concrete code or concrete document text. Task 1 and part of Task 7 Step 5 are explicitly marked as depending on the owner's own external action (Google Cloud Console setup) — this is a real, disclosed external dependency, not a placeholder for undone work.

**3. Type consistency:** `AuthCtx` (Task 5) fields (`status` including the `misconfigured` case, `email`, `accessToken`, `deniedEmail`, `connect`, `signOut`) are used identically in Task 7's `DriveSyncPanel`. `syncDriveFolder(accessToken, folderInput): Promise<{added, skipped, failed}>` signature (Task 6) matches its call site in Task 7. `parseFolderId` (Task 3) and `verifyFolder` (Task 6) are used identically in Task 6 and Task 7. `BookRecord`/`SettingsRecord` fields match the existing Plan 1 schema plus the one new optional field. ✅

**4. Fail-safe distinctions preserved end to end:** "misconfigured" (allowlist not set up) vs. "denied" (wrong account) are visually and behaviorally distinct at every layer — `connect()` never attempts sign-in in the misconfigured case, and the panel never phrases misconfiguration like a rejection. "Folder not found" (bad/foreign ID) vs. "folder empty" (real folder, zero EPUBs) are distinguished by `verifyFolder` running before `listEpubFiles`. A single corrupt file's failure is isolated from the rest of a sync batch. ✅

---

## Notes for Plan 4 (not part of this plan)

Plan 4 (GitHub Pages deploy + single-account login lockdown) will:
- Create a new dedicated private repo (project page, `kalaiselvan-t.github.io/reader/`), per the confirmed decision.
- Add a GitHub Actions workflow to build and deploy on push.
- Set `vite.config.ts`'s `base` to `/reader/`.
- Add the deployed origin to the OAuth Client's Authorized JavaScript origins (an owner-performed Google Cloud Console step, same style as this plan's Task 1).
- Inject `VITE_GOOGLE_CLIENT_ID`/`VITE_OWNER_EMAIL` as GitHub Actions repository secrets/variables at build time (the values are already established by this plan's Task 1 — Plan 4 does not create new Google Cloud resources, just points the existing OAuth client at a second origin).
