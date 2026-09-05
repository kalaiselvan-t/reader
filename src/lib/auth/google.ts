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
