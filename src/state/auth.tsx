import { createContext, useContext, useState, type ReactNode } from 'react';
import { requestAccessToken } from '../lib/auth/google';
import { fetchUserEmail, isAllowedEmail } from '../lib/auth/allowlist';

type Status = 'signed-out' | 'connecting' | 'signed-in' | 'denied' | 'misconfigured';

interface AuthCtx {
  status: Status;
  email: string | null;
  accessToken: string | null;
  deniedEmail: string | null;
  connect: () => Promise<void>;
  signOut: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

const OWNER_EMAIL = (import.meta.env.VITE_OWNER_EMAIL as string) || '';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('signed-out');
  const [email, setEmail] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [deniedEmail, setDeniedEmail] = useState<string | null>(null);

  const connect = async () => {
    if (!OWNER_EMAIL) {
      // Distinct from "denied": the allowlist itself isn't configured yet.
      // Never attempt sign-in in this state, and never let it look like a
      // rejected account — see docs/superpowers/google-drive-setup-runbook.md.
      setStatus('misconfigured');
      return;
    }
    setStatus('connecting');
    setDeniedEmail(null);
    try {
      const token = await requestAccessToken();
      const signedInEmail = await fetchUserEmail(token);
      if (isAllowedEmail(signedInEmail, OWNER_EMAIL)) {
        setAccessToken(token);
        setEmail(signedInEmail);
        setStatus('signed-in');
      } else {
        setAccessToken(null);
        setEmail(null);
        setDeniedEmail(signedInEmail);
        setStatus('denied');
      }
    } catch {
      setStatus('signed-out');
    }
  };

  const signOut = () => {
    setAccessToken(null);
    setEmail(null);
    setDeniedEmail(null);
    setStatus('signed-out');
  };

  return (
    <Ctx.Provider value={{ status, email, accessToken, deniedEmail, connect, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used within AuthProvider');
  return v;
}
