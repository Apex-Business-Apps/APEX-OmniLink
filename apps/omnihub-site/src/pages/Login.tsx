import { useState, FormEvent } from 'react';
import { Layout } from '@/components/Layout';
import { Section } from '@/components/Section';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Basic validation
    if (!email || !password) {
      setError('Please enter both email and password');
      setIsLoading(false);
      return;
    }

    // Simulate authentication (replace with real auth later)
    // For now, accept any valid email format with password length >= 6
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Store session and redirect
    globalThis.localStorage.setItem('omnihub_session', JSON.stringify({
      email,
      authenticated: true,
      timestamp: Date.now(),
    }));

    globalThis.window.location.href = '/';
  };

  return (
    <Layout title="Log In">
      <Section>
        <div style={{ textAlign: 'center', maxWidth: '400px', margin: '0 auto' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-6)',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke="white" strokeWidth="2" />
              <path
                d="M4 20c0-4 4-6 8-6s8 2 8 6"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1 className="heading-2">Welcome Back</h1>
          <p className="text-secondary mt-2">Sign in to your APEX OmniHub account</p>

          <form onSubmit={handleSubmit} style={{ marginTop: 'var(--space-8)' }}>
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email
              </label>
              <input
                type="email"
                id="email"
                className="form-input"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                type="password"
                id="password"
                className="form-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="form-error" style={{ marginBottom: 'var(--space-4)' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn btn--primary btn--lg"
              style={{ width: '100%' }}
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-muted mt-8" style={{ fontSize: 'var(--font-size-sm)' }}>
            Don&apos;t have an account?{' '}
            <a href="/request-access.html" style={{ color: 'var(--color-accent)' }}>
              Request Access
            </a>
          </p>
        </div>
      </Section>
    </Layout>
  );
}
