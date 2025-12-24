import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { createDebugLogger } from '@/lib/debug-logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const log = createDebugLogger('ErrorBoundary.tsx', 'D');
    
    // #region agent log
    log('ErrorBoundary caught error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
    // #endregion
    
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
    
    // Log to monitoring service if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window !== 'undefined' && (window as any).errorTracker) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).errorTracker.captureException(error, {
        extra: errorInfo,
      });
    }
    
    // Also use our monitoring system
    import('@/lib/monitoring').then(({ logError }) => {
      logError(error, {
        action: 'error_boundary',
        metadata: {
          componentStack: errorInfo.componentStack,
        },
      });
    }).catch(() => {});
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <div className="max-w-md w-full">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription className="mt-2">
                {this.state.error?.message || 'An unexpected error occurred'}
              </AlertDescription>
            </Alert>
            <div className="mt-4 flex gap-2">
              <Button onClick={this.handleReset} variant="outline">
                Try again
              </Button>
              <Button onClick={() => window.location.href = '/'} variant="default">
                Go home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
