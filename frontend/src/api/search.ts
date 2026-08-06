import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { SearchResponse } from './types'

export function fetchSearch(q: string) {
  return apiClient.get<SearchResponse>('/search/', { params: { q } }).then((res) => res.data)
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: ['search', q],
    queryFn: () => fetchSearch(q),
    enabled: q.trim().length > 0,
  })
}
