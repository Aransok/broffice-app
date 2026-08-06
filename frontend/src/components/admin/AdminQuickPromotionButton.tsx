import { useState } from 'react'
import {
  createPromotion,
  deletePromotion,
  type Promotion,
  type PromotionDiscountType,
  updatePromotion,
} from '../../api/promotions'
import { bgnToEur, eurToBgn } from '../../utils/currency'

/** Small inline "give a promotion on this exact item" widget — always
 * creates a product-scoped Promotion (this widget's whole point is "on this
 * exact item"); the only variable is *who* it's for. Used from the admin
 * order view, the customer cart/activity tabs (audience='client': just for
 * that one customer), and the product page's admin price editor
 * (audience='everyone'). Creates the same Promotion the full promotions
 * page would, just without navigating away and re-picking the
 * customer/product.
 *
 * When the caller already knows a matching promotion exists
 * (`existingPromotion`), this edits/deletes it in place instead of creating
 * a second, conflicting one. */
export function AdminQuickPromotionButton({
  audience = 'client',
  customerId,
  productId,
  productName,
  existingPromotion = null,
  onCreated,
}: {
  audience?: 'client' | 'everyone'
  /** Required when audience='client', ignored for audience='everyone'. */
  customerId?: number
  productId: string
  productName: string
  existingPromotion?: Promotion | null
  onCreated?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [discountType, setDiscountType] = useState<PromotionDiscountType>(
    existingPromotion?.discount_type ?? 'percent',
  )
  const [value, setValue] = useState(
    existingPromotion
      ? existingPromotion.discount_type === 'flat'
        ? bgnToEur(existingPromotion.value)
        : existingPromotion.value
      : '',
  )
  const [maxQuantity, setMaxQuantity] = useState(
    existingPromotion?.max_quantity ? String(existingPromotion.max_quantity) : '',
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openForm() {
    if (existingPromotion) {
      setDiscountType(existingPromotion.discount_type)
      setValue(
        existingPromotion.discount_type === 'flat'
          ? bgnToEur(existingPromotion.value)
          : existingPromotion.value,
      )
      setMaxQuantity(existingPromotion.max_quantity ? String(existingPromotion.max_quantity) : '')
    }
    setOpen(true)
  }

  async function handleSave() {
    if (!value) {
      setError(discountType === 'percent' ? 'Въведете %.' : 'Въведете €.')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      name:
        existingPromotion?.name ??
        (audience === 'client'
          ? `Индивидуална отстъпка — ${productName}`
          : `Промоция — ${productName}`),
      discount_type: discountType,
      value: discountType === 'flat' ? eurToBgn(value) : value,
      scope: 'product' as const,
      user: audience === 'client' ? (customerId ?? null) : null,
      product: productId,
      category: null,
      active: true,
      max_quantity: maxQuantity ? Number(maxQuantity) : null,
    }
    try {
      if (existingPromotion) {
        await updatePromotion(existingPromotion.id, payload)
      } else {
        await createPromotion(payload)
      }
      setOpen(false)
      onCreated?.()
    } catch {
      setError('Промоцията не можа да бъде запазена.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!existingPromotion) return
    if (!confirm(`Изтриване на промоцията "${existingPromotion.name}"?`)) return
    setSaving(true)
    try {
      await deletePromotion(existingPromotion.id)
      setOpen(false)
      onCreated?.()
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={openForm} className="text-xs text-primary hover:underline">
        {existingPromotion
          ? `Редактирай промоция (${
              existingPromotion.discount_type === 'percent'
                ? `${existingPromotion.value}%`
                : `€${bgnToEur(existingPromotion.value)}`
            }${existingPromotion.max_quantity ? `, до ${existingPromotion.max_quantity} бр.` : ''})`
          : audience === 'everyone'
            ? '+ Промоция за всички'
            : '+ Промоция'}
      </button>
    )
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <select
        value={discountType}
        onChange={(event) => setDiscountType(event.target.value as PromotionDiscountType)}
        className="rounded-ui border border-slate-300 px-1 py-0.5 text-xs"
        aria-label="Тип отстъпка"
      >
        <option value="percent">%</option>
        <option value="flat">€</option>
      </select>
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={discountType === 'percent' ? '%' : '€'}
        aria-label="Стойност на отстъпката"
        className="w-14 rounded-ui border border-slate-300 px-1 py-0.5 text-xs"
      />
      <input
        type="text"
        inputMode="numeric"
        value={maxQuantity}
        onChange={(event) => setMaxQuantity(event.target.value.replace(/\D/g, ''))}
        placeholder="Макс. бр."
        title="Промоцията важи само за първите N бройки в поръчката — оставете празно за без ограничение"
        aria-label="Максимален брой за отстъпката (по избор)"
        className="w-16 rounded-ui border border-slate-300 px-1 py-0.5 text-xs"
      />
      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="rounded-ui bg-primary px-2 py-0.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {saving ? '...' : 'Запази'}
      </button>
      {existingPromotion && (
        <button
          type="button"
          disabled={saving}
          onClick={handleDelete}
          className="text-xs text-red-600 hover:underline disabled:opacity-50"
        >
          Изтрий
        </button>
      )}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-slate-500 hover:underline"
      >
        Отказ
      </button>
      {error && <span className="w-full text-xs text-red-600">{error}</span>}
    </div>
  )
}
