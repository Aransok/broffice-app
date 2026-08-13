import { useState } from 'react'
import { deleteAdminProduct, updateProductPricing, useAdminProducts } from '../../api/adminProducts'
import { useCategories } from '../../api/categories'
import { getImageUrl } from '../../api/media'
import type { ProductListItem } from '../../api/types'
import { computeProfitBgn, eurToBgn, formatEur } from '../../utils/currency'
import { AdminProductForm } from './AdminProductForm'

const PAGE_SIZE = 24

const SORT_OPTIONS = [
  { value: '', label: 'Без сортиране' },
  { value: 'client_price', label: 'Клиентска цена (ниска-висока)' },
  { value: '-client_price', label: 'Клиентска цена (висока-ниска)' },
  { value: 'admin_price', label: 'Цена за реселър (ниска-висока)' },
  { value: '-admin_price', label: 'Цена за реселър (висока-ниска)' },
  { value: 'profit', label: 'Печалба (ниска-висока)' },
  { value: '-profit', label: 'Печалба (висока-ниска)' },
] as const

export function AdminProductsPage() {
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [ordering, setOrdering] = useState('')
  const [page, setPage] = useState(1)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const { data: categories } = useCategories()
  const { data, isLoading, refetch } = useAdminProducts({
    search,
    category__external_id: categoryId || undefined,
    ordering: ordering || undefined,
    page,
  })
  const totalPages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1

  function updateSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  function updateCategoryFilter(value: string) {
    setCategoryId(value)
    setPage(1)
  }

  function updateOrdering(value: string) {
    setOrdering(value)
    setPage(1)
  }

  function openCreate() {
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(id: string) {
    setEditingId(id)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
  }

  async function handleSaved() {
    closeForm()
    await refetch()
  }

  async function handleCreated() {
    // Deliberately does NOT touch `editingId` — the form now tracks the
    // newly-created product's id itself once saved, so changing the
    // `productId` prop here would just re-trigger AdminProductForm's
    // loading-state swap (a whole unmount/remount around a refetch),
    // wiping out the very images/local state we want to keep showing.
    // Only the product *list* needs refreshing so the new row appears.
    await refetch()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Изтриване на "${name}"?`)) return
    await deleteAdminProduct(id)
    await refetch()
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Продукти (админ)</h1>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-ui bg-primary px-4 py-2 font-medium text-white"
        >
          Нов продукт
        </button>
      </div>

      <ZeroPriceQuickFix />

      {showForm && (
        <div className="mb-6">
          <AdminProductForm
            productId={editingId}
            onSaved={handleSaved}
            onCancel={closeForm}
            onCreated={handleCreated}
          />
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="admin-products-category">
          Категория
        </label>
        <select
          id="admin-products-category"
          value={categoryId}
          onChange={(event) => updateCategoryFilter(event.target.value)}
          className="rounded-ui border border-slate-300 bg-surface px-3 py-2 text-sm text-slate-700"
        >
          <option value="">Всички категории</option>
          {categories?.results.map((category) => (
            <option key={category.id} value={category.external_id}>
              {category.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="admin-products-sort">
          Сортиране
        </label>
        <select
          id="admin-products-sort"
          value={ordering}
          onChange={(event) => updateOrdering(event.target.value)}
          className="rounded-ui border border-slate-300 bg-surface px-3 py-2 text-sm text-slate-700"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="relative min-w-55 flex-1">
          <input
            type="text"
            placeholder="Търси по име или SKU..."
            value={search}
            onChange={(event) => updateSearch(event.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="w-full rounded-ui border border-slate-300 px-3 py-2"
          />
          {searchFocused && search.trim() && data && data.results.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-72 w-full divide-y divide-slate-100 overflow-y-auto rounded-ui border border-slate-200 bg-surface shadow-lg">
              {data.results.slice(0, 8).map((product) => {
                const imageUrl = getImageUrl(product.primary_image)
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      // onMouseDown (not onClick) fires before the input's
                      // onBlur hides this dropdown, so the click registers.
                      onMouseDown={() => openEdit(product.id)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-primary/10"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-ui border border-slate-200 bg-slate-100">
                        {imageUrl && (
                          <img src={imageUrl} alt="" className="h-full w-full object-contain" />
                        )}
                      </div>
                      <span className="min-w-0 flex-1 truncate">{product.name}</span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {product.sku || '—'}
                        {product.supplier_id && ` · №${product.supplier_id}`}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {isLoading && <p className="text-slate-500">Зареждане...</p>}

      {data && data.results.length === 0 && (
        <p className="py-4 text-slate-500">Няма намерени продукти.</p>
      )}

      {data && data.results.length > 0 && (
        <>
          {/* Desktop/tablet: table, wrapped so IT scrolls horizontally on its
           * own — the admin shell's <main> is overflow-x-hidden (so the
           * sidebar/mobile-drawer layout never breaks), which would
           * otherwise silently clip this table's rightmost columns (Цена за
           * реселър included) with no way to reach them at all.
           * Mobile: card list (below) — same data, no table/scrolling. */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-3">№</th>
                  <th className="py-2 pr-3">Снимка</th>
                  <th className="py-2 pr-3">Продукт</th>
                  <th className="py-2 pr-3">SKU</th>
                  <th className="py-2 pr-3">Категория</th>
                  <th className="py-2 pr-3">Клиентска цена</th>
                  <th className="py-2 pr-3">Цена за реселър</th>
                  <th className="py-2 pr-3">Печалба</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {data.results.map((product) => {
                  const imageUrl = getImageUrl(product.primary_image)
                  return (
                    <tr key={product.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 text-slate-500">{product.item_number ?? '—'}</td>
                      <td className="py-2 pr-3">
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-ui border border-slate-200 bg-slate-50">
                          {imageUrl ? (
                            <img src={imageUrl} alt="" className="h-full w-full object-contain" />
                          ) : (
                            <span className="text-center text-[8px] text-slate-400">
                              Без снимка
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="max-w-60 truncate py-2 pr-3" title={product.name}>
                        {product.supplier_id && (
                          <span className="text-slate-400">№{product.supplier_id} </span>
                        )}
                        {product.name}
                      </td>
                      <td className="py-2 pr-3 text-slate-500">{product.sku || '—'}</td>
                      <td className="py-2 pr-3 text-slate-500">{product.category_name ?? '—'}</td>
                      <td className="py-2 pr-3">
                        {formatEur(
                          product.promo_price_bgn ?? product.client_price ?? product.price_bgn,
                        )}
                      </td>
                      <td className="py-2 pr-3 text-slate-500">
                        {product.admin_price ? formatEur(product.admin_price) : '—'}
                      </td>
                      <td className="py-2 pr-3">
                        {(() => {
                          // promo_price_bgn (when set) is the actual charged
                          // price — using the base price here would overstate
                          // profit on a product currently on promotion.
                          const profitBgn = computeProfitBgn(
                            product.promo_price_bgn ?? product.client_price ?? product.price_bgn,
                            product.admin_price,
                          )
                          if (profitBgn === null) return '—'
                          return (
                            <span
                              className={
                                Number(profitBgn) < 0
                                  ? 'font-medium text-red-600'
                                  : 'font-medium text-green-600'
                              }
                            >
                              {formatEur(profitBgn)}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="flex gap-3 py-2">
                        <button
                          type="button"
                          onClick={() => openEdit(product.id)}
                          className="text-primary hover:underline"
                        >
                          Редактирай
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(product.id, product.name)}
                          className="text-red-600 hover:underline"
                        >
                          Изтрий
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 sm:hidden">
            {data.results.map((product) => {
              const imageUrl = getImageUrl(product.primary_image)
              return (
                <div key={product.id} className="flex gap-3 rounded-ui border border-slate-200 p-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-ui border border-slate-200 bg-slate-50">
                    {imageUrl ? (
                      <img src={imageUrl} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-center text-[8px] text-slate-400">Без снимка</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">
                      №{product.item_number ?? '—'}
                      {product.supplier_id && ` · Д${product.supplier_id}`} · {product.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      SKU: {product.sku || '—'} · {product.category_name ?? 'Без категория'}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {formatEur(
                        product.promo_price_bgn ?? product.client_price ?? product.price_bgn,
                      )}
                    </p>
                    {product.admin_price && (
                      <p className="text-xs text-slate-500">
                        Реселър: {formatEur(product.admin_price)}
                      </p>
                    )}
                    {(() => {
                      // promo_price_bgn (when set) is the actual charged
                      // price — using the base price here would overstate
                      // profit on a product currently on promotion.
                      const profitBgn = computeProfitBgn(
                        product.promo_price_bgn ?? product.client_price ?? product.price_bgn,
                        product.admin_price,
                      )
                      if (profitBgn === null) return null
                      return (
                        <p
                          className={
                            Number(profitBgn) < 0
                              ? 'text-xs font-medium text-red-600'
                              : 'text-xs font-medium text-green-600'
                          }
                        >
                          Печалба: {formatEur(profitBgn)}
                        </p>
                      )
                    })()}
                    <div className="mt-2 flex gap-3 text-sm">
                      <button
                        type="button"
                        onClick={() => openEdit(product.id)}
                        className="text-primary hover:underline"
                      >
                        Редактирай
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(product.id, product.name)}
                        className="text-red-600 hover:underline"
                      >
                        Изтрий
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <p className="text-sm text-slate-500">
              Страница {page} от {totalPages} · {data.count} продукта
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!data.previous}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-ui border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-40"
              >
                Предишна
              </button>
              <button
                type="button"
                disabled={!data.next}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-ui border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-40"
              >
                Следваща
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** Surfaces products with no real client price (missing or 0 — the
 * supplier sync leaves these stuck until someone notices and fixes them by
 * hand, see docs/issues) so they can be corrected without hunting through
 * the full catalog. Renders nothing at all once there are none left. */
function ZeroPriceQuickFix() {
  const { data, refetch } = useAdminProducts({ zero_price: '1', page: 1 })

  if (!data || data.count === 0) return null

  return (
    <div className="mb-6 rounded-ui border border-amber-300 bg-amber-50 p-4">
      <h2 className="mb-1 font-semibold text-amber-900">
        Продукти без реална цена ({data.count})
      </h2>
      <p className="mb-3 text-sm text-amber-800">
        Доставчикът е върнал 0 за тези продукти — клиентите виждат €0.00. Задайте истинска цена:
      </p>
      <ul className="flex flex-col gap-2">
        {data.results.map((product) => (
          <ZeroPriceRow key={product.id} product={product} onSaved={refetch} />
        ))}
      </ul>
      {data.count > data.results.length && (
        <p className="mt-3 text-xs text-amber-700">
          Показани са първите {data.results.length} от {data.count} — коригирайте тези и списъкът
          ще се обнови автоматично.
        </p>
      )}
    </div>
  )
}

function ZeroPriceRow({
  product,
  onSaved,
}: {
  product: ProductListItem
  onSaved: () => void
}) {
  const [priceEur, setPriceEur] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!priceEur) return
    setSaving(true)
    try {
      await updateProductPricing(product.id, { client_price: eurToBgn(priceEur) })
      setPriceEur('')
      await onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="flex items-center gap-2 rounded-ui bg-surface px-3 py-2 text-sm">
      <span className="min-w-0 flex-1 truncate text-slate-800">
        {product.supplier_id && <span className="text-slate-400">№{product.supplier_id} </span>}
        {product.name}
        {product.category_name && (
          <span className="text-slate-400"> · {product.category_name}</span>
        )}
      </span>
      <input
        type="text"
        placeholder="Цена (€)"
        value={priceEur}
        onChange={(event) => setPriceEur(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && handleSave()}
        className="w-24 shrink-0 rounded-ui border border-slate-300 px-2 py-1"
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !priceEur}
        className="shrink-0 rounded-ui bg-primary px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
      >
        {saving ? '...' : 'Запази'}
      </button>
    </li>
  )
}
