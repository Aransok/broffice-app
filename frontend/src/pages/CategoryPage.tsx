import { type FormEvent, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useCategory } from '../api/categories'
import { useProducts } from '../api/products'
import { PriceRangeSlider } from '../components/PriceRangeSlider'
import { ProductCard } from '../components/product/ProductCard'
import { Seo } from '../components/Seo'

const PAGE_SIZE = 24
// Static bounds for the slider track — a convenience on top of the manual
// inputs (which accept any value, including outside this range).
const PRICE_BOUNDS: [number, number] = [0, 5000]

const SORT_OPTIONS: { value: string; label: string; ordering: string }[] = [
  { value: 'default', label: 'По подразбиране', ordering: '' },
  { value: 'name', label: 'Име (А-Я)', ordering: 'name' },
  { value: 'price_asc', label: 'Цена: ниска към висока', ordering: 'price_bgn' },
  { value: 'price_desc', label: 'Цена: висока към ниска', ordering: '-price_bgn' },
]

export function CategoryPage() {
  const { slug = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') ?? '1')
  const sort = searchParams.get('sort') ?? 'default'
  const minParam = searchParams.get('min') ?? ''
  const maxParam = searchParams.get('max') ?? ''
  const [minInput, setMinInput] = useState(minParam)
  const [maxInput, setMaxInput] = useState(maxParam)

  const { data: category, isLoading: categoryLoading, isError: categoryError } = useCategory(slug)
  const ordering = SORT_OPTIONS.find((option) => option.value === sort)?.ordering
  const {
    data: products,
    isLoading: productsLoading,
    isError: productsError,
  } = useProducts({
    category__slug: slug,
    page,
    ordering: ordering || undefined,
    price_bgn__gte: minParam || undefined,
    price_bgn__lte: maxParam || undefined,
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

  function goToPage(page: number) {
    const merged = new URLSearchParams(searchParams)
    merged.set('page', String(page))
    setSearchParams(merged)
  }

  function handlePriceFilterSubmit(event: FormEvent) {
    event.preventDefault()
    updateFilters({ min: minInput, max: maxInput })
  }

  const sliderValue: [number, number] = [
    minInput ? Number(minInput) : PRICE_BOUNDS[0],
    maxInput ? Number(maxInput) : PRICE_BOUNDS[1],
  ]

  function handleSliderChange(next: [number, number]) {
    setMinInput(String(next[0]))
    setMaxInput(String(next[1]))
  }

  function commitSliderFilter() {
    updateFilters({ min: minInput, max: maxInput })
  }

  if (categoryError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <p className="text-red-600">Категорията не е намерена.</p>
      </div>
    )
  }

  const totalPages = products ? Math.ceil(products.count / PAGE_SIZE) : 0

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {category && <Seo data={category.seo} />}
      <nav className="mb-4 text-sm text-slate-500">
        <Link to="/" className="transition-colors duration-200 hover:text-primary">
          Начало
        </Link>{' '}
        / <span className="text-slate-700">{categoryLoading ? '...' : category?.name}</span>
      </nav>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">
        {categoryLoading ? 'Зареждане...' : category?.name}
      </h1>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Matches the live site's left-hand shop sidebar (КАТЕГОРИИ / ЦЕНА
            filter widgets) — the previous version had no subcategory list
            at all and put price filtering in a floating top toolbar instead
            of this sidebar, which is what the official design actually
            uses. */}
        <aside className="w-full shrink-0 lg:w-64">
          {/* Matches the live site's own filter-list treatment exactly
              (checked against officecenter-bg.com's actual CSS, not
              guessed): 18px/500-weight title with a light bottom border,
              14px/500-weight rows with a 16px circular outline marker
              before each one — a plain text link list (the first version
              of this sidebar) reads as noticeably flatter/plainer than
              the real site's filter-checkbox look. */}
          {category?.children && category.children.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-5 border-b-2 border-slate-200 pb-2.5 text-lg font-medium text-slate-900">
                Категории
              </h2>
              <ul className="flex flex-col">
                {category.children.map((child) => (
                  <li key={child.id}>
                    <Link
                      to={`/category/${child.slug}`}
                      className="relative block py-1.5 pl-7 text-sm font-medium text-slate-500 transition-colors duration-200 before:absolute before:left-0 before:top-0.75 before:h-4 before:w-4 before:rounded-full before:border before:border-slate-400 before:transition-colors before:duration-200 hover:text-primary hover:before:border-primary"
                    >
                      {child.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h2 className="mb-5 border-b-2 border-slate-200 pb-2.5 text-lg font-medium text-slate-900">
              Цена
            </h2>
            <form onSubmit={handlePriceFilterSubmit} className="flex flex-col gap-3">
              <div className="flex items-end gap-2">
                <label className="text-sm text-slate-700">
                  От (лв.)
                  <input
                    type="number"
                    min={0}
                    value={minInput}
                    onChange={(event) => setMinInput(event.target.value)}
                    className="mt-1 block w-full rounded-ui border border-slate-300 px-2 py-1.5"
                  />
                </label>
                <label className="text-sm text-slate-700">
                  До (лв.)
                  <input
                    type="number"
                    min={0}
                    value={maxInput}
                    onChange={(event) => setMaxInput(event.target.value)}
                    className="mt-1 block w-full rounded-ui border border-slate-300 px-2 py-1.5"
                  />
                </label>
              </div>
              <div
                className="px-1"
                onMouseUp={commitSliderFilter}
                onTouchEnd={commitSliderFilter}
              >
                <PriceRangeSlider
                  bounds={PRICE_BOUNDS}
                  value={sliderValue}
                  onChange={handleSliderChange}
                />
              </div>
              <button
                type="submit"
                className="rounded-ui bg-primary px-3 py-1.5 text-sm font-medium text-white"
              >
                Приложи
              </button>
            </form>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex justify-end">
            <label className="text-sm text-slate-700">
              Подреди по
              <select
                value={sort}
                onChange={(event) => updateFilters({ sort: event.target.value })}
                className="ml-2 rounded-ui border border-slate-300 px-2 py-1.5"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {productsLoading && <p className="text-slate-500">Зареждане на продукти...</p>}
          {productsError && (
            <p className="text-red-600">Продуктите не могат да бъдат заредени в момента.</p>
          )}
          {products && products.results.length === 0 && (
            <p className="text-slate-500">Няма намерени продукти в тази категория.</p>
          )}
          {products && products.results.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
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
      </div>
    </div>
  )
}
