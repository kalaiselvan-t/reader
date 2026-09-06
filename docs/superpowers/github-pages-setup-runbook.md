# GitHub Pages Setup Runbook (owner-performed, one time)

This gets Reader onto a public URL you can install on your phone, without
touching your existing `kalaiselvan-t.github.io` personal site. You do these
steps yourself — repo creation and Google Cloud Console changes both require
your own login.

**Time:** ~10 minutes. **Cost:** free (GitHub Pages + Actions are free for
public repos on personal accounts, within generous free-tier minutes).

## 1. Create a new, dedicated, public repository

1. Go to https://github.com/new
2. Owner: your account (`kalaiselvan-t`). Repository name: `reader`.
3. **Visibility: Public.** This is required, not optional: GitHub Pages on a
   private repo needs a paid GitHub plan (Pro/Team/Enterprise) — on GitHub
   Free, Pages only serves public repos. This isn't a real reduction in
   protection: the built site was always going to be publicly fetchable
   once deployed regardless of repo visibility (that's how GitHub Pages
   works). The actual gate is the OAuth Testing-mode allowlist + the app's
   own email check from Plan 3, unaffected by this choice. Nothing
   sensitive lives in the repo — the OAuth Client ID and owner email are
   both non-secret values (see Step 3 below).
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

- The repo is **public** (required for GitHub Pages on GitHub Free), and the
  *built site* is public too once deployed — that's how GitHub Pages works.
  Actual protection is the OAuth Testing-mode allowlist + the app's own
  email check from Plan 3, unchanged by this plan. No secrets live in the
  repo or its history.
- The first deploy only happens after Task 3's push — nothing goes live from
  this runbook alone.
