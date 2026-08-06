import { Link, useSearchParams } from 'react-router-dom'
import { useProducts } from '../api/products'
import { ProductCard } from '../components/product/ProductCard'

const PAGE_SIZE = 24

const SORT_OPTIONS: { value: string; label: string; ordering: string }[] = [
  { value: 'default', label: 'По подразбиране', ordering: '-created_at' },
  { value: 'name', label: 'Име (А-Я)', ordering: 'name' },
  { value: 'price_asc', label: 'Цена: ниска към висока', ordering: 'price_bgn' },
  { value: 'price_desc', label: 'Цена: висока към ниска', ordering: '-price_bgn' },
]

/** Reuses the same product-listing endpoint/grid/pagination as CategoryPage,
 * just filtered to `on_promotion=1` (backed by the same `promoted_products_q`
 * the homepage's Promotions section and the pricing engine both use) — never
 * a separate hand-picked or duplicated product set. */
export function PromotionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') ?? '1')
  const sort = searchParams.get('sort') ?? 'default'
  const ordering = SORT_OPTIONS.find((option) => option.value === sort)?.ordering

  const { data: products, isLoading, isError } = useProducts({
    on_promotion: true,
    page,
    ordering,
  })

  function updateSort(value: string) {
    const merged = new URLSearchParams(searchParams)
    merged.set('sort', value)
    merged.delete('page')
    setSearchParams(merged)
  }

  function goToPage(nextPage: number) {
    const merged = new URLSearchParams(searchParams)
    merged.set('page', String(nextPage))
    setSearchParams(merged)
  }

  const totalPages = products ? Math.ceil(products.count / PAGE_SIZE) : 0

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-4 text-sm text-slate-500">
        <Link to="/" className="hover:text-primary">
          Начало
        </Link>{' '}
        / <span className="text-slate-700">Промоции</span>
      </nav>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Промоции</h1>

      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-ui border border-slate-200 p-3">
        <label className="text-sm text-slate-700">
          Подреди по
          <select
            value={sort}
            onChange={(event) => updateSort(event.target.value)}
            className="mt-1 block rounded-ui border border-slate-300 px-2 py-1.5"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading && <p className="text-slate-500">Зареждане на продукти...</p>}
      {isError && (
        <p className="text-red-600">Продуктите не могат да бъдат заредени в момента.</p>
      )}
      {products && products.results.length === 0 && (
        <p className="text-slate-500">В момента няма активни промоции.</p>
      )}
      {products && products.results.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.results.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => goToPage(p)}
              className={
                p === page
                  ? 'rounded-ui bg-primary px-3 py-1 text-sm text-white'
                  : 'rounded-ui border border-slate-300 px-3 py-1 text-sm text-slate-700'
              }
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
