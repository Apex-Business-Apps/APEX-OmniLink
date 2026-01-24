/**
 * APEX OmniHub Marketing Site Content Configuration
 * All copy, proof tiles, and navigation live here for easy updates.
 */

import { getSiteUrl } from '@/lib/site-url';

// ============================================================================
// Helper functions to reduce duplication in config objects
// ============================================================================

/** Build a navigation link */
function buildLink(label: string, href: string) {
  return { label, href };
}



/** Build a titled item with description */
function buildItem(title: string, description: string) {
  return { title, description };
}

/** Build a proof tile */
function buildProofTile(id: string, label: string, value: string, verified: boolean) {
  return { id, label, value, verified };
}

/** Build a form field config */
function buildField(label: string, placeholder: string, maxLength: number) {
  return { label, placeholder, maxLength };
}

type TechSpecSectionTuple = readonly [
  id: string,
  title: string,
  description: string,
  details: readonly string[],
];

type TechSpecSection = {
  id: string;
  title: string;
  description: string;
  details: readonly string[];
};

/** Convert tuple-based tech spec data into structured sections */
function buildTechSpecSections(data: readonly TechSpecSectionTuple[]): readonly TechSpecSection[] {
  return data.map(([id, title, description, details]) => ({
    id,
    title,
    description,
    details,
  }));
}

