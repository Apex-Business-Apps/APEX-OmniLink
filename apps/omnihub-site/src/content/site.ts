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
      { label: 'Features', href: '#features' },
      { label: 'Solutions', href: '#solutions' },
      { label: 'Integrations', href: '#integrations' },
      { label: 'Pricing', href: '#pricing' },
    ],
    actions: {
      login: { label: 'Log In', href: '/request-access.html' },
      primary: { label: 'Get Started', href: '#cta' },
    },
  },

  hero: {
    title: 'Intelligence Designed',
    emphasis: 'It Sees You',
    tagline: 'APEX OmniHub',
    subtitle: 'A unified command center for operational intelligence, workflow orchestration, and real-time execution.',
    description:
      'Connect teams, systems, and data into a single living workspace that adapts, learns, and drives measurable outcomes.',
  },

  stamp: {
    headline: 'IT SEES YOU.',
    tagline: 'DIRECTABLE \u2022 ACCOUNTABLE \u2022 DEPENDABLE',
  },

  ctas: {
    primary: { label: 'Get Started', href: '#cta' },
    secondary: { label: 'View Platform', href: '/demo.html' },
    link: { label: 'Request Access', href: '/request-access.html' },
  },

  features: [
    {
      title: 'Unified Workspace',
      description:
        'Bring tasks, knowledge, and telemetry into one command layer so every team stays aligned.',
    },
    {
      title: 'AI-Powered Insights',
      description:
        'Surface anomalies, opportunities, and next-best actions before they impact performance.',
    },
    {
      title: 'Cross-Platform Sync',
      description:
        'Keep workflows consistent across apps, devices, and environments with zero manual drift.',
    },
  ],

  integrations: [
    'Slack',
    'Google Workspace',
    'GitHub',
    'Jira',
    'Salesforce',
    'Notion',
  ],

  showcase: [
    { title: 'Project Management' },
    { title: 'Team Collaboration' },
    { title: 'Personal Dashboard' },
    { title: 'Workflow Automation' },
  ],

  finalCta: {
    title: 'Experience APEX OmniHub Today',
    subtitle: 'Unite. Automate. Excel.',
    primary: { label: 'Get Started', href: '#cta' },
    secondary: { label: 'Request Access', href: '/request-access.html' },
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
    buildTechSpecSection(
      'single-port',
      'Single-Port Protocol',
      'All communication flows through a single controlled port. This simplifies firewall configuration, reduces attack surface, and enables comprehensive audit logging of all data in transit.',
      [
        'One ingress/egress point for all adapter traffic',
        'Protocol-agnostic envelope format',
        'Built-in rate limiting and throttling',
        'Automatic TLS termination',
      ]
    ),
    buildTechSpecSection(
      'modular-adapters',
      'Modular Adapters',
      'No vendor lock-in by design. Adapters are standalone modules that translate between external systems and the canonical event format.',
      [
        'Hot-swappable adapter architecture',
        'Typed contracts for each adapter',
        'Isolated failure domains',
        'Community and enterprise adapter ecosystem',
      ]
    ),
    buildTechSpecSection(
      'man-mode',
      'MAN Mode (Manual Authorization Needed)',
      'High-risk operations pause for human approval without blocking the entire workflow. Items requiring authorization are skipped, queued, and the user is notified.',
      [
        'Configurable risk thresholds',
        'Async approval queue with notifications',
        'Audit trail for all approval decisions',
        'Timeout policies with safe defaults',
      ]
    ),
    buildTechSpecSection(
      'receipts-idempotency',
      'Receipts & Idempotency',
      'Every operation generates a receipt. Idempotency keys ensure safe retries and deterministic replay.',
      [
        'Unique operation IDs for every request',
        'Cryptographic receipts for audit',
        'Automatic deduplication',
        'Replay capability for debugging',
      ]
    ),
    buildTechSpecSection(
      'security-posture',
      'Security Posture',
      'Defense-in-depth with zero-trust principles. Every request is authenticated, authorized, and logged.',
      [
        'mTLS for service-to-service communication',
        'RBAC with attribute-based extensions',
        'Comprehensive security headers',
        'Regular third-party security audits',
      ]
    ),
    buildTechSpecSection(
      'rollback-portability',
      'Rollback & Portability',
      'Migrate between hosts and vendors with confidence. All state is exportable, all operations are reversible.',
      [
        'Database-agnostic data layer',
        'Configuration as code',
        'Compensation transactions for rollback',
        'Documented migration runbooks',
      ]
    ),
  ],
} as const;

function buildTechSpecSection(
  id: string,
  title: string,
  description: string,
  details: string[]
) {
  return {
    id,
    title,
    description,
    details,
  };
}

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
