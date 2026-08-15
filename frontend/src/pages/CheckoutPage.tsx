import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAddresses } from '../api/addresses'
import { type CouponDiscountType, validateCoupon } from '../api/coupons'
import { createOrder } from '../api/orders'
import { fetchSpeedyQuote, useSpeedyOffices } from '../api/shipping'
import type { PaymentMethod, ShippingMethod, SpeedyOffice } from '../api/types'
import { Seo } from '../components/Seo'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useVat } from '../context/VatContext'
import { bgnToEur } from '../utils/currency'

function SpeedyOfficePicker({
  onSelect,
  selected,
}: {
  onSelect: (office: SpeedyOffice) => void
  selected: SpeedyOffice | null
}) {
  const [city, setCity] = useState('')
  const [query, setQuery] = useState('')
  const { data: offices, isFetching } = useSpeedyOffices(city, query)

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Град"
          value={city}
          onChange={(event) => setCity(event.target.value)}
          className="flex-1 rounded-ui border border-slate-300 px-3 py-2"
        />
        <input
          type="text"
          placeholder="Търси офис по име"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="flex-1 rounded-ui border border-slate-300 px-3 py-2"
        />
      </div>
      {isFetching && <p className="text-sm text-slate-500">Търсене...</p>}
      {offices && offices.length > 0 && (
        <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-ui border border-slate-200">
          {offices.map((office) => (
            <li key={office.id}>
              <button
                type="button"
                onClick={() => onSelect(office)}
                className={
                  selected?.id === office.id
                    ? 'w-full bg-primary/10 px-3 py-2 text-left text-sm'
                    : 'w-full px-3 py-2 text-left text-sm hover:bg-primary/10'
                }
              >
                <div className="font-medium text-slate-800">{office.name}</div>
                <div className="text-slate-500">{office.address}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {offices && offices.length === 0 && city && (
        <p className="text-sm text-slate-500">Няма намерени офиси.</p>
      )}
    </div>
  )
}

export function CheckoutPage() {
  const { items, totalPrice, clear } = useCart()
  const { displayPrice } = useVat()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState(user?.email ?? '')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  const [isCompanyOrder, setIsCompanyOrder] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [companyEik, setCompanyEik] = useState('')
  const [companyVatNumber, setCompanyVatNumber] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [companyMol, setCompanyMol] = useState('')

  const { data: addresses } = useAddresses(Boolean(user))
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [deliveryAddressLine, setDeliveryAddressLine] = useState('')
  const [deliveryCity, setDeliveryCity] = useState('')
  const [deliveryPostCode, setDeliveryPostCode] = useState('')

  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('speedy_address')
  const [selectedOffice, setSelectedOffice] = useState<SpeedyOffice | null>(null)
  const [shippingCost, setShippingCost] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash_on_delivery')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [termsAccepted, setTermsAccepted] = useState(false)

  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string
    discount_type: CouponDiscountType
    value: string
  } | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [checkingCoupon, setCheckingCoupon] = useState(false)

  async function handleApplyCoupon() {
    setCouponError(null)
    if (!couponInput.trim()) return
    setCheckingCoupon(true)
    try {
      const result = await validateCoupon(couponInput.trim(), totalPrice.toFixed(2))
      setAppliedCoupon(result)
    } catch (err) {
      setAppliedCoupon(null)
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setCouponError(detail || 'Невалиден купон код.')
    } finally {
      setCheckingCoupon(false)
    }
  }

  // Preview only — the actual discount is always recomputed server-side
  // when the order is submitted, same "server never trusts a client
  // number" rule as every other price on this page.
  const couponPreviewDiscount = appliedCoupon
    ? appliedCoupon.discount_type === 'percent'
      ? (totalPrice * Number(appliedCoupon.value)) / 100
      : Number(appliedCoupon.value)
    : 0

  function handleSelectAddress(id: string) {
    setSelectedAddressId(id || null)
    const address = addresses?.results.find((a) => a.id === id)
    if (address) {
      setDeliveryAddressLine(address.address_line)
      setDeliveryCity(address.city)
      setDeliveryPostCode(address.post_code)
      setPhone((prev) => prev || address.phone)
      setName((prev) => prev || address.full_name)
      if (address.is_company) {
        setIsCompanyOrder(true)
        setCompanyName(address.company_name)
        setCompanyEik(address.company_eik)
        setCompanyVatNumber(address.company_vat_number)
        setCompanyAddress(address.company_address)
        setCompanyMol(address.company_mol)
      }
    }
  }

  // Auto-fills the customer's default (or otherwise first, per the API's
  // own "-is_default, -created_at" ordering) saved address as soon as it
  // loads, so a returning customer doesn't have to re-pick it every time -
  // they can still switch to a different saved address or type a new one,
  // this only sets the initial value.
  useEffect(() => {
    if (selectedAddressId || !addresses || addresses.results.length === 0) return
    // One-time initialization of local form state from async-loaded data, not a derived value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleSelectAddress(addresses.results[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses])

  useEffect(() => {
    const city = shippingMethod === 'speedy_office' ? selectedOffice?.city : deliveryCity
    if (!city) return
    let cancelled = false
    const timeout = setTimeout(() => {
      fetchSpeedyQuote(shippingMethod, city).then((quote) => {
        if (!cancelled) setShippingCost(quote.shipping_cost_bgn)
      })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [shippingMethod, deliveryCity, selectedOffice])

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-slate-600">
        Количката е празна.
      </div>
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (shippingMethod === 'speedy_office' && !selectedOffice) {
      setError('Изберете офис на Спиди.')
      return
    }
    if (shippingMethod === 'speedy_address' && (!deliveryAddressLine || !deliveryCity)) {
      setError('Попълнете адрес и град за доставка.')
      return
    }
    if (!termsAccepted) {
      setError('Трябва да приемете Общите условия, за да завършите поръчката.')
      return
    }
    if (isCompanyOrder && (!companyName || !companyEik)) {
      setError('Попълнете име на фирма и ЕИК.')
      return
    }

    setSubmitting(true)
    try {
      const order = await createOrder({
        customer_email: email,
        customer_name: name,
        customer_phone: phone,
        items: items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
        address_id: selectedAddressId ?? undefined,
        shipping_method: shippingMethod,
        payment_method: paymentMethod,
        coupon_code: appliedCoupon?.code,
        is_company_order: isCompanyOrder,
        ...(isCompanyOrder
          ? {
              company_name: companyName,
              company_eik: companyEik,
              company_vat_number: companyVatNumber,
              company_address: companyAddress,
              company_mol: companyMol,
            }
          : {}),
        ...(shippingMethod === 'speedy_address'
          ? {
              delivery_address_line: deliveryAddressLine,
              delivery_city: deliveryCity,
              delivery_post_code: deliveryPostCode,
            }
          : { speedy_office_id: selectedOffice?.external_id }),
      })
      clear()
      navigate('/order-confirmation', { state: { order } })
    } catch (err) {
      // The coupon is re-validated server-side at submit time (never
      // trusted from the earlier preview check) — surface that specific
      // reason if that's what failed, e.g. someone else used it in the
      // meantime, rather than a generic message.
      const couponIssue = (err as { response?: { data?: { coupon_code?: string[] } } })?.response
        ?.data?.coupon_code?.[0]
      if (couponIssue) {
        setAppliedCoupon(null)
        setCouponError(couponIssue)
        setError('Купонът вече не е валиден — премахнат е, опитайте отново.')
      } else {
        setError('Поръчката не бе изпратена успешно. Проверете данните и опитайте отново.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Seo title="Поръчка | BRoffice" robots="noindex, follow" />
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Поръчка</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <section>
          <h2 className="mb-3 font-semibold text-slate-900">Контакти</h2>
          <div className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="Имейл"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-ui border border-slate-300 px-3 py-2"
            />
            <input
              type="text"
              required
              placeholder="Име"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-ui border border-slate-300 px-3 py-2"
            />
            <input
              type="tel"
              required
              placeholder="Телефон"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="rounded-ui border border-slate-300 px-3 py-2"
            />
          </div>
        </section>

        <section>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <input
              type="checkbox"
              checked={isCompanyOrder}
              onChange={(event) => setIsCompanyOrder(event.target.checked)}
            />
            Поръчвам от името на фирма
          </label>
          {isCompanyOrder && (
            <div className="mt-3 flex flex-col gap-3">
              <input
                type="text"
                required
                placeholder="Име на фирма"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                className="rounded-ui border border-slate-300 px-3 py-2"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="ЕИК / Булстат"
                  value={companyEik}
                  onChange={(event) => setCompanyEik(event.target.value)}
                  className="rounded-ui border border-slate-300 px-3 py-2"
                />
                <input
                  type="text"
                  placeholder="ДДС номер (по избор)"
                  value={companyVatNumber}
                  onChange={(event) => setCompanyVatNumber(event.target.value)}
                  className="rounded-ui border border-slate-300 px-3 py-2"
                />
              </div>
              <input
                type="text"
                placeholder="Адрес по регистрация"
                value={companyAddress}
                onChange={(event) => setCompanyAddress(event.target.value)}
                className="rounded-ui border border-slate-300 px-3 py-2"
              />
              <input
                type="text"
                placeholder="МОЛ (по избор)"
                value={companyMol}
                onChange={(event) => setCompanyMol(event.target.value)}
                className="rounded-ui border border-slate-300 px-3 py-2"
              />
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-semibold text-slate-900">Начин на доставка</h2>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={shippingMethod === 'speedy_address'}
                onChange={() => setShippingMethod('speedy_address')}
              />
              Доставка до адрес
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={shippingMethod === 'speedy_office'}
                onChange={() => setShippingMethod('speedy_office')}
              />
              До офис на Спиди
            </label>
          </div>

          {shippingMethod === 'speedy_address' && (
            <div className="mt-3 flex flex-col gap-3">
              {user && addresses && addresses.results.length > 0 && (
                <select
                  value={selectedAddressId ?? ''}
                  onChange={(event) => handleSelectAddress(event.target.value)}
                  className="rounded-ui border border-slate-300 px-3 py-2"
                >
                  <option value="">Нов адрес</option>
                  {addresses.results.map((address) => (
                    <option key={address.id} value={address.id}>
                      {address.label || address.full_name} — {address.city}, {address.address_line}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                required
                placeholder="Адрес"
                value={deliveryAddressLine}
                onChange={(event) => setDeliveryAddressLine(event.target.value)}
                className="rounded-ui border border-slate-300 px-3 py-2"
              />
              <div className="flex gap-3">
                <input
                  type="text"
                  required
                  placeholder="Град"
                  value={deliveryCity}
                  onChange={(event) => setDeliveryCity(event.target.value)}
                  className="flex-1 rounded-ui border border-slate-300 px-3 py-2"
                />
                <input
                  type="text"
                  placeholder="Пощенски код"
                  value={deliveryPostCode}
                  onChange={(event) => setDeliveryPostCode(event.target.value)}
                  className="w-32 rounded-ui border border-slate-300 px-3 py-2"
                />
              </div>
            </div>
          )}

          {shippingMethod === 'speedy_office' && (
            <SpeedyOfficePicker selected={selectedOffice} onSelect={setSelectedOffice} />
          )}
        </section>

        <section>
          <h2 className="mb-3 font-semibold text-slate-900">Начин на плащане</h2>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={paymentMethod === 'cash_on_delivery'}
                onChange={() => setPaymentMethod('cash_on_delivery')}
              />
              Наложен платеж (в брой при доставка)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={paymentMethod === 'bank_transfer'}
                onChange={() => setPaymentMethod('bank_transfer')}
              />
              Плащане по банков път
            </label>
          </div>
          <p className="mt-1 text-xs text-slate-500">Плащане с карта ще бъде добавено скоро.</p>
        </section>

        <section>
          <h2 className="mb-3 font-semibold text-slate-900">Купон код</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Купон код (по избор)"
              value={couponInput}
              onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
              disabled={Boolean(appliedCoupon)}
              className="flex-1 rounded-ui border border-slate-300 px-3 py-2 disabled:bg-slate-50"
            />
            {appliedCoupon ? (
              <button
                type="button"
                onClick={() => {
                  setAppliedCoupon(null)
                  setCouponInput('')
                  setCouponError(null)
                }}
                className="rounded-ui border border-slate-300 px-4 py-2 text-sm text-slate-700"
              >
                Премахни
              </button>
            ) : (
              <button
                type="button"
                disabled={checkingCoupon}
                onClick={handleApplyCoupon}
                className="rounded-ui bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {checkingCoupon ? 'Проверка...' : 'Приложи'}
              </button>
            )}
          </div>
          {couponError && <p className="mt-1 text-sm text-red-600">{couponError}</p>}
          {appliedCoupon && (
            <p className="mt-1 text-sm text-green-700">
              Купон {appliedCoupon.code} приложен: -
              {appliedCoupon.discount_type === 'percent'
                ? `${appliedCoupon.value}%`
                : `€${bgnToEur(appliedCoupon.value)}`}
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-semibold text-slate-900">Обобщение</h2>
          <ul className="divide-y divide-slate-100 rounded-ui border border-slate-200 text-sm">
            {items.map((item) => (
              <li key={item.productId} className="flex justify-between px-3 py-2">
                <span>
                  {item.name} x{item.quantity}
                </span>
                <span>
                  {item.price
                    ? (() => {
                        const lineBgn = displayPrice(String(Number(item.price) * item.quantity))
                        return `€${bgnToEur(lineBgn ?? '')}`
                      })()
                    : '-'}
                </span>
              </li>
            ))}
          </ul>
          {appliedCoupon && (
            <div className="mt-2 flex justify-between text-sm text-green-700">
              <span>Купон ({appliedCoupon.code})</span>
              <span>
                {(() => {
                  const discountBgn = displayPrice(couponPreviewDiscount.toFixed(2))
                  return `-€${bgnToEur(discountBgn ?? '')}`
                })()}
              </span>
            </div>
          )}
          <div className="mt-2 flex justify-between font-semibold text-slate-900">
            <span>Общо (с доставка)</span>
            <span>
              {(() => {
                const totalBgn = displayPrice(
                  (totalPrice - couponPreviewDiscount + Number(shippingCost ?? 0)).toFixed(2),
                )
                return `€${bgnToEur(totalBgn ?? '')}`
              })()}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Крайната сума (вкл. ДДС) се потвърждава при завършване на поръчката.
          </p>
        </section>

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            Прочетох и приемам{' '}
            <Link to="/terms" className="text-primary hover:underline">
              Общите условия
            </Link>{' '}
            и{' '}
            <Link to="/privacy-policy" className="text-primary hover:underline">
              Политиката за поверителност
            </Link>
            .
          </span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-ui bg-primary px-6 py-3 font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Изпращане...' : 'Потвърди поръчката'}
        </button>
      </form>
    </div>
  )
}
