import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { DashboardLayout } from "./components/DashboardLayout";
import { ConsentBanner } from "./components/ConsentBanner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useOfflineSupport } from "./hooks/useOfflineSupport";
import { useEffect } from 'react';
import { initializeMonitoring } from './lib/monitoring';
import { initializeSecurity } from './lib/security';
import { logConfiguration } from './lib/config';
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Links from "./pages/Links";
import Files from "./pages/Files";
import Automations from "./pages/Automations";
import Integrations from "./pages/Integrations";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false, // Prevent excessive refetches
      refetchOnMount: false, // Use cached data when available
      refetchOnReconnect: true, // Refetch when network reconnects
    },
    mutations: {
      retry: false, // Don't retry mutations by default
    },
  },
});

const AppContent = () => {
  useOfflineSupport();
  
  useEffect(() => {
    // Initialize production systems
    initializeMonitoring();
    initializeSecurity();
    logConfiguration();
  }, []);
  
  return null;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AppContent />
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ConsentBanner />
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Auth />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/dashboard" element={<DashboardLayout><Dashboard /></DashboardLayout>} />
              <Route path="/links" element={<DashboardLayout><Links /></DashboardLayout>} />
              <Route path="/files" element={<DashboardLayout><Files /></DashboardLayout>} />
              <Route path="/automations" element={<DashboardLayout><Automations /></DashboardLayout>} />
              <Route path="/integrations" element={<DashboardLayout><Integrations /></DashboardLayout>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
