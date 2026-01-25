import { Layout } from '@/components/Layout';
import { Section } from '@/components/Section';
import { CTAGroup } from '@/components/CTAGroup';
import { HeroVisual } from '@/components/HeroVisual';
import { FeatureHighlightGrid } from '@/components/FeatureHighlightGrid';
import { siteConfig } from '@/content/site';
import {
  IconConnect,
  IconTranslate,
  IconExecute,
  IconTriForceProtocol,
  IconOrchestrator,
  IconFortressProtocol,
  IconManMode,
  IconAutomation,
  IconIntegrations,
  IconAnalytics,
} from '@/components/icons';

function Hero() {
  return (
    <section className="hero hero--mission">
      <div className="hero__background" aria-hidden="true">
        <div className="hero__gradient" />
        <div className="hero__arcs" />
        <div className="hero__stars" />
      </div>
      <div className="container hero__grid">
        <div className="hero__content">
          <p className="hero__eyebrow">{siteConfig.hero.eyebrow}</p>
          <h1 className="heading-hero hero__title">{siteConfig.hero.title}</h1>
          <p className="hero__tagline">{siteConfig.hero.tagline}</p>
          <p className="hero__proof">{siteConfig.stamp.tagline}</p>
          <p className="hero__subtitle">{siteConfig.hero.subtitle}</p>
          <p className="hero__description">
            Understand Everything. Communicate Anything, to Every Platform.
            OmniHub is your universal translator and orchestrator, connecting AI,
            enterprise systems, and Web3 through a single controlled port.
          </p>
          <div className="hero__actions">
            <CTAGroup
              primary={siteConfig.ctas.primary}
              secondary={siteConfig.ctas.secondary}
            />
          </div>
        </div>

        <div className="hero__visual" aria-hidden="true">
          <div className="hero__glow" />
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}

function HighlightsSection() {
  const highlightItems = [
    {
      title: 'AI-Powered Automation',
      description:
        'Imagine a platform that anticipates your needs and streamlines your operations effortlessly.',
      icon: <IconAutomation size={22} />,
    },
    {
      title: 'Smart Integrations',
      description:
        'Unify your tools and data into one intelligent system. Say goodbye to silos and productivity bottlenecks.',
      icon: <IconIntegrations size={22} />,
    },
    {
      title: 'Advanced Analytics',
      description:
        'Gain a 360° view of your organization. Make data-driven decisions with cutting-edge insights.',
      icon: <IconAnalytics size={22} />,
    },
  ];

  return (
    <Section id="features" variant="surface">
      <FeatureHighlightGrid items={highlightItems} />
    </Section>
  );
}

function TriForceSection() {
  const triForceCards = [
    {
      id: 'connect',
      title: 'Connect',
      icon: <IconConnect size={32} />,
      description:
        'Modular adapters plug into any system with an interface: API, webhook, or events.',
    },
    {
      id: 'translate',
      title: 'Translate',
      icon: <IconTranslate size={32} />,
      description:
        'Canonical, typed semantic events so platforms actually understand each other.',
    },
    {
      id: 'execute',
      title: 'Execute',
      icon: <IconExecute size={32} />,
      description:
        'Deterministic workflows with receipts, retries, rollback paths, and MAN Mode gates.',
    },
  ];

  return (
    <Section id="tri-force" variant="default">
      <div className="triforce">
        <div className="triforce__header">
          <h2 className="heading-2">Tri-Force Protocol</h2>
          <p className="text-secondary mt-4">
            The three pillars that power every OmniHub workflow
          </p>
        </div>
        <div className="triforce__grid">
          {triForceCards.map((card) => (
            <a
              key={card.id}
              href={`/tech-specs.html#${card.id}`}
              className="triforce__card"
            >
              <div className="triforce__icon">{card.icon}</div>
              <h3 className="triforce__title">{card.title}</h3>
              <p className="triforce__desc">{card.description}</p>
            </a>
          ))}
        </div>
      </div>
    </Section>
  );
}

function OrchestratorSection() {
  return (
    <Section id="orchestrator" variant="surface">
      <div className="orchestrator">
        <div className="orchestrator__content">
          <h2 className="heading-2">The Orchestrator</h2>
          <p className="text-secondary mt-4">
            OmniHub does more than connect. It coordinates. Every workflow
            flows through the central orchestrator, ensuring consistent
            execution, comprehensive logging, and intelligent routing.
          </p>
          <ul className="orchestrator__list">
            <li>Single control plane for all integrations</li>
            <li>Real-time event correlation and tracking</li>
            <li>Automatic retry and compensation logic</li>
            <li>Workflow state persistence and recovery</li>
          </ul>
        </div>
        <div className="orchestrator__visual" aria-hidden="true">
          <div className="orchestrator__hub">
            <div className="orchestrator__pulse" />
            <div className="orchestrator__core">
              <IconOrchestrator size={48} />
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function FortressSection() {
  return (
    <Section id="fortress" variant="navy">
      <div className="fortress">
        <h2 className="heading-2">Zero-Trust Fortress Protocol</h2>
        <p className="fortress__subtitle">
          Security is not an afterthought. It is the foundation.
        </p>
        <div className="fortress__grid">
          {siteConfig.fortress.items.map((item) => (
            <div key={item} className="fortress__item">
              <div className="fortress__bullet" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function ManModeSection() {
  return (
    <Section id="man-mode" variant="default">
      <div className="manmode">
        <div className="manmode__visual" aria-hidden="true">
          <div className="manmode__icon">
            <picture>
              {/* PNG for mobile/tablet (max-width: 768px) */}
              <source media="(max-width: 768px)" srcSet="/manmode-icon.png" />
              {/* SVG for desktop (min-width: 769px) */}
              <img
                src="/manmode-icon.svg"
                alt=""
                className="manmode__icon-img"
                style={{
                  maxWidth: 'min(560px, 100%)',
                  maxHeight: 'min(60vh, 520px)',
                  width: 'auto',
                  height: 'auto',
                }}
              />
            </picture>
          </div>
        </div>
        <div className="manmode__content">
          <span className="manmode__badge">MAN MODE</span>
          <h2 className="heading-2">{siteConfig.manMode.subtitle}</h2>
          <p className="text-secondary mt-4">{siteConfig.manMode.description}</p>
          <ul className="manmode__features">
            <li>High-risk items are flagged, not blocked</li>
            <li>Workflow continues with zero interruption</li>
            <li>User notified for manual review</li>
            <li>Full audit trail maintained</li>
          </ul>
          <a href="/tech-specs.html#man-mode" className="btn btn--secondary mt-8">
            Learn More
          </a>
        </div>
      </div>
    </Section>
  );
}

function CapabilityShowcase() {
  const capabilities = [
    {
      id: 'tri-force',
      title: 'Tri-Force Protocol',
      description: 'Connect, Translate, Execute',
      icon: <IconTriForceProtocol size={28} />,
      href: '#tri-force',
    },
    {
      id: 'orchestrator',
      title: 'Orchestrator',
      description: 'Central command for all workflows',
      icon: <IconOrchestrator size={28} />,
      href: '#orchestrator',
    },
    {
      id: 'fortress',
      title: 'Fortress Protocol',
      description: 'Zero-trust security by default',
      icon: <IconFortressProtocol size={28} />,
      href: '#fortress',
    },
    {
      id: 'man-mode',
      title: 'MAN Mode',
      description: 'Manual Authorization Needed',
      icon: <IconManMode size={28} />,
      href: '#man-mode',
    },
    {
      id: 'maestro',
      title: 'M.A.E.S.T.R.O.',
      description: 'Multi-Agent Execution, Simulation, Testing, Reliability & Operations',
      icon: <IconAutomation size={28} />,
      href: '#maestro',
    },
  ];

  return (
    <Section id="integrations" variant="surface">
      <div style={{ textAlign: 'center' }}>
        <h2 className="heading-2">Core Capabilities</h2>
        <p className="text-secondary mt-4">
          Explore what makes OmniHub the intelligent hub for your operations
        </p>
        <div className="capability-grid mt-8">
          {capabilities.map((cap) => (
            <a key={cap.id} href={cap.href} className="capability-card">
              <div className="capability-card__icon">{cap.icon}</div>
              <h3 className="capability-card__title">{cap.title}</h3>
              <p className="capability-card__desc">{cap.description}</p>
            </a>
          ))}
        </div>
      </div>
    </Section>
  );
}

function CTASection() {
  return (
    <Section id="cta" variant="navy">
      <div style={{ textAlign: 'center' }}>
        <h2 className="heading-2">Experience APEX OmniHub Today</h2>
        <p
          className="text-lg mt-4"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Unite. Automate. Excel.
        </p>
        <div className="mt-8">
          <CTAGroup
            primary={{ label: 'Get Started for Free', href: '/request-access.html' }}
            secondary={{ label: 'Schedule a Demo', href: '/demo.html' }}
            centered
          />
        </div>
      </div>
    </Section>
  );
}

export function HomePage() {
  return (
    <Layout>
      <Hero />
      <HighlightsSection />
      <TriForceSection />
      <OrchestratorSection />
      <FortressSection />
      <ManModeSection />
      <CapabilityShowcase />
      <CTASection />
    </Layout>
  );
}
