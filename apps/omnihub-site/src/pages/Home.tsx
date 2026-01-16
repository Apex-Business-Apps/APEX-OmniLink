import { Layout } from '@/components/Layout';
import { CTAGroup } from '@/components/CTAGroup';
import { siteConfig } from '@/content/site';

function Hero() {
  return (
    <section className="hero">
      <div className="hero__background" aria-hidden="true">
        <div className="hero__stars" />
        <div className="hero__arcs" />
        <div className="hero__glow" />
        <div className="hero__grid" />
      </div>
      <div className="container hero__inner">
        <div className="hero__content">
          <p className="hero__tagline">{siteConfig.hero.tagline}</p>
          <h1 className="heading-hero hero__title">
            <span>{siteConfig.hero.title}</span>
            <span className="hero__title-accent">{siteConfig.hero.emphasis}</span>
          </h1>
          <p className="hero__subtitle">{siteConfig.hero.subtitle}</p>
          <p className="hero__description">{siteConfig.hero.description}</p>
          <CTAGroup
            primary={siteConfig.ctas.primary}
            secondary={siteConfig.ctas.secondary}
          />
        </div>
        <div className="hero__media">
          <div className="hero__art-glow" aria-hidden="true" />
          <img
            className="hero__art hero__art--light"
            src="/assets/hero-light.svg"
            alt="APEX OmniHub interface preview"
          />
          <img
            className="hero__art hero__art--dark"
            src="/assets/hero-night.svg"
            alt=""
            aria-hidden="true"
          />
        </div>
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <Layout>
      <Hero />
      <section id="features" className="section features-section">
        <div className="container">
          <div className="section-heading">
            <p className="section-eyebrow">Features</p>
            <h2 className="heading-2">Everything you need to orchestrate work</h2>
          </div>
          <div className="feature-grid">
            {siteConfig.features.map((feature) => (
              <div key={feature.title} className="card feature-card">
                <h3 className="heading-4">{feature.title}</h3>
                <p className="text-secondary mt-4">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="integrations" className="section integrations-section">
        <div className="container">
          <div className="section-heading section-heading--center">
            <p className="section-eyebrow">Integrations</p>
            <h2 className="heading-2">Connect the tools you already use</h2>
          </div>
          <div className="integration-pills">
            {siteConfig.integrations.map((integration) => (
              <span key={integration} className="integration-pill">
                {integration}
              </span>
            ))}
          </div>
        </div>
      </section>
      <section id="solutions" className="section showcase-section">
        <div className="container">
          <div className="section-heading">
            <p className="section-eyebrow">Solutions</p>
            <h2 className="heading-2">Designed for every team</h2>
          </div>
          <div className="showcase-grid">
            {siteConfig.showcase.map((item) => (
              <div key={item.title} className="showcase-card">
                <div className="showcase-card__surface" />
                <p className="showcase-card__title">{item.title}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="pricing" className="section pricing-section">
        <div className="container">
          <div className="pricing-card">
            <div>
              <p className="section-eyebrow">Pricing</p>
              <h2 className="heading-2">Launch-ready plans for teams of every size</h2>
              <p className="text-secondary mt-4">
                Flexible tiers are available for early adopters. Lock in priority access.
              </p>
            </div>
            <CTAGroup primary={siteConfig.ctas.link} secondary={siteConfig.ctas.secondary} />
          </div>
        </div>
      </section>
      <section id="cta" className="section final-cta">
        <div className="container">
          <div className="final-cta__content">
            <h2 className="heading-2">{siteConfig.finalCta.title}</h2>
            <p className="final-cta__subtitle">{siteConfig.finalCta.subtitle}</p>
            <div className="final-cta__actions">
              <CTAGroup
                primary={siteConfig.finalCta.primary}
                secondary={siteConfig.finalCta.secondary}
                centered
              />
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
