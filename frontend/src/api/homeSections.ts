import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { ProductListItem } from './types'

export interface HomeSections {
  best_sellers: ProductListItem[]
  new_products: ProductListItem[]
  promotions: ProductListItem[]
  /** Personalized to the logged-in user's browsing activity — empty for
   * guests/no-activity users, same "just don't render the section" pattern
   * as best_sellers/promotions when those come back empty too. */
  recommended: ProductListItem[]
}

export function fetchHomeSections() {
  return apiClient.get<HomeSections>('/home-sections/').then((res) => res.data)
}

export function useHomeSections() {
  return useQuery({
    queryKey: ['home-sections'],
    queryFn: fetchHomeSections,
  })
}
