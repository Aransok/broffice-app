import { Link, useParams } from 'react-router-dom'
import { getInvoiceDownloadUrl, useMyOrder } from '../../api/myOrders'
import { getImageUrl } from '../../api/media'
import { formatEur } from '../../utils/currency'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Чакаща',
  confirmed: 'Потвърдена',
  rejected: 'Отказана',
}

export function AccountOrderDetailPage() {
  const { number } = useParams<{ number: string }>()
  const { data: order, isLoading } = useMyOrder(number ?? '')

  if (isLoading) return <p className="text-slate-500">Зареждане...</p>
  if (!order) return <p className="text-slate-500">Поръчката не е намерена.</p>

  return (
    <div>
      <Link to="/account/orders" className="mb-4 inline-block text-sm text-primary hover:underline">
        ← Всички поръчки
      </Link>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">{order.number}</h2>
      <p className="mb-4 text-sm text-slate-500">
        {new Date(order.created_at).toLocaleDateString('bg-BG')} ·{' '}
        {STATUS_LABELS[order.status] ?? order.status}
      </p>

      <ul className="mb-4 divide-y divide-slate-100 rounded-ui border border-slate-200 text-sm">
        {order.items.map((item) => {
          const imageUrl = getImageUrl(item.product_image)
          const thumbnail = (
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-ui bg-slate-50">
              {imageUrl && (
                <img src={imageUrl} alt={item.product_name} className="h-full w-full object-contain p-1" />
              )}
            </div>
          )
          return (
            <li key={item.id} className="flex items-center gap-3 px-3 py-2">
              {item.product_slug ? (
                <Link to={`/product/${item.product_slug}`}>{thumbnail}</Link>
              ) : (
                thumbnail
              )}
              <span className="flex-1">
                {item.product_name} x{item.quantity}
                {item.discount_label && (
                  <span className="ml-2 text-xs text-primary">({item.discount_label})</span>
                )}
              </span>
              <span>{formatEur(item.line_total)}</span>
            </li>
          )
        })}
      </ul>

      <div className="mb-4 space-y-1 text-sm text-slate-600">
        <p>Междинна сума: {formatEur(order.subtotal_bgn)}</p>
        {Number(order.shipping_cost_bgn) > 0 && (
          <p>Доставка: {formatEur(order.shipping_cost_bgn)}</p>
        )}
        <p>
          ДДС ({order.vat_rate_percent}%): {formatEur(order.vat_amount_bgn)}
        </p>
        <p className="font-semibold text-slate-900">
          Общо: {formatEur(order.total_bgn)}
        </p>
      </div>

      {order.invoice && (
        <p className="text-sm text-slate-600">
          Фактура: <span className="font-medium text-slate-900">{order.invoice.number}</span>{' '}
          ({new Date(order.invoice.issued_at).toLocaleDateString('bg-BG')}){' '}
          <a
            href={getInvoiceDownloadUrl(order.number)}
            className="text-primary hover:underline"
          >
            Изтегли PDF
          </a>
        </p>
      )}
    </div>
  )
}
