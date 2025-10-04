import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ShieldAlert } from 'lucide-react';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [devBypass, setDevBypass] = useState(false);

  // Check for dev bypass on mount and listen for storage changes
  useEffect(() => {
    const checkDevBypass = () => {
      const bypass = localStorage.getItem('__DEV_BYPASS__') === 'true';
      setDevBypass(bypass);
    };
    
    checkDevBypass();
    window.addEventListener('storage', checkDevBypass);
    
    // Secret key combo: Ctrl+Shift+D
    const handleKeyCombo = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        const newValue = localStorage.getItem('__DEV_BYPASS__') !== 'true';
        localStorage.setItem('__DEV_BYPASS__', String(newValue));
        setDevBypass(newValue);
        console.log(`🔓 DEV BYPASS ${newValue ? 'ENABLED' : 'DISABLED'}`);
      }
    };
    
    window.addEventListener('keydown', handleKeyCombo);
    
    return () => {
      window.removeEventListener('storage', checkDevBypass);
      window.removeEventListener('keydown', handleKeyCombo);
    };
  }, []);

  useEffect(() => {
    if (!loading && !user && !devBypass) {
      navigate('/auth');
    }
  }, [user, loading, devBypass, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && !devBypass) {
    return null;
  }

  return (
    <>
      {devBypass && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-black px-4 py-2 text-center font-semibold z-50 flex items-center justify-center gap-2">
          <ShieldAlert className="h-4 w-4" />
          DEV BYPASS ACTIVE - Press Ctrl+Shift+D to disable
        </div>
      )}
      <div className={devBypass ? 'pt-10' : ''}>
        {children}
      </div>
    </>
  );
};