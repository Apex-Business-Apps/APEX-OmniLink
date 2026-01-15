import { ReactNode, useEffect, useState } from 'react';
import { siteConfig } from '@/content/site';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

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
  if (typeof window === 'undefined') return false;
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return saved === 'dark' || (!saved && prefersDark);
}

function ThemeToggle() {
  const [isDark, setIsDark] = useState(getInitialTheme);

  useEffect(() => {
    // Sync DOM attribute with state on mount
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const setTheme = (dark: boolean) => {
    const newTheme = dark ? 'dark' : 'light';
    setIsDark(dark);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return (
    <div className="theme-toggle-segmented" role="radiogroup" aria-label="Theme selection">
      <button
        type="button"
        className={`theme-toggle-segmented__option ${!isDark ? 'theme-toggle-segmented__option--active' : ''}`}
        onClick={() => setTheme(false)}
        aria-checked={!isDark}
        role="radio"
      >
        WHITE FORTRESS
      </button>
      <button
        type="button"
        className={`theme-toggle-segmented__option ${isDark ? 'theme-toggle-segmented__option--active' : ''}`}
        onClick={() => setTheme(true)}
        aria-checked={isDark}
        role="radio"
      >
        NIGHT WATCH
      </button>
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

function Nav() {
  return (
    <nav className="nav">
      <div className="container nav__inner">
        <div className="nav__left">
          <a href="/" className="nav__logo" aria-label="APEX OmniHub home">
            <LogoMark />
            <span className="nav__logo-text">{siteConfig.nav.logo}</span>
          </a>
          <BurgerMenu />
        </div>
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
          <a href={siteConfig.nav.primaryCta.href} className="btn btn--primary btn--sm nav__cta-desktop">
            {siteConfig.nav.primaryCta.label}
          </a>
          <ThemeToggle />
          <a href={siteConfig.nav.login.href} className="nav__link nav__link--action nav__login">
            {siteConfig.nav.login.label}
          </a>
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
              <a href={link.href} className="footer__link">
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
      <Nav />
      <main>{children}</main>
      <Footer />
    </>
  );
}
