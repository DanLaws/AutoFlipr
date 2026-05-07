import SEO from "../components/SEO";

export default function TermsPage() {
  return (
    <div className="min-h-screen px-4 py-16" style={{ background: "var(--color-page)" }}>
      <SEO
        title="Terms of Service"
        description="AutoFlipr terms of service."
        canonical="/terms"
        noindex
      />
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-text-primary tracking-tight mb-2">Terms of Service</h1>
        <p className="text-sm text-text-faint mb-10">Last updated: May 2025</p>

        <div className="space-y-8 text-sm text-text-secondary leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">1. Acceptance of terms</h2>
            <p>
              By accessing or using AutoFlipr ("the Service"), you agree to be bound by these Terms of Service. If you do not
              agree, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">2. Description of service</h2>
            <p>
              AutoFlipr provides tools to help UK users identify potentially underpriced used vehicles listed on third-party
              marketplaces. Deal scores, margin estimates, and cost breakdowns are indicative only and do not constitute
              financial advice.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">3. User accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for all activity that
              occurs under your account. You must be at least 18 years old to use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">4. Acceptable use</h2>
            <p>
              You agree not to misuse the Service, including attempting to circumvent rate limits, scrape data in bulk,
              reverse-engineer proprietary algorithms, or use the Service for any unlawful purpose.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">5. Disclaimers</h2>
            <p>
              The Service is provided "as is" without warranties of any kind. AutoFlipr does not guarantee the accuracy of
              listings, valuations, or any data sourced from third-party marketplaces. Always conduct your own due diligence
              before purchasing a vehicle.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">6. Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, AutoFlipr Ltd shall not be liable for any indirect, incidental, or
              consequential damages arising from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">7. Governing law</h2>
            <p>
              These terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive
              jurisdiction of the courts of England and Wales.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-text-primary mb-2">8. Contact</h2>
            <p>
              Questions about these terms? Email us at{" "}
              <a href="mailto:legal@autoflipr.co.uk" className="text-text-primary underline hover:no-underline">
                legal@autoflipr.co.uk
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
