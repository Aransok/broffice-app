import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { Paginated, ProductListItem } from './types'

export interface Favorite {
  id: string
  product: ProductListItem
  created_at: string
}

export function fetchFavorites() {
  return apiClient.get<Paginated<Favorite>>('/favorites/').then((res) => res.data)
}

export function addFavorite(productId: string) {
  return apiClient
    .post<Favorite>('/favorites/', { product_id: productId })
    .then((res) => res.data)
}

export function removeFavorite(favoriteId: string) {
  return apiClient.delete(`/favorites/${favoriteId}/`)
}

export function toggleFavorite(productId: string) {
  return apiClient
    .post<{ favorited: boolean }>('/favorites/toggle/', { product_id: productId })
    .then((res) => res.data)
}

export function useFavorites(enabled: boolean) {
  return useQuery({
    queryKey: ['favorites'],
    queryFn: fetchFavorites,
    enabled,
  })
}
