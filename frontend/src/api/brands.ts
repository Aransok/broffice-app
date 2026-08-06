import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { Brand, Paginated } from './types'

export function fetchBrands() {
  return apiClient.get<Paginated<Brand>>('/brands/').then((res) => res.data)
}

export function useBrands() {
  return useQuery({
    queryKey: ['brands'],
    queryFn: fetchBrands,
  })
}
