import { Helmet } from "react-helmet-async";

// Update SITE_URL when the production domain is confirmed.
// Set VITE_SITE_URL in your .env file to override locally.
const SITE_URL = import.meta.env.VITE_SITE_URL ?? "https://autoflipr.com";
const SITE_NAME = "AutoFlipr";
const DEFAULT_DESCRIPTION =
  "AutoFlipr scores every used car on AutoTrader, Gumtree and Facebook Marketplace against real market data. Instantly find underpriced UK used cars worth buying or flipping.";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

interface SEOProps {
  /** Page-specific title. Appended with "| AutoFlipr". Omit to use the full brand default. */
  title?: string;
  description?: string;
  /** Path only, e.g. "/pricing". Resolved against SITE_URL. */
  canonical?: string;
  noindex?: boolean;
  ogType?: "website" | "article";
  ogImage?: string;
  /** One or more schema.org JSON-LD objects. Injected as <script type="application/ld+json">. */
  schema?: Record<string, unknown> | Record<string, unknown>[];
}

export default function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  canonical,
  noindex = false,
  ogType = "website",
  ogImage = DEFAULT_OG_IMAGE,
  schema,
}: SEOProps) {
  const fullTitle = title
    ? `${title} | ${SITE_NAME}`
    : `${SITE_NAME} — Find Underpriced Used Cars in the UK`;

  const canonicalUrl = canonical ? `${SITE_URL}${canonical}` : undefined;

  const schemas = schema
    ? Array.isArray(schema)
      ? schema
      : [schema]
    : null;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta
        name="robots"
        content={noindex ? "noindex, nofollow" : "index, follow"}
      />
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:image" content={ogImage} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* JSON-LD structured data */}
      {schemas &&
        schemas.map((s, i) => (
          <script key={i} type="application/ld+json">
            {JSON.stringify(s)}
          </script>
        ))}
    </Helmet>
  );
}
