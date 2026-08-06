import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { Address, Paginated } from './types'

export type AddressPayload = Omit<Address, 'id'>

export function fetchAddresses() {
  return apiClient.get<Paginated<Address>>('/addresses/').then((res) => res.data)
}

export function createAddress(payload: Partial<AddressPayload>) {
  return apiClient.post<Address>('/addresses/', payload).then((res) => res.data)
}

export function updateAddress(id: string, payload: Partial<AddressPayload>) {
  return apiClient.patch<Address>(`/addresses/${id}/`, payload).then((res) => res.data)
}

export function deleteAddress(id: string) {
  return apiClient.delete(`/addresses/${id}/`)
}

export function useAddresses(enabled: boolean) {
  return useQuery({
    queryKey: ['addresses'],
    queryFn: fetchAddresses,
    enabled,
  })
}
