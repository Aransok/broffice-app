import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type {
  PigeonExpressCity,
  PigeonExpressOffice,
  PigeonExpressStreet,
  ShippingMethod,
  SpeedyOffice,
} from './types'

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

export function fetchPigeonExpressCities(name: string) {
  return apiClient
    .get<{ results: PigeonExpressCity[] }>('/shipping/pigeon-express/cities/', {
      params: { name },
    })
    .then((res) => res.data.results)
}

export function usePigeonExpressCities(name: string) {
  return useQuery({
    queryKey: ['pigeon-express-cities', name],
    queryFn: () => fetchPigeonExpressCities(name),
    enabled: name.trim().length > 0,
  })
}

export function fetchPigeonExpressStreets(cityId: string, name: string) {
  return apiClient
    .get<{ results: PigeonExpressStreet[] }>(
      `/shipping/pigeon-express/cities/${cityId}/streets/`,
      { params: { name } },
    )
    .then((res) => res.data.results)
}

export function usePigeonExpressStreets(cityId: string, name: string) {
  return useQuery({
    queryKey: ['pigeon-express-streets', cityId, name],
    queryFn: () => fetchPigeonExpressStreets(cityId, name),
    enabled: Boolean(cityId) && name.trim().length >= 2,
  })
}

export function fetchPigeonExpressOffices(
  type: 'office' | 'locker',
  cityId: string,
  name: string,
) {
  return apiClient
    .get<{ results: PigeonExpressOffice[] }>('/shipping/pigeon-express/offices/', {
      params: { type, city_id: cityId, name },
    })
    .then((res) => res.data.results)
}

export function usePigeonExpressOffices(
  type: 'office' | 'locker',
  cityId: string,
  name: string,
) {
  return useQuery({
    queryKey: ['pigeon-express-offices', type, cityId, name],
    queryFn: () => fetchPigeonExpressOffices(type, cityId, name),
  })
}

export function fetchPigeonExpressQuote(payload: {
  shipping_method: ShippingMethod
  pigeon_express_city_id?: string
  pigeon_express_street_id?: string
  pigeon_express_street_number?: string
  pigeon_express_additional_info?: string
  pigeon_express_office_id?: string
}) {
  return apiClient
    .post<{ shipping_cost_bgn: string }>('/shipping/pigeon-express/quote/', payload)
    .then((res) => res.data)
}
