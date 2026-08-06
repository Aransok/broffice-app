import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { Paginated } from './types'

export interface AdminPriceOverride {
  id: string
  product: string
  product_name: string
  user: number
  username: string
  client_price: string | null
  admin_price: string | null
  notes: string
  created_at: string
}

export type AdminPriceOverridePayload = Partial<
  Pick<AdminPriceOverride, 'product' | 'user' | 'client_price' | 'admin_price' | 'notes'>
>

export function fetchPriceOverrides(params: { user?: number } = {}) {
  return apiClient
    .get<Paginated<AdminPriceOverride>>('/admin/price-overrides/', { params })
    .then((res) => res.data)
}

export function createPriceOverride(payload: AdminPriceOverridePayload) {
  return apiClient
    .post<AdminPriceOverride>('/admin/price-overrides/', payload)
    .then((res) => res.data)
}

export function updatePriceOverride(id: string, payload: AdminPriceOverridePayload) {
  return apiClient
    .patch<AdminPriceOverride>(`/admin/price-overrides/${id}/`, payload)
    .then((res) => res.data)
}

export function deletePriceOverride(id: string) {
  return apiClient.delete(`/admin/price-overrides/${id}/`)
}

export function usePriceOverrides(params: { user?: number } = {}) {
  return useQuery({
    queryKey: ['admin-price-overrides', params],
    queryFn: () => fetchPriceOverrides(params),
  })
}
