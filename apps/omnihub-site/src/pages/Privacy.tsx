import { Layout } from '@/components/Layout';
import { Section } from '@/components/Section';

export function PrivacyPage() {
  return (
    <Layout title="Privacy Policy">
      <Section variant="default">
        <div className="legal-content">
          <h1 className="heading-1">Privacy Policy</h1>
          <p className="legal-content__updated">Last updated: January 2025</p>

          <div className="legal-content__section">
            <h2 className="heading-3">1. Introduction</h2>
            <p>
              APEX Business Systems (&quot;we&quot;, &quot;us&quot;, or
              &quot;our&quot;) operates the APEX OmniHub platform. This Privacy
              Policy explains how we collect, use, disclose, and safeguard your
              information when you use our services.
            </p>
          </div>

          <div className="legal-content__section">
            <h2 className="heading-3">2. Information We Collect</h2>
            <p>We may collect information about you in various ways:</p>
            <ul>
              <li>
                <strong>Personal Data:</strong> Name, email address, company
                name, and other contact information you provide when requesting
                access or contacting us.
              </li>
              <li>
                <strong>Usage Data:</strong> Information about how you interact
                with our platform, including pages visited, features used, and
                time spent.
              </li>
              <li>
                <strong>Technical Data:</strong> IP address, browser type,
                device information, and operating system.
              </li>
            </ul>
          </div>

          <div className="legal-content__section">
            <h2 className="heading-3">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, operate, and maintain our services</li>
              <li>Process your requests and transactions</li>
              <li>Send administrative information and updates</li>
              <li>Respond to inquiries and offer support</li>
              <li>Improve and optimize our platform</li>
              <li>Protect against unauthorized access and abuse</li>
            </ul>
          </div>

          <div className="legal-content__section">
            <h2 className="heading-3">4. Data Security</h2>
            <p>
              We implement appropriate technical and organizational security
              measures to protect your personal information. However, no method
              of transmission over the Internet is 100% secure, and we cannot
              guarantee absolute security.
            </p>
          </div>

          <div className="legal-content__section">
            <h2 className="heading-3">5. Data Retention</h2>
            <p>
              We retain your personal information only for as long as necessary
              to fulfill the purposes outlined in this policy, unless a longer
              retention period is required by law.
            </p>
          </div>

          <div className="legal-content__section">
            <h2 className="heading-3">6. Your Rights</h2>
            <p>
              Depending on your location, you may have certain rights regarding
              your personal information, including:
            </p>
            <ul>
              <li>Access to your personal data</li>
              <li>Correction of inaccurate data</li>
              <li>Deletion of your data</li>
              <li>Restriction of processing</li>
              <li>Data portability</li>
              <li>Objection to processing</li>
            </ul>
          </div>

          <div className="legal-content__section">
            <h2 className="heading-3">7. Cookies and Tracking</h2>
            <p>
              We use essential cookies to maintain your session and preferences.
              We do not use third-party tracking cookies or sell your data to
              advertisers.
            </p>
          </div>

          <div className="legal-content__section">
            <h2 className="heading-3">8. Third-Party Services</h2>
            <p>
              Our platform may integrate with third-party services. Each
              integration operates under its own privacy policy, and we
              encourage you to review them.
            </p>
          </div>

          <div className="legal-content__section">
            <h2 className="heading-3">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of any changes by posting the new policy on this page
              and updating the &quot;Last updated&quot; date.
            </p>
          </div>

          <div className="legal-content__section">
            <h2 className="heading-3">10. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us
              at{' '}
              <a href="mailto:privacy@apexomnihub.icu">privacy@apexomnihub.icu</a>
              .
            </p>
          </div>
        </div>
      </Section>
    </Layout>
  );
}
