import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  addOrderItem,
  confirmOrder,
  markNotificationRead,
  rejectOrder,
  removeOrderItem,
  repriceOrder,
  useNotifications,
} from '../../api/adminNotifications'
import {
  getAdminInvoiceDownloadUrl,
  getAdminPigeonExpressLabelDownloadUrl,
  updatePigeonExpressPackage,
} from '../../api/adminOrders'
import { getImageUrl } from '../../api/media'
import type { Order, ProductListItem } from '../../api/types'
import { AdminProductPicker } from '../../components/admin/AdminProductPicker'
import { AdminQuickPromotionButton } from '../../components/admin/AdminQuickPromotionButton'
import { SHIPPING_LABELS } from '../../constants/shipping'
import { formatEur } from '../../utils/currency'

const PAYMENT_LABELS: Record<string, string> = {
  cash_on_delivery: 'Наложен платеж',
  bank_transfer: 'Плащане по банков път',
}

/** Deep link to the exact product page on the supplier's live site, for
 * items synced from their catalog (external_id = "supplier-{id}") — the
 * slug segment is cosmetic on their end, any value resolves correctly by
 * id alone (verified against the live site). Null for legacy/manually-added
 * products, which have no supplier reference to link to.
 *
 * There's no way to go further and auto-add it to their cart — their "Добави
 * в количката" button is a plain `href="#"` driven entirely by JS + a CSRF
 * token from an active session on their site, not a URL a link can trigger. */
/** The supplier's own numeric product id (the same "№..." shown on every
 * product card storefront-wide) parsed out of external_id ("supplier-337"
 * -> "337") - shown to admins instead of SKU so it matches how they already
 * identify products everywhere else in the app. */
function supplierNumericId(externalId: string): string | null {
  const match = /^supplier-(\d+)$/.exec(externalId)
  return match ? match[1] : null
}

function supplierProductUrl(externalId: string): string | null {
  const id = supplierNumericId(externalId)
  return id ? `https://officecenter-bg.com/product/${id}/x` : null
}

