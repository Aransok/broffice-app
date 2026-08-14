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

/** Flattens the category list (already a mix of top-level categories and
 * subcategories — the plain list endpoint returns both, unrestricted) into
 * parent-then-children order so a category picker can target a subcategory
 * specifically (e.g. "Принтерна хартия" under a much bigger parent) without
 * having to hunt for it in an unsorted, unindented dropdown. Shared by every
 * admin category-scoped picker (promotions page, per-client promotions) so
 * they all list/order categories identically. */
export function orderedCategoryOptions(
  categories: Category[],
): { category: Category; depth: number }[] {
  const byParent = new Map<string | null, Category[]>()
  for (const category of categories) {
    const key = category.parent
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(category)
  }
  const result: { category: Category; depth: number }[] = []
  function walk(parentId: string | null, depth: number) {
    for (const category of byParent.get(parentId) ?? []) {
      result.push({ category, depth })
      walk(category.id, depth + 1)
    }
  }
  walk(null, 0)
  return result
}
