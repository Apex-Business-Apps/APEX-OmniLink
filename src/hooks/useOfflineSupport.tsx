import { useEffect, useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { setupOfflineListeners, processQueuedRequests } from '@/lib/offline';
import { createDebugLogger } from '@/lib/debug-logger';

export function useOfflineSupport() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { toast } = useToast();
  // Use ref to store toast function to avoid dependency issues
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const log = createDebugLogger('useOfflineSupport.tsx', 'B');
  
  // Memoize callbacks to prevent unnecessary re-renders
  const handleOnline = useCallback(() => {
    // #region agent log
    log('Online event');
    // #endregion
    setIsOnline(true);
    toastRef.current({
      title: 'Connection restored',
      description: 'You are back online. Syncing data...',
    });
    processQueuedRequests();
  }, []);

  const handleOffline = useCallback(() => {
    // #region agent log
    log('Offline event');
    // #endregion
    setIsOnline(false);
    toastRef.current({
      title: 'Connection lost',
      description: 'You are offline. Changes will be saved locally.',
      variant: 'destructive',
    });
  }, []);

  useEffect(() => {
    // #region agent log
    log('useOfflineSupport useEffect entry', { isOnline: navigator.onLine });
    // #endregion
    
    const cleanup = setupOfflineListeners(handleOnline, handleOffline);
    return cleanup;
  }, [handleOnline, handleOffline]);

  return { isOnline };
}
