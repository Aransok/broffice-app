import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAdminCustomers } from '../../api/adminCustomers'

export function AdminCustomersPage() {
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const { data, isLoading } = useAdminCustomers(search ? { search } : {})
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Клиенти</h1>

      <div className="relative mb-4 max-w-sm">
        <input
          type="text"
          placeholder="Търси по потребителско име или имейл..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className="w-full rounded-ui border border-slate-300 px-3 py-2"
        />
        {searchFocused && search.trim() && data && data.results.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-72 w-full divide-y divide-slate-100 overflow-y-auto rounded-ui border border-slate-200 bg-surface shadow-lg">
            {data.results.slice(0, 8).map((customer) => (
              <li key={customer.id}>
                <button
                  type="button"
                  // onMouseDown (not onClick) fires before the input's
                  // onBlur hides this dropdown, so the click registers.
                  onMouseDown={() => navigate(`/admin/customers/${customer.id}`)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-primary/10"
                >
                  <span className="font-medium text-slate-900">{customer.username}</span>{' '}
                  <span className="text-slate-500">({customer.email})</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isLoading && <p className="text-slate-500">Зареждане...</p>}

      {data && data.results.length === 0 && (
        <p className="py-4 text-slate-500">Няма намерени клиенти.</p>
      )}

      {data && data.results.length > 0 && (
        <>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4">Потребител</th>
                  <th className="py-2 pr-4">Имейл</th>
                  <th className="py-2 pr-4">Регистрация</th>
                  <th className="py-2 pr-4">Количка</th>
                  <th className="py-2 pr-4">Поръчки</th>
                  <th className="py-2 pr-4">Промоции</th>
                  <th className="py-2 pr-4">Инд. цени</th>
                  <th className="py-2 pr-4">Активност</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((customer) => (
                  <tr key={customer.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4">
                      <Link
                        to={`/admin/customers/${customer.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {customer.username}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{customer.email}</td>
                    <td className="py-2 pr-4 text-slate-500">
                      {new Date(customer.date_joined).toLocaleDateString('bg-BG')}
                    </td>
                    <td className="py-2 pr-4">{customer.cart_item_count}</td>
                    <td className="py-2 pr-4">{customer.order_count}</td>
                    <td className="py-2 pr-4">{customer.promotion_count}</td>
                    <td className="py-2 pr-4">{customer.price_override_count}</td>
                    <td className="py-2 pr-4">{customer.activity_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 sm:hidden">
            {data.results.map((customer) => (
              <Link
                key={customer.id}
                to={`/admin/customers/${customer.id}`}
                className="rounded-ui border border-slate-200 p-3"
              >
                <p className="font-medium text-primary">{customer.username}</p>
                <p className="text-sm text-slate-600">{customer.email}</p>
                <p className="text-xs text-slate-500">
                  Регистриран на {new Date(customer.date_joined).toLocaleDateString('bg-BG')}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span>Количка: {customer.cart_item_count}</span>
                  <span>Поръчки: {customer.order_count}</span>
                  <span>Промоции: {customer.promotion_count}</span>
                  <span>Инд. цени: {customer.price_override_count}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