export function AdminNotificationsPage() {
  const { data, refetch, isLoading } = useNotifications()
  const [busyOrder, setBusyOrder] = useState<string | null>(null)
  // Deep-link target from the "Прегледай поръчката" button in the admin
  // new-order email (?order=<number>) — scrolls to and highlights the
  // matching row once the list has loaded.
  const [searchParams] = useSearchParams()
  const highlightOrder = searchParams.get('order')
  const rowRefs = useRef(new Map<string, HTMLDivElement>())

  // Which pending order currently has its "add product" panel open - only
  // one at a time, an admin works one order at a time in practice.
  const [addPanelOrder, setAddPanelOrder] = useState<string | null>(null)
  const [addQuantity, setAddQuantity] = useState(1)
  const [addFreeGift, setAddFreeGift] = useState(false)

  // Same one-at-a-time pattern as the add-product panel above, for
  // correcting the Pigeon Express package weight/dimensions before a real
  // shipment gets created on confirm.
  const [packagePanelOrder, setPackagePanelOrder] = useState<string | null>(null)
  const [packageWeight, setPackageWeight] = useState('')
  const [packageLength, setPackageLength] = useState('')
  const [packageWidth, setPackageWidth] = useState('')
  const [packageHeight, setPackageHeight] = useState('')
  const [packageSaving, setPackageSaving] = useState(false)

  function openPackagePanel(order: Order) {
    setPackagePanelOrder(order.number)
    setPackageWeight(
      order.pigeon_express_package_weight_kg ?? order.pigeon_express_suggested_weight_kg ?? '',
    )
    setPackageLength(order.pigeon_express_package_length_cm ?? '')
    setPackageWidth(order.pigeon_express_package_width_cm ?? '')
    setPackageHeight(order.pigeon_express_package_height_cm ?? '')
  }

  async function handleSavePackage(number: string) {
    setPackageSaving(true)
    try {
      await updatePigeonExpressPackage(number, {
        weight_kg: packageWeight,
        length_cm: packageLength,
        width_cm: packageWidth,
        height_cm: packageHeight,
      })
      setPackagePanelOrder(null)
      await refetch()
    } finally {
      setPackageSaving(false)
    }
  }

  useEffect(() => {
    if (!highlightOrder) return
    const el = rowRefs.current.get(highlightOrder)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightOrder, data])

  async function handleConfirm(number: string, notificationId: string) {
    setBusyOrder(number)
    try {
      await confirmOrder(number)
      await markNotificationRead(notificationId)
      await refetch()
    } finally {
      setBusyOrder(null)
    }
  }

  async function handleReject(number: string, notificationId: string) {
    const reason = prompt('Причина за отказ (по избор):') ?? ''
    setBusyOrder(number)
    try {
      await rejectOrder(number, reason)
      await markNotificationRead(notificationId)
      await refetch()
    } finally {
      setBusyOrder(null)
    }
  }

  async function handleReprice(number: string) {
    setBusyOrder(number)
    try {
      await repriceOrder(number)
      await refetch()
    } finally {
      setBusyOrder(null)
    }
  }

  async function handleAddItem(number: string, product: ProductListItem) {
    setBusyOrder(number)
    try {
      await addOrderItem(number, product.id, addQuantity, addFreeGift ? '0.00' : undefined)
      setAddPanelOrder(null)
      setAddQuantity(1)
      setAddFreeGift(false)
      await refetch()
    } finally {
      setBusyOrder(null)
    }
  }

  async function handleRemoveItem(number: string, itemId: string, productName: string) {
    if (!confirm(`Премахване на "${productName}" от поръчката?`)) return
    setBusyOrder(number)
    try {
      await removeOrderItem(number, itemId)
      await refetch()
    } finally {
      setBusyOrder(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Поръчки (админ)</h1>

      {isLoading && <p className="text-slate-500">Зареждане...</p>}
      {data && data.results.length === 0 && <p className="text-slate-500">Няма поръчки.</p>}

      <div className="flex flex-col gap-4">
        {data?.results.map((notification) => {
          const order = notification.order
          const isHighlighted = highlightOrder === order.number
          return (
            <div
              key={notification.id}
              ref={(el) => {
                if (el) rowRefs.current.set(order.number, el)
                else rowRefs.current.delete(order.number)
              }}
              className={
                isHighlighted
                  ? 'rounded-ui border-2 border-primary bg-primary/10 p-4'
                  : notification.is_read
                    ? 'rounded-ui border border-slate-200 p-4'
                    : 'rounded-ui border border-primary/40 bg-primary/5 p-4'
              }
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-slate-900">{order.number}</span>{' '}
                  <span className="text-sm text-slate-500">
                    ({order.customer_name || order.customer_email})
                  </span>{' '}
                  <span className="text-sm text-slate-400">
                    ·{' '}
                    {new Date(order.created_at).toLocaleString('bg-BG', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>{' '}
                  {order.user ? (
                    <Link
                      to={`/admin/customers/${order.user}`}
                      className="text-sm text-primary hover:underline"
                    >
                      Регистриран клиент: {order.username}
                    </Link>
                  ) : (
                    <span className="text-sm text-slate-400">Гост (без акаунт)</span>
                  )}
                  {order.is_company_order && (
                    <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                      Фирма: {order.company_name}
                    </span>
                  )}
                </div>
                <span
                  className={
                    order.status === 'pending'
                      ? 'rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800'
                      : order.status === 'confirmed'
                        ? 'rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800'
                        : 'rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800'
                  }
                >
                  {order.status}
                </span>
              </div>

              {order.invoice && (
                <a
                  href={getAdminInvoiceDownloadUrl(order.number)}
                  className="mb-2 inline-block text-xs text-primary hover:underline"
                >
                  Изтегли фактура ({order.invoice.number})
                </a>
              )}
              {order.pigeon_express_reference_number && (
                <a
                  href={getAdminPigeonExpressLabelDownloadUrl(order.number)}
                  className="mb-2 ml-3 inline-block text-xs text-primary hover:underline"
                >
                  Изтегли товарителница ({order.pigeon_express_reference_number})
                </a>
              )}

              <ul className="mb-2 divide-y divide-slate-100 text-sm">
                {order.items.map((item) => {
                  const imageUrl = getImageUrl(item.product_image)
                  const supplierUrl = supplierProductUrl(item.product_external_id)
                  const supplierId = supplierNumericId(item.product_external_id)
                  return (
                    <li key={item.id} className="flex items-center justify-between gap-3 py-1.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-ui border border-slate-200 bg-slate-50">
                          {imageUrl ? (
                            <img src={imageUrl} alt="" className="h-full w-full object-contain" />
                          ) : (
                            <span className="text-center text-[8px] text-slate-400">
                              Без снимка
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="truncate">
                            {supplierUrl ? (
                              <a
                                href={supplierUrl}
                                target="_blank"
                                rel="noreferrer"
                                title="Отвори продукта при доставчика, за да поръчате наличност"
                                className="text-primary hover:underline"
                              >
                                {item.product_name}
                              </a>
                            ) : (
                              item.product_name
                            )}
                            {supplierId && (
                              <span className="text-slate-400"> · №{supplierId}</span>
                            )}{' '}
                            x{item.quantity}
                          </span>
                          {order.user && item.product && (
                            <AdminQuickPromotionButton
                              customerId={order.user}
                              productId={item.product}
                              productName={item.product_name}
                            />
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 flex items-center gap-2">
                        {formatEur(item.line_total)}
                        {order.status === 'pending' && (
                          <button
                            type="button"
                            disabled={busyOrder === order.number}
                            onClick={() =>
                              handleRemoveItem(order.number, item.id, item.product_name)
                            }
                            title="Премахни от поръчката"
                            className="text-red-600 hover:underline disabled:opacity-50"
                          >
                            ✕
                          </button>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>

              {order.status === 'pending' &&
                (addPanelOrder === order.number ? (
                  <div className="mb-2 rounded-ui border border-slate-200 p-2">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <label className="text-xs text-slate-600">
                        Кол-во
                        <input
                          type="number"
                          min={1}
                          value={addQuantity}
                          onChange={(event) =>
                            setAddQuantity(Number(event.target.value) || 1)
                          }
                          className="ml-1 w-16 rounded-ui border border-slate-300 px-2 py-1 text-sm"
                        />
                      </label>
                      <label className="flex items-center gap-1 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={addFreeGift}
                          onChange={(event) => setAddFreeGift(event.target.checked)}
                        />
                        Безплатен подарък (€0.00)
                      </label>
                      <button
                        type="button"
                        onClick={() => setAddPanelOrder(null)}
                        className="text-xs text-slate-500 hover:underline"
                      >
                        Отказ
                      </button>
                    </div>
                    <AdminProductPicker
                      onSelect={(product) => handleAddItem(order.number, product)}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddPanelOrder(order.number)}
                    className="mb-2 text-xs text-primary hover:underline"
                  >
                    + Добави продукт
                  </button>
                ))}

              <div className="mb-2 text-sm text-slate-600">
                {order.shipping_method && (
                  <p>
                    Доставка: {SHIPPING_LABELS[order.shipping_method] ?? order.shipping_method}
                    {order.shipping_method === 'speedy_office'
                      ? ` — ${order.speedy_office_name}`
                      : order.shipping_method === 'pigeon_express_address'
                        ? ` — ${order.pigeon_express_street_name} ${order.pigeon_express_street_number}, ${order.pigeon_express_city_name}`
                        : order.shipping_method === 'pigeon_express_office' ||
                            order.shipping_method === 'pigeon_express_locker'
                          ? ` — ${order.pigeon_express_office_name}`
                          : ` — ${order.delivery_address_line}, ${order.delivery_city} ${order.delivery_post_code}`}
                  </p>
                )}
                <p>Телефон: {order.customer_phone || '-'}</p>
                {order.is_company_order && (
                  <>
                    <p>
                      Фирма: {order.company_name} · ЕИК: {order.company_eik}
                      {order.company_vat_number && ` · ДДС №: ${order.company_vat_number}`}
                    </p>
                    {order.company_address && <p>Адрес по регистрация: {order.company_address}</p>}
                    {order.company_mol && <p>МОЛ: {order.company_mol}</p>}
                  </>
                )}
                <p>Плащане: {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}</p>
                <p className="font-medium text-slate-900">
                  Общо: {formatEur(order.total_bgn)}
                </p>
                {order.total_profit_bgn !== null && (
                  <p className="font-medium text-green-700">
                    Печалба: {formatEur(order.total_profit_bgn)}
                  </p>
                )}
              </div>

              {order.status === 'pending' &&
                order.shipping_method.startsWith('pigeon_express') &&
                !order.pigeon_express_reference_number &&
                (packagePanelOrder === order.number ? (
                  <div className="mb-2 rounded-ui border border-slate-200 p-2">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <label className="text-xs text-slate-600">
                        Тегло (кг)
                        <input
                          type="text"
                          inputMode="decimal"
                          value={packageWeight}
                          onChange={(event) => setPackageWeight(event.target.value)}
                          placeholder="1.00"
                          className="ml-1 w-16 rounded-ui border border-slate-300 px-2 py-1 text-sm"
                        />
                      </label>
                      <label className="text-xs text-slate-600">
                        Дължина (см)
                        <input
                          type="text"
                          inputMode="decimal"
                          value={packageLength}
                          onChange={(event) => setPackageLength(event.target.value)}
                          placeholder="20"
                          className="ml-1 w-14 rounded-ui border border-slate-300 px-2 py-1 text-sm"
                        />
                      </label>
                      <label className="text-xs text-slate-600">
                        Ширина (см)
                        <input
                          type="text"
                          inputMode="decimal"
                          value={packageWidth}
                          onChange={(event) => setPackageWidth(event.target.value)}
                          placeholder="15"
                          className="ml-1 w-14 rounded-ui border border-slate-300 px-2 py-1 text-sm"
                        />
                      </label>
                      <label className="text-xs text-slate-600">
                        Височина (см)
                        <input
                          type="text"
                          inputMode="decimal"
                          value={packageHeight}
                          onChange={(event) => setPackageHeight(event.target.value)}
                          placeholder="10"
                          className="ml-1 w-14 rounded-ui border border-slate-300 px-2 py-1 text-sm"
                        />
                      </label>
                    </div>
                    {order.pigeon_express_suggested_weight_kg && !order.pigeon_express_package_weight_kg && (
                      <p className="mb-2 text-xs text-slate-500">
                        Предложено тегло по продуктови данни:{' '}
                        {order.pigeon_express_suggested_weight_kg} кг — проверете преди запис.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={packageSaving}
                        onClick={() => handleSavePackage(order.number)}
                        className="rounded-ui bg-primary px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                      >
                        {packageSaving ? 'Запазване...' : 'Запази'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPackagePanelOrder(null)}
                        className="text-xs text-slate-500 hover:underline"
                      >
                        Отказ
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openPackagePanel(order)}
                    className="mb-2 block text-xs text-primary hover:underline"
                  >
                    {order.pigeon_express_package_weight_kg
                      ? `Опаковка: ${order.pigeon_express_package_weight_kg} кг` +
                        (order.pigeon_express_package_length_cm
                          ? `, ${order.pigeon_express_package_length_cm}×${order.pigeon_express_package_width_cm}×${order.pigeon_express_package_height_cm} см`
                          : '') +
                        ' (редактирай)'
                      : '+ Тегло/размери за Pigeon Express (по подразбиране: 1 кг, 20×15×10 см)'}
                  </button>
                ))}

              {order.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyOrder === order.number}
                    onClick={() => handleConfirm(order.number, notification.id)}
                    className="rounded-ui bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Потвърди
                  </button>
                  <button
                    type="button"
                    disabled={busyOrder === order.number}
                    onClick={() => handleReprice(order.number)}
                    title="Провери за активни промоции и преизчисли цените, преди да потвърдиш"
                    className="rounded-ui border border-primary/40 px-3 py-1.5 text-sm font-medium text-primary disabled:opacity-50"
                  >
                    Приложи промоция
                  </button>
                  <button
                    type="button"
                    disabled={busyOrder === order.number}
                    onClick={() => handleReject(order.number, notification.id)}
                    className="rounded-ui border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 disabled:opacity-50"
                  >
                    Откажи
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
