import { useState, useRef, useEffect, FormEvent, ChangeEvent } from 'react';
import { Layout } from '@/components/Layout';
import { Section, SectionHeader } from '@/components/Section';
import { requestAccessConfig } from '@/content/site';

// Environment feature flags
const ENABLE_SUPABASE =
  import.meta.env.VITE_ENABLE_REQUEST_ACCESS === 'true' &&
  !!import.meta.env.VITE_SUPABASE_URL &&
  !!import.meta.env.VITE_SUPABASE_ANON_KEY;

interface FormData {
  name: string;
  email: string;
  company: string;
  useCase: string;
  website: string; // honeypot
}

interface FormErrors {
  name?: string;
  email?: string;
  company?: string;
  useCase?: string;
  general?: string;
}

const COOLDOWN_KEY = 'omnihub_request_access_cooldown';

function getLastSubmitTime(): number {
  try {
    const stored = localStorage.getItem(COOLDOWN_KEY);
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

function setLastSubmitTime(): void {
  try {
    localStorage.setItem(COOLDOWN_KEY, Date.now().toString());
  } catch {
    // Ignore storage errors
  }
}

function isOnCooldown(): boolean {
  const last = getLastSubmitTime();
  return Date.now() - last < requestAccessConfig.antiAbuse.cooldownTime;
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function sanitizeInput(input: string): string {
  // Basic HTML entity encoding to prevent XSS
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function generateMailtoPayload(data: FormData): string {
  const subject = encodeURIComponent('APEX OmniHub Access Request');
  const body = encodeURIComponent(
    `Name: ${data.name}\nCompany: ${data.company}\nEmail: ${data.email}\n\nUse Case:\n${data.useCase}`
  );
  return `mailto:${requestAccessConfig.fallbackEmail}?subject=${subject}&body=${body}`;
}

function copyToClipboard(data: FormData): Promise<void> {
  const text = `APEX OmniHub Access Request\n\nName: ${data.name}\nCompany: ${data.company}\nEmail: ${data.email}\n\nUse Case:\n${data.useCase}`;
  return navigator.clipboard.writeText(text);
}

export function RequestAccessPage() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    company: '',
    useCase: '',
    website: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const formStartTime = useRef<number>(Date.now());

  useEffect(() => {
    formStartTime.current = Date.now();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length > requestAccessConfig.fields.name.maxLength) {
      newErrors.name = `Name must be ${requestAccessConfig.fields.name.maxLength} characters or less`;
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    } else if (formData.email.length > requestAccessConfig.fields.email.maxLength) {
      newErrors.email = `Email must be ${requestAccessConfig.fields.email.maxLength} characters or less`;
    }

    if (formData.company.length > requestAccessConfig.fields.company.maxLength) {
      newErrors.company = `Company must be ${requestAccessConfig.fields.company.maxLength} characters or less`;
    }

    if (formData.useCase.length > requestAccessConfig.fields.useCase.maxLength) {
      newErrors.useCase = `Use case must be ${requestAccessConfig.fields.useCase.maxLength} characters or less`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Anti-abuse: honeypot check
    if (formData.website) {
      // Bot detected, silently fail
      setIsSuccess(true);
      return;
    }

    // Anti-abuse: timing check
    const elapsed = Date.now() - formStartTime.current;
    if (elapsed < requestAccessConfig.antiAbuse.minSubmitTime) {
      setErrors({ general: 'Please take a moment to fill out the form.' });
      return;
    }

    // Anti-abuse: cooldown check
    if (isOnCooldown()) {
      setErrors({ general: 'Please wait a few minutes before submitting again.' });
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    const sanitizedData: FormData = {
      name: sanitizeInput(formData.name.trim()),
      email: sanitizeInput(formData.email.trim().toLowerCase()),
      company: sanitizeInput(formData.company.trim()),
      useCase: sanitizeInput(formData.useCase.trim()),
      website: '',
    };

    try {
      if (ENABLE_SUPABASE) {
        // Supabase integration (feature-flagged)
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY
        );

        // Upsert to prevent duplicates (requires unique constraint on email)
        const { error } = await supabase
          .from('access_requests')
          .upsert(
            {
              email: sanitizedData.email,
              name: sanitizedData.name,
              company: sanitizedData.company,
              use_case: sanitizedData.useCase,
              created_at: new Date().toISOString(),
            },
            { onConflict: 'email' }
          );

        if (error) {
          throw error;
        }

        setLastSubmitTime();
        setIsSuccess(true);
      } else {
        // Fallback: open mailto link
        window.location.href = generateMailtoPayload(sanitizedData);
        setLastSubmitTime();
        setIsSuccess(true);
      }
    } catch {
      setErrors({
        general: 'Something went wrong. Please try the email fallback below.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await copyToClipboard(formData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: open mailto
      window.location.href = generateMailtoPayload(formData);
    }
  };

  if (isSuccess) {
    return (
      <Layout title="Request Access">
        <Section>
          <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto var(--space-6)',
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path
                  d="M20 6L9 17l-5-5"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1 className="heading-2">{requestAccessConfig.successMessage}</h1>
            <p className="text-secondary mt-4">
              We review requests regularly and will reach out if there&apos;s a fit.
            </p>
            <div className="mt-8">
              <a href="/" className="btn btn--secondary">
                Back to Home
              </a>
            </div>
          </div>
        </Section>
      </Layout>
    );
  }

  return (
    <Layout title="Request Access">
      <Section>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <SectionHeader
            title={requestAccessConfig.title}
            subtitle={requestAccessConfig.description}
          />

          <form onSubmit={handleSubmit} noValidate>
            {errors.general && (
              <div
                className="card"
                style={{
                  backgroundColor: 'rgba(220, 38, 38, 0.1)',
                  borderColor: 'var(--color-error)',
                  marginBottom: 'var(--space-6)',
                  padding: 'var(--space-4)',
                }}
              >
                <p style={{ color: 'var(--color-error)', margin: 0 }}>
                  {errors.general}
                </p>
              </div>
            )}

            {/* Honeypot field - hidden from users */}
            <div className="form-honeypot" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                type="text"
                id="website"
                name="website"
                value={formData.website}
                onChange={handleChange}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label htmlFor="name" className="form-label">
                {requestAccessConfig.fields.name.label} *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                className="form-input"
                placeholder={requestAccessConfig.fields.name.placeholder}
                value={formData.name}
                onChange={handleChange}
                maxLength={requestAccessConfig.fields.name.maxLength}
                required
              />
              {errors.name && <p className="form-error">{errors.name}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="email" className="form-label">
                {requestAccessConfig.fields.email.label} *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                className="form-input"
                placeholder={requestAccessConfig.fields.email.placeholder}
                value={formData.email}
                onChange={handleChange}
                maxLength={requestAccessConfig.fields.email.maxLength}
                required
              />
              {errors.email && <p className="form-error">{errors.email}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="company" className="form-label">
                {requestAccessConfig.fields.company.label}
              </label>
              <input
                type="text"
                id="company"
                name="company"
                className="form-input"
                placeholder={requestAccessConfig.fields.company.placeholder}
                value={formData.company}
                onChange={handleChange}
                maxLength={requestAccessConfig.fields.company.maxLength}
              />
              {errors.company && <p className="form-error">{errors.company}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="useCase" className="form-label">
                {requestAccessConfig.fields.useCase.label}
              </label>
              <textarea
                id="useCase"
                name="useCase"
                className="form-textarea"
                placeholder={requestAccessConfig.fields.useCase.placeholder}
                value={formData.useCase}
                onChange={handleChange}
                maxLength={requestAccessConfig.fields.useCase.maxLength}
              />
              {errors.useCase && <p className="form-error">{errors.useCase}</p>}
            </div>

            <button
              type="submit"
              className="btn btn--primary btn--lg"
              style={{ width: '100%' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : requestAccessConfig.submitLabel}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 'var(--space-8)' }}>
            <p className="text-sm text-muted">
              {requestAccessConfig.fallbackMessage}{' '}
              <a
                href={`mailto:${requestAccessConfig.fallbackEmail}`}
                style={{ color: 'var(--color-accent)' }}
              >
                {requestAccessConfig.fallbackEmail}
              </a>
            </p>
            {formData.name && formData.email && (
              <button
                type="button"
                className="btn btn--ghost mt-4"
                onClick={handleCopy}
              >
                {copied ? 'Copied!' : 'Copy request to clipboard'}
              </button>
            )}
          </div>
        </div>
      </Section>
    </Layout>
  );
}
