import { Link, useLocation } from 'react-router-dom'
import type { Order } from '../api/types'
import { Seo } from '../components/Seo'
import { formatEur } from '../utils/currency'

export function OrderConfirmationPage() {
  const location = useLocation()
  const order = (location.state as { order?: Order } | null)?.order

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-slate-600">Няма данни за поръчка.</p>
        <Link to="/" className="text-primary hover:underline">
          Обратно към началото
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Seo title="Поръчката е приета | BRoffice" robots="noindex, follow" />
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">Благодарим за поръчката!</h1>
      <p className="mb-6 text-slate-600">
        Поръчка <span className="font-medium">{order.number}</span> е приета и очаква
        потвърждение.
      </p>

      <div className="rounded-ui border border-slate-200">
        <ul className="divide-y divide-slate-100 text-sm">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between px-4 py-2">
              <span>
                {item.product_name} x{item.quantity}
              </span>
              <span>{formatEur(item.line_total)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-slate-200 px-4 py-3 font-semibold">
          <span>Общо</span>
          <span>{formatEur(order.total_bgn)}</span>
        </div>
      </div>

      <p className="mt-6 text-sm text-slate-600">
        Ще получите имейл на <span className="font-medium">{order.customer_email}</span> след
        потвърждение на поръчката.
      </p>

      <Link to="/" className="mt-6 inline-block text-primary hover:underline">
        Обратно към началото
      </Link>
    </div>
  )
}
