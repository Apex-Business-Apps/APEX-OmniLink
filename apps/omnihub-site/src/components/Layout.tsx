import { ReactNode, useEffect, useRef, useState } from 'react';
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

function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      setMenuOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, []);

  return (
    <nav className="nav">
      <div className="container nav__inner">
        <div className="nav__left">
          <a href="/" className="nav__logo" aria-label="APEX OmniHub home">
            <img
              src="/apex-omnihub-wordmark.svg"
              alt="APEX OmniHub"
              className="nav__logo-wordmark"
              width="165"
              height="24"
              style={{
                height: '24px',
                width: 'auto',
                aspectRatio: '1012.5 / 147'
              }}
            />
          </a>
        </div>

        <ul className="nav__links" aria-label="Primary navigation">
          {siteConfig.nav.links.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="nav__link">
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="nav__actions">
          <ThemeToggle />

          <div className="nav__burger" ref={menuRef}>
            <button
              type="button"
              className="nav__burger-btn"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span
                className={
                  menuOpen
                    ? 'nav__burger-icon nav__burger-icon--open'
                    : 'nav__burger-icon'
                }
              >
                <span />
                <span />
                <span />
              </span>
            </button>

            {menuOpen && (
              <dialog
                open
                className="nav__mobile-menu"
                aria-label="Mobile navigation"
                style={{
                  border: 'none',
                  padding: 0,
                  margin: 0,
                  width: '100%',
                  height: '100%',
                  background: 'transparent',
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  zIndex: 100
                }}
              >
                <ul className="nav__mobile-links">
                  {siteConfig.nav.links.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        className="nav__mobile-link"
                        onClick={() => setMenuOpen(false)}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </dialog>
            )}
          </div>
        </div>
      </div>
    </nav>
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
