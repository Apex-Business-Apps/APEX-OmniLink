import { Layout } from '@/components/Layout';
import { Section, SectionHeader } from '@/components/Section';
import { CTAGroup } from '@/components/CTAGroup';
import { demoConfig, siteConfig } from '@/content/site';

function VideoPlaceholder() {
  return (
    <div
      className="card"
      style={{
        aspectRatio: '16/9',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-navy)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 'var(--space-4)',
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M8 5v14l11-7L8 5z" fill="white" />
        </svg>
      </div>
      <h3 className="heading-4">{demoConfig.videoPlaceholder.title}</h3>
      <p className="text-secondary text-sm mt-2">
        {demoConfig.videoPlaceholder.description}
      </p>
    </div>
  );
}

function InteractivePlaceholder() {
  return (
    <div className="card" style={{ padding: 'var(--space-8)' }}>
      <h3 className="heading-4">{demoConfig.interactivePlaceholder.title}</h3>
      <p className="text-secondary mt-2">
        {demoConfig.interactivePlaceholder.description}
      </p>
      <div
        style={{
          marginTop: 'var(--space-6)',
          padding: 'var(--space-6)',
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--border-radius-md)',
          border: '1px dashed var(--color-border)',
          textAlign: 'center',
        }}
      >
        <p className="text-muted text-sm">Interactive demo coming soon</p>
      </div>
    </div>
  );
}

function DemoCTA() {
  return (
    <Section variant="navy">
      <div style={{ textAlign: 'center' }}>
        <h2 className="heading-2">{demoConfig.cta.title}</h2>
        <p className="text-lg mt-4" style={{ color: 'var(--color-text-muted)' }}>
          {demoConfig.cta.description}
        </p>
        <div className="mt-8">
          <CTAGroup
            primary={demoConfig.cta.button}
            secondary={siteConfig.ctas.secondary}
            centered
          />
        </div>
      </div>
    </Section>
  );
}

export function DemoPage() {
  return (
    <Layout title="Demo">
      <Section>
        <SectionHeader
          title={demoConfig.title}
          subtitle={demoConfig.subtitle}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
          <VideoPlaceholder />
          <InteractivePlaceholder />
        </div>
      </Section>
      <DemoCTA />
    </Layout>
  );
}
