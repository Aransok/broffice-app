import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'

export interface PublicConfig {
  vat_rate_percent: string
  prices_include_vat: boolean
  company_name: string
  company_eik: string
  /** Empty string when not configured — never a placeholder/invented value. */
  company_vat_number: string
  company_address: string
  company_email: string
  company_phone: string
  company_working_hours: string
}

export function fetchPublicConfig() {
  return apiClient.get<PublicConfig>('/config/').then((res) => res.data)
}

export function usePublicConfig() {
  return useQuery({
    queryKey: ['public-config'],
    queryFn: fetchPublicConfig,
    staleTime: Infinity,
  })
}
