import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { Category, Paginated } from './types'

export interface CategoryTreeNode {
  id: string
  external_id: string
  slug: string
  name: string
  children: CategoryTreeNode[]
}

export function fetchCategories(params: { search?: string } = {}) {
  return apiClient.get<Paginated<Category>>('/categories/', { params }).then((res) => res.data)
}

export function fetchCategory(slug: string) {
  return apiClient.get<Category>(`/categories/${slug}/`).then((res) => res.data)
}

export function fetchCategoryTree() {
  return apiClient.get<CategoryTreeNode[]>('/categories/tree/').then((res) => res.data)
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => fetchCategories(),
  })
}

export function useCategory(slug: string) {
  return useQuery({
    queryKey: ['category', slug],
    queryFn: () => fetchCategory(slug),
    enabled: Boolean(slug),
  })
}

export function useCategoryTree() {
  return useQuery({
    queryKey: ['category-tree'],
    queryFn: fetchCategoryTree,
    staleTime: 10 * 60 * 1000,
  })
}
