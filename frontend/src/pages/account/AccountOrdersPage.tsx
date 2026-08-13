import { Link } from 'react-router-dom'
import { useMyOrders } from '../../api/myOrders'
import { formatEur } from '../../utils/currency'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Чакаща',
  confirmed: 'Потвърдена',
  rejected: 'Отказана',
}

export function AccountOrdersPage() {
  const { data, isLoading } = useMyOrders(true)

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Моите поръчки</h2>
      {isLoading && <p className="text-slate-500">Зареждане...</p>}
      <div className="flex flex-col gap-3">
        {data?.results.map((order) => (
          <Link
            key={order.id}
            to={`/account/orders/${order.number}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-ui border border-slate-200 p-3 hover:border-primary/40"
          >
            <span className="font-semibold text-slate-900">{order.number}</span>
            <span className="text-sm text-slate-500">
              {new Date(order.created_at).toLocaleDateString('bg-BG')}
            </span>
            <span className="text-sm text-slate-500">
              {STATUS_LABELS[order.status] ?? order.status}
            </span>
            <span className="font-medium text-slate-900">
              {formatEur(order.total_bgn)}
            </span>
          </Link>
        ))}
      </div>
      {data && data.results.length === 0 && (
        <p className="text-slate-500">Все още нямате поръчки.</p>
      )}
    </div>
  )
}
