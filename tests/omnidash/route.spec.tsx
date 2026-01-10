import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import OmniDashLayout from '@/pages/OmniDash/OmniDashLayout';

vi.mock('@/omnidash/types', async () => {
  const actual = await vi.importActual<unknown>('@/omnidash/types');
  return {
    ...actual,
    OMNIDASH_FLAG: true,
  };
});

vi.mock('@/omnidash/hooks', () => ({
  useAdminAccess: () => ({ isAdmin: true, loading: false, featureEnabled: true }),
  useOmniDashSettings: () => ({
    data: {
      demo_mode: false,
      show_connected_ecosystem: false,
      anonymize_kpis: false,
      freeze_mode: false,
      power_block_started_at: null,
      power_block_duration_minutes: 90,
      updated_at: new Date().toISOString(),
      user_id: 'u1',
    },
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'admin@example.com' } }),
}));

vi.mock('@/omnidash/api', () => ({
  fetchHealthSnapshot: () => Promise.resolve({ lastUpdated: new Date().toISOString() }),
}));

describe('OmniDash routes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it.skip('renders OmniDash layout for admin user', async () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/omnidash']}>
          <Routes>
            <Route path="/omnidash" element={<OmniDashLayout />}>
              <Route index element={<div>Today</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText(/APEX OmniHub/i)).toBeInTheDocument();
    expect(await screen.findByTestId('omnidash-nav-o')).toBeInTheDocument();
    expect(await screen.findByText(/Today/)).toBeInTheDocument();
  });
});

