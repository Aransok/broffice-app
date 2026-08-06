import { apiClient } from './client'

export interface ContactPayload {
  name: string
  email: string
  phone?: string
  subject?: string
  message: string
}

export function submitContactForm(payload: ContactPayload) {
  return apiClient.post<{ detail: string }>('/contact/', payload).then((res) => res.data)
}
