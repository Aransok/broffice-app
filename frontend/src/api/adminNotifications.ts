import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { Order, Paginated } from './types'

export interface OrderNotification {
  id: string
  order: Order
  is_read: boolean
  message: string
  created_at: string
}

export function fetchNotifications() {
  return apiClient
    .get<Paginated<OrderNotification>>('/admin/notifications/')
    .then((res) => res.data)
}

export function markNotificationRead(id: string) {
  return apiClient.post(`/admin/notifications/${id}/mark_read/`)
}

export function confirmOrder(number: string) {
  return apiClient.post<Order>(`/admin/orders/${number}/confirm/`).then((res) => res.data)
}

export function rejectOrder(number: string, reason: string) {
  return apiClient
    .post<Order>(`/admin/orders/${number}/reject/`, { reason })
    .then((res) => res.data)
}

/** Re-checks currently active promotions against a still-pending order and
 * updates its item prices/totals accordingly — lets admin apply a
 * promotion the customer missed (or one that started after the order came
 * in) before confirming, rather than the order being stuck forever at
 * checkout-time pricing. */
export function repriceOrder(number: string) {
  return apiClient.post<Order>(`/admin/orders/${number}/reprice/`).then((res) => res.data)
}

/** Adds a product to a still-pending order before it's confirmed/rejected -
 * e.g. swapping in a replacement for an out-of-stock item. `unitPriceBgn`
 * bypasses the pricing engine entirely as a manual override (e.g. "0.00"
 * for a free gift) - leave it out to price the item normally. */
export function addOrderItem(
  number: string,
  productId: string,
  quantity: number,
  unitPriceBgn?: string,
) {
  return apiClient
    .post<Order>(`/admin/orders/${number}/add-item/`, {
      product_id: productId,
      quantity,
      ...(unitPriceBgn !== undefined ? { unit_price: unitPriceBgn } : {}),
    })
    .then((res) => res.data)
}

export function removeOrderItem(number: string, itemId: string) {
  return apiClient
    .delete<Order>(`/admin/orders/${number}/items/${itemId}/`)
    .then((res) => res.data)
}

export function useNotifications() {
  return useQuery({
    queryKey: ['admin-notifications'],
    queryFn: fetchNotifications,
  })
}
