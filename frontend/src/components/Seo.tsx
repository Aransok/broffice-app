import { Helmet } from 'react-helmet-async'
import type { SeoData } from '../api/types'

const SITE_NAME = 'BRoffice'
const DEFAULT_DESCRIPTION =
  'BRoffice — онлайн магазин за офис консумативи, канцеларски материали и техника с доставка в цяла България.'

interface SeoProps {
  /** Full payload from a product/category detail response — takes priority
   * over the plain props below when present. */
  data?: SeoData
  title?: string
  description?: string
  /** Defaults to the current page URL — only override for pages that
   * shouldn't self-canonicalize (none currently, kept for completeness). */
  canonical?: string
  /** e.g. "noindex, follow" for search results / other non-indexable pages. */
  robots?: string
  jsonLd?: Record<string, unknown>[]
}

/** Sets per-page <title>/meta/canonical/Open Graph/JSON-LD via
 * react-helmet-async. Every route should render this once, even pages with
 * no DB-backed SEO row (data undefined) — title/description still fall
 * back to something real rather than leaving index.html's generic default
 * in place while the user browses deeper into the site. */
export function Seo({ data, title, description, canonical, robots, jsonLd }: SeoProps) {
  const resolvedTitle = data?.title || title || SITE_NAME
  const resolvedDescription = data?.description || description || DEFAULT_DESCRIPTION
  const resolvedCanonical = data?.canonical || canonical || window.location.href
  const resolvedRobots = data?.robots || robots || 'index, follow'
  const og = data?.open_graph
  const ld = data?.json_ld ?? jsonLd

  return (
    <Helmet>
      <title>{resolvedTitle}</title>
      <meta name="description" content={resolvedDescription} />
      <meta name="robots" content={resolvedRobots} />
      <link rel="canonical" href={resolvedCanonical} />

      <meta property="og:type" content={og?.['og:type'] || 'website'} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={og?.['og:title'] || resolvedTitle} />
      <meta
        property="og:description"
        content={og?.['og:description'] || resolvedDescription}
      />
      <meta property="og:url" content={og?.['og:url'] || resolvedCanonical} />
      {og?.['og:image'] && <meta property="og:image" content={og['og:image']} />}

      {ld?.map((entry, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(entry)}
        </script>
      ))}
    </Helmet>
  )
}
