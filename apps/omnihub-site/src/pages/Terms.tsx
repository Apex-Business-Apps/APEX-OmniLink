import { Layout } from '@/components/Layout';
import { Section } from '@/components/Section';

export function TermsPage() {
  return (
    <Layout title="Terms of Service">
      <Section variant="default">
        <div className="legal-content">
          <h1 className="heading-1">Terms of Service</h1>
          <p className="legal-content__updated">Last updated: January 2025</p>

          <div className="legal-content__section">
            <h2 className="heading-3">1. Agreement to Terms</h2>
            <p>
              By accessing or using APEX OmniHub (&quot;the Service&quot;),
              operated by APEX Business Systems, you agree to be bound by these
              Terms of Service. If you do not agree to these terms, do not use
              the Service.
            </p>
          </div>

          <div className="legal-content__section">
            <h2 className="heading-3">2. Description of Service</h2>
            <p>
              APEX OmniHub is a workflow automation and integration platform
              that connects AI systems, enterprise applications, and Web3
              protocols through a unified interface. The Service includes:
            </p>
            <ul>
              <li>Workflow orchestration and automation</li>
              <li>System integration via modular adapters</li>
              <li>Event translation and routing</li>
              <li>Security and compliance features</li>
            </ul>
          </div>

          <div className="legal-content__section">
            <h2 className="heading-3">3. Account Registration</h2>
            <p>
              To access certain features, you may need to register for an
              account. You agree to:
            </p>
            <ul>
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>Accept responsibility for all activities under your account</li>
            </ul>
          </div>

          <div className="legal-content__section">
            <h2 className="heading-3">4. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul>
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on intellectual property rights</li>
              <li>Transmit malicious code or attempt unauthorized access</li>
              <li>Interfere with the operation of the Service</li>
              <li>Engage in activities that harm other users</li>
            </ul>
          </div>

          <div className="legal-content__section">
            <h2 className="heading-3">5. Intellectual Property</h2>
            <p>
              The Service and its original content, features, and functionality
              are owned by APEX Business Systems and are protected by
              international copyright, trademark, and other intellectual
              property laws.
            </p>
          </div>

          <div className="legal-content__section">
            <h2 className="heading-3">6. User Content</h2>
            <p>
              You retain ownership of any data or content you submit to the
              Service. By submitting content, you grant us a license to use,
              process, and store it as necessary to provide the Service.
            </p>
          </div>

          <div className="legal-content__section">
            <h2 className="heading-3">7. Disclaimer of Warranties</h2>
            <p>
              The Service is provided &quot;as is&quot; and &quot;as
              available&quot; without warranties of any kind, either express or
              implied. We do not warrant that the Service will be uninterrupted,
              secure, or error-free.
            </p>
          </div>

          <div className="legal-content__section">
            <h2 className="heading-3">8. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, APEX Business Systems
              shall not be liable for any indirect, incidental, special,
              consequential, or punitive damages arising from your use of the
              Service.
            </p>
          </div>

          <div className="legal-content__section">
            <h2 className="heading-3">9. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless APEX Business Systems and
              its affiliates from any claims, damages, or expenses arising from
              your use of the Service or violation of these terms.
            </p>
          </div>

          <div className="legal-content__section">
            <h2 className="heading-3">10. Termination</h2>
            <p>
              We may terminate or suspend your access to the Service immediately
              and without notice for conduct that we believe violates these
              terms or is harmful to other users or the Service.
            </p>
          </div>

          <div className="legal-content__section">
            <h2 className="heading-3">11. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. We will
              provide notice of significant changes. Your continued use of the
              Service after changes constitutes acceptance of the new terms.
            </p>
          </div>

          <div className="legal-content__section">
            <h2 className="heading-3">12. Governing Law</h2>
            <p>
              These terms shall be governed by and construed in accordance with
              applicable laws, without regard to conflict of law principles.
            </p>
          </div>

          <div className="legal-content__section">
            <h2 className="heading-3">13. Contact Information</h2>
            <p>
              For questions about these Terms of Service, please contact us at{' '}
              <a href="mailto:legal@apexomnihub.icu">legal@apexomnihub.icu</a>.
            </p>
          </div>
        </div>
      </Section>
    </Layout>
  );
}
