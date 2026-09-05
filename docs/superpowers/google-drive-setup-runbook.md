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
