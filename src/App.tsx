import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { Web3Provider } from "./providers/Web3Provider";
import { DashboardLayout } from "./components/DashboardLayout";
import { ConsentBanner } from "./components/ConsentBanner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PaidAccessRoute } from "./components/PaidAccessRoute";
import { useOfflineSupport } from "./hooks/useOfflineSupport";
import { useEffect, lazy, Suspense } from 'react';
import { initializeMonitoring } from './lib/monitoring';
import { initializeSecurity } from './lib/security';
import { logConfiguration } from './lib/config';
import { createDebugLogger } from './lib/debug-logger';
import { Loader2 } from 'lucide-react';
import { OMNIDASH_FLAG } from './omnidash/types';

// Lazy load pages for better code splitting
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Links = lazy(() => import("./pages/Links"));
const Files = lazy(() => import("./pages/Files"));
const Automations = lazy(() => import("./pages/Automations"));
const Integrations = lazy(() => import("./pages/Integrations"));
const ApexAssistant = lazy(() => import("./pages/ApexAssistant"));
const Todos = lazy(() => import("./pages/Todos"));
const Privacy = lazy(() => import("./pages/Privacy"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TradeLine247 = lazy(() => import("./pages/apps/TradeLine247"));
const AutoRepAi = lazy(() => import("./pages/apps/AutoRepAi"));
const KeepSafe = lazy(() => import("./pages/apps/KeepSafe"));
const StrideGuide = lazy(() => import("./pages/apps/StrideGuide"));
const RobuxMinerPro = lazy(() => import("./pages/apps/RobuxMinerPro"));
const FLOWBills = lazy(() => import("./pages/apps/FLOWBills"));
const JubeeLove = lazy(() => import("./pages/apps/JubeeLove"));
const BuiltCanadian = lazy(() => import("./pages/apps/BuiltCanadian"));
const TechSpecs = lazy(() => import("./pages/TechSpecs"));
const Diagnostics = lazy(() => import("./pages/Diagnostics"));
const Health = lazy(() => import("./pages/Health"));
const OmniDashLayout = lazy(() => import("./pages/OmniDash/OmniDashLayout"));
const OmniDashToday = lazy(() => import("./pages/OmniDash/Today"));
const OmniDashPipeline = lazy(() => import("./pages/OmniDash/Pipeline"));
const OmniDashKpis = lazy(() => import("./pages/OmniDash/Kpis"));
const OmniDashOps = lazy(() => import("./pages/OmniDash/Ops"));
const OmniDashIntegrations = lazy(() => import("./pages/OmniDash/Integrations"));
const OmniDashEvents = lazy(() => import("./pages/OmniDash/Events"));
const OmniDashEntities = lazy(() => import("./pages/OmniDash/Entities"));
const OmniDashRuns = lazy(() => import("./pages/OmniDash/Runs"));
const OmniDashApprovals = lazy(() => import("./pages/OmniDash/Approvals"));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      const log = createDebugLogger('App.tsx', 'C');
      // #region agent log
      log('React Query global error', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      // #endregion
      if (import.meta.env.DEV) {
        console.error('React Query error:', error);
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      const log = createDebugLogger('App.tsx', 'C');
      // #region agent log
      log('React Query mutation error', {
        error: error instanceof Error ? error.message : 'unknown',
      });
      // #endregion
      if (import.meta.env.DEV) {
        console.error('React Query mutation error:', error);
      }
    },
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error: unknown) => {
        const log = createDebugLogger('App.tsx', 'C');
        // #region agent log
        const errorStatus = (error as { status?: number })?.status;
        log('React Query retry check', {
          failureCount,
          errorStatus,
          willRetry: errorStatus !== undefined && (errorStatus < 400 || errorStatus >= 500) ? failureCount < 3 : false,
        });
        // #endregion
        // Don't retry on 4xx errors
        if (errorStatus !== undefined && errorStatus >= 400 && errorStatus < 500) return false;
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
    const log = createDebugLogger('App.tsx', 'A');
    
    // #region agent log
    log('AppContent useEffect entry');
    // #endregion
    
    try {
      // Initialize production systems
      // #region agent log
      log('Before initializeMonitoring');
      // #endregion
      initializeMonitoring();
      
      // #region agent log
      log('Before initializeSecurity');
      // #endregion
      initializeSecurity();
      
      // #region agent log
      log('Before logConfiguration');
      // #endregion
      logConfiguration();
      
      // #region agent log
      log('AppContent initialization complete');
      // #endregion
    } catch (error) {
      // #region agent log
      log('AppContent initialization error', { 
        error: error instanceof Error ? error.message : 'unknown' 
      });
      // #endregion
      console.error('Failed to initialize app:', error);
    }
  }, []);
  
  return null;
};

const App = () => (
  <div data-testid="app-shell">
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AppContent />
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ConsentBanner />
          <AuthProvider>
            <Web3Provider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/login" element={<Auth />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/dashboard" element={<PaidAccessRoute><DashboardLayout><Dashboard /></DashboardLayout></PaidAccessRoute>} />
                <Route path="/links" element={<PaidAccessRoute><DashboardLayout><Links /></DashboardLayout></PaidAccessRoute>} />
                <Route path="/files" element={<PaidAccessRoute><DashboardLayout><Files /></DashboardLayout></PaidAccessRoute>} />
                <Route path="/automations" element={<PaidAccessRoute><DashboardLayout><Automations /></DashboardLayout></PaidAccessRoute>} />
                <Route path="/integrations" element={<PaidAccessRoute><DashboardLayout><Integrations /></DashboardLayout></PaidAccessRoute>} />
                <Route path="/apex" element={<PaidAccessRoute><DashboardLayout><ApexAssistant /></DashboardLayout></PaidAccessRoute>} />
                <Route path="/todos" element={<PaidAccessRoute><DashboardLayout><Todos /></DashboardLayout></PaidAccessRoute>} />
                <Route path="/apps/tradeline247" element={<TradeLine247 />} />
                <Route path="/apps/autorepai" element={<AutoRepAi />} />
                <Route path="/apps/keepsafe" element={<KeepSafe />} />
                <Route path="/apps/strideguide" element={<StrideGuide />} />
                <Route path="/apps/robuxminerpro" element={<RobuxMinerPro />} />
                <Route path="/apps/flowbills" element={<FLOWBills />} />
                <Route path="/apps/jubeelove" element={<JubeeLove />} />
                <Route path="/apps/built-canadian" element={<BuiltCanadian />} />
                <Route path="/tech-specs" element={<TechSpecs />} />
                <Route path="/diagnostics" element={<PaidAccessRoute><DashboardLayout><Diagnostics /></DashboardLayout></PaidAccessRoute>} />
                <Route path="/health" element={<Health />} />
              {OMNIDASH_FLAG && (
                <Route path="/omnidash" element={<DashboardLayout><OmniDashLayout /></DashboardLayout>}>
                  <Route index element={<OmniDashToday />} />
                  <Route path="pipeline" element={<OmniDashPipeline />} />
                  <Route path="kpis" element={<OmniDashKpis />} />
                  <Route path="ops" element={<OmniDashOps />} />
                  <Route path="integrations" element={<OmniDashIntegrations />} />
                  <Route path="events" element={<OmniDashEvents />} />
                  <Route path="entities" element={<OmniDashEntities />} />
                  <Route path="runs" element={<OmniDashRuns />} />
                  <Route path="approvals" element={<OmniDashApprovals />} />
                </Route>
              )}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </Web3Provider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  </div>
);

export default App;
