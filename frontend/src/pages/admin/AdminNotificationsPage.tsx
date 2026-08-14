import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  confirmOrder,
  markNotificationRead,
  rejectOrder,
  repriceOrder,
  useNotifications,
} from '../../api/adminNotifications'
import { getAdminInvoiceDownloadUrl } from '../../api/adminOrders'
import { getImageUrl } from '../../api/media'
import { AdminQuickPromotionButton } from '../../components/admin/AdminQuickPromotionButton'
import { formatEur } from '../../utils/currency'

const SHIPPING_LABELS: Record<string, string> = {
  speedy_address: 'Доставка до адрес',
  speedy_office: 'До офис на Спиди',
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
                      <span className="shrink-0">{formatEur(item.line_total)}</span>
                    </li>
                  )
                })}
              </ul>

              <div className="mb-2 text-sm text-slate-600">
                {order.shipping_method && (
                  <p>
                    Доставка: {SHIPPING_LABELS[order.shipping_method] ?? order.shipping_method}
                    {order.shipping_method === 'speedy_office'
                      ? ` — ${order.speedy_office_name}`
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
                <p>Плащане: Наложен платеж</p>
                <p className="font-medium text-slate-900">
                  Общо: {formatEur(order.total_bgn)}
                </p>
                {order.total_profit_bgn !== null && (
                  <p className="font-medium text-green-700">
                    Печалба: {formatEur(order.total_profit_bgn)}
                  </p>
                )}
              </div>

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
