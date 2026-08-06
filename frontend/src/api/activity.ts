import { apiClient } from './client'

/** Records that the logged-in customer viewed a product — powers the admin
 * customer-detail "Активност" tab. Authenticated-only on the backend (guest
 * browsing is never tracked); the call is skipped client-side too so a
 * logged-out visitor never even fires the request. */
export function trackProductView(productId: string) {
  return apiClient.post('/activity/track/', { product_id: productId })
}
