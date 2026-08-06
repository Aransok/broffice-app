import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { Paginated } from './types'

/** What's discounted — independent of who it's for, see `user` below. */
export type PromotionScope = 'global' | 'category' | 'product'
export type PromotionDiscountType = 'percent' | 'flat'

export interface Promotion {
  id: string
  name: string
  discount_type: PromotionDiscountType
  value: string
  scope: PromotionScope
  /** Independent audience filter, layered on top of `scope`: null means
   * "everyone eligible for that target", set means "only this client,
   * regardless of scope" — e.g. scope='product' + user=X is a discount on
   * one item for one client. */
  user: number | null
  /** Read-only, populated alongside `user` for display (admin list). */
  username?: string | null
  product: string | null
  category: string | null
  active: boolean
  starts_at: string | null
  ends_at: string | null
  status: string
  /** Caps how many units per order get the discount — e.g. order 100, only
   * the first 20 are discounted, the rest bill at the normal price. Null =
   * no cap, applies to the whole quantity ordered. */
  max_quantity: number | null
}

export type PromotionPayload = Omit<Promotion, 'id' | 'username'>

export interface AdminUserResult {
  id: number
  username: string
  email: string
}

export function fetchPromotions(params: { user?: number; product?: string } = {}) {
  return apiClient
    .get<Paginated<Promotion>>('/admin/promotions/', { params })
    .then((res) => res.data)
}

export function createPromotion(payload: Partial<PromotionPayload>) {
  return apiClient.post<Promotion>('/admin/promotions/', payload).then((res) => res.data)
}

export function updatePromotion(id: string, payload: Partial<PromotionPayload>) {
  return apiClient.patch<Promotion>(`/admin/promotions/${id}/`, payload).then((res) => res.data)
}

export function deletePromotion(id: string) {
  return apiClient.delete(`/admin/promotions/${id}/`)
}

export function searchAdminUsers(search: string) {
  return apiClient
    .get<AdminUserResult[]>('/admin/users/', { params: { search } })
    .then((res) => res.data)
}

export function usePromotions(params: { user?: number; product?: string } = {}) {
  return useQuery({
    queryKey: ['admin-promotions', params],
    queryFn: () => fetchPromotions(params),
  })
}
