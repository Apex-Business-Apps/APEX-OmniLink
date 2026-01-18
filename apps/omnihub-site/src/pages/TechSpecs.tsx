import { Layout } from '@/components/Layout';
import { Section, SectionHeader } from '@/components/Section';
import { CTAGroup } from '@/components/CTAGroup';
import { techSpecsConfig, siteConfig } from '@/content/site';

type SpecSectionProps = Readonly<{
  title: string;
  description: string;
  details: readonly string[];
}>;

function SpecSection({ title, description, details }: SpecSectionProps) {
  return (
    <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
      <h3 className="heading-3">{title}</h3>
      <p className="text-secondary mt-4">{description}</p>
      <ul
        className="fortress-list"
        style={{ marginTop: 'var(--space-4)' }}
      >
        {details.map((detail) => (
          <li key={detail} className="fortress-list__item">
            {detail}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TechSpecsPage() {
  return (
    <Layout title="Tech Specs">
      <Section>
        <SectionHeader
          title={techSpecsConfig.title}
          subtitle={techSpecsConfig.subtitle}
        />
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          {techSpecsConfig.sections.map((section) => (
            <SpecSection
              key={section.id}
              title={section.title}
              description={section.description}
              details={section.details}
            />
          ))}
        </div>
      </Section>
      <Section variant="surface">
        <div style={{ textAlign: 'center' }}>
          <h2 className="heading-2">Ready to see it in action?</h2>
          <p className="text-secondary mt-4">
            Watch the demo or request access to explore the platform.
          </p>
          <div className="mt-8">
            <CTAGroup
              primary={siteConfig.ctas.primary}
              secondary={siteConfig.ctas.link}
              centered
            />
          </div>
        </div>
      </Section>
    </Layout>
  );
}
