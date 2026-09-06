# GitHub Pages Setup Runbook (owner-performed, one time)

This gets Reader onto a public URL you can install on your phone, without
touching your existing `kalaiselvan-t.github.io` personal site. You do these
steps yourself — repo creation and Google Cloud Console changes both require
your own login.

**Time:** ~10 minutes. **Cost:** free (GitHub Pages + Actions are free for
public and private repos on personal accounts, within generous free-tier
minutes).

## 1. Create a new, dedicated, private repository

1. Go to https://github.com/new
2. Owner: your account (`kalaiselvan-t`). Repository name: `reader`.
3. **Visibility: Private.**
4. Do **not** initialize with a README/`.gitignore`/license — this repo will
   receive the existing local history via `git push`, not start fresh.
5. Click **Create repository**. Note the remote URL shown (SSH or HTTPS,
   whichever you normally use with GitHub) — Task 3 needs it.

## 2. Set the Pages source to GitHub Actions

1. In the new repo, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions** (not
   "Deploy from a branch"). Don't pick a workflow template yet — Task 2 of
   the plan adds the actual workflow file.

## 3. Add the two repository Variables

1. Go to **Settings → Secrets and variables → Actions → Variables tab**
   (not the Secrets tab — neither value here is actually sensitive).
2. Add:
   - `VITE_GOOGLE_CLIENT_ID` = the same Client ID you put in `.env.local`
     for local development (from the Plan 3 runbook).
   - `VITE_OWNER_EMAIL` = the same owner email you put in `.env.local`.

## 4. Add the new origin to your existing OAuth Client

1. Go back to https://console.cloud.google.com/apis/credentials (the same
   project you created in Plan 3's runbook).
2. Open the Web application OAuth Client you already created.
3. Under **Authorized JavaScript origins**, add:
   ```
   https://kalaiselvan-t.github.io
   ```
   **No `/reader` at the end** — Google matches origins by scheme+host+port
   only, never a path, so this one entry covers the app regardless of which
   path it's served under.
4. Save. Keep the existing `http://localhost:5173` entry too — you still
   want local dev to work.

## Known limitations (by design, not bugs)

- The repo is **private**, but the *built site* is still public once
  deployed — that's how GitHub Pages works for any repo visibility. Actual
  protection is the OAuth Testing-mode allowlist + the app's own email
  check from Plan 3, unchanged by this plan.
- The first deploy only happens after Task 3's push — nothing goes live from
  this runbook alone.
