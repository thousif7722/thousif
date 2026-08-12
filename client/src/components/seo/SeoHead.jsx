import { Helmet } from 'react-helmet-async';

const SITE_NAME = 'OneWayFix';
const DEFAULT_OG_IMAGE = 'https://onewayfix.com/og-default.png';
const BASE_URL = 'https://onewayfix.com';

/**
 * SeoHead — reusable SEO meta tag component.
 * Drop this at the top of any page that needs SEO.
 *
 * Props:
 *   title         — page title (will append " | OneWayFix" if not already present)
 *   description   — meta description (150-160 chars)
 *   canonical     — canonical URL (defaults to current path)
 *   ogImage       — OG image URL
 *   ogType        — 'website' | 'article' (default: 'website')
 *   noIndex       — true to add noindex,nofollow (login, admin, private pages)
 *   jsonLd        — array of JSON-LD objects (structured data)
 *   breadcrumbs   — array of { name, url } for BreadcrumbList
 */
export default function SeoHead({
  title,
  description,
  canonical,
  ogImage,
  ogType = 'website',
  noIndex = false,
  jsonLd = [],
  breadcrumbs = [],
}) {
  const fullTitle = title
    ? title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`
    : `${SITE_NAME} — Book Trusted Home Service Professionals Near You`;

  const metaDescription = description ||
    'Book verified home service professionals near you. AC repair, electrician, plumber, cleaning and more. Fast booking, fair prices.';

  const canonicalUrl = canonical
    ? `${BASE_URL}${canonical}`
    : typeof window !== 'undefined' ? window.location.href : BASE_URL;

  const image = ogImage || DEFAULT_OG_IMAGE;

  // Build JSON-LD array — always include WebPage, add passed items
  const allJsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: fullTitle,
      description: metaDescription,
      url: canonicalUrl,
    },
    // Breadcrumbs
    ...(breadcrumbs.length > 1 ? [{
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((crumb, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: crumb.name,
        item: `${BASE_URL}${crumb.url}`,
      })),
    }] : []),
    ...jsonLd,
  ];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />

      {/* Canonical */}
      <link rel="canonical" href={canonicalUrl} />

      {/* Robots */}
      {noIndex
        ? <meta name="robots" content="noindex, nofollow" />
        : <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
      }

      {/* Language */}
      <html lang="en" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={ogType} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_IN" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={image} />

      {/* JSON-LD Structured Data */}
      {allJsonLd.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}
