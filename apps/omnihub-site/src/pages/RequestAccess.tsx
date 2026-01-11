/**
 * @fileoverview Request Access Page Component
 * @description Handles early access form submissions with anti-abuse protections.
 *
 * Security features:
 * - Honeypot field to detect bots
 * - Timing check to prevent instant submissions
 * - Client-side cooldown to prevent spam
 * - Input sanitization to prevent XSS
 * - Optional Supabase backend (feature-flagged)
 *
 * @module pages/RequestAccess
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
  type ChangeEvent,
} from 'react';
import { Layout } from '@/components/Layout';
import { Section, SectionHeader } from '@/components/Section';
import { requestAccessConfig } from '@/content/site';

/** Check if Supabase integration is enabled via environment variables */
const ENABLE_SUPABASE =
  import.meta.env.VITE_ENABLE_REQUEST_ACCESS === 'true' &&
  Boolean(import.meta.env.VITE_SUPABASE_URL) &&
  Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

/** LocalStorage key for submission cooldown tracking */
const COOLDOWN_KEY = 'omnihub_request_access_cooldown';

/**
 * Form data structure matching the access request fields
 */
interface FormData {
  /** User's full name */
  name: string;
  /** User's email address */
  email: string;
  /** User's company name (optional) */
  company: string;
  /** Description of intended use case (optional) */
  useCase: string;
  /** Honeypot field - should remain empty for real users */
  website: string;
}

/**
 * Form validation error messages
 */
interface FormErrors {
  name?: string;
  email?: string;
  company?: string;
  useCase?: string;
  general?: string;
}

/**
 * Retrieves the timestamp of the last form submission from localStorage.
 * Used to enforce submission cooldown periods.
 *
 * @returns Timestamp in milliseconds, or 0 if not found/invalid
 */
