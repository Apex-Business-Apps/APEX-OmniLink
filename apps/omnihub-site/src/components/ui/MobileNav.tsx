import React, { useEffect, useCallback } from 'react';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  navLinks: { href: string; label: string }[];
}

export const MobileNav: React.FC<MobileNavProps> = ({ isOpen, onClose, navLinks }) => {
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <button
        type="button"
        className="drawer-backdrop"
        onClick={onClose}
        aria-label="Close menu"
      />
      {/* Drawer */}
      <dialog
        className="drawer"
        aria-label="Mobile navigation"
        open
        onCancel={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        <div className="drawer__header">
          <span className="drawer__title">Menu</span>
          <button
            type="button"
            className="drawer__close"
            onClick={onClose}
            aria-label="Close menu"
          >
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
          </button>
        </div>
        <nav className="drawer__nav" role="navigation" aria-label="Mobile navigation">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="drawer__link"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </dialog>
    </>
  );
};
