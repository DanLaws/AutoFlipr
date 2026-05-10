import SEO from "../components/SEO";

export default function TermsPage() {
  return (
    <div className="min-h-screen px-4 py-16" style={{ background: "var(--color-page)" }}>
      <SEO
        title="Terms of Service — AutoFlipr"
        description="AutoFlipr terms of service. Please read before using the service."
        canonical="/terms"
      />
      <div className="max-w-2xl mx-auto prose prose-sm text-text-secondary">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Terms of Service</h1>
        <p className="text-xs text-text-muted mb-8">Last updated: 10 May 2026</p>

        <Section title="1. Acceptance">
          <p>
            By creating an account or using AutoFlipr ("<strong>the Service</strong>"), you agree to
            these Terms. If you do not agree, do not use the Service.
          </p>
        </Section>

        <Section title="2. The Service">
          <p>
            AutoFlipr aggregates publicly available used-car listings and provides AI-generated
            analysis to help identify potentially underpriced vehicles. Information provided is for
            reference only. <strong>We do not guarantee the accuracy of valuations, scores, or
            recommendations.</strong> Always carry out your own due diligence before purchasing a vehicle.
          </p>
        </Section>

        <Section title="3. Accounts">
          <ul>
            <li>You must be 18 or older to use the Service.</li>
            <li>You are responsible for keeping your login credentials secure.</li>
            <li>You must not share your account with others.</li>
            <li>We reserve the right to suspend or terminate accounts that violate these Terms.</li>
          </ul>
        </Section>

        <Section title="4. Subscriptions and billing">
          <ul>
            <li>Paid plans are billed in advance on a monthly or annual basis.</li>
            <li>The Pro plan includes a 1-day free trial. Your card will be charged at the end of the trial unless you cancel.</li>
            <li>You may cancel at any time. Access continues until the end of the current billing period.</li>
            <li>Refunds are not provided for partial billing periods.</li>
            <li>We reserve the right to change pricing with 30 days' notice.</li>
          </ul>
        </Section>

        <Section title="5. Acceptable use">
          <p>You must not:</p>
          <ul>
            <li>Attempt to scrape, copy, or redistribute AutoFlipr data at scale.</li>
            <li>Use the Service to violate any law or regulation.</li>
            <li>Attempt to reverse-engineer or interfere with the Service.</li>
            <li>Submit false or misleading listing reports.</li>
          </ul>
        </Section>

        <Section title="6. Intellectual property">
          <p>
            All content, branding, and software comprising the Service is owned by AutoFlipr. You
            may not copy or republish it without written permission.
          </p>
        </Section>

        <Section title="7. Disclaimer of warranties">
          <p>
            The Service is provided "<strong>as is</strong>" without warranty of any kind. We do not
            warrant that the Service will be uninterrupted, error-free, or that deal scores will be
            accurate. Vehicle valuations are estimates, not professional advice.
          </p>
        </Section>

        <Section title="8. Limitation of liability">
          <p>
            To the fullest extent permitted by law, AutoFlipr's liability for any claim arising from
            use of the Service is limited to the amount you paid in the 12 months preceding the
            claim. We are not liable for any indirect, incidental, or consequential damages.
          </p>
        </Section>

        <Section title="9. Governing law">
          <p>
            These Terms are governed by the laws of England and Wales. Any disputes shall be subject
            to the exclusive jurisdiction of the courts of England and Wales.
          </p>
        </Section>

        <Section title="10. Changes">
          <p>
            We may update these Terms. Continued use of the Service after changes are posted
            constitutes acceptance of the new Terms.
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
