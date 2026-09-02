import { useState } from 'react';
import { SettingsProvider } from './state/settings';
import { LibraryProvider } from './state/library';
import { TopBar } from './components/TopBar';
import { Library } from './components/Library';

export default function App() {
  const [openBookId, setOpenBookId] = useState<string | null>(null);

  return (
    <SettingsProvider>
      <LibraryProvider>
        {openBookId ? (
          <>
            <TopBar title="Reading" onBack={() => setOpenBookId(null)} />
            <div style={{ padding: 18, color: 'var(--text-2)' }}>
              Reader mounts here (Task 8): {openBookId}
            </div>
          </>
        ) : (
          <>
            <TopBar title="Reader" />
            <Library onOpenBook={setOpenBookId} />
          </>
        )}
      </LibraryProvider>
    </SettingsProvider>
  );
}
