import { ReactNode, useEffect, useState } from 'react';
import { siteConfig } from '@/content/site';
import { ReferenceOverlay } from './ReferenceOverlay';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem('theme');
  return saved === 'dark' ? 'dark' : 'light';
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <div className="theme-toggle" role="group" aria-label="Theme toggle">
      <button
        type="button"
        className={`theme-toggle__option ${theme === 'light' ? 'is-active' : ''}`}
        onClick={() => setTheme('light')}
        aria-pressed={theme === 'light'}
      >
        WHITE FORTRESS
      </button>
      <button
        type="button"
        className={`theme-toggle__option ${theme === 'dark' ? 'is-active' : ''}`}
        onClick={() => setTheme('dark')}
        aria-pressed={theme === 'dark'}
      >
        NIGHT WATCH
      </button>
    </div>
  );
}

function getInitialAuthState(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('omnihub_session');
}

function Nav() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(getInitialAuthState);

  const handleAuthClick = () => {
    if (isAuthenticated) {
      localStorage.removeItem('omnihub_session');
      setIsAuthenticated(false);
      window.location.href = '/';
    } else {
      window.location.href = '/restricted.html';
    }
  };

  return (
    <nav className="nav">
      <div className="container nav__inner">
        <a href="/" className="nav__logo">
          <img
            className="nav__wordmark nav__wordmark--light"
            src="/assets/wordmark-light.svg"
            alt={siteConfig.nav.logo}
          />
          <img
            className="nav__wordmark nav__wordmark--dark"
            src="/assets/wordmark-night.svg"
            alt=""
            aria-hidden="true"
          />
        </a>
        <ul className="nav__links">
          {siteConfig.nav.links.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="nav__link">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="nav__actions">
          <a href={siteConfig.nav.actions.login.href} className="btn btn--ghost btn--sm">
            {siteConfig.nav.actions.login.label}
          </a>
          <a href={siteConfig.nav.actions.primary.href} className="btn btn--primary btn--sm">
            {siteConfig.nav.actions.primary.label}
          </a>
          <ThemeToggle />
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

function OverlayGuide() {
  const [overlay, setOverlay] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const value = params.get('overlay');
    if (value === 'night') {
      setOverlay('dark');
    } else if (value === 'light') {
      setOverlay('light');
    }
  }, []);

  if (!overlay) return null;

  const src =
    overlay === 'dark' ? '/reference/home-night.png' : '/reference/home-light.png';

  return <img className="overlay-guide" src={src} alt="" aria-hidden="true" />;
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
      <OverlayGuide />
    </>
  );
}
