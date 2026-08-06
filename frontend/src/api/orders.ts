import { apiClient } from './client'
import type { Order, OrderCreatePayload } from './types'

export function createOrder(payload: OrderCreatePayload) {
  return apiClient.post<Order>('/orders/', payload).then((res) => res.data)
}
