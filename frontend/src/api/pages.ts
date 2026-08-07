import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { SeoData } from './types'

export interface CmsPage {
  id: string
  slug: string
  title: string
  body: string
  updated_at: string
  seo: SeoData
}

export function fetchPage(slug: string) {
  return apiClient.get<CmsPage>(`/pages/${slug}/`).then((res) => res.data)
}

export function usePage(slug: string) {
  return useQuery({
    queryKey: ['page', slug],
    queryFn: () => fetchPage(slug),
  })
}
