import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getSettings, putSettings, DEFAULT_SETTINGS, type SettingsRecord } from '../lib/storage/db';

interface SettingsCtx {
  settings: SettingsRecord;
  update: (patch: Partial<SettingsRecord>) => void;
}

const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsRecord>(DEFAULT_SETTINGS);

  useEffect(() => { getSettings().then(setSettings); }, []);

  const update = (patch: Partial<SettingsRecord>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      putSettings(next);
      return next;
    });
  };

  return <Ctx.Provider value={{ settings, update }}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSettings must be used within SettingsProvider');
  return v;
}
