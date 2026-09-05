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
