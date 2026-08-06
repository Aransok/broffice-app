import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { Paginated } from './types'

export type CouponDiscountType = 'percent' | 'flat'

export interface Coupon {
  id: string
  code: string
  discount_type: CouponDiscountType
  value: string
  /** Coupon only applies if the cart subtotal (BGN) is at least this —
   * guards a flat coupon from making a cheap item free. Null = no minimum. */
  min_order_amount: string | null
  user: number | null
  username: string | null
  active: boolean
  is_redeemed: boolean
  redeemed_at: string | null
  redeemed_by_username: string | null
  redeemed_order_number: string | null
  created_at: string
}

export interface CouponCreatePayload {
  code?: string
  discount_type: CouponDiscountType
  value: string
  min_order_amount: string | null
  user: number | null
  active: boolean
}

export interface CouponCreateResponse extends Coupon {
  email_sent: boolean
  email_error?: string
}

export function fetchCoupons(params: { user?: number; search?: string } = {}) {
  return apiClient.get<Paginated<Coupon>>('/admin/coupons/', { params }).then((res) => res.data)
}

export function createCoupon(payload: CouponCreatePayload) {
  return apiClient.post<CouponCreateResponse>('/admin/coupons/', payload).then((res) => res.data)
}

export function updateCoupon(id: string, payload: Partial<CouponCreatePayload>) {
  return apiClient.patch<Coupon>(`/admin/coupons/${id}/`, payload).then((res) => res.data)
}

export function deleteCoupon(id: string) {
  return apiClient.delete(`/admin/coupons/${id}/`)
}

export function useCoupons(params: { user?: number; search?: string } = {}) {
  return useQuery({
    queryKey: ['admin-coupons', params],
    queryFn: () => fetchCoupons(params),
  })
}

/** Customer-facing checkout preview — the real, only-enforced validation
 * happens again server-side when the order is actually submitted. */
export function validateCoupon(code: string, subtotal: string) {
  return apiClient
    .post<{ code: string; discount_type: CouponDiscountType; value: string }>(
      '/coupons/validate/',
      { code, subtotal },
    )
    .then((res) => res.data)
}
