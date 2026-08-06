import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'

export interface AdminDashboardStats {
  pending_orders: number
  unread_notifications: number
  total_customers: number
  total_products: number
}

export function fetchDashboardStats() {
  return apiClient.get<AdminDashboardStats>('/admin/dashboard/stats/').then((res) => res.data)
}

export function useDashboardStats(enabled = true) {
  return useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: fetchDashboardStats,
    enabled,
    // Polled for the header's unread-notifications badge (spec #6: admin
    // must see new orders without relying on email) — 30s is a reasonable
    // "feels live" interval without hammering the endpoint.
    refetchInterval: enabled ? 30_000 : false,
  })
}