export const siteConfig = {
  name: 'APEX OmniHub',
  domain: new URL(getSiteUrl()).hostname,

  nav: {
    logo: 'APEX OmniHub',
    links: [
      { label: 'Demo', href: '/demo.html' },
      { label: 'Tech Specs', href: '/tech-specs.html' },
      { label: 'Request Access', href: '/request-access.html' },
      { label: 'Login', href: '/login.html' },
    ],
    login: buildLink('Log In', '/restricted.html'),
    primaryCta: buildLink('Get Started', '/request-access.html'),
  },

  hero: {
    eyebrow: 'APEX OMNIHUB',
    title: 'Intelligence Designed',
    tagline: 'It Sees You',
    subtitle:
      'Welcome to the future of workflow automation and business intelligence.',
  },

  highlights: {
    title: '',
    items: [
      buildItem('AI-Powered Automation', 'Imagine a platform that anticipates your needs and streamlines your operations effortlessly.'),
      buildItem('Smart Integrations', 'Unify your tools and data into one intelligent system. Say goodbye to silos and productivity bottlenecks.'),
      buildItem('Advanced Analytics', 'Gain a 360° view of your organization. Make data-driven decisions with cutting-edge insights.'),
    ],
  },

  integrations: {
    title: "Integrations that don't compromise your stack",
    subtitle:
      'Adapters stay modular, portable, and optional-by-default. OmniHub stays the control tower.',
    items: [
      buildItem('Enterprise Systems', 'CRMs, ERPs, ticketing, calendars, messaging, storage, data warehouses.'),
      buildItem('AI Apps & Agents', 'Model providers, agent frameworks, RAG pipelines, tool routers, eval gates.'),
      buildItem('Web3 & Onchain', 'Wallet ops, tokenization, proofs, attestations, chain event listeners.'),
    ],
  },

  showcase: {
    title: 'Experience APEX OmniHub Today',
    subtitle: 'Unite. Automate. Excel.',
    items: [
      { title: 'Project Management', image: '/placeholder-project.png' },
      { title: 'Team Collaboration', image: '/placeholder-team.png' },
      { title: 'Personal Dashboard', image: '/placeholder-dashboard.png' },
      { title: 'Workflow Automation', image: '/placeholder-workflow.png' },
    ],
  },

  stamp: {
    headline: 'IT SEES YOU.',
    tagline: 'DIRECTABLE \u2022 ACCOUNTABLE \u2022 DEPENDABLE',
  },

  ctas: {
    primary: buildLink('Get Started', '/request-access.html'),
    secondary: buildLink('Watch Demo', '/demo.html'),
    link: buildLink('Read Tech Specs', '/tech-specs.html'),
  },

  howItWorks: {
    title: 'How It Works',
    steps: [
      buildItem('Connect', 'Modular adapters plug into any system with an interface (API, webhook, events).'),
      buildItem('Translate', 'Canonical, typed semantic events so platforms actually understand each other.'),
      buildItem('Execute', 'Deterministic workflows with receipts, retries, rollback paths, and MAN Mode gates.'),
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
      buildLink('Privacy', '/privacy'),
      buildLink('Terms', '/terms'),
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
    buildProofTile('sonarcloud-gate', 'SonarCloud Quality Gate', 'PASSED', true),
    buildProofTile('new-issues', 'New Issues', '0', true),
    buildProofTile('security-hotspots', 'Security Hotspots (new code)', '0', true),
    buildProofTile('coverage', 'Coverage tracking', 'configurable', false),
  ],
} as const;

/**
 * Tech Specs page content - evidence-first headings
 */
export const techSpecsConfig = {
  title: 'Technical Specifications',
  subtitle: 'Evidence-first architecture and security posture',
  sections: buildTechSpecSections([
    [
      'single-port',
      'Single-Port Protocol',
      'All communication flows through a single controlled port. This simplifies firewall configuration, reduces attack surface, and enables comprehensive audit logging of all data in transit.',
      [
        'One ingress/egress point for all adapter traffic',
        'Protocol-agnostic envelope format',
        'Built-in rate limiting and throttling',
        'Automatic TLS termination',
      ],
    ],
    [
      'modular-adapters',
      'Modular Adapters',
      'No vendor lock-in by design. Adapters are standalone modules that translate between external systems and the canonical event format.',
      [
        'Hot-swappable adapter architecture',
        'Typed contracts for each adapter',
        'Isolated failure domains',
        'Community and enterprise adapter ecosystem',
      ],
    ],
    [
      'man-mode',
      'MAN Mode (Manual Authorization Needed)',
      'High-risk operations pause for human approval without blocking the entire workflow. Items requiring authorization are skipped, queued, and the user is notified.',
      [
        'Configurable risk thresholds',
        'Async approval queue with notifications',
        'Audit trail for all approval decisions',
        'Timeout policies with safe defaults',
      ],
    ],
    [
      'receipts-idempotency',
      'Receipts & Idempotency',
      'Every operation generates a receipt. Idempotency keys ensure safe retries and deterministic replay.',
      [
        'Unique operation IDs for every request',
        'Cryptographic receipts for audit',
        'Automatic deduplication',
        'Replay capability for debugging',
      ],
    ],
    [
      'security-posture',
      'Security Posture',
      'Defense-in-depth with zero-trust principles. Every request is authenticated, authorized, and logged.',
      [
        'mTLS for service-to-service communication',
        'RBAC with attribute-based extensions',
        'Comprehensive security headers',
        'Regular third-party security audits',
      ],
    ],
    [
      'rollback-portability',
      'Rollback & Portability',
      'Migrate between hosts and vendors with confidence. All state is exportable, all operations are reversible.',
      [
        'Database-agnostic data layer',
        'Configuration as code',
        'Compensation transactions for rollback',
        'Documented migration runbooks',
      ],
    ],
  ]),
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
    button: buildLink('Request Access', '/request-access.html'),
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
    name: buildField('Name', 'Your name', 100),
    email: buildField('Email', 'you@company.com', 254),
    company: buildField('Company', 'Company name', 100),
    useCase: buildField('Use Case', 'Briefly describe your use case...', 500),
  },
  submitLabel: 'Request Access',
  fallbackMessage: 'Having trouble? Email us at',
  fallbackEmail: 'access@apexomnihub.icu',
  successMessage: 'Thank you! We\u2019ll be in touch soon.',
  antiAbuse: {
    honeypotField: 'website',
    minSubmitTime: 3000,
    cooldownTime: 300000,
  },
} as const;

export type SiteConfig = typeof siteConfig;
export type ProofConfig = typeof proofConfig;
export type TechSpecsConfig = typeof techSpecsConfig;
export type DemoConfig = typeof demoConfig;
export type RequestAccessConfig = typeof requestAccessConfig;
