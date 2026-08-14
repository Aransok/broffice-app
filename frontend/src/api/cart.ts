import { apiClient } from './client'

export interface CartLine {
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

export interface ServerCart {
  items: CartLine[]
  subtotal_bgn: string
}

export function fetchMyCart() {
  return apiClient.get<ServerCart>('/cart/').then((res) => res.data)
}

export function addMyCartItem(productId: string, quantity: number) {
  return apiClient
    .post<ServerCart>('/cart/items/', { product_id: productId, quantity })
    .then((res) => res.data)
}

export function updateMyCartItem(itemId: string, quantity: number) {
  return apiClient
    .patch<ServerCart>(`/cart/items/${itemId}/`, { quantity })
    .then((res) => res.data)
}

export function removeMyCartItem(itemId: string) {
  return apiClient.delete<ServerCart>(`/cart/items/${itemId}/`).then((res) => res.data)
}
