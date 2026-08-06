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

export function useNotifications() {
  return useQuery({
    queryKey: ['admin-notifications'],
    queryFn: fetchNotifications,
  })
}
