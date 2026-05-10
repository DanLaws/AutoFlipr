import SEO from "../components/SEO";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen px-4 py-16" style={{ background: "var(--color-page)" }}>
      <SEO
        title="Privacy Policy — AutoFlipr"
        description="AutoFlipr privacy policy. How we collect, use and protect your data."
        canonical="/privacy"
      />
      <div className="max-w-2xl mx-auto prose prose-sm text-text-secondary">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Privacy Policy</h1>
        <p className="text-xs text-text-muted mb-8">Last updated: 10 May 2026</p>

        <Section title="1. Who we are">
          <p>
            AutoFlipr ("<strong>we</strong>", "<strong>us</strong>") is a UK-based service that helps
            people find underpriced used cars. Our website is <strong>autoflipr.com</strong>.
          </p>
          <p>
            For questions about this policy, contact us at{" "}
            <a href="mailto:privacy@autoflipr.com" className="text-brand underline">
              privacy@autoflipr.com
            </a>
            .
          </p>
        </Section>

        <Section title="2. What data we collect">
          <ul>
            <li><strong>Account data</strong> — email address and hashed password when you register.</li>
            <li><strong>Usage data</strong> — URLs you scan, watchlist entries, and Flipfolio entries you create.</li>
            <li><strong>Billing data</strong> — plan and subscription status. Card details are held by Stripe and never stored on our servers.</li>
            <li><strong>Technical data</strong> — IP address, browser type, and request logs for security and debugging purposes.</li>
          </ul>
        </Section>

        <Section title="3. How we use your data">
          <ul>
            <li>To provide and improve the AutoFlipr service.</li>
            <li>To process payments via Stripe.</li>
            <li>To send transactional emails (e.g. password reset).</li>
            <li>To detect and prevent fraud or abuse.</li>
          </ul>
          <p>We do not sell your personal data to third parties.</p>
        </Section>

        <Section title="4. Legal basis (UK GDPR)">
          <p>We process your data under the following lawful bases:</p>
          <ul>
            <li><strong>Contract</strong> — to deliver the service you signed up for.</li>
            <li><strong>Legitimate interests</strong> — security monitoring, service improvement.</li>
            <li><strong>Legal obligation</strong> — fraud prevention, tax records.</li>
          </ul>
        </Section>

        <Section title="5. Third parties">
          <ul>
            <li><strong>Stripe</strong> — payment processing. See <a href="https://stripe.com/gb/privacy" className="text-brand underline" target="_blank" rel="noopener">stripe.com/gb/privacy</a>.</li>
            <li><strong>Google (Gemini API)</strong> — AI-powered listing analysis. Data is sent to Google's API for processing and is not used to train models.</li>
            <li><strong>DVLA / DVSA</strong> — vehicle registration lookups.</li>
          </ul>
        </Section>

        <Section title="6. Data retention">
          <p>
            We retain your account data for as long as your account is active. If you delete your
            account, your personal data is removed within 30 days. Anonymised aggregate data may be
            retained indefinitely.
          </p>
        </Section>

        <Section title="7. Your rights">
          <p>Under UK GDPR you have the right to access, correct, delete, or export your personal data.
          Email <a href="mailto:privacy@autoflipr.com" className="text-brand underline">privacy@autoflipr.com</a> to make a request. We will respond within 30 days.</p>
        </Section>

        <Section title="8. Cookies">
          <p>
            We use only essential session cookies required to keep you logged in. We do not use
            advertising or tracking cookies.
          </p>
        </Section>

        <Section title="9. Changes to this policy">
          <p>
            We may update this policy from time to time. We will notify you of significant changes
            by email or by a notice on the site.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-base font-semibold text-text-primary mb-3">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed">{children}</div>
    </div>
  );
}
