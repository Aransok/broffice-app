import { Link } from 'react-router-dom'
import { useDashboardStats } from '../../api/adminDashboard'

const CARDS = [
  { key: 'pending_orders', label: 'Чакащи поръчки', to: '/admin/orders' },
  { key: 'unread_notifications', label: 'Непрочетени известия', to: '/admin/orders' },
  { key: 'total_customers', label: 'Клиенти', to: '/admin/customers' },
  { key: 'total_products', label: 'Продукти', to: '/admin/products' },
] as const

export function AdminDashboardPage() {
  const { data, isLoading } = useDashboardStats()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Начало</h1>

      {isLoading && <p className="text-slate-500">Зареждане...</p>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {CARDS.map((card) => (
          <Link
            key={card.key}
            to={card.to}
            className="rounded-ui border border-slate-200 bg-surface p-4 hover:border-primary/40"
          >
            <p className="text-2xl font-semibold text-slate-900">
              {data ? data[card.key] : '—'}
            </p>
            <p className="text-sm text-slate-500">{card.label}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
