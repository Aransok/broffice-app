import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  addCustomerCartItem,
  deleteAdminCustomer,
  removeCustomerCartItem,
  updateCustomerCartItem,
  useAdminCustomer,
  useCustomerActivity,
  useCustomerCart,
} from '../../api/adminCustomers'
import { useAdminOrders } from '../../api/adminOrders'
import {
  createPriceOverride,
  deletePriceOverride,
  usePriceOverrides,
} from '../../api/adminPriceOverrides'
import { getImageUrl } from '../../api/media'
import {
  createPromotion,
  deletePromotion,
  type Promotion,
  type PromotionDiscountType,
  updatePromotion,
  usePromotions,
} from '../../api/promotions'
import type { ProductListItem } from '../../api/types'
import { AdminProductPicker } from '../../components/admin/AdminProductPicker'
import { AdminQuickPromotionButton } from '../../components/admin/AdminQuickPromotionButton'
import { bgnToEur, eurToBgn } from '../../utils/currency'

const TABS = [
  { key: 'cart', label: 'Количка' },
  { key: 'orders', label: 'Поръчки' },
  { key: 'pricing', label: 'Индивидуални цени' },
  { key: 'promotions', label: 'Промоции' },
  { key: 'activity', label: 'Активност' },
] as const

type TabKey = (typeof TABS)[number]['key']

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Чакаща',
  confirmed: 'Потвърдена',
  rejected: 'Отказана',
}

export function AdminCustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const customerId = Number(id)
  const [tab, setTab] = useState<TabKey>('cart')
  const [deleting, setDeleting] = useState(false)
  const { data: customer } = useAdminCustomer(customerId)
  const navigate = useNavigate()

  async function handleDeleteCustomer() {
    if (!customer) return
    const confirmed = confirm(
      `Изтриване на акаунта на "${customer.username}" (${customer.email})?\n\n` +
        'Профилът и данните за вход ще бъдат премахнати. Направените поръчки и фактури ' +
        'остават в системата (вече не са свързани с този акаунт). Това действие не може ' +
        'да бъде отменено.',
    )
    if (!confirmed) return
    setDeleting(true)
    try {
      await deleteAdminCustomer(customerId)
      navigate('/admin/customers')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">
          {customer?.username ?? `Клиент #${customerId}`}
        </h1>
        {customer && (
          <button
            type="button"
            onClick={handleDeleteCustomer}
            disabled={deleting}
            className="rounded-ui border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? 'Изтриване...' : 'Изтрий акаунта'}
          </button>
        )}
      </div>
      {customer && (
        <p className="mb-6 text-sm text-slate-500">
          {customer.email} · регистриран на{' '}
          {new Date(customer.date_joined).toLocaleDateString('bg-BG')}
        </p>
      )}

      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === item.key
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'cart' && <CartTab customerId={customerId} />}
      {tab === 'orders' && <OrdersTab customerId={customerId} />}
      {tab === 'pricing' && <PricingTab customerId={customerId} />}
      {tab === 'promotions' && <PromotionsTab customerId={customerId} />}
      {tab === 'activity' && <ActivityTab customerId={customerId} />}
    </div>
  )
}

