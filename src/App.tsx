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
import ApexAssistant from "./pages/ApexAssistant";
import Todos from "./pages/Todos";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";
import TradeLine247 from "./pages/apps/TradeLine247";
import AutoRepAi from "./pages/apps/AutoRepAi";
import KeepSafe from "./pages/apps/KeepSafe";
import StrideGuide from "./pages/apps/StrideGuide";
import RobuxMinerPro from "./pages/apps/RobuxMinerPro";
import FLOWBills from "./pages/apps/FLOWBills";
import JubeeLove from "./pages/apps/JubeeLove";
import BuiltCanadian from "./pages/apps/BuiltCanadian";
import TechSpecs from "./pages/TechSpecs";

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
              <Route path="/auth" element={<Auth />} />
              <Route path="/login" element={<Auth />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/dashboard" element={<DashboardLayout><Dashboard /></DashboardLayout>} />
              <Route path="/links" element={<DashboardLayout><Links /></DashboardLayout>} />
              <Route path="/files" element={<DashboardLayout><Files /></DashboardLayout>} />
            <Route path="/automations" element={<DashboardLayout><Automations /></DashboardLayout>} />
            <Route path="/integrations" element={<DashboardLayout><Integrations /></DashboardLayout>} />
            <Route path="/apex" element={<DashboardLayout><ApexAssistant /></DashboardLayout>} />
              <Route path="/todos" element={<DashboardLayout><Todos /></DashboardLayout>} />
              <Route path="/apps/tradeline247" element={<TradeLine247 />} />
              <Route path="/apps/autorepai" element={<AutoRepAi />} />
              <Route path="/apps/keepsafe" element={<KeepSafe />} />
              <Route path="/apps/strideguide" element={<StrideGuide />} />
              <Route path="/apps/robuxminerpro" element={<RobuxMinerPro />} />
              <Route path="/apps/flowbills" element={<FLOWBills />} />
              <Route path="/apps/jubeelove" element={<JubeeLove />} />
              <Route path="/apps/built-canadian" element={<BuiltCanadian />} />
              <Route path="/tech-specs" element={<TechSpecs />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
