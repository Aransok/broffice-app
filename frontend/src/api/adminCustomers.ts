import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { Paginated } from './types'

export interface AdminCustomer {
  id: number
  username: string
  email: string
  date_joined: string
  is_active: boolean
  order_count: number
  cart_item_count: number
  promotion_count: number
  price_override_count: number
  activity_count: number
}

export interface AdminCartLine {
  item_id: string
  product_id: string
  product_slug: string
  product_name: string
  product_number: string
  product_image: string | null
  quantity: number
  base_price: string
  unit_price: string
  price_source: string
  line_total: string
}

export interface AdminCart {
  items: AdminCartLine[]
  subtotal_bgn: string
}

export interface AdminActivityRow {
  id: string
  product: string
  product_name: string
  product_slug: string
  product_image: string | null
  category: string | null
  category_name: string | null
  view_count: number
  last_viewed_at: string
  price_bgn: string | null
  effective_price_bgn: string | null
  price_source: string | null
}

export function fetchAdminCustomers(params: { search?: string; page?: number } = {}) {
  return apiClient
    .get<Paginated<AdminCustomer>>('/admin/customers/', { params })
    .then((res) => res.data)
}

export function fetchAdminCustomer(id: number) {
  return apiClient.get<AdminCustomer>(`/admin/customers/${id}/`).then((res) => res.data)
}

export function deleteAdminCustomer(id: number) {
  return apiClient.delete(`/admin/customers/${id}/`)
}

export function fetchCustomerCart(id: number) {
  return apiClient.get<AdminCart>(`/admin/customers/${id}/cart/`).then((res) => res.data)
}

export function addCustomerCartItem(id: number, productId: string, quantity: number) {
  return apiClient
    .post<AdminCart>(`/admin/customers/${id}/cart/items/`, {
      product_id: productId,
      quantity,
    })
    .then((res) => res.data)
}

export function updateCustomerCartItem(id: number, itemId: string, quantity: number) {
  return apiClient
    .patch<AdminCart>(`/admin/customers/${id}/cart/items/${itemId}/`, { quantity })
    .then((res) => res.data)
}

export function removeCustomerCartItem(id: number, itemId: string) {
  return apiClient
    .delete<AdminCart>(`/admin/customers/${id}/cart/items/${itemId}/`)
    .then((res) => res.data)
}

export function fetchCustomerActivity(id: number) {
  return apiClient
    .get<AdminActivityRow[]>(`/admin/customers/${id}/activity/`)
    .then((res) => res.data)
}

export function useAdminCustomers(params: { search?: string; page?: number } = {}) {
  return useQuery({
    queryKey: ['admin-customers', params],
    queryFn: () => fetchAdminCustomers(params),
  })
}

export function useAdminCustomer(id: number) {
  return useQuery({
    queryKey: ['admin-customer', id],
    queryFn: () => fetchAdminCustomer(id),
  })
}

export function useCustomerCart(id: number) {
  return useQuery({
    queryKey: ['admin-customer-cart', id],
    queryFn: () => fetchCustomerCart(id),
  })
}

export function useCustomerActivity(id: number) {
  return useQuery({
    queryKey: ['admin-customer-activity', id],
    queryFn: () => fetchCustomerActivity(id),
  })
}
