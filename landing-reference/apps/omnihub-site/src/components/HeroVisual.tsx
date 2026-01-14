import type { ReactNode } from 'react';

interface IconCardProps {
  label: string;
  children: ReactNode;
  className?: string;
}

function IconCard({ label, children, className }: IconCardProps) {
  return (
    <div className={`hero-visual__icon ${className ?? ''}`.trim()} aria-hidden="true">
      <div className="hero-visual__icon-inner">{children}</div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M7 3v2M17 3v2M4 9h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8 13h3M8 17h8M14 13h2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M4 7h16v10H4V7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m4 8 8 6 8-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M4 20V4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M7 18v-6M12 18V7M17 18v-9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M4 20h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M10 8 16 12 10 16V8Z"
        fill="currentColor"
        opacity="0.9"
      />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CubeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M12 2 3 7v10l9 5 9-5V7l-9-5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 22V12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="m21 7-9 5-9-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HeroVisual() {
  return (
    <div className="hero-visual" aria-hidden="true">
      <div className="hero-visual__rings" />
      <div className="hero-visual__hub">
        <div className="hero-visual__hub-core">
          <div className="hero-visual__hub-eye" />
        </div>
      </div>

      <div className="hero-visual__orbit">
        <IconCard label="Calendar" className="hero-visual__icon--a">
          <CalendarIcon />
        </IconCard>
        <IconCard label="Email" className="hero-visual__icon--b">
          <MailIcon />
        </IconCard>
        <IconCard label="Charts" className="hero-visual__icon--c">
          <ChartIcon />
        </IconCard>
        <IconCard label="Demo" className="hero-visual__icon--d">
          <PlayIcon />
        </IconCard>
        <IconCard label="Adapters" className="hero-visual__icon--e">
          <CubeIcon />
        </IconCard>
      </div>
    </div>
  );
}
