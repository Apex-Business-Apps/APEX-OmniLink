import { Layout } from '@/components/Layout';
import { Section } from '@/components/Section';
import { restrictedConfig } from '@/content/site';

export function RestrictedPage() {
  return (
    <Layout title="Restricted">
      <Section>
        <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-6)',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <rect
                x="3"
                y="11"
                width="18"
                height="11"
                rx="2"
                stroke="white"
                strokeWidth="2"
              />
              <path
                d="M7 11V7a5 5 0 0 1 10 0v4"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1 className="heading-2">{restrictedConfig.title}</h1>
          <p className="text-secondary mt-2">{restrictedConfig.subtitle}</p>
          <p className="text-muted mt-4">{restrictedConfig.message}</p>

          <div
            className="cta-group cta-group--center"
            style={{ marginTop: 'var(--space-8)', flexDirection: 'column' }}
          >
            {restrictedConfig.actions.map((action) => (
              <a
                key={action.href}
                href={action.href}
                className={`btn btn--lg ${
                  action.primary ? 'btn--primary' : 'btn--secondary'
                }`}
                style={{ width: '100%', maxWidth: '300px' }}
              >
                {action.label}
              </a>
            ))}
          </div>
        </div>
      </Section>
    </Layout>
  );
}
