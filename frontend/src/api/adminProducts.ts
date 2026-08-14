import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { Paginated, ProductDetail, ProductImage, ProductListItem } from './types'

export interface AdminProductPayload {
  name?: string
  description?: string
  short_description?: string
  brand?: string | null
  category?: string | null
  price_bgn?: string
  price_eur?: string
  old_price_bgn?: string | null
  old_price_eur?: string | null
  client_price?: string
  admin_price?: string
  currency?: string
  availability?: string
  pack_quantity?: number | null
  status?: 'draft' | 'published' | 'archived'
  specifications?: Record<string, string>
}

export interface AdminProductListParams {
  search?: string
  page?: number
  category__external_id?: string
  ordering?: string
  /** '1' to only return products with a missing/zero client price - powers
   * the admin products page's quick-fix panel. */
  zero_price?: string
}

export function fetchAdminProducts(params: AdminProductListParams = {}) {
  return apiClient
    .get<Paginated<ProductListItem>>('/admin/products/', { params })
    .then((res) => res.data)
}

export function fetchAdminProduct(id: string) {
  return apiClient.get<ProductDetail>(`/admin/products/${id}/`).then((res) => res.data)
}

export function createAdminProduct(payload: AdminProductPayload) {
  return apiClient.post<ProductDetail>('/admin/products/', payload).then((res) => res.data)
}

export function updateAdminProduct(id: string, payload: AdminProductPayload) {
  return apiClient.patch<ProductDetail>(`/admin/products/${id}/`, payload).then((res) => res.data)
}

export function deleteAdminProduct(id: string) {
  return apiClient.delete(`/admin/products/${id}/`)
}

export interface ProductPricing {
  id: string
  external_id: string
  name: string
  client_price: string | null
  admin_price: string | null
  price_bgn: string | null
  price_eur: string | null
}

export function updateProductPricing(
  id: string,
  payload: Partial<Pick<ProductPricing, 'client_price' | 'admin_price' | 'price_bgn' | 'price_eur'>>,
) {
  return apiClient
    .patch<ProductPricing>(`/admin/products/${id}/pricing/`, payload)
    .then((res) => res.data)
}

export function uploadProductImages(id: string, files: File[]) {
  const formData = new FormData()
  files.forEach((file) => formData.append('images', file))
  return apiClient
    .post<ProductImage[]>(`/admin/products/${id}/images/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((res) => res.data)
}

export function deleteProductImage(productId: string, imageId: string) {
  return apiClient.delete(`/admin/products/${productId}/images/${imageId}/`)
}

export interface SupplierSyncResult {
  created: number
  updated: number
}

export function syncSupplierCatalog() {
  return apiClient.post<SupplierSyncResult>('/admin/products/sync/').then((res) => res.data)
}

export function useAdminProducts(params: AdminProductListParams = {}) {
  return useQuery({
    queryKey: ['admin-products', params],
    queryFn: () => fetchAdminProducts(params),
  })
}

export function useAdminProduct(id: string | null) {
  return useQuery({
    queryKey: ['admin-product', id],
    queryFn: () => fetchAdminProduct(id as string),
    enabled: Boolean(id),
  })
}
