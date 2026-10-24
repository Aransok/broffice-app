import { apiClient } from './client'

export interface DesignChoice {
  value: string
  label: string
}

/** {"bold": {"numbers": false}}: only the owner's overrides, per design. */
export type FeatureOverrides = Record<string, Record<string, boolean>>

export interface LiveDesign {
  design: string
  features: FeatureOverrides
}

export interface AdminDesignState extends LiveDesign {
  choices: DesignChoice[]
}

/** The design every visitor currently gets, with its feature switches. */
export function fetchLiveDesign() {
  return apiClient.get<LiveDesign>('/design/').then((res) => res.data)
}

export function fetchAdminDesign() {
  return apiClient.get<AdminDesignState>('/admin/design/').then((res) => res.data)
}

/** Makes a design live for every visitor. Admin only. */
export function setLiveDesign(design: string) {
  return apiClient.put<AdminDesignState>('/admin/design/', { design }).then((res) => res.data)
}

/** Replaces one design's feature switches. Admin only. */
export function setDesignFeatures(design: string, features: Record<string, boolean>) {
  return apiClient
    .put<AdminDesignState>('/admin/design/', { features: { [design]: features } })
    .then((res) => res.data)
}
