import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabaseClient';

interface DebugContextType {
  debugMode: boolean;
  setDebugMode: (enabled: boolean) => void;
  isAdmin: boolean;
  adminLoading: boolean;
}

const DebugContext = createContext<DebugContextType | undefined>(undefined);

export function DebugProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [debugMode, setDebugModeState] = useState(() => {
    return localStorage.getItem('limbahguna_debug_mode') === 'true';
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        setAdminLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        setIsAdmin(!error && !!data);
      } catch {
        setIsAdmin(false);
      } finally {
        setAdminLoading(false);
      }
    };

    checkAdmin();
  }, [user]);

  const setDebugMode = (enabled: boolean) => {
    setDebugModeState(enabled);
    localStorage.setItem('limbahguna_debug_mode', enabled ? 'true' : 'false');
  };

  // Non-admins can never have debug mode on
  const effectiveDebugMode = isAdmin && debugMode;

  return (
    <DebugContext.Provider value={{ debugMode: effectiveDebugMode, setDebugMode, isAdmin, adminLoading }}>
      {children}
    </DebugContext.Provider>
  );
}

export function useDebug() {
  const context = useContext(DebugContext);
  if (context === undefined) {
    throw new Error('useDebug must be used within a DebugProvider');
  }
  return context;
}
