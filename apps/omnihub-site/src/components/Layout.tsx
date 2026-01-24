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
    <>
      <div className="theme-toggle-segmented" aria-label="Theme selection">
        <label
          className={`theme-toggle-segmented__option ${
            isLight ? 'theme-toggle-segmented__option--active' : ''
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
          className={`theme-toggle-segmented__option ${
            isDark ? 'theme-toggle-segmented__option--active' : ''
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

      <button
        type="button"
        className="theme-toggle theme-toggle--icon"
        aria-label={isDark ? 'Switch to White Fortress theme' : 'Switch to Night Watch theme'}
        onClick={() => setTheme(!isDark)}
      >
        <span className="theme-toggle__icon" aria-hidden="true">
          {isDark ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          )}
        </span>
      </button>
    </>
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
              src="/apex-badge.png"
              alt=""
              aria-hidden="true"
              className="nav__logo-badge"
              width="32"
              height="32"
              style={{ maxHeight: 32, height: 'auto', width: 'auto' }}
            />
            <img
              src="/apex-omnihub-wordmark.svg"
              alt="APEX OmniHub"
              className="nav__logo-wordmark"
              width="320"
              height="20"
              style={{
                maxHeight: 24,
                maxWidth: 'min(42vw, 360px)',
                height: 'auto',
                width: 'auto',
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
              <div className="nav__mobile-menu" role="dialog" aria-label="Mobile navigation">
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
              </div>
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
