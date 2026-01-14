import { Layout } from '@/components/Layout';
import { Section, SectionHeader } from '@/components/Section';
import { CTAGroup } from '@/components/CTAGroup';
import { ProofGrid } from '@/components/ProofGrid';
import { Steps } from '@/components/Steps';
import { FortressList } from '@/components/FortressList';
import { HeroVisual } from '@/components/HeroVisual';
import { FeatureHighlightGrid } from '@/components/FeatureHighlightGrid';
import { IntegrationGrid } from '@/components/IntegrationGrid';
import { ShowcaseStrip } from '@/components/ShowcaseStrip';
import { siteConfig, proofConfig } from '@/content/site';

function Hero() {
  return (
    <section className="hero hero--mission">
      <div className="container hero__grid">
        <div className="hero__content">
          <p className="hero__eyebrow">{siteConfig.hero.tagline}</p>
          <h1 className="heading-hero hero__title">{siteConfig.hero.title}</h1>
          <p className="hero__subtitle">{siteConfig.hero.subtitle}</p>
          <p className="hero__description">{siteConfig.hero.description}</p>
          <div className="hero__actions">
            <CTAGroup
              primary={siteConfig.ctas.primary}
              secondary={siteConfig.ctas.secondary}
              link={siteConfig.ctas.link}
            />
          </div>
        </div>

        <div className="hero__visual" aria-hidden="true">
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}

function HighlightsSection() {
  return (
    <Section id="features" variant="surface">
      <SectionHeader title={siteConfig.highlights.title} />
      <FeatureHighlightGrid items={siteConfig.highlights.items} />
    </Section>
  );
}

function HowItWorksSection() {
  return (
    <Section id="solutions" variant="surface">
      <SectionHeader title={siteConfig.howItWorks.title} />
      <Steps />
    </Section>
  );
}

function FortressSection() {
  return (
    <Section id="fortress">
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <SectionHeader title={siteConfig.fortress.title} />
        <FortressList />
      </div>
    </Section>
  );
}

function IntegrationsSection() {
  return (
    <Section id="integrations">
      <div style={{ maxWidth: '920px', margin: '0 auto', textAlign: 'center' }}>
        <h2 className="heading-2">{siteConfig.integrations.title}</h2>
        <p className="text-secondary mt-4">{siteConfig.integrations.subtitle}</p>
        <div className="mt-8">
          <IntegrationGrid items={siteConfig.integrations.items} />
        </div>
      </div>
    </Section>
  );
}

function ProofSection() {
  return (
    <Section id="proof">
      <SectionHeader title={proofConfig.title} />
      <ProofGrid />
    </Section>
  );
}

function ShowcaseSection() {
  return (
    <Section variant="surface">
      <div style={{ textAlign: 'center' }}>
        <h2 className="heading-2">{siteConfig.showcase.title}</h2>
        <p className="text-secondary mt-4">{siteConfig.showcase.subtitle}</p>
        <div className="mt-8">
          <ShowcaseStrip items={siteConfig.showcase.items} />
        </div>
      </div>
    </Section>
  );
}

function CTASection() {
  return (
    <Section id="pricing" variant="navy">
      <div style={{ textAlign: 'center' }}>
        <h2 className="heading-2">Experience APEX OmniHub today</h2>
        <p className="text-lg mt-4" style={{ color: 'var(--color-text-muted)' }}>
          Early access is invite-only. Pricing is partner-based until general availability.
        </p>
        <div className="mt-8">
          <CTAGroup
            primary={siteConfig.ctas.primary}
            secondary={siteConfig.ctas.secondary}
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
      <HowItWorksSection />
      <FortressSection />
      <IntegrationsSection />
      <ProofSection />
      <ShowcaseSection />
      <CTASection />
    </Layout>
  );
}
