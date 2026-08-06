import { useState } from 'react'
import {
  type Coupon,
  type CouponDiscountType,
  createCoupon,
  deleteCoupon,
  useCoupons,
} from '../../api/coupons'
import { type AdminUserResult, searchAdminUsers } from '../../api/promotions'
import { bgnToEur, eurToBgn } from '../../utils/currency'

/** Whole-cart discount codes a customer types at checkout — distinct from
 * Промоции (automatic, always tied to one product/category/user). Single-use:
 * once redeemed the row just shows who used it and on which order. */
export function AdminCouponsPage() {
  const { data, refetch } = useCoupons()
  const [code, setCode] = useState('')
  const [discountType, setDiscountType] = useState<CouponDiscountType>('percent')
  const [value, setValue] = useState('')
  const [minOrderAmount, setMinOrderAmount] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [userId, setUserId] = useState('')
  const [username, setUsername] = useState('')
  const [userResults, setUserResults] = useState<AdminUserResult[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)

  async function handleUserSearch(search: string) {
    setUserSearch(search)
    setUserId('')
    setUsername('')
    if (search.trim().length > 1) {
      setUserResults(await searchAdminUsers(search))
    } else {
      // Still show something browsable rather than an empty box — the
      // backend already returns a default (blank-search) list of clients,
      // this just stops throwing it away below 2 typed characters.
      setUserResults(await searchAdminUsers(''))
    }
  }

  /** Populates the client dropdown the moment the field is focused, before
   * any typing — so it's a real pick-from-a-list option, not only "type to
   * search and hope you spell it right." */
  async function handleUserFieldFocus() {
    if (userResults.length === 0) {
      setUserResults(await searchAdminUsers(userSearch))
    }
  }

  function resetForm() {
    setCode('')
    setValue('')
    setMinOrderAmount('')
    setUserSearch('')
    setUserId('')
    setUsername('')
    setUserResults([])
  }

  async function handleCreate() {
    setError(null)
    setLastResult(null)
    if (!value) {
      setError(discountType === 'percent' ? 'Въведете процент.' : 'Въведете сума в евро.')
      return
    }
    setSaving(true)
    try {
      const created = await createCoupon({
        code: code.trim().toUpperCase() || undefined,
        discount_type: discountType,
        value: discountType === 'flat' ? eurToBgn(value) : value,
        min_order_amount: minOrderAmount ? eurToBgn(minOrderAmount) : null,
        user: userId ? Number(userId) : null,
        active: true,
      })
      if (created.user) {
        setLastResult(
          created.email_sent
            ? `Купон ${created.code} създаден и имейлът е изпратен на ${username}.`
            : `Купон ${created.code} създаден, но имейлът НЕ можа да бъде изпратен${created.email_error ? `: ${created.email_error}` : '.'}`,
        )
      } else {
        setLastResult(
          `Купон ${created.code} създаден (без конкретен клиент — няма кой да получи имейл).`,
        )
      }
      resetForm()
      await refetch()
    } catch {
      setError('Купонът не можа да бъде запазен.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(coupon: Coupon) {
    if (!confirm(`Изтриване на купон "${coupon.code}"?`)) return
    await deleteCoupon(coupon.id)
    await refetch()
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Купони (админ)</h1>

      <div className="mb-8 flex flex-col gap-3 rounded-ui border border-slate-200 p-4">
        <h2 className="font-semibold text-slate-900">Нов купон</h2>
        <p className="text-xs text-slate-500">
          Купонът важи за цялата количка (не за конкретен продукт) и е за еднократна употреба — след
          като бъде използван веднъж, вече не може да се приложи отново.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Код (по избор — генерира се автоматично)"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            className="rounded-ui border border-slate-300 px-3 py-2"
          />
          <select
            value={discountType}
            onChange={(event) => setDiscountType(event.target.value as CouponDiscountType)}
            className="rounded-ui border border-slate-300 px-3 py-2"
          >
            <option value="percent">Процент (%)</option>
            <option value="flat">Фиксирана сума (€)</option>
          </select>
        </div>
        <input
          type="text"
          placeholder={discountType === 'percent' ? 'Отстъпка (%)' : 'Сума (€)'}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="rounded-ui border border-slate-300 px-3 py-2"
        />
        {discountType === 'flat' && value && (
          <p className="-mt-1 text-xs text-slate-500">
            = {eurToBgn(value)} лв. при прилагане (фиксиран курс 1 € = 1.95583 лв.)
          </p>
        )}

        <input
          type="text"
          placeholder="Минимална сума на поръчката (€, по избор)"
          title="Купонът важи само за поръчки над тази сума — пази от 'купон за 5€ прави 5€ продукт безплатен'"
          value={minOrderAmount}
          onChange={(event) => setMinOrderAmount(event.target.value)}
          className="rounded-ui border border-slate-300 px-3 py-2"
        />
        <p className="-mt-2 text-xs text-slate-500">
          Например купон от 5 € с минимална сума 20 € няма да важи за поръчка под 20 €. Оставете
          празно за без ограничение.
        </p>

        <div>
          <input
            type="text"
            placeholder="Изберете клиент от списъка или потърсете (по избор — оставете празно за код, който всеки може да въведе)"
            value={userSearch}
            onChange={(event) => handleUserSearch(event.target.value)}
            onFocus={handleUserFieldFocus}
            className="w-full rounded-ui border border-slate-300 px-3 py-2"
          />
          {userResults.length > 0 && (
            <ul className="mt-1 max-h-40 divide-y divide-slate-100 overflow-y-auto rounded-ui border border-slate-200">
              {userResults.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setUserId(String(user.id))
                      setUsername(user.username)
                      setUserSearch('')
                      setUserResults([])
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-primary/10"
                  >
                    {user.username} ({user.email})
                  </button>
                </li>
              ))}
            </ul>
          )}
          {userId && (
            <p className="mt-1 text-sm text-primary">
              Избран клиент: {username}{' '}
              <button
                type="button"
                onClick={() => {
                  setUserId('')
                  setUsername('')
                }}
                className="ml-1 text-xs text-slate-500 underline"
              >
                премахни
              </button>
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handleCreate}
          className="self-start rounded-ui bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Запазване...' : 'Създай купон'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {lastResult && <p className="text-sm text-slate-700">{lastResult}</p>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-4">Код</th>
              <th className="py-2 pr-4">Отстъпка</th>
              <th className="py-2 pr-4">Клиент</th>
              <th className="py-2 pr-4">Статус</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.results.map((coupon) => (
              <tr key={coupon.id} className="border-b border-slate-100">
                <td className="py-2 pr-4 font-mono font-medium">{coupon.code}</td>
                <td className="py-2 pr-4">
                  {coupon.discount_type === 'percent'
                    ? `${coupon.value}%`
                    : `€${bgnToEur(coupon.value)}`}
                  {coupon.min_order_amount && (
                    <div className="text-xs text-slate-400">
                      мин. €{bgnToEur(coupon.min_order_amount)}
                    </div>
                  )}
                </td>
                <td className="py-2 pr-4 text-slate-500">{coupon.username ?? 'Всеки с кода'}</td>
                <td className="py-2 pr-4">
                  {coupon.is_redeemed ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      Използван
                      {coupon.redeemed_order_number ? ` (${coupon.redeemed_order_number})` : ''}
                    </span>
                  ) : coupon.active ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      Активен
                    </span>
                  ) : (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                      Деактивиран
                    </span>
                  )}
                </td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={() => handleDelete(coupon)}
                    className="text-red-600 hover:underline"
                  >
                    Изтрий
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.results.length === 0 && (
          <p className="py-4 text-slate-500">Няма създадени купони.</p>
        )}
      </div>
    </div>
  )
}
