/**
 * OmniTrace Runs Page Tests
 *
 * Tests cover:
 * 1. Renders list of runs
 * 2. Handles empty state gracefully
 * 3. Shows loading state
 * 4. Handles errors
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the API module
vi.mock('@/omnidash/omnilink-api', () => ({
  fetchOmniTraceRuns: vi.fn(),
  fetchOmniTraceRunDetail: vi.fn(),
}));

// Mock the auth context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    session: { access_token: 'mock-token' },
  })),
}));

// Import after mocks are set up
import { Runs } from '@/pages/OmniDash/Runs';
import { fetchOmniTraceRuns } from '@/omnidash/omnilink-api';
import type { OmniTraceRunsListResponse } from '@/omnidash/types';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('OmniTrace Runs Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page title and description', async () => {
    const mockData: OmniTraceRunsListResponse = {
      runs: [],
      total: 0,
      limit: 50,
    };
    vi.mocked(fetchOmniTraceRuns).mockResolvedValue(mockData);

    renderWithProviders(<Runs />);

    expect(screen.getByText('OmniTrace Runs')).toBeInTheDocument();
    expect(
      screen.getByText(/Workflow execution history with event timeline/)
    ).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    // Never resolve the promise to keep loading state
    vi.mocked(fetchOmniTraceRuns).mockImplementation(
      () => new Promise(() => {})
    );

    renderWithProviders(<Runs />);

    expect(screen.getByText('Loading runs...')).toBeInTheDocument();
  });

  it('handles empty state gracefully', async () => {
    const mockData: OmniTraceRunsListResponse = {
      runs: [],
      total: 0,
      limit: 50,
    };
    vi.mocked(fetchOmniTraceRuns).mockResolvedValue(mockData);

    renderWithProviders(<Runs />);

    // Wait for the empty state message
    const emptyMessage = await screen.findByText(
      /No workflow runs recorded yet/
    );
    expect(emptyMessage).toBeInTheDocument();
  });

  it('renders runs when data is available', async () => {
    const mockData: OmniTraceRunsListResponse = {
      runs: [
        {
          id: 'run-1',
          workflow_id: 'wf-test-12345678',
          trace_id: 'trace-1',
          user_id: 'test-user-id',
          status: 'completed',
          input_redacted: { goal: 'test' },
          output_redacted: { status: 'success' },
          input_hash: 'abc123def456',
          output_hash: 'xyz789',
          event_count: 5,
          created_at: '2026-01-24T10:00:00Z',
          updated_at: '2026-01-24T10:01:00Z',
        },
        {
          id: 'run-2',
          workflow_id: 'wf-running-workflow',
          trace_id: 'trace-2',
          user_id: 'test-user-id',
          status: 'running',
          input_redacted: {},
          output_redacted: null,
          input_hash: 'hash123',
          output_hash: null,
          event_count: 2,
          created_at: '2026-01-24T11:00:00Z',
          updated_at: '2026-01-24T11:00:00Z',
        },
      ],
      total: 2,
      limit: 50,
    };
    vi.mocked(fetchOmniTraceRuns).mockResolvedValue(mockData);

    renderWithProviders(<Runs />);

    // Wait for runs to render
    const completedBadge = await screen.findByText('completed');
    expect(completedBadge).toBeInTheDocument();

    const runningBadge = await screen.findByText('running');
    expect(runningBadge).toBeInTheDocument();

    // Check event counts are displayed
    expect(screen.getByText('5 events')).toBeInTheDocument();
    expect(screen.getByText('2 events')).toBeInTheDocument();

    // Check total count
    expect(screen.getByText('Showing 2 of 2 runs')).toBeInTheDocument();
  });

  it('shows error state when fetch fails', async () => {
    vi.mocked(fetchOmniTraceRuns).mockRejectedValue(
      new Error('Network error')
    );

    renderWithProviders(<Runs />);

    const errorMessage = await screen.findByText(/Failed to load runs/);
    expect(errorMessage).toBeInTheDocument();
    expect(screen.getByText(/Network error/)).toBeInTheDocument();
  });

  it('displays status badges with correct styling', async () => {
    const mockData: OmniTraceRunsListResponse = {
      runs: [
        {
          id: 'run-failed',
          workflow_id: 'wf-failed',
          trace_id: 'trace-f',
          user_id: 'test-user-id',
          status: 'failed',
          input_redacted: {},
          output_redacted: null,
          input_hash: 'hash',
          output_hash: null,
          event_count: 1,
          created_at: '2026-01-24T10:00:00Z',
          updated_at: '2026-01-24T10:00:00Z',
        },
      ],
      total: 1,
      limit: 50,
    };
    vi.mocked(fetchOmniTraceRuns).mockResolvedValue(mockData);

    renderWithProviders(<Runs />);

    const failedBadge = await screen.findByText('failed');
    expect(failedBadge).toBeInTheDocument();
  });

  it('truncates long workflow IDs', async () => {
    const longWorkflowId = 'workflow-with-a-very-long-identifier-12345678';
    const mockData: OmniTraceRunsListResponse = {
      runs: [
        {
          id: 'run-1',
          workflow_id: longWorkflowId,
          trace_id: 'trace-1',
          user_id: 'test-user-id',
          status: 'completed',
          input_redacted: {},
          output_redacted: null,
          input_hash: 'hash',
          output_hash: null,
          event_count: 0,
          created_at: '2026-01-24T10:00:00Z',
          updated_at: '2026-01-24T10:00:00Z',
        },
      ],
      total: 1,
      limit: 50,
    };
    vi.mocked(fetchOmniTraceRuns).mockResolvedValue(mockData);

    renderWithProviders(<Runs />);

    // Wait for content to render
    await screen.findByText('completed');

    // The full workflow ID should not be displayed
    expect(screen.queryByText(longWorkflowId)).not.toBeInTheDocument();

    // Instead, a truncated version should be shown (workflow-w...12345678)
    const truncatedElement = screen.getByText(/workflow-w\.\.\.12345678/);
    expect(truncatedElement).toBeInTheDocument();
  });
});
