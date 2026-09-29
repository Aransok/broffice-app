import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'

export interface PigeonExpressPickupOffice {
  office_id: string
  office_name: string
}

export function fetchPigeonExpressPickupOffice() {
  return apiClient
    .get<PigeonExpressPickupOffice>('/admin/pigeon-express/pickup-office/')
    .then((res) => res.data)
}

export function usePigeonExpressPickupOffice() {
  return useQuery({
    queryKey: ['admin-pigeon-express-pickup-office'],
    queryFn: fetchPigeonExpressPickupOffice,
  })
}

export function setPigeonExpressPickupOffice(officeId: string) {
  return apiClient
    .put<PigeonExpressPickupOffice>('/admin/pigeon-express/pickup-office/', {
      office_id: officeId,
    })
    .then((res) => res.data)
}
