import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { CloudSetupMessage } from '@/components/CloudSetupMessage';
import {
  markDeviceTrusted,
  syncOnLogin,
  startBackgroundDeviceSync,
  stopBackgroundDeviceSync,
  upsertDevice,
} from '@/zero-trust/deviceRegistry';
import { recordAuditEvent } from '@/security/auditLog';
import { createDebugLogger } from '@/lib/debug-logger';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  signOut: async () => { },
  loading: true,
});

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [cloudConfigured, setCloudConfigured] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const log = createDebugLogger('AuthContext.tsx', 'B');

    // #region agent log
    log('AuthProvider useEffect entry');
    // #endregion

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const supabaseAnonKey =
        import.meta.env.VITE_SUPABASE_ANON_KEY ??
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // #region agent log
      log('Environment variables check', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseAnonKey,
      });
      // #endregion

      if (!supabaseUrl || !supabaseAnonKey) {
        if (import.meta.env.DEV) {
          console.warn(
            'Missing Supabase environment variables. Checked: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY | VITE_SUPABASE_PUBLISHABLE_KEY'
          );
        }
        setCloudConfigured(false);
        setLoading(false);
        return;
      }

      // #region agent log
      log('Before onAuthStateChange');
      // #endregion

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          // #region agent log
          log('Auth state change', {
            event,
            hasSession: !!session,
            hasUser: !!session?.user,
          });
          // #endregion
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      );

      // #region agent log
      log('Before getSession');
      // #endregion

      supabase.auth.getSession().then(({ data: { session } }) => {
        // #region agent log
        log('getSession result', {
          hasSession: !!session,
          hasUser: !!session?.user,
        });
        // #endregion
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }).catch((error) => {
        // #region agent log
        log('getSession error', {
          error: error instanceof Error ? error.message : 'unknown',
        });
        // #endregion
        if (import.meta.env.DEV) {
          console.error('Failed to get session:', error);
        }
        setLoading(false);
      });

      return () => {
        const cleanupLog = createDebugLogger('AuthContext.tsx', 'F');
        // #region agent log
        cleanupLog('AuthProvider cleanup');
        // #endregion
        subscription.unsubscribe();
      };
    } catch (error) {
      // #region agent log
      log('AuthProvider useEffect error', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      // #endregion
      if (import.meta.env.DEV) {
        console.error('AuthProvider initialization error:', error);
      }
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const log = createDebugLogger('AuthContext.tsx', 'B');

    // #region agent log
    log('Device sync useEffect entry', {
      hasSession: !!session,
      hasUser: !!session?.user,
    });
    // #endregion

    if (!session?.user) {
      stopBackgroundDeviceSync();
      return;
    }

    try {
      const deviceId = localStorage.getItem('device_id') || crypto.randomUUID();
      localStorage.setItem('device_id', deviceId);
      const fingerprint = navigator.userAgent;

      // #region agent log
      log('Before device sync operations', {
        deviceId,
        userId: session.user.id,
      });
      // #endregion

      (async () => {
        try {
          // #region agent log
          log('Before syncOnLogin');
          // #endregion
          await syncOnLogin(session.user.id);

          // #region agent log
          log('Before upsertDevice');
          // #endregion
          await upsertDevice(session.user.id, deviceId, { fingerprint }, 'suspect');

          // #region agent log
          log('Before markDeviceTrusted');
          // #endregion
          await markDeviceTrusted(deviceId);

          // #region agent log
          log('Before startBackgroundDeviceSync');
          // #endregion
          startBackgroundDeviceSync(session.user.id);

          recordAuditEvent({
            actorId: session.user.id,
            actionType: 'login',
            resourceType: 'session',
            resourceId: deviceId,
            metadata: { fingerprint },
          });

          // #region agent log
          log('Device sync operations complete');
          // #endregion
        } catch (error) {
          // #region agent log
          log('Device sync operations error', {
            error: error instanceof Error ? error.message : 'unknown',
          });
          // #endregion
          if (import.meta.env.DEV) {
            console.error('Device sync error:', error);
          }
        }
      })();
    } catch (error) {
      // #region agent log
      log('Device sync useEffect error', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      // #endregion
      if (import.meta.env.DEV) {
        console.error('Device sync setup error:', error);
      }
    }

    return () => {
      const cleanupLog = createDebugLogger('AuthContext.tsx', 'F');
      // #region agent log
      cleanupLog('Device sync cleanup');
      // #endregion
      stopBackgroundDeviceSync();
    };
  }, [session]);

  const signOut = async () => {
    await supabase.auth.signOut();
    stopBackgroundDeviceSync();
    if (session?.user) {
      recordAuditEvent({
        actorId: session.user.id,
        actionType: 'logout',
        resourceType: 'session',
        resourceId: 'self',
      });
    }
    navigate('/auth');
  };

  // Show setup message if Cloud is not configured
  if (!cloudConfigured) {
    return <CloudSetupMessage />;
  }

  const contextValue = React.useMemo(
    () => ({ user, session, signOut, loading }),
    [user, session, loading]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
