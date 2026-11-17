import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { SearchResponse } from './types'

export interface SearchFilters {
  ordering?: string
  /** BGN, like the category page's price filter. */
  price_bgn__gte?: string
  price_bgn__lte?: string
  /** Comma-separated brand slugs. */
  brands?: string
  category?: string
  page?: number
}

export function fetchSearch(q: string, filters: SearchFilters = {}) {
  const params = Object.fromEntries(
    Object.entries({ q, ...filters }).filter(([, value]) => value !== undefined && value !== ''),
  )
  return apiClient.get<SearchResponse>('/search/', { params }).then((res) => res.data)
}

export function useSearch(q: string, filters: SearchFilters = {}) {
  return useQuery({
    queryKey: ['search', q, filters],
    queryFn: () => fetchSearch(q, filters),
    enabled: q.trim().length > 0,
    // Keep the current results on screen while a filter change loads.
    placeholderData: keepPreviousData,
  })
}
