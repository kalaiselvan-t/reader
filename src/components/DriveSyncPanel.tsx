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
      const relinkedPart = result.relinked > 0 ? `, ${result.relinked} relinked` : '';
      const failedPart = result.failed > 0 ? `, ${result.failed} failed` : '';
      setMessage(`Added ${result.added}, already had ${result.skipped}${relinkedPart}${failedPart}.`);
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
