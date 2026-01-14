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
      { label: 'Features', href: '/#features' },
      { label: 'Solutions', href: '/#solutions' },
      { label: 'Integrations', href: '/#integrations' },
      { label: 'Pricing', href: '/#pricing' },
    ],
    login: { label: 'Log In', href: '/restricted.html' },
    primaryCta: { label: 'Get Started', href: '/request-access.html' },
  },

  hero: {
    title: 'Intelligence Designed',
    tagline: 'IT SEES YOU',
    subtitle:
      'Translate intent into audited execution across AI agents, enterprise systems, and Web3.',
    description:
      'APEX OmniHub is the vendor-independent control plane that governs data flow, policy, and deterministic execution through a single controlled port. Secure, observable, reversible.',
  },

  highlights: {
    title: 'Built for enterprise outcomes—without enterprise friction',
    items: [
      {
        title: 'Universal Translation Engine',
        description:
          'Canonical typed events so platforms actually understand each other — APIs, webhooks, queues, and chains.',
      },
      {
        title: 'Fortress Protocol by default',
        description:
          'Assume breach. Verify identity + intent. Least privilege. Receipts, idempotency keys, and audit trails on everything.',
      },
      {
        title: 'Designed Intelligence',
        description:
          'Agentic automation with MAN Mode safety gates, deterministic retries, and reversible execution paths.',
      },
    ],
  },

  integrations: {
    title: 'Integrations that don’t compromise your stack',
    subtitle:
      'Adapters stay modular, portable, and optional-by-default. OmniHub stays the control tower.',
    items: [
      {
        title: 'Enterprise Systems',
        description: 'CRMs, ERPs, ticketing, calendars, messaging, storage, data warehouses.',
      },
      {
        title: 'AI Apps & Agents',
        description: 'Model providers, agent frameworks, RAG pipelines, tool routers, eval gates.',
      },
      {
        title: 'Web3 & Onchain',
        description: 'Wallet ops, tokenization, proofs, attestations, chain event listeners.',
      },
    ],
  },

  showcase: {
    title: 'Ready for the future of execution?',
    subtitle: 'Unite. Govern. Automate.',
    items: [
      { title: 'Policy Console', caption: 'Zero-trust policy, RBAC, and audit.' },
      { title: 'MAN Mode Queue', caption: 'Human approvals without blocking workflows.' },
      { title: 'Execution Receipts', caption: 'Deterministic replay and proof.' },
      { title: 'Adapter Registry', caption: 'Portable, modular integrations.' },
    ],
  },

  stamp: {
    headline: 'IT SEES YOU.',
    tagline: 'DIRECTABLE \u2022 ACCOUNTABLE \u2022 DEPENDABLE',
  },

  ctas: {
    primary: { label: 'Get Started', href: '/request-access.html' },
    secondary: { label: 'Watch Demo', href: '/demo.html' },
    link: { label: 'Read Tech Specs', href: '/tech-specs.html' },
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
