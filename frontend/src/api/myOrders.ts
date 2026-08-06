import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { Order, Paginated } from './types'

// SESSION_COOKIE_SAMESITE=Lax still sends the cookie on this kind of
// top-level GET navigation (an <a href> click), even cross-port in dev —
// so a plain link works without needing to fetch+blob the PDF in JS.
export function getInvoiceDownloadUrl(orderNumber: string) {
  return `${apiClient.defaults.baseURL}/my-orders/${orderNumber}/invoice/`
}

export function fetchMyOrders() {
  return apiClient.get<Paginated<Order>>('/my-orders/').then((res) => res.data)
}

export function fetchMyOrder(number: string) {
  return apiClient.get<Order>(`/my-orders/${number}/`).then((res) => res.data)
}

export function useMyOrders(enabled: boolean) {
  return useQuery({
    queryKey: ['my-orders'],
    queryFn: fetchMyOrders,
    enabled,
  })
}

export function useMyOrder(number: string) {
  return useQuery({
    queryKey: ['my-order', number],
    queryFn: () => fetchMyOrder(number),
    enabled: Boolean(number),
  })
}
