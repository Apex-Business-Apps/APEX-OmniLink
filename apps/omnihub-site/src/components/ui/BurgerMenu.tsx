import React from 'react';

interface BurgerMenuProps {
  isOpen: boolean;
  onClick: () => void;
}

export const BurgerMenu: React.FC<BurgerMenuProps> = ({ isOpen, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="burger-menu"
    aria-label={isOpen ? 'Close menu' : 'Open menu'}
    aria-expanded={isOpen}
  >
    <span className="burger-menu__icon">
      <span
        className="burger-menu__line"
        style={isOpen ? { transform: 'rotate(45deg) translate(4px, 4px)' } : undefined}
      />
      <span
        className="burger-menu__line"
        style={isOpen ? { opacity: 0 } : undefined}
      />
      <span
        className="burger-menu__line"
        style={isOpen ? { transform: 'rotate(-45deg) translate(4px, -4px)' } : undefined}
      />
    </span>
  </button>
);
