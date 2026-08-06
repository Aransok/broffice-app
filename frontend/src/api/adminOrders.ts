import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { Order, Paginated } from './types'

export function getAdminInvoiceDownloadUrl(orderNumber: string) {
  return `${apiClient.defaults.baseURL}/admin/orders/${orderNumber}/invoice/`
}

export function fetchAdminOrders(params: { user?: number; status?: string } = {}) {
  return apiClient
    .get<Paginated<Order>>('/admin/orders/', { params })
    .then((res) => res.data)
}

export function useAdminOrders(params: { user?: number; status?: string } = {}) {
  return useQuery({
    queryKey: ['admin-orders', params],
    queryFn: () => fetchAdminOrders(params),
  })
}
