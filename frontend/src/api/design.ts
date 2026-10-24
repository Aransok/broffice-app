import { apiClient } from './client'

export interface DesignChoice {
  value: string
  label: string
}

export interface AdminDesignState {
  design: string
  choices: DesignChoice[]
}

/** The design every visitor currently gets. */
export function fetchLiveDesign() {
  return apiClient.get<{ design: string }>('/design/').then((res) => res.data.design)
}

export function fetchAdminDesign() {
  return apiClient.get<AdminDesignState>('/admin/design/').then((res) => res.data)
}

/** Makes a design live for every visitor. Admin only. */
export function setLiveDesign(design: string) {
  return apiClient.put<AdminDesignState>('/admin/design/', { design }).then((res) => res.data)
}
