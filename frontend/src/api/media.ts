import { apiClient } from './client'

const apiOrigin = (apiClient.defaults.baseURL ?? '').replace(/\/api\/v1\/?$/, '')

/**
 * Product/category images imported from the legacy site were never copied into
 * Django's media storage — only their original HTTrack-relative path was
 * captured (see docs/issues/product-images-not-copied.md). This serves them
 * via the backend's dev-only /legacy-media/ bridge until the real image
 * pipeline exists.
 */
export function getLegacyMediaUrl(path: string): string | null {
  if (!path) return null
  return `${apiOrigin}/legacy-media/${path.replace(/^\/+/, '')}`
}

/**
 * Images uploaded through the admin product form are real files saved under
 * Django's own MEDIA_ROOT (path always starts with "products/") — served via
 * the normal /media/ route, not the legacy bridge.
 */
export function getImageUrl(path: string | null | undefined): string | null {
  if (!path) return null
  // Supplier-synced images (sync_supplier_catalog) are stored as the
  // supplier's own absolute URL — hotlinked directly, not copied into our
  // media storage yet, so neither of the other two branches applies.
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  if (
    path.startsWith('products/') ||
    path.startsWith('categories/') ||
    path.startsWith('brands/') ||
    path.startsWith('highlights/')
  ) {
    return `${apiOrigin}/media/${path}`
  }
  return getLegacyMediaUrl(path)
}

/** Base media origin, for fetching non-image static files served the same
 * way (e.g. the promo banner manifest.json) — not routed through apiClient
 * since it isn't a DRF endpoint, just a static file under MEDIA_ROOT. */
export function getMediaOrigin(): string {
  return apiOrigin
}
