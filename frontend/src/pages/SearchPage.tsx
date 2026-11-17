import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSearch } from '../api/search'
import {
  BrandFilter,
  FilterSection,
  Pagination,
  PriceFilter,
  SortSelect,
} from '../components/catalog/Filters'
import { orderingFor } from '../components/catalog/sort'
import { ProductCard } from '../components/product/ProductCard'
import { Seo } from '../components/Seo'
import { eurToBgn } from '../utils/currency'

const FILTER_KEYS = ['sort', 'min', 'max', 'brand', 'category']

/** Search results with the same filters as a category page: sort, category
 * (from what was found), brand and price, all kept in the URL so Back and
 * shared links keep them. */
export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const page = Number(searchParams.get('page') ?? '1')
  const sort = searchParams.get('sort') ?? 'default'
  const minParam = searchParams.get('min') ?? ''
  const maxParam = searchParams.get('max') ?? ''
  const categoryParam = searchParams.get('category') ?? ''
  const brandParam = searchParams.get('brand') ?? ''
  const selectedBrands = useMemo(() => brandParam.split(',').filter(Boolean), [brandParam])
  // Phones: the filters fold away behind a button so results come first.
  const [filtersOpen, setFiltersOpen] = useState(false)

  const { data, isLoading, isError, isFetching } = useSearch(q, {
    ordering: orderingFor(sort),
    price_bgn__gte: minParam ? eurToBgn(minParam) : undefined,
    price_bgn__lte: maxParam ? eurToBgn(maxParam) : undefined,
    brands: brandParam || undefined,
    category: categoryParam || undefined,
    page,
  })

  function updateFilters(next: Record<string, string>) {
    const merged = new URLSearchParams(searchParams)
    Object.entries(next).forEach(([key, value]) => {
      if (value) merged.set(key, value)
      else merged.delete(key)
    })
    merged.delete('page')
    setSearchParams(merged)
  }

  function clearFilters() {
    const merged = new URLSearchParams(searchParams)
    FILTER_KEYS.forEach((key) => merged.delete(key))
    merged.delete('page')
    setSearchParams(merged)
  }

  function goToPage(next: number) {
    const merged = new URLSearchParams(searchParams)
    merged.set('page', String(next))
    setSearchParams(merged)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function toggleBrand(slug: string) {
    const next = selectedBrands.includes(slug)
      ? selectedBrands.filter((s) => s !== slug)
      : [...selectedBrands, slug]
    updateFilters({ brand: next.join(',') })
  }

  const count = data?.count ?? data?.results.length ?? 0
  const pageSize = data?.page_size ?? 24
  const totalPages = Math.ceil(count / pageSize)
  const filtered = Boolean(minParam || maxParam || brandParam || categoryParam)
  const activeFilterCount =
    (categoryParam ? 1 : 0) + selectedBrands.length + (minParam || maxParam ? 1 : 0)
  const categories = data?.categories ?? []
  const brands = data?.brands ?? []

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Internal search results are excluded from robots.txt too — infinite
          query permutations have no indexing value, this is belt-and-suspenders
          for any crawler that ignores robots.txt. */}
      <Seo
        title={q ? `Резултати за "${q}" | BRoffice` : 'Търсене | BRoffice'}
        robots="noindex, follow"
      />
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Резултати за &quot;{q}&quot;</h1>
      {data && (
        <p className="mb-6 text-sm text-slate-500">
          {count} {count === 1 ? 'продукт' : 'продукта'}
        </p>
      )}

      {!q && <p className="text-slate-500">Въведете дума за търсене.</p>}
      {isLoading && <p className="text-slate-500">Търсене...</p>}
      {isError && <p className="text-red-600">Търсенето не бе успешно в момента.</p>}

      {data && (count > 0 || filtered) && (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
              className="flex w-full items-center justify-between rounded-ui border border-slate-300 bg-surface px-4 py-2.5 text-sm font-medium text-slate-900"
            >
              <span>
                Филтри
                {activeFilterCount > 0 && (
                  <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-white">
                    {activeFilterCount}
                  </span>
                )}
              </span>
              <span aria-hidden="true">{filtersOpen ? '−' : '+'}</span>
            </button>
          </div>

          <aside className={`w-full shrink-0 lg:block lg:w-64 ${filtersOpen ? '' : 'hidden'}`}>
            {filtered && (
              <button
                type="button"
                onClick={clearFilters}
                className="mb-5 text-sm font-medium text-primary hover:underline"
              >
                Изчисти всички филтри
              </button>
            )}

            {categories.length > 1 || categoryParam ? (
              <FilterSection title="Категория">
                <ul className="flex flex-col">
                  {[{ slug: '', name: 'Всички категории', count: null as number | null }]
                    .concat(categories)
                    .map((cat) => {
                      const active = cat.slug === categoryParam
                      return (
                        <li key={cat.slug || 'all'}>
                          <button
                            type="button"
                            onClick={() => updateFilters({ category: cat.slug })}
                            className={
                              'relative flex w-full items-baseline gap-2 py-1.5 pl-7 text-left text-sm font-medium transition-colors duration-200 before:absolute before:left-0 before:top-2 before:h-4 before:w-4 before:rounded-full before:border hover:text-primary ' +
                              (active
                                ? 'text-primary before:border-primary before:bg-primary/20'
                                : 'text-slate-700 before:border-slate-400')
                            }
                          >
                            <span className="flex-1">{cat.name}</span>
                            {cat.count !== null && (
                              <span className="text-xs text-slate-400 tabular-nums">
                                {cat.count}
                              </span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                </ul>
              </FilterSection>
            ) : null}

            {(brands.length > 1 || selectedBrands.length > 0) && (
              <BrandFilter
                facets={brands}
                selected={selectedBrands}
                onToggle={toggleBrand}
                onClear={() => updateFilters({ brand: '' })}
              />
            )}

            <PriceFilter
              key={`${minParam}-${maxParam}`}
              min={minParam}
              max={maxParam}
              onApply={(min, max) => updateFilters({ min, max })}
            />
          </aside>

          <div className={`min-w-0 flex-1 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
            <div className="mb-4 flex justify-end">
              <SortSelect
                value={sort}
                onChange={(value) => updateFilters({ sort: value })}
                defaultLabel="Най-подходящи"
              />
            </div>

            {data.results.length === 0 ? (
              <p className="text-slate-500">
                Няма продукти с тези филтри.{' '}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="font-medium text-primary hover:underline"
                >
                  Изчисти филтрите
                </button>
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {data.results.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}

            <Pagination page={page} totalPages={totalPages} onPage={goToPage} />
          </div>
        </div>
      )}

      {data && count === 0 && !filtered && (
        <p className="text-slate-500">Няма намерени продукти.</p>
      )}
    </div>
  )
}
