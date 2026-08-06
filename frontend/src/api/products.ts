import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { Paginated, ProductDetail, ProductListItem } from './types'

export interface ProductListParams {
  category__slug?: string
  brand__slug?: string
  page?: number
  ordering?: string
  search?: string
  price_bgn__gte?: string
  price_bgn__lte?: string
  on_promotion?: boolean
}

export function fetchProducts(params: ProductListParams = {}) {
  return apiClient.get<Paginated<ProductListItem>>('/products/', { params }).then((res) => res.data)
}

export function fetchProduct(slug: string) {
  return apiClient.get<ProductDetail>(`/products/${slug}/`).then((res) => res.data)
}

export function useProducts(params: ProductListParams = {}) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => fetchProducts(params),
  })
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: () => fetchProduct(slug),
    enabled: Boolean(slug),
  })
}

/** Content-based — same category (brand preferred), not personalized. */
export function fetchSimilarProducts(slug: string) {
  return apiClient.get<ProductListItem[]>(`/products/${slug}/similar/`).then((res) => res.data)
}

export function useSimilarProducts(slug: string) {
  return useQuery({
    queryKey: ['product-similar', slug],
    queryFn: () => fetchSimilarProducts(slug),
    enabled: Boolean(slug),
  })
}

/** Personalized to the viewer's own browsing activity — empty for
 * guests/no-activity users, in which case the section should just not
 * render at all rather than show empty. */
export function fetchRecommendedProducts(slug: string) {
  return apiClient.get<ProductListItem[]>(`/products/${slug}/recommended/`).then((res) => res.data)
}

export function useRecommendedProducts(slug: string) {
  return useQuery({
    queryKey: ['product-recommended', slug],
    queryFn: () => fetchRecommendedProducts(slug),
    enabled: Boolean(slug),
  })
}
