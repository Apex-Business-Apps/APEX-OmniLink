import { Layout } from '@/components/Layout';
import { Section, SectionHeader } from '@/components/Section';
import { Stamp } from '@/components/Stamp';
import { CTAGroup } from '@/components/CTAGroup';
import { ProofGrid } from '@/components/ProofGrid';
import { SignalTrace } from '@/components/SignalTrace';
import { Steps } from '@/components/Steps';
import { FortressList } from '@/components/FortressList';
import { siteConfig, proofConfig } from '@/content/site';

function Hero() {
  return (
    <section className="hero" style={{ position: 'relative' }}>
      <SignalTrace />
      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        <p className="hero__tagline">{siteConfig.hero.tagline}</p>
        <h1 className="heading-hero hero__title">{siteConfig.hero.title}</h1>
        <p className="hero__subtitle">{siteConfig.hero.subtitle}</p>
        <p className="hero__description">{siteConfig.hero.description}</p>
        <CTAGroup
          primary={siteConfig.ctas.primary}
          secondary={siteConfig.ctas.secondary}
          link={siteConfig.ctas.link}
          centered
        />
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <Section id="how-it-works" variant="surface">
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

function ManModeSection() {
  return (
    <Section id="man-mode" variant="surface">
      <div style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center' }}>
        <h2 className="heading-2">{siteConfig.manMode.title}</h2>
        <p className="text-lg text-accent mt-4">{siteConfig.manMode.subtitle}</p>
        <p className="text-secondary mt-4">{siteConfig.manMode.description}</p>
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

function StampSection() {
  return (
    <Section variant="surface">
      <Stamp />
    </Section>
  );
}

function CTASection() {
  return (
    <Section id="cta" variant="navy">
      <div style={{ textAlign: 'center' }}>
        <h2 className="heading-2">Ready to get started?</h2>
        <p className="text-lg mt-4" style={{ color: 'var(--color-text-muted)' }}>
          Request access to explore the APEX OmniHub platform.
        </p>
        <div className="mt-8">
          <CTAGroup
            primary={siteConfig.ctas.link}
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
      <HowItWorksSection />
      <FortressSection />
      <ManModeSection />
      <ProofSection />
      <StampSection />
      <CTASection />
    </Layout>
  );
}
