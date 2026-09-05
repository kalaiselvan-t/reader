const API = 'https://www.googleapis.com/drive/v3/files';

interface DriveApiFile {
  id: string;
  name: string;
  mimeType: string;
}

const FOLDER_MIME = 'application/vnd.google-apps.folder';

/**
 * Thrown when a Drive API call fails with 401/403 — almost always an expired
 * or revoked access token, not a genuine problem with the request itself.
 * Callers should treat this as "reconnect", not as an error to surface as-is.
 */
export class DriveAuthError extends Error {}

function isAuthStatus(status: number): boolean {
  return status === 401 || status === 403;
}

/**
 * Confirm `folderId` is a real, visible, non-trashed Drive folder — not just
 * a string that happens to look like one. Without this, a bogus pasted ID
 * would silently list zero files, indistinguishable from a real empty folder.
 */
export async function verifyFolder(accessToken: string, folderId: string): Promise<void> {
  const url = `${API}/${folderId}?fields=${encodeURIComponent('id,mimeType,trashed')}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    if (isAuthStatus(res.status)) {
      throw new DriveAuthError('Drive session expired.');
    }
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
    if (isAuthStatus(res.status)) {
      throw new DriveAuthError('Drive session expired.');
    }
    throw new Error(`Drive list failed: ${res.status}`);
  }
  const data: { files: DriveApiFile[] } = await res.json();
  const files = data.files ?? [];
  return files
    .filter((f) => f.mimeType === 'application/epub+zip' || f.name.toLowerCase().endsWith('.epub'))
    .map((f) => ({ id: f.id, name: f.name }));
}

/** Download a Drive file's raw bytes. */
export async function downloadFile(accessToken: string, fileId: string): Promise<ArrayBuffer> {
  const res = await fetch(`${API}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    if (isAuthStatus(res.status)) {
      throw new DriveAuthError('Drive session expired.');
    }
    throw new Error(`Drive download failed: ${res.status}`);
  }
  return res.arrayBuffer();
}
