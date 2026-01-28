/**
 * OmniSentry Settings Toggle
 * 
 * Provides an intuitive UI for enabling/disabling OmniSentry monitoring.
 * Persists preference to localStorage - no env var installation needed.
 */

import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Shield, ShieldCheck, ShieldOff, Activity, Trash2 } from 'lucide-react';
import {
  initializeOmniSentry,
  shutdownOmniSentry,
  getHealthStatus,
  clearAllData,
  type HealthStatus,
} from '@/lib/omni-sentry';

const STORAGE_KEY = 'omni_sentry_enabled';

/**
 * Check if OmniSentry is enabled via localStorage
 */
export function isOmniSentryEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Set OmniSentry enabled state
 */
export function setOmniSentryEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
    if (enabled) {
      initializeOmniSentry();
    } else {
      shutdownOmniSentry();
    }
  } catch {
    // Storage unavailable
  }
}

/**
 * Initialize OmniSentry based on stored preference
 * Call this once at app startup
 */
export function initializeFromPreference(): void {
  if (isOmniSentryEnabled()) {
    initializeOmniSentry();
  }
}

/**
 * OmniSentry Settings Dropdown
 * Compact dropdown menu for OmniSentry controls
 */
export function OmniSentryDropdown() {
  const [enabled, setEnabled] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    setEnabled(isOmniSentryEnabled());
  }, []);

  useEffect(() => {
    if (enabled) {
      const updateHealth = () => setHealth(getHealthStatus());
      updateHealth();
      const interval = setInterval(updateHealth, 10000);
      return () => clearInterval(interval);
    } else {
      setHealth(null);
    }
  }, [enabled]);

  const handleToggle = (newValue: boolean) => {
    setEnabled(newValue);
    setOmniSentryEnabled(newValue);
  };

  const handleClearData = () => {
    clearAllData();
    setHealth(getHealthStatus());
  };

  const getStatusIcon = () => {
    if (!enabled) return <ShieldOff className="h-4 w-4 text-muted-foreground" />;
    if (!health) return <Shield className="h-4 w-4 text-muted-foreground" />;
    
    switch (health.status) {
      case 'healthy':
        return <ShieldCheck className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <Shield className="h-4 w-4 text-yellow-500" />;
      case 'critical':
        return <ShieldOff className="h-4 w-4 text-red-500" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  const getStatusColor = () => {
    if (!enabled || !health) return 'bg-muted';
    switch (health.status) {
      case 'healthy': return 'bg-green-500/10';
      case 'degraded': return 'bg-yellow-500/10';
      case 'critical': return 'bg-red-500/10';
      default: return 'bg-muted';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {getStatusIcon()}
          {enabled && health?.status === 'healthy' && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          OmniSentry
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between px-2 py-2">
          <Label htmlFor="omni-sentry-toggle" className="text-sm">
            Self-Healing Monitor
          </Label>
          <Switch
            id="omni-sentry-toggle"
            checked={enabled}
            onCheckedChange={handleToggle}
          />
        </div>

        {enabled && health && (
          <>
            <DropdownMenuSeparator />
            
            {/* Health Status */}
            <div className={`mx-2 my-2 p-2 rounded-md ${getStatusColor()}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Status</span>
                <span className="text-xs capitalize">{health.status}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground">Circuit</span>
                <span className="text-xs">{health.metrics.circuitState}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground">Error Rate</span>
                <span className="text-xs">{health.metrics.errorRate}/min</span>
              </div>
            </div>

            {health.diagnostics.length > 0 && (
              <div className="mx-2 mb-2 p-2 bg-yellow-500/10 rounded-md">
                <span className="text-xs font-medium text-yellow-600">Diagnostics</span>
                {health.diagnostics.map((d) => (
                  <p key={d} className="text-xs text-yellow-600 mt-1">{d}</p>
                ))}
              </div>
            )}

            <DropdownMenuSeparator />
            
            {/* Actions */}
            <DropdownMenuItem onClick={handleClearData} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All Data
            </DropdownMenuItem>
          </>
        )}

        {!enabled && (
          <div className="px-2 py-2 text-xs text-muted-foreground">
            Enable to activate self-healing error monitoring with circuit breaker protection.
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Compact status indicator for nav bars
 */
export function OmniSentryIndicator() {
  const [enabled, setEnabled] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    setEnabled(isOmniSentryEnabled());
  }, []);

  useEffect(() => {
    if (enabled) {
      const updateHealth = () => setHealth(getHealthStatus());
      updateHealth();
      const interval = setInterval(updateHealth, 30000);
      return () => clearInterval(interval);
    }
  }, [enabled]);

  if (!enabled) return null;

  const statusColor = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    critical: 'bg-red-500',
  }[health?.status ?? 'healthy'];

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50" title="OmniSentry Active">
      <Activity className="h-3 w-3 text-muted-foreground" />
      <span className={`h-2 w-2 rounded-full ${statusColor}`} />
    </div>
  );
}
