import React from 'react';

export interface IconProps {
  className?: string;
  size?: number;
  color?: string;
}

export const IconTriForceProtocol: React.FC<IconProps> = ({
  className = '',
  size = 24,
  color = 'currentColor',
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-label="Tri-Force Protocol"
  >
    <title>Tri-Force Protocol</title>
    <path d="M12 3L21 19H3L12 3Z" />
    <circle cx="12" cy="4" r="2" fill={color} />
    <circle cx="4" cy="18" r="2" fill={color} />
    <circle cx="20" cy="18" r="2" fill={color} />
    <circle cx="12" cy="12" r="1.5" fill={color} />
    <path d="M12 6.5V10.5" />
    <path d="M6.5 16.5L10.5 13" />
    <path d="M17.5 16.5L13.5 13" />
  </svg>
);

export const IconConnect: React.FC<IconProps> = ({
  className = '',
  size = 24,
  color = 'currentColor',
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-label="Connect"
  >
    <title>Connect</title>
    <rect x="2" y="7" width="6" height="10" rx="1" />
    <rect x="16" y="7" width="6" height="10" rx="1" />
    <path d="M8 10H16" />
    <path d="M8 14H16" />
    <circle cx="12" cy="10" r="1" fill={color} />
    <circle cx="12" cy="14" r="1" fill={color} />
    <path d="M5 5V7" />
    <path d="M5 17V19" />
    <path d="M19 5V7" />
    <path d="M19 17V19" />
  </svg>
);

export const IconTranslate: React.FC<IconProps> = ({
  className = '',
  size = 24,
  color = 'currentColor',
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-label="Translate"
  >
    <title>Translate</title>
    <path d="M4 6L2 12L4 18" />
    <path d="M8 6L6 12L8 18" />
    <path d="M16 6H22V10" />
    <path d="M22 14V18H16" />
    <path d="M16 10L22 14" />
    <path d="M10 9L14 9" />
    <path d="M14 9L12 7" />
    <path d="M14 15L10 15" />
    <path d="M10 15L12 17" />
  </svg>
);

export const IconExecute: React.FC<IconProps> = ({
  className = '',
  size = 24,
  color = 'currentColor',
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-label="Execute"
  >
    <title>Execute</title>
    <path d="M13 2L4 14H11L10 22L20 10H13L13 2Z" />
    <path d="M2 7H4" />
    <path d="M2 12H5" />
    <path d="M2 17H4" />
    <path d="M20 7H22" />
    <path d="M19 17H22" />
  </svg>
);

export const IconOrchestrator: React.FC<IconProps> = ({
  className = '',
  size = 24,
  color = 'currentColor',
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-label="Orchestrator"
  >
    <title>Orchestrator</title>
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="1.5" fill={color} />
    <path d="M12 2V6" />
    <path d="M12 18V22" />
    <path d="M2 12H6" />
    <path d="M18 12H22" />
    <path d="M4.93 4.93L7.76 7.76" />
    <path d="M16.24 16.24L19.07 19.07" />
    <path d="M4.93 19.07L7.76 16.24" />
    <path d="M16.24 7.76L19.07 4.93" />
    <circle cx="12" cy="2" r="1" fill={color} />
    <circle cx="12" cy="22" r="1" fill={color} />
    <circle cx="2" cy="12" r="1" fill={color} />
    <circle cx="22" cy="12" r="1" fill={color} />
  </svg>
);

export const IconFortressProtocol: React.FC<IconProps> = ({
  className = '',
  size = 24,
  color = 'currentColor',
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-label="Fortress Protocol"
  >
    <title>Fortress Protocol</title>
    <path d="M12 2L20 6V12C20 16.4 16.4 20 12 22C7.6 20 4 16.4 4 12V6L12 2Z" />
    <path d="M12 5L17 7.5V11C17 14 14.5 17 12 18.5C9.5 17 7 14 7 11V7.5L12 5Z" />
    <circle cx="12" cy="11" r="2" />
    <path d="M12 13V15" />
  </svg>
);

export const IconManMode: React.FC<IconProps> = ({
  className = '',
  size = 24,
  color = 'currentColor',
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-label="MAN Mode"
  >
    <title>MAN Mode</title>
    {/* Warning triangle */}
    <path d="M12 2L22 20H2L12 2Z" />
    {/* Stop hand - palm */}
    <path d="M12 8V14" />
    {/* Stop hand - fingers spread */}
    <path d="M9 10V8" />
    <path d="M10.5 9V7" />
    <path d="M13.5 9V7" />
    <path d="M15 10V8" />
    {/* Palm base */}
    <path d="M9 14H15" />
    <path d="M9 10C9 10 9 12 9 14" />
    <path d="M15 10C15 10 15 12 15 14" />
  </svg>
);

export const IconAutomation: React.FC<IconProps> = ({
  className = '',
  size = 24,
  color = 'currentColor',
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-label="Automation"
  >
    <title>Automation</title>
    <path d="M12 2L14 4.5L17 4L18 7L21 8L20.5 11L22 12L20.5 13L21 16L18 17L17 20L14 19.5L12 22L10 19.5L7 20L6 17L3 16L3.5 13L2 12L3.5 11L3 8L6 7L7 4L10 4.5L12 2Z" />
    <circle cx="12" cy="12" r="4" />
    <path d="M10 10L12 12L14 10" />
    <path d="M10 14L12 12L14 14" />
  </svg>
);

export const IconIntegrations: React.FC<IconProps> = ({
  className = '',
  size = 24,
  color = 'currentColor',
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-label="Integrations"
  >
    <title>Integrations</title>
    <rect x="8" y="8" width="8" height="8" rx="1" />
    <rect x="9" y="2" width="6" height="4" rx="1" />
    <path d="M12 6V8" />
    <rect x="9" y="18" width="6" height="4" rx="1" />
    <path d="M12 16V18" />
    <rect x="2" y="9" width="4" height="6" rx="1" />
    <path d="M6 12H8" />
    <rect x="18" y="9" width="4" height="6" rx="1" />
    <path d="M16 12H18" />
    <circle cx="12" cy="12" r="1.5" fill={color} />
  </svg>
);

export const IconAnalytics: React.FC<IconProps> = ({
  className = '',
  size = 24,
  color = 'currentColor',
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-label="Analytics"
  >
    <title>Analytics</title>
    <path d="M3 3V21H21" />
    <rect x="6" y="13" width="3" height="6" rx="0.5" />
    <rect x="11" y="9" width="3" height="10" rx="0.5" />
    <rect x="16" y="5" width="3" height="14" rx="0.5" />
    <path d="M5 6C8 3 16 3 19 6" />
    <circle cx="12" cy="6" r="1" fill={color} />
  </svg>
);

// eslint-disable-next-line react-refresh/only-export-components
export const Icons = {
  TriForceProtocol: IconTriForceProtocol,
  Connect: IconConnect,
  Translate: IconTranslate,
  Execute: IconExecute,
  Orchestrator: IconOrchestrator,
  FortressProtocol: IconFortressProtocol,
  ManMode: IconManMode,
  Automation: IconAutomation,
  Integrations: IconIntegrations,
  Analytics: IconAnalytics,
};

export default Icons;
