import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { ShippingMethod, SpeedyOffice } from './types'

export function fetchSpeedyOffices(city: string, q: string) {
  return apiClient
    .get<SpeedyOffice[]>('/shipping/speedy/offices/', { params: { city, q } })
    .then((res) => res.data)
}

export function useSpeedyOffices(city: string, q: string) {
  return useQuery({
    queryKey: ['speedy-offices', city, q],
    queryFn: () => fetchSpeedyOffices(city, q),
    enabled: city.trim().length > 0,
  })
}

export function fetchSpeedyQuote(shippingMethod: ShippingMethod, city: string) {
  return apiClient
    .post<{ shipping_cost_bgn: string }>('/shipping/speedy/quote/', {
      shipping_method: shippingMethod,
      city,
    })
    .then((res) => res.data)
}
