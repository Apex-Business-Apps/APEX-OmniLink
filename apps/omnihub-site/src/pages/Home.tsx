import { Layout } from '@/components/Layout';
import { Section } from '@/components/Section';
import { CTAGroup } from '@/components/CTAGroup';
import { HeroVisual } from '@/components/HeroVisual';
import { FeatureHighlightGrid } from '@/components/FeatureHighlightGrid';
import { ShowcaseStrip } from '@/components/ShowcaseStrip';
import { siteConfig } from '@/content/site';

function Hero() {
  return (
    <section className="hero hero--mission">
      <div className="container hero__grid">
        <div className="hero__content">
          <p className="hero__eyebrow">{siteConfig.hero.eyebrow}</p>
          <h1 className="heading-hero hero__title">{siteConfig.hero.title}</h1>
          <p className="hero__tagline">{siteConfig.hero.tagline}</p>
          <p className="hero__subtitle">{siteConfig.hero.subtitle}</p>
          <div className="hero__actions">
            <CTAGroup
              primary={siteConfig.ctas.primary}
              secondary={siteConfig.ctas.secondary}
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
      <FeatureHighlightGrid items={siteConfig.highlights.items} />
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
        <h2 className="heading-2">Experience APEX OmniHub Today</h2>
        <p className="text-lg mt-4" style={{ color: 'var(--color-text-muted)' }}>
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
      <ShowcaseSection />
      <CTASection />
    </Layout>
  );
}

