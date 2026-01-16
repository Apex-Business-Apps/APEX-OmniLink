import { ReactNode, useEffect, useState } from 'react';
import { siteConfig } from '@/content/site';
import { ReferenceOverlay } from './ReferenceOverlay';

type LayoutProps = Readonly<{
  children: ReactNode;
  title?: string;
}>;

function BurgerMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="nav__burger">
      <button
        type="button"
        className="nav__burger-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle menu"
        aria-expanded={isOpen}
      >
        <span className={`nav__burger-icon ${isOpen ? 'nav__burger-icon--open' : ''}`}>
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>
      {isOpen && (
        <div className="nav__mobile-menu">
          <ul className="nav__mobile-links">
            {siteConfig.nav.links.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="nav__mobile-link">
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <a href={siteConfig.nav.primaryCta.href} className="btn btn--primary btn--sm nav__mobile-cta">
                {siteConfig.nav.primaryCta.label}
              </a>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

function getInitialTheme(): boolean {
  if (typeof globalThis.window === 'undefined') return false;
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
  );
}

function LogoMark() {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="nav__logo-mark"
    >
      <path
        d="M12 2 2 20h20L12 2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M12 6 6.8 16.5h10.4L12 6Z"
        fill="currentColor"
        opacity="0.12"
      />
      <path
        d="M12 10.2 9.2 16h5.6L12 10.2Z"
        fill="currentColor"
        opacity="0.28"
      />
    </svg>
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
            <LogoMark />
            <img
              className="nav__logo-wordmark"
              src="/apex-omnihub-wordmark.png"
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
          {NAV_LINKS.map((link) => (
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
  if (typeof globalThis.window === 'undefined') return false;
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
      globalThis.window.location.href = '/restricted.html';
    }
  };

  return (
    <>
      <nav className="nav">
        <div className="container nav__inner">
          <a href="/" className="nav__logo" aria-label="APEX OmniHub home">
            <LogoMark />
            <img
              className="nav__logo-wordmark"
              src="/apex-omnihub-wordmark.png"
              alt="APEX OmniHub"
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
