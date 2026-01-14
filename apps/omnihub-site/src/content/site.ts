/**
 * APEX OmniHub Marketing Site Content Configuration
 * All copy, proof tiles, and navigation live here for easy updates.
 */

import { getSiteUrl } from '@/lib/site-url';

export const siteConfig = {
  name: 'APEX OmniHub',
  domain: new URL(getSiteUrl()).hostname,

  nav: {
    logo: 'APEX OmniHub',
    links: [
      { label: 'Demo', href: '/demo.html' },
      { label: 'Tech Specs', href: '/tech-specs.html' },
      { label: 'Request Access', href: '/request-access.html' },
    ],
  },

  hero: {
    title: 'APEX OmniHub',
    tagline: 'Intelligence, Designed.',
    subtitle: 'Understand Everything. Communicate Anything, to Every Platform.',
    description: 'The universal translator + orchestrator that connects AI, enterprise systems, and Web3 through a single controlled port - grounded in facts, truth, and audited proof.',
  },

  stamp: {
    headline: 'IT SEES YOU.',
    tagline: 'DIRECTABLE \u2022 ACCOUNTABLE \u2022 DEPENDABLE',
  },

  ctas: {
    primary: { label: 'View Demo', href: '/demo.html' },
    secondary: { label: 'Read Tech Specs', href: '/tech-specs.html' },
    link: { label: 'Request Access', href: '/request-access.html' },
  },

  howItWorks: {
    title: 'How It Works',
    steps: [
      {
        title: 'Connect',
        description: 'Modular adapters plug into any system with an interface (API, webhook, events).',
      },
      {
        title: 'Translate',
        description: 'Canonical, typed semantic events so platforms actually understand each other.',
      },
      {
        title: 'Execute',
        description: 'Deterministic workflows with receipts, retries, rollback paths, and MAN Mode gates.',
      },
    ],
  },

  fortress: {
    title: 'Zero-Trust Fortress Protocol',
    items: [
      'Assume breach by default',
      'Verify explicitly (identity, origin, policy, intent)',
      'Least privilege (scoped + time-boxed access)',
      'Idempotency keys + receipts',
      'MAN Mode for high-risk decision items (workflow continues)',
      'Observability by default (correlation IDs)',
      'Reversible execution (compensation/rollback paths)',
    ],
  },

  manMode: {
    title: 'MAN Mode',
    subtitle: 'Manual Authorization Needed',
    description: 'High-risk decision items are skipped, the workflow continues with zero blocks, and the user is notified to action the item.',
  },

  footer: {
    copyright: '\u00A9 2025 APEX Business Systems. All rights reserved.',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
} as const;

/**
 * Proof module configuration - data-driven, no hype
 * Values are loaded from config so they can be updated without code edits.
 */
export const proofConfig = {
  title: 'Verified',
  tiles: [
    {
      id: 'sonarcloud-gate',
      label: 'SonarCloud Quality Gate',
      value: 'PASSED',
      verified: true,
    },
    {
      id: 'new-issues',
      label: 'New Issues',
      value: '0',
      verified: true,
    },
    {
      id: 'security-hotspots',
      label: 'Security Hotspots (new code)',
      value: '0',
      verified: true,
    },
    {
      id: 'coverage',
      label: 'Coverage tracking',
      value: 'configurable',
      verified: false,
    },
  ],
} as const;

/**
 * Tech Specs page content - evidence-first headings
 */
export const techSpecsConfig = {
  title: 'Technical Specifications',
  subtitle: 'Evidence-first architecture and security posture',
  sections: [
    {
      id: 'single-port',
      title: 'Single-Port Protocol',
      description: 'All communication flows through a single controlled port. This simplifies firewall configuration, reduces attack surface, and enables comprehensive audit logging of all data in transit.',
      details: [
        'One ingress/egress point for all adapter traffic',
        'Protocol-agnostic envelope format',
        'Built-in rate limiting and throttling',
        'Automatic TLS termination',
      ],
    },
    {
      id: 'modular-adapters',
      title: 'Modular Adapters',
      description: 'No vendor lock-in by design. Adapters are standalone modules that translate between external systems and the canonical event format.',
      details: [
        'Hot-swappable adapter architecture',
        'Typed contracts for each adapter',
        'Isolated failure domains',
        'Community and enterprise adapter ecosystem',
      ],
    },
    {
      id: 'man-mode',
      title: 'MAN Mode (Manual Authorization Needed)',
      description: 'High-risk operations pause for human approval without blocking the entire workflow. Items requiring authorization are skipped, queued, and the user is notified.',
      details: [
        'Configurable risk thresholds',
        'Async approval queue with notifications',
        'Audit trail for all approval decisions',
        'Timeout policies with safe defaults',
      ],
    },
    {
      id: 'receipts-idempotency',
      title: 'Receipts & Idempotency',
      description: 'Every operation generates a receipt. Idempotency keys ensure safe retries and deterministic replay.',
      details: [
        'Unique operation IDs for every request',
        'Cryptographic receipts for audit',
        'Automatic deduplication',
        'Replay capability for debugging',
      ],
    },
    {
      id: 'security-posture',
      title: 'Security Posture',
      description: 'Defense-in-depth with zero-trust principles. Every request is authenticated, authorized, and logged.',
      details: [
        'mTLS for service-to-service communication',
        'RBAC with attribute-based extensions',
        'Comprehensive security headers',
        'Regular third-party security audits',
      ],
    },
    {
      id: 'rollback-portability',
      title: 'Rollback & Portability',
      description: 'Migrate between hosts and vendors with confidence. All state is exportable, all operations are reversible.',
      details: [
        'Database-agnostic data layer',
        'Configuration as code',
        'Compensation transactions for rollback',
        'Documented migration runbooks',
      ],
    },
  ],
} as const;

/**
 * Demo page content
 */
export const demoConfig = {
  title: 'See It In Action',
  subtitle: 'Experience the APEX OmniHub workflow',
  videoPlaceholder: {
    title: 'Demo Video',
    description: 'Coming soon - see how APEX OmniHub connects your systems',
  },
  interactivePlaceholder: {
    title: 'Interactive Demo',
    description: 'Try the workflow builder with sample adapters',
  },
  cta: {
    title: 'Ready to get started?',
    description: 'Request access to explore the full platform',
    button: { label: 'Request Access', href: '/request-access.html' },
  },
} as const;

/**
 * Request Access form configuration
 */
export const requestAccessConfig = {
  title: 'Request Access',
  subtitle: 'Join the early access program',
  description: 'We\u2019re onboarding select partners and enterprises. Fill out the form to request access.',
  fields: {
    name: { label: 'Name', placeholder: 'Your name', maxLength: 100 },
    email: { label: 'Email', placeholder: 'you@company.com', maxLength: 254 },
    company: { label: 'Company', placeholder: 'Company name', maxLength: 100 },
    useCase: { label: 'Use Case', placeholder: 'Briefly describe your use case...', maxLength: 500 },
  },
  submitLabel: 'Request Access',
  fallbackMessage: 'Having trouble? Email us at',
  fallbackEmail: 'access@apexomnihub.icu',
  successMessage: 'Thank you! We\u2019ll be in touch soon.',
  antiAbuse: {
    honeypotField: 'website', // Hidden field - bots fill this
    minSubmitTime: 3000, // Minimum 3 seconds to submit
    cooldownTime: 300000, // 5 minutes between submissions
  },
} as const;

/**
 * Restricted page content
 */
export const restrictedConfig = {
  title: 'Restricted',
  subtitle: 'This area requires authorization',
  message: 'Access to this section is limited. You have options:',
  actions: [
    { label: 'Request Access', href: '/request-access.html', primary: true },
    { label: 'Watch Demo', href: '/demo.html', primary: false },
    { label: 'Read Tech Specs', href: '/tech-specs.html', primary: false },
  ],
} as const;

export type SiteConfig = typeof siteConfig;
export type ProofConfig = typeof proofConfig;
export type TechSpecsConfig = typeof techSpecsConfig;
export type DemoConfig = typeof demoConfig;
export type RequestAccessConfig = typeof requestAccessConfig;
export type RestrictedConfig = typeof restrictedConfig;
