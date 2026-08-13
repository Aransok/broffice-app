import { Link } from 'react-router-dom'
import { getInvoiceDownloadUrl, useMyOrders } from '../../api/myOrders'
import { formatEur } from '../../utils/currency'

export function AccountInvoicesPage() {
  const { data, isLoading } = useMyOrders(true)
  const invoiced = data?.results.filter((order) => order.invoice) ?? []

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Фактури</h2>
      {isLoading && <p className="text-slate-500">Зареждане...</p>}
      <div className="flex flex-col gap-3">
        {invoiced.map((order) => (
          <div
            key={order.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-ui border border-slate-200 p-3"
          >
            <div>
              <p className="font-semibold text-slate-900">{order.invoice!.number}</p>
              <p className="text-sm text-slate-500">
                Поръчка{' '}
                <Link to={`/account/orders/${order.number}`} className="text-primary hover:underline">
                  {order.number}
                </Link>{' '}
                · {new Date(order.invoice!.issued_at).toLocaleDateString('bg-BG')}
              </p>
            </div>
            <span className="font-medium text-slate-900">
              {formatEur(order.total_bgn)}
            </span>
            <a
              href={getInvoiceDownloadUrl(order.number)}
              className="rounded-ui border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5"
            >
              Изтегли PDF
            </a>
          </div>
        ))}
      </div>
      {data && invoiced.length === 0 && (
        <p className="text-slate-500">Все още нямате фактури (издават се при потвърждение на поръчка).</p>
      )}
    </div>
  )
}
