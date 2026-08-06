import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { Menu } from './types'

export function fetchNavigation() {
  return apiClient.get<Menu[]>('/navigation/').then((res) => res.data)
}

export function useNavigation() {
  return useQuery({
    queryKey: ['navigation'],
    queryFn: fetchNavigation,
    staleTime: 5 * 60 * 1000,
  })
}
