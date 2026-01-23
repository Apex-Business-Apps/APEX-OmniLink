import { ReactNode, useEffect, useState } from 'react';
import { siteConfig } from '@/content/site';
import { ReferenceOverlay } from './ReferenceOverlay';

type LayoutProps = Readonly<{
  children: ReactNode;
  title?: string;
}>;

function getInitialTheme(): boolean {
  if (globalThis.window === undefined) return false;
  const saved = globalThis.localStorage.getItem('theme');
  const prefersDark =
    globalThis.window.matchMedia('(prefers-color-scheme: dark)').matches;
  return saved === 'dark' || (!saved && prefersDark);
}

function ThemeToggle() {
  const [isDark, setIsDark] = useState(getInitialTheme);
  const isLight = !isDark;

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  }, [isDark]);

  const setTheme = (dark: boolean) => {
    const newTheme = dark ? 'dark' : 'light';
    setIsDark(dark);
    globalThis.localStorage.setItem('theme', newTheme);
    document.documentElement.dataset.theme = newTheme;
  };

  return (
    <div className="theme-toggle-segmented" aria-label="Theme selection">
      <label
        className={`theme-toggle-segmented__option ${isLight ? 'theme-toggle-segmented__option--active' : ''
          }`}
      >
        <input
          className="theme-toggle-segmented__input"
          type="radio"
          name="theme"
          value="light"
          checked={isLight}
          onChange={() => setTheme(false)}
        />
        WHITE FORTRESS
      </label>
      <label
        className={`theme-toggle-segmented__option ${isDark ? 'theme-toggle-segmented__option--active' : ''
          }`}
      >
        <input
          className="theme-toggle-segmented__input"
          type="radio"
          name="theme"
          value="dark"
          checked={isDark}
          onChange={() => setTheme(true)}
        />
        NIGHT WATCH
      </label>
    </div>
  );
}

function BurgerIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

type MobileDrawerProps = Readonly<{
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  onAuthClick: () => void;
}>;

function MobileDrawer({
  isOpen,
  onClose,
  isAuthenticated,
  onAuthClick,
}: MobileDrawerProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <button
        type="button"
        className="drawer-backdrop"
        onClick={onClose}
        aria-label="Close menu"
      />
      <dialog
        className="drawer"
        aria-label="Navigation menu"
        open
        onCancel={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        <div className="drawer__header">
          <a href="/" className="nav__logo" aria-label="APEX OmniHub home">
            <img
              className="nav__logo-wordmark"
              src="/apex-omnihub-wordmark.svg"
              alt="APEX OmniHub"
            />
          </a>
          <button
            type="button"
            className="drawer__close"
            onClick={onClose}
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        </div>
        <nav className="drawer__nav" aria-label="Main navigation">
          {siteConfig.nav.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="drawer__link"
              onClick={onClose}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="drawer__footer">
          <ThemeToggle />
          <button
            type="button"
            className="nav__link nav__link--action nav__auth-btn"
            onClick={() => {
              onAuthClick();
              onClose();
            }}
          >
            {isAuthenticated ? 'Log out' : 'Log in'}
          </button>
        </div>
      </dialog>
    </>
  );
}

function getInitialAuthState(): boolean {
  if (globalThis.window === undefined) return false;
  return Boolean(globalThis.localStorage.getItem('omnihub_session'));
}

function Nav() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(getInitialAuthState);

  const handleAuthClick = () => {
    if (isAuthenticated) {
      globalThis.localStorage.removeItem('omnihub_session');
      setIsAuthenticated(false);
      globalThis.window.location.href = '/';
    } else {
      globalThis.window.location.href = '/login.html';
    }
  };

  return (
    <>
      <nav className="nav">
        <div className="container nav__inner">
          <a href="/" className="nav__logo" aria-label="APEX OmniHub home">
            <img
              className="nav__logo-wordmark h-6 w-auto object-contain"
            />
          </a>

          <div className="nav__actions">
            <button
              type="button"
              className="nav__burger"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              aria-expanded={drawerOpen}
            >
              <BurgerIcon />
            </button>
            <ThemeToggle />
            <button
              type="button"
              className="nav__link nav__link--action nav__auth-btn"
              onClick={handleAuthClick}
            >
              {isAuthenticated ? 'Log out' : 'Log in'}
            </button>
          </div>
        </div>
      </nav>
      <MobileDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        isAuthenticated={isAuthenticated}
        onAuthClick={handleAuthClick}
      />
    </>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <p className="footer__copyright">{siteConfig.footer.copyright}</p>
        <ul className="footer__links">
          {siteConfig.footer.links.map((link) => (
            <li key={link.href}>
              <a href={link.href + '.html'} className="footer__link">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
      {/* Maestro Observability Indicator */}
      <div className="container" style={{
        fontSize: '0.75rem',
        color: 'var(--color-text-secondary)',
        opacity: 0.7,
        paddingTop: 'var(--space-4)',
        borderTop: '1px solid var(--color-border)',
        marginTop: 'var(--space-4)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: import.meta.env.VITE_MAESTRO_ENABLED === 'true' ? 'var(--color-success)' : 'var(--color-text-muted)'
        }} />
        <span>
          Maestro: {import.meta.env.VITE_MAESTRO_ENABLED === 'true' ? 'Active' : 'Disabled'}
        </span>
      </div>
    </footer>
  );
}

export function Layout({ children, title }: LayoutProps) {
  useEffect(() => {
    if (title) {
      document.title = `${title} | ${siteConfig.name}`;
    } else {
      document.title = `${siteConfig.name} - Intelligence, Designed.`;
    }
  }, [title]);

  return (
    <>
      <ReferenceOverlay />
      <Nav />
      <main>{children}</main>
      <Footer />
    </>
  );
}
