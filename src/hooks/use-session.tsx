'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';

interface Session {
  name: string;
  role: string;
}

interface SessionContextType {
  session: Session | null;
  setSession: (session: Session | null, rememberMe?: boolean) => void;
  isLoading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedSession = localStorage.getItem('session');
      if (storedSession) {
        setSessionState(JSON.parse(storedSession));
      }
    } catch (error) {
      console.error("Could not load session from localStorage", error);
      localStorage.removeItem('session');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setSession = useCallback((sessionData: Session | null, rememberMe: boolean = false) => {
    setSessionState(sessionData);
    if (sessionData && rememberMe) {
      try {
        localStorage.setItem('session', JSON.stringify(sessionData));
      } catch (error) {
        console.error("Could not save session to localStorage", error);
      }
    } else {
      localStorage.removeItem('session');
    }
  }, []);


  const value = { session, setSession, isLoading };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
