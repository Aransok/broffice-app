import { useState } from 'react'
import { useCategories } from '../../api/categories'
import { getImageUrl } from '../../api/media'
import { useProducts } from '../../api/products'
import type { ProductListItem } from '../../api/types'

/** Shared "find a product" widget for every admin place that needs to pick
 * one out of ~90+ products by more than just its name: customer cart
 * management, individual pricing, and promotion product-scope selection.
 * Category filter + name/SKU search both go through the exact same public
 * product-listing endpoint/category data the storefront uses — no
 * duplicated product or category source. */
export function AdminProductPicker({
  onSelect,
  placeholder = 'Търси продукт по име или SKU...',
}: {
  onSelect: (product: ProductListItem) => void
  placeholder?: string
}) {
  const [categorySlug, setCategorySlug] = useState('')
  const [search, setSearch] = useState('')
  const { data: categories } = useCategories()
  const active = Boolean(categorySlug || search)
  const { data: products, isLoading } = useProducts({
    category__slug: categorySlug || undefined,
    search: search || undefined,
  })

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="admin-picker-category">
          Категория
        </label>
        <select
          id="admin-picker-category"
          value={categorySlug}
          onChange={(event) => setCategorySlug(event.target.value)}
          className="rounded-ui border border-slate-300 bg-surface px-2 py-2 text-sm text-slate-700"
        >
          <option value="">Всички категории</option>
          {categories?.results.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Търсене по име или SKU"
          className="min-w-55 flex-1 rounded-ui border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {active && (
        <div className="mt-2 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-ui border border-slate-200">
          {isLoading && <p className="p-3 text-sm text-slate-500">Зареждане...</p>}
          {products && products.results.length === 0 && (
            <p className="p-3 text-sm text-slate-500">Няма намерени продукти.</p>
          )}
          {products?.results.map((product) => {
            const imageUrl = getImageUrl(product.primary_image)
            const price = product.client_price ?? product.price_bgn
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => onSelect(product)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-primary/10"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-ui border border-slate-200 bg-slate-100">
                  {imageUrl ? (
                    <img src={imageUrl} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-center text-[9px] leading-tight text-slate-400">
                      Без снимка
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{product.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    SKU: {product.sku || '—'} · {product.category_name ?? 'Без категория'}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-slate-600">
                  <span className="block text-[10px] text-slate-400">База</span>
                  <span className="font-medium text-slate-700">{price ? `${price} лв.` : '—'}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