function CartTab({ customerId }: { customerId: number }) {
  const { data: cart, refetch, isLoading } = useCustomerCart(customerId)
  const { data: promotions, refetch: refetchPromotions } = usePromotions({ user: customerId })
  const [quantity, setQuantity] = useState(1)
  const [error, setError] = useState<string | null>(null)

  function promotionForProduct(productId: string) {
    // usePromotions({ user: customerId }) above already scopes the query to
    // this client — scope==='product' picks out "the one for this exact
    // item" among that client's promotions (vs. e.g. a whole-account one).
    return promotions?.results.find((p) => p.scope === 'product' && p.product === productId) ?? null
  }

  async function handleAdd(productId: string) {
    setError(null)
    try {
      await addCustomerCartItem(customerId, productId, quantity)
      setQuantity(1)
      await refetch()
    } catch {
      setError('Продуктът не можа да бъде добавен.')
    }
  }

  async function handleQuantityChange(itemId: string, next: number) {
    if (next < 1) return
    await updateCustomerCartItem(customerId, itemId, next)
    await refetch()
  }

  async function handleRemove(itemId: string, productName: string) {
    if (!confirm(`Премахване на "${productName}" от количката на клиента?`)) return
    await removeCustomerCartItem(customerId, itemId)
    await refetch()
  }

  return (
    <div>
      <p className="mb-4 rounded-ui bg-primary/5 p-3 text-xs text-slate-600">
        Тази количка е същата, която клиентът вижда в своя профил на сайта — промените тук се
        отразяват веднага при него, и обратно.
      </p>
      <div className="mb-4 rounded-ui border border-slate-200 p-4">
        <h2 className="mb-2 font-semibold text-slate-900">Добави продукт</h2>
        <div className="mb-2 flex items-center gap-2">
          <label htmlFor="cart-add-qty" className="text-sm text-slate-600">
            Количество
          </label>
          <input
            id="cart-add-qty"
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value) || 1)}
            className="w-20 rounded-ui border border-slate-300 px-3 py-2"
          />
        </div>
        <AdminProductPicker onSelect={(product) => handleAdd(product.id)} />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {isLoading && <p className="text-slate-500">Зареждане...</p>}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-4">Продукт</th>
              <th className="py-2 pr-4">Код</th>
              <th className="py-2 pr-4">Кол-во</th>
              <th className="py-2 pr-4">Ед. цена</th>
              <th className="py-2 pr-4">Източник</th>
              <th className="py-2 pr-4">Общо</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {cart?.items.map((item) => {
              const imageUrl = getImageUrl(item.product_image)
              return (
                <tr key={item.item_id} className="border-b border-slate-100">
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-ui border border-slate-200 bg-slate-50">
                        {imageUrl ? (
                          <img src={imageUrl} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <span className="text-center text-[8px] text-slate-400">Без снимка</span>
                        )}
                      </div>
                      <div>
                        <span>{item.product_name}</span>
                        <AdminQuickPromotionButton
                          customerId={customerId}
                          productId={item.product_id}
                          productName={item.product_name}
                          existingPromotion={promotionForProduct(item.product_id)}
                          onCreated={() => {
                            void refetch()
                            void refetchPromotions()
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-slate-500">{item.product_sku}</td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center rounded-ui border border-slate-300">
                      <button
                        type="button"
                        aria-label="Намали количеството"
                        onClick={() => handleQuantityChange(item.item_id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="px-2 py-1 text-slate-600 hover:text-primary disabled:opacity-40"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        aria-label="Количество"
                        value={item.quantity}
                        onChange={(event) =>
                          handleQuantityChange(item.item_id, Number(event.target.value) || 1)
                        }
                        className="w-12 border-x border-slate-300 py-1 text-center"
                      />
                      <button
                        type="button"
                        aria-label="Увеличи количеството"
                        onClick={() => handleQuantityChange(item.item_id, item.quantity + 1)}
                        className="px-2 py-1 text-slate-600 hover:text-primary"
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="py-2 pr-4">€{bgnToEur(item.unit_price)}</td>
                  <td className="py-2 pr-4 text-slate-500">{item.price_source || '—'}</td>
                  <td className="py-2 pr-4 font-medium">€{bgnToEur(item.line_total)}</td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => handleRemove(item.item_id, item.product_name)}
                      className="text-red-600 hover:underline"
                    >
                      Премахни
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {cart && cart.items.length === 0 && (
        <p className="py-4 text-slate-500">Количката е празна.</p>
      )}
      {cart && cart.items.length > 0 && (
        <p className="mt-3 text-right font-semibold text-slate-900">
          Общо: €{bgnToEur(cart.subtotal_bgn)}
        </p>
      )}
    </div>
  )
}

function OrdersTab({ customerId }: { customerId: number }) {
  const { data, isLoading } = useAdminOrders({ user: customerId })

  return (
    <div>
      {isLoading && <p className="text-slate-500">Зареждане...</p>}
      <div className="flex flex-col gap-3">
        {data?.results.map((order) => (
          <div key={order.id} className="rounded-ui border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-slate-900">{order.number}</span>
              <span className="text-sm text-slate-500">
                {ORDER_STATUS_LABELS[order.status] ?? order.status}
              </span>
              <span className="text-sm text-slate-500">
                {new Date(order.created_at).toLocaleDateString('bg-BG')}
              </span>
              <span className="font-medium text-slate-900">€{bgnToEur(order.total_bgn)}</span>
            </div>
          </div>
        ))}
      </div>
      {data && data.results.length === 0 && (
        <p className="py-4 text-slate-500">Няма поръчки от този клиент.</p>
      )}
    </div>
  )
}

function PricingTab({ customerId }: { customerId: number }) {
  const { data, refetch } = usePriceOverrides({ user: customerId })
  const [mode, setMode] = useState<'price' | 'percent'>('price')
  const [priceEur, setPriceEur] = useState('')
  const [percent, setPercent] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<ProductListItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const basePrice = selectedProduct
    ? Number(selectedProduct.client_price ?? selectedProduct.price_bgn ?? 0)
    : null
  const computedBgn =
    mode === 'price'
      ? priceEur
        ? eurToBgn(priceEur)
        : null
      : basePrice && percent
        ? (basePrice * (1 - Number(percent) / 100)).toFixed(2)
        : null

  async function handleSave() {
    setError(null)
    if (!selectedProduct) {
      setError('Изберете продукт.')
      return
    }
    if (!computedBgn) {
      setError(mode === 'price' ? 'Въведете цена.' : 'Въведете процент отстъпка.')
      return
    }
    setSaving(true)
    try {
      await createPriceOverride({
        product: selectedProduct.id,
        user: customerId,
        client_price: computedBgn,
        notes,
      })
      setSelectedProduct(null)
      setPriceEur('')
      setPercent('')
      setNotes('')
      await refetch()
    } catch {
      setError('Индивидуалната цена не можа да бъде запазена.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, productName: string) {
    if (!confirm(`Изтриване на индивидуалната цена за "${productName}"?`)) return
    await deletePriceOverride(id)
    await refetch()
  }

  return (
    <div>
      <div className="mb-4 rounded-ui border border-slate-200 p-4">
        <h2 className="mb-2 font-semibold text-slate-900">Нова индивидуална цена</h2>
        <p className="mb-2 text-xs text-slate-500">
          Тази цена винаги има приоритет пред промоциите за този клиент — не се събира с тях.
        </p>

        <AdminProductPicker onSelect={(product) => setSelectedProduct(product)} />
        {selectedProduct && (
          <p className="mt-2 text-sm text-primary">
            Избран: {selectedProduct.name} (база €{basePrice ? bgnToEur(String(basePrice)) : '—'})
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as 'price' | 'percent')}
            className="rounded-ui border border-slate-300 px-2 py-2 text-sm"
          >
            <option value="price">Точна цена (€)</option>
            <option value="percent">Отстъпка (%)</option>
          </select>
          {mode === 'price' ? (
            <input
              type="text"
              placeholder="Цена (€)"
              value={priceEur}
              onChange={(event) => setPriceEur(event.target.value)}
              className="w-32 rounded-ui border border-slate-300 px-3 py-2"
            />
          ) : (
            <input
              type="text"
              placeholder="Отстъпка (%)"
              value={percent}
              onChange={(event) => setPercent(event.target.value)}
              className="w-32 rounded-ui border border-slate-300 px-3 py-2"
            />
          )}
          <input
            type="text"
            placeholder="Бележка (по избор)"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="w-48 rounded-ui border border-slate-300 px-3 py-2"
          />
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-ui bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Запазване...' : 'Добави'}
          </button>
        </div>
        {computedBgn && (
          <p className="mt-2 text-xs text-slate-500">
            Крайна цена: €{bgnToEur(computedBgn)}
          </p>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-4">Продукт</th>
              <th className="py-2 pr-4">Цена</th>
              <th className="py-2 pr-4">Бележка</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.results.map((override) => (
              <tr key={override.id} className="border-b border-slate-100">
                <td className="py-2 pr-4">{override.product_name}</td>
                <td className="py-2 pr-4">
                  {override.client_price ? `€${bgnToEur(override.client_price)}` : '—'}
                </td>
                <td className="py-2 pr-4 text-slate-500">{override.notes || '—'}</td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={() => handleDelete(override.id, override.product_name)}
                    className="text-red-600 hover:underline"
                  >
                    Изтрий
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && data.results.length === 0 && (
        <p className="py-4 text-slate-500">Няма индивидуални цени за този клиент.</p>
      )}
    </div>
  )
}

function PromotionsTab({ customerId }: { customerId: number }) {
  const { data, refetch } = usePromotions({ user: customerId })
  const [editingId, setEditingId] = useState<string | null>(null)
  // Product id carried over from the promotion being edited, kept as-is
  // unless the admin explicitly re-picks one — otherwise saving an edit
  // without touching the picker would wrongly clear it to "whole account".
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [discountType, setDiscountType] = useState<PromotionDiscountType>('percent')
  const [value, setValue] = useState('')
  const [maxQuantity, setMaxQuantity] = useState('')
  const [active, setActive] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<ProductListItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function resetForm() {
    setEditingId(null)
    setEditingProductId(null)
    setName('')
    setValue('')
    setMaxQuantity('')
    setActive(true)
    setSelectedProduct(null)
  }

  function startEdit(promo: Promotion) {
    setEditingId(promo.id)
    setEditingProductId(promo.product)
    setName(promo.name)
    setDiscountType(promo.discount_type)
    setValue(promo.discount_type === 'flat' ? bgnToEur(promo.value) : promo.value)
    setMaxQuantity(promo.max_quantity ? String(promo.max_quantity) : '')
    setActive(promo.active)
    setSelectedProduct(null)
  }

  async function handleSave() {
    setError(null)
    if (!value) {
      setError(discountType === 'percent' ? 'Въведете процент.' : 'Въведете сума в евро.')
      return
    }
    setSaving(true)
    try {
      const productId = selectedProduct ? selectedProduct.id : editingProductId
      const payload = {
        name: name || `Индивидуална отстъпка${selectedProduct ? ` — ${selectedProduct.name}` : ''}`,
        discount_type: discountType,
        value: discountType === 'flat' ? eurToBgn(value) : value,
        max_quantity: maxQuantity ? Number(maxQuantity) : null,
        // user=customerId (independent of scope, see the target/audience
        // decoupling) narrows this to just that one client. A product
        // narrows the target further to just that one item; leaving it
        // empty targets everything the customer buys — same Promotion
        // model the general /admin/promotions page uses, just pre-scoped
        // to this customer so the admin doesn't have to re-search there.
        scope: productId ? ('product' as const) : ('global' as const),
        user: customerId,
        product: productId,
        category: null,
        active,
      }
      if (editingId) {
        await updatePromotion(editingId, payload)
      } else {
        await createPromotion(payload)
      }
      resetForm()
      await refetch()
    } catch {
      setError('Промоцията не можа да бъде запазена.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, promoName: string) {
    if (!confirm(`Изтриване на промоцията "${promoName}"?`)) return
    if (editingId === id) resetForm()
    await deletePromotion(id)
    await refetch()
  }

  return (
    <div>
      <div className="mb-4 rounded-ui border border-slate-200 p-4">
        <h2 className="mb-2 font-semibold text-slate-900">
          {editingId ? 'Редактиране на промоция' : 'Нова промоция за този клиент'}
        </h2>
        <p className="mb-2 text-xs text-slate-500">
          Ако индивидуална цена вече съществува за продукт, тя винаги има приоритет пред тази
          промоция — не се събират.{' '}
          <Link to="/admin/promotions" className="text-primary hover:underline">
            Пълното управление на промоции
          </Link>{' '}
          е тук, ако трябва промоция по категория или за целия сайт.
        </p>

        <input
          type="text"
          placeholder="Име на промоцията (по избор)"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mb-2 w-full rounded-ui border border-slate-300 px-3 py-2"
        />

        <p className="mb-1 text-xs text-slate-500">
          Продукт (по избор — оставете празно за отстъпка върху всичко, което клиентът купува)
          {editingId && !selectedProduct && editingProductId && ' — продуктът остава непроменен'}
        </p>
        <AdminProductPicker onSelect={(product) => setSelectedProduct(product)} />
        {selectedProduct && (
          <p className="mt-1 text-sm text-primary">
            Избран: {selectedProduct.name}{' '}
            <button
              type="button"
              onClick={() => setSelectedProduct(null)}
              className="ml-1 text-xs text-slate-500 underline"
            >
              премахни
            </button>
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={discountType}
            onChange={(event) => setDiscountType(event.target.value as PromotionDiscountType)}
            className="rounded-ui border border-slate-300 px-2 py-2 text-sm"
          >
            <option value="percent">Процент (%)</option>
            <option value="flat">Крайна цена (€)</option>
          </select>
          <input
            type="text"
            placeholder={discountType === 'percent' ? 'Отстъпка (%)' : 'Сума (€)'}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="w-32 rounded-ui border border-slate-300 px-3 py-2"
          />
          <input
            type="text"
            inputMode="numeric"
            placeholder="Макс. бр. (по избор)"
            title="Промоцията важи само за първите N бройки в поръчката — оставете празно за без ограничение"
            value={maxQuantity}
            onChange={(event) => setMaxQuantity(event.target.value.replace(/\D/g, ''))}
            className="w-36 rounded-ui border border-slate-300 px-3 py-2"
          />
          <label className="flex items-center gap-1.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            Активна
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-ui bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Запазване...' : editingId ? 'Запази промените' : 'Добави'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-ui border border-slate-300 px-4 py-2 text-sm text-slate-700"
            >
              Отказ
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-4">Име</th>
              <th className="py-2 pr-4">Отстъпка</th>
              <th className="py-2 pr-4">Активна</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.results.map((promo) => (
              <tr key={promo.id} className="border-b border-slate-100">
                <td className="py-2 pr-4">{promo.name}</td>
                <td className="py-2 pr-4">
                  {promo.discount_type === 'percent'
                    ? `${promo.value}%`
                    : `€${bgnToEur(promo.value)}`}
                </td>
                <td className="py-2 pr-4">{promo.active ? 'Да' : 'Не'}</td>
                <td className="flex gap-3 py-2">
                  <button
                    type="button"
                    onClick={() => startEdit(promo)}
                    className="text-primary hover:underline"
                  >
                    Редактирай
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(promo.id, promo.name)}
                    className="text-red-600 hover:underline"
                  >
                    Изтрий
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && data.results.length === 0 && (
        <p className="py-4 text-slate-500">Няма промоции за този клиент.</p>
      )}
    </div>
  )
}

function ActivityTab({ customerId }: { customerId: number }) {
  const { data, refetch } = useCustomerActivity(customerId)
  const { data: promotions, refetch: refetchPromotions } = usePromotions({ user: customerId })

  function promotionForProduct(productId: string) {
    // usePromotions({ user: customerId }) above already scopes the query to
    // this client — scope==='product' picks out "the one for this exact
    // item" among that client's promotions (vs. e.g. a whole-account one).
    return promotions?.results.find((p) => p.scope === 'product' && p.product === productId) ?? null
  }

  return (
    <div>
      <p className="mb-4 rounded-ui bg-primary/5 p-3 text-xs text-slate-600">
        Продукти, които клиентът е разгледал докато е бил вписан — помага да прецените за кое да му
        предложите индивидуална промоция. Показва се веднага след преглед на страницата на продукта.
      </p>
      {data && data.length === 0 && (
        <p className="py-4 text-slate-500">
          Клиентът все още не е разглеждал продукти (или ги е разглеждал само като гост, без вход в
          профила).
        </p>
      )}
      {data && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2 pr-4">Продукт</th>
                <th className="py-2 pr-4">Категория</th>
                <th className="py-2 pr-4">Цена</th>
                <th className="py-2 pr-4">Прегледи</th>
                <th className="py-2 pr-4">Последен преглед</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const imageUrl = getImageUrl(row.product_image)
                const onPromo = row.price_source && row.effective_price_bgn !== row.price_bgn
                return (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-ui border border-slate-200 bg-slate-50">
                          {imageUrl ? (
                            <img src={imageUrl} alt="" className="h-full w-full object-contain" />
                          ) : (
                            <span className="text-center text-[8px] text-slate-400">
                              Без снимка
                            </span>
                          )}
                        </div>
                        <div>
                          <span>{row.product_name}</span>
                          <AdminQuickPromotionButton
                            customerId={customerId}
                            productId={row.product}
                            productName={row.product_name}
                            existingPromotion={promotionForProduct(row.product)}
                            onCreated={() => {
                              void refetch()
                              void refetchPromotions()
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-slate-500">{row.category_name ?? '—'}</td>
                    <td className="py-2 pr-4">
                      {row.effective_price_bgn ? (
                        <>
                          {onPromo && row.price_bgn && (
                            <span className="mr-1 text-slate-400 line-through">
                              €{bgnToEur(row.price_bgn)}
                            </span>
                          )}
                          <span className={onPromo ? 'font-medium text-red-600' : ''}>
                            €{bgnToEur(row.effective_price_bgn)}
                          </span>
                          {onPromo && (
                            <div className="text-xs text-red-600">{row.price_source}</div>
                          )}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 pr-4">{row.view_count}</td>
                    <td className="py-2 pr-4 text-slate-500">
                      {new Date(row.last_viewed_at).toLocaleString('bg-BG')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
