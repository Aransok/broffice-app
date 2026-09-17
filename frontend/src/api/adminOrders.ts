import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { Order, Paginated } from './types'

export function getAdminInvoiceDownloadUrl(orderNumber: string) {
  return `${apiClient.defaults.baseURL}/admin/orders/${orderNumber}/invoice/`
}

export function getAdminPigeonExpressLabelDownloadUrl(orderNumber: string) {
  return `${apiClient.defaults.baseURL}/admin/orders/${orderNumber}/pigeon-express-label/`
}

export function updatePigeonExpressPackage(
  orderNumber: string,
  payload: {
    weight_kg?: string
    length_cm?: string
    width_cm?: string
    height_cm?: string
  },
) {
  return apiClient
    .post<Order>(`/admin/orders/${orderNumber}/pigeon-express-package/`, payload)
    .then((res) => res.data)
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
