import { Layout } from '@/components/Layout';
import { Section } from '@/components/Section';
import { CTAGroup } from '@/components/CTAGroup';
import { HeroVisual } from '@/components/HeroVisual';
import { FeatureHighlightGrid } from '@/components/FeatureHighlightGrid';
import { siteConfig } from '@/content/site';

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
            OmniHub is your universal translator and orchestrator—connecting AI,
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
  return (
    <Section id="features" variant="surface">
      <FeatureHighlightGrid items={siteConfig.highlights.items} />
    </Section>
  );
}

function TriForceSection() {
  const triForceCards = [
    {
      id: 'connect',
      title: 'Connect',
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      ),
      description:
        'Modular adapters plug into any system with an interface—API, webhook, or events.',
    },
    {
      id: 'translate',
      title: 'Translate',
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10" />
          <path d="M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
      ),
      description:
        'Canonical, typed semantic events so platforms actually understand each other.',
    },
    {
      id: 'execute',
      title: 'Execute',
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
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
            OmniHub doesn&apos;t just connect—it coordinates. Every workflow
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
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
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
          Security isn&apos;t an afterthought—it&apos;s the foundation
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.75-2.96l-6.93-12a2 2 0 00-3.5 0l-6.93 12A2 2 0 005.07 19z" />
            </svg>
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
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      ),
      href: '#tri-force',
    },
    {
      id: 'orchestrator',
      title: 'Orchestrator',
      description: 'Central command for all workflows',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
          <path d="M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
        </svg>
      ),
      href: '#orchestrator',
    },
    {
      id: 'fortress',
      title: 'Fortress Protocol',
      description: 'Zero-trust security by default',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      ),
      href: '#fortress',
    },
    {
      id: 'man-mode',
      title: 'MAN Mode',
      description: 'Manual Authorization Needed',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <path d="M20 8v6m3-3h-6" />
        </svg>
      ),
      href: '#man-mode',
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
