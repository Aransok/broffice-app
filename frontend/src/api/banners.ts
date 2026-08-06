import { useQuery } from '@tanstack/react-query'
import { getMediaOrigin } from './media'

export interface BannerEntry {
  id: string
  type: 'product' | 'category'
  image_path: string
  target_url: string
  title: string
  discount_label: string
}

/** Not a DRF endpoint — banners/services.py (backend) writes this file
 * directly to MEDIA_ROOT/highlights/manifest.json on every sync_banners()
 * run, so the frontend just reads it as a static file. Deliberately not
 * "/media/banners/..." — that URL shape is a classic ad-blocker filter
 * pattern (EasyList and similar block "/banners/" by default), which would
 * silently fail for a real chunk of visitors with no console error. */
export function fetchBanners(): Promise<BannerEntry[]> {
  return fetch(`${getMediaOrigin()}/media/highlights/manifest.json`).then((res) => {
    if (!res.ok) {
      // No promotions active yet -> sync_banners() has never run -> the
      // file doesn't exist. Not an error, just "no banners right now".
      if (res.status === 404) return []
      throw new Error(`Failed to load banners (${res.status})`)
    }
    return res.json()
  })
}

export function useBanners() {
  return useQuery({
    queryKey: ['banners'],
    queryFn: fetchBanners,
    // A newly created/edited promotion's banner shows up within this
    // window even if the homepage tab was already open and never
    // remounted/refocused (the two ways TanStack Query would otherwise
    // refetch on its own) — cheap to poll since it's just a small static
    // JSON file, not a real API call.
    refetchInterval: 60_000,
  })
}
