/**
 * Agent Workflow Hook
 *
 * Manages async agent workflow execution with polling
 *
 * Flow:
 * 1. Submit goal to Edge Function
 * 2. Receive workflow_id
 * 3. Poll orchestrator for completion
 * 4. Return result when ready
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WorkflowStatus {
  status: 'idle' | 'submitting' | 'processing' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  workflow_id?: string;
  correlation_id?: string;
  progress?: number;
}

interface UseAgentWorkflowReturn {
  status: WorkflowStatus['status'];
  result: unknown;
  error: string | null;
  submitGoal: (goal: string, context?: Record<string, unknown>) => Promise<void>;
  reset: () => void;
  workflowId: string | null;
  isLoading: boolean;
}

const POLL_INTERVAL = 2000; // Poll every 2 seconds
const MAX_POLL_DURATION = 300000; // Stop polling after 5 minutes

export function useAgentWorkflow(): UseAgentWorkflowReturn {
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>({
    status: 'idle',
  });

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const pollWorkflowStatus = useCallback(
    async (workflowId: string, pollUrl: string) => {
      try {
        // Check if we've exceeded max poll duration
        const elapsed = Date.now() - startTimeRef.current;
        if (elapsed > MAX_POLL_DURATION) {
          stopPolling();
          setWorkflowStatus({
            status: 'failed',
            error: 'Workflow timeout - operation took too long',
            workflow_id: workflowId,
          });
          return;
        }

        // Get current session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          stopPolling();
          setWorkflowStatus({
            status: 'failed',
            error: 'Authentication required',
          });
          return;
        }

        // Poll the orchestrator
        const response = await fetch(pollUrl, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          console.error(`Polling error: ${response.status}`);
          // Don't stop polling on transient errors
          return;
        }

        const data = await response.json();

        if (data.status === 'completed') {
          stopPolling();
          setWorkflowStatus({
            status: 'completed',
            result: data.result,
            workflow_id: workflowId,
          });
        } else if (data.status === 'failed') {
          stopPolling();
          setWorkflowStatus({
            status: 'failed',
            error: data.error || 'Workflow failed',
            workflow_id: workflowId,
          });
        } else {
          // Still processing - update progress if available
          setWorkflowStatus((prev) => ({
            ...prev,
            status: 'processing',
            progress: data.progress,
          }));
        }
      } catch (error) {
        console.error('Poll error:', error);
        // Don't stop polling on transient errors
      }
    },
    [stopPolling]
  );

  const submitGoal = useCallback(
    async (goal: string, context?: Record<string, unknown>) => {
      try {
        setWorkflowStatus({ status: 'submitting' });

        // Get current session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setWorkflowStatus({
            status: 'failed',
            error: 'Please sign in to use the agent',
          });
          return;
        }

        // Submit to Edge Function
        const { data, error } = await supabase.functions.invoke('omnilink-agent', {
          body: {
            message: goal,
            context,
          },
        });

        if (error) {
          console.error('Edge Function error:', error);
          setWorkflowStatus({
            status: 'failed',
            error: error.message || 'Failed to submit request',
          });
          return;
        }

        if (data.error) {
          setWorkflowStatus({
            status: 'failed',
            error: data.error,
          });
          return;
        }

        // Extract workflow info
        const { workflow_id, correlation_id, poll_url } = data;

        if (!workflow_id || !poll_url) {
          setWorkflowStatus({
            status: 'failed',
            error: 'Invalid response from server',
          });
          return;
        }

        console.log(`[Agent] Workflow started: ${workflow_id}`);

        setWorkflowStatus({
          status: 'processing',
          workflow_id,
          correlation_id,
        });

        // Start polling
        startTimeRef.current = Date.now();
        pollIntervalRef.current = setInterval(() => {
          pollWorkflowStatus(workflow_id, poll_url);
        }, POLL_INTERVAL);

        // Poll immediately
        pollWorkflowStatus(workflow_id, poll_url);
      } catch (error) {
        console.error('Submit error:', error);
        setWorkflowStatus({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
    [pollWorkflowStatus]
  );

  const reset = useCallback(() => {
    stopPolling();
    setWorkflowStatus({ status: 'idle' });
  }, [stopPolling]);

  return {
    status: workflowStatus.status,
    result: workflowStatus.result,
    error: workflowStatus.error || null,
    submitGoal,
    reset,
    workflowId: workflowStatus.workflow_id || null,
    isLoading: workflowStatus.status === 'submitting' || workflowStatus.status === 'processing',
  };
}