function getLastSubmitTime(): number {
  try {
    const stored = localStorage.getItem(COOLDOWN_KEY);
    if (stored === null) {
      return 0;
    }
    const parsed = parseInt(stored, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  } catch {
    // localStorage may be unavailable (private browsing, etc.)
    return 0;
  }
}

/**
 * Records the current timestamp as the last submission time.
 * Silently fails if localStorage is unavailable.
 */
function setLastSubmitTime(): void {
  try {
    localStorage.setItem(COOLDOWN_KEY, Date.now().toString());
  } catch {
    // Ignore storage errors - cooldown is a best-effort feature
  }
}

/**
 * Checks if the user is within the submission cooldown period.
 *
 * @returns true if user must wait before submitting again
 */
function isOnCooldown(): boolean {
  const lastSubmit = getLastSubmitTime();
  const cooldownMs = requestAccessConfig.antiAbuse.cooldownTime;
  return Date.now() - lastSubmit < cooldownMs;
}

/**
 * Validates an email address using a standard pattern.
 * Note: Server-side validation should also be performed.
 *
 * @param email - Email address to validate
 * @returns true if email format is valid
 */
function validateEmail(email: string): boolean {
  // RFC 5322 simplified pattern - validates common email formats
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

/**
 * Sanitizes user input to prevent XSS attacks.
 * Encodes HTML special characters as entities.
 *
 * @param input - Raw user input string
 * @returns Sanitized string safe for display
 */
function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Generates a mailto: URL with pre-filled subject and body.
 * Used as fallback when Supabase is not configured.
 *
 * @param data - Form data to include in email
 * @returns Fully-formed mailto: URL
 */
function generateMailtoPayload(data: FormData): string {
  const subject = encodeURIComponent('APEX OmniHub Access Request');
  const bodyParts = [
    `Name: ${data.name}`,
    `Company: ${data.company || 'Not provided'}`,
    `Email: ${data.email}`,
    '',
    'Use Case:',
    data.useCase || 'Not provided',
  ];
  const body = encodeURIComponent(bodyParts.join('\n'));
  return `mailto:${requestAccessConfig.fallbackEmail}?subject=${subject}&body=${body}`;
}

/**
 * Copies the form data to clipboard as formatted text.
 *
 * @param data - Form data to copy
 * @returns Promise that resolves when copy is complete
 * @throws If clipboard API is unavailable
 */
async function copyToClipboard(data: FormData): Promise<void> {
  const textParts = [
    'APEX OmniHub Access Request',
    '',
    `Name: ${data.name}`,
    `Company: ${data.company || 'Not provided'}`,
    `Email: ${data.email}`,
    '',
    'Use Case:',
    data.useCase || 'Not provided',
  ];
  await navigator.clipboard.writeText(textParts.join('\n'));
}

/**
 * Request Access Page Component
 *
 * Renders a form for users to request early access to APEX OmniHub.
 * Includes comprehensive anti-abuse measures and optional backend integration.
 *
 * @returns React component
 */
export function RequestAccessPage(): JSX.Element {
  // Form state
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    company: '',
    useCase: '',
    website: '', // honeypot - must remain empty
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Track form load time for timing-based anti-abuse
  const formStartTime = useRef<number>(Date.now());

  // Reset form start time on mount
  useEffect(() => {
    formStartTime.current = Date.now();
  }, []);

  /**
   * Validates all form fields and updates error state.
   *
   * @returns true if form is valid
   */
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    const { fields } = requestAccessConfig;

    // Name validation
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      newErrors.name = 'Name is required';
    } else if (trimmedName.length > fields.name.maxLength) {
      newErrors.name = `Name must be ${fields.name.maxLength} characters or less`;
    }

    // Email validation
    const trimmedEmail = formData.email.trim();
    if (!trimmedEmail) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address';
    } else if (trimmedEmail.length > fields.email.maxLength) {
      newErrors.email = `Email must be ${fields.email.maxLength} characters or less`;
    }

    // Company validation (optional but length-limited)
    if (formData.company.length > fields.company.maxLength) {
      newErrors.company = `Company must be ${fields.company.maxLength} characters or less`;
    }

    // Use case validation (optional but length-limited)
    if (formData.useCase.length > fields.useCase.maxLength) {
      newErrors.useCase = `Use case must be ${fields.useCase.maxLength} characters or less`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  /**
   * Handles input field changes with real-time error clearing.
   */
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));

      // Clear field-specific error when user starts typing
      if (errors[name as keyof FormErrors]) {
        setErrors((prev) => ({ ...prev, [name]: undefined }));
      }
    },
    [errors]
  );

  /**
   * Handles form submission with anti-abuse checks.
   */
  const handleSubmit = useCallback(
    async (e: FormEvent): Promise<void> => {
      e.preventDefault();

      // Anti-abuse: Honeypot check (bots often fill hidden fields)
      if (formData.website) {
        // Silently "succeed" to not tip off the bot
        setIsSuccess(true);
        return;
      }

      // Anti-abuse: Timing check (reject instant submissions)
      const elapsedMs = Date.now() - formStartTime.current;
      const minTimeMs = requestAccessConfig.antiAbuse.minSubmitTime;
      if (elapsedMs < minTimeMs) {
        setErrors({ general: 'Please take a moment to fill out the form.' });
        return;
      }

      // Anti-abuse: Cooldown check (rate limiting)
      if (isOnCooldown()) {
        setErrors({
          general: 'Please wait a few minutes before submitting again.',
        });
        return;
      }

      // Validate form fields
      if (!validateForm()) {
        return;
      }

      setIsSubmitting(true);
      setErrors({});

      // Sanitize all inputs before processing
      const sanitizedData: FormData = {
        name: sanitizeInput(formData.name.trim()),
        email: sanitizeInput(formData.email.trim().toLowerCase()),
        company: sanitizeInput(formData.company.trim()),
        useCase: sanitizeInput(formData.useCase.trim()),
        website: '',
      };

      try {
        if (ENABLE_SUPABASE) {
          // Dynamic import to avoid bundling Supabase when not used
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            import.meta.env.VITE_SUPABASE_URL as string,
            import.meta.env.VITE_SUPABASE_ANON_KEY as string
          );

          // Upsert for idempotency - requires UNIQUE constraint on email
          const { error } = await supabase.from('access_requests').upsert(
            {
              email: sanitizedData.email,
              name: sanitizedData.name,
              company: sanitizedData.company || null,
              use_case: sanitizedData.useCase || null,
            },
            { onConflict: 'email' }
          );

          if (error) {
            throw new Error(error.message);
          }

          setLastSubmitTime();
          setIsSuccess(true);
        } else {
          // Fallback: Open mailto link
          window.location.href = generateMailtoPayload(sanitizedData);
          setLastSubmitTime();
          setIsSuccess(true);
        }
      } catch {
        // Log minimal error in dev mode, don't expose details to user
        setErrors({
          general: 'Something went wrong. Please try the email fallback below.',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, validateForm]
  );

  /**
   * Handles copy-to-clipboard action with fallback to mailto.
   */
  const handleCopy = useCallback(async (): Promise<void> => {
    try {
      await copyToClipboard(formData);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API failed, fall back to mailto
      window.location.href = generateMailtoPayload(formData);
    }
  }, [formData]);

  // Success state - show confirmation message
  if (isSuccess) {
    return (
      <Layout title="Request Access">
        <Section>
          <div
            style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}
          >
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
              role="img"
              aria-label="Success"
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
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
              We review requests regularly and will reach out if there&apos;s a
              fit.
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

  // Form state - show input form
  return (
    <Layout title="Request Access">
      <Section>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <SectionHeader
            title={requestAccessConfig.title}
            subtitle={requestAccessConfig.description}
          />

          <form onSubmit={handleSubmit} noValidate>
            {/* General error message */}
            {errors.general && (
              <div
                className="card"
                role="alert"
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

            {/* Honeypot field - hidden from real users, traps bots */}
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

            {/* Name field */}
            <div className="form-group">
              <label htmlFor="name" className="form-label">
                {requestAccessConfig.fields.name.label}{' '}
                <span aria-label="required">*</span>
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
                aria-required="true"
                aria-invalid={errors.name ? 'true' : undefined}
                aria-describedby={errors.name ? 'name-error' : undefined}
              />
              {errors.name && (
                <p id="name-error" className="form-error" role="alert">
                  {errors.name}
                </p>
              )}
            </div>

            {/* Email field */}
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                {requestAccessConfig.fields.email.label}{' '}
                <span aria-label="required">*</span>
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
                aria-required="true"
                aria-invalid={errors.email ? 'true' : undefined}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
              {errors.email && (
                <p id="email-error" className="form-error" role="alert">
                  {errors.email}
                </p>
              )}
            </div>

            {/* Company field (optional) */}
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
                aria-invalid={errors.company ? 'true' : undefined}
                aria-describedby={errors.company ? 'company-error' : undefined}
              />
              {errors.company && (
                <p id="company-error" className="form-error" role="alert">
                  {errors.company}
                </p>
              )}
            </div>

            {/* Use case field (optional) */}
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
                aria-invalid={errors.useCase ? 'true' : undefined}
                aria-describedby={errors.useCase ? 'useCase-error' : undefined}
              />
              {errors.useCase && (
                <p id="useCase-error" className="form-error" role="alert">
                  {errors.useCase}
                </p>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              className="btn btn--primary btn--lg"
              style={{ width: '100%' }}
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : requestAccessConfig.submitLabel}
            </button>
          </form>

          {/* Fallback options */}
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
                aria-label={
                  copied
                    ? 'Request copied to clipboard'
                    : 'Copy request to clipboard'
                }
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
