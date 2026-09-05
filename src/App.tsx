import { useState } from 'react';
import { AuthProvider } from './state/auth';
import { SettingsProvider } from './state/settings';
import { LibraryProvider } from './state/library';
import { TopBar } from './components/TopBar';
import { Library } from './components/Library';
import { Reader } from './components/Reader';

export default function App() {
  const [openBookId, setOpenBookId] = useState<string | null>(null);

  return (
    <AuthProvider>
      <SettingsProvider>
        <LibraryProvider>
          {openBookId ? (
            <>
              <TopBar title="Reading" onBack={() => setOpenBookId(null)} />
              <Reader bookId={openBookId} />
            </>
          ) : (
            <>
              <TopBar title="Reader" />
              <Library onOpenBook={setOpenBookId} />
            </>
          )}
        </LibraryProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
