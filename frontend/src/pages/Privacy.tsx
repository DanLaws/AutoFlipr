import SEO from "../components/SEO";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen px-4 py-16" style={{ background: "var(--color-page)" }}>
      <SEO
        title="Privacy Policy"
        description="AutoFlipr privacy policy — how we collect, use, and protect your data."
        canonical="/privacy"
        noindex
      />
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-text-primary tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-text-faint mb-10">Last updated: May 2025</p>

        <div className="space-y-8 text-sm text-text-secondary leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">1. Who we are</h2>
            <p>
              AutoFlipr Ltd is registered in England and Wales. We operate the AutoFlipr service at autoflipr.co.uk.
              We are the data controller for information collected through the Service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">2. What data we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Email address and hashed password when you create an account</li>
              <li>URLs and vehicle listings you scan or save</li>
              <li>Usage data (pages visited, features used) via server-side logs</li>
              <li>Payment data processed by Stripe — we never store card numbers</li>
              <li>Postcode, if you set a home location for distance filtering</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">3. How we use your data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide and improve the Service</li>
              <li>To send transactional emails (account, billing, alerts you opt in to)</li>
              <li>To detect and prevent fraud or abuse</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">4. Data sharing</h2>
            <p>
              We do not sell your personal data. We share data only with service providers necessary to operate the
              platform (Stripe for payments, our hosting provider for infrastructure). All processors are contractually
              bound to GDPR-compliant data handling.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">5. Data retention</h2>
            <p>
              We retain your account data for as long as your account is active. Scan history is retained for 12 months
              on the Free plan and indefinitely on paid plans. You can request deletion at any time.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">6. Your rights (UK GDPR)</h2>
            <p>You have the right to access, correct, delete, or port your personal data. To exercise any of these rights, email us at{" "}
              <a href="mailto:privacy@autoflipr.co.uk" className="text-text-primary underline hover:no-underline">
                privacy@autoflipr.co.uk
              </a>
              . We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">7. Cookies</h2>
            <p>
              We use only essential cookies required for authentication and session management. We do not use advertising
              or analytics cookies without your explicit consent.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">8. Contact</h2>
            <p>
              For privacy enquiries, contact{" "}
              <a href="mailto:privacy@autoflipr.co.uk" className="text-text-primary underline hover:no-underline">
                privacy@autoflipr.co.uk
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border-default">
          <a href="/" className="text-sm text-text-muted hover:text-text-primary transition-colors">← Back to AutoFlipr</a>
        </div>
      </div>
    </div>
  );
}
