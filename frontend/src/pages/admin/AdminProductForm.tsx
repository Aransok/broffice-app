import { type FormEvent, useEffect, useState } from 'react'
import {
  type AdminProductPayload,
  createAdminProduct,
  deleteProductImage,
  updateAdminProduct,
  uploadProductImages,
  useAdminProduct,
} from '../../api/adminProducts'
import { useCategories } from '../../api/categories'
import { getImageUrl } from '../../api/media'
import type { ProductDetail } from '../../api/types'
import { BGN_PER_EUR, bgnToEur, eurToBgn } from '../../utils/currency'

const emptyForm: AdminProductPayload = {
  name: '',
  sku: '',
  price_bgn: '',
  price_eur: '',
  old_price_bgn: '',
  old_price_eur: '',
  category: '',
  description: '',
  short_description: '',
  availability: 'in_stock',
  status: 'published',
}

function formFromProduct(product: ProductDetail): AdminProductPayload {
  return {
    name: product.name,
    sku: '',
    price_bgn: product.price_bgn ?? '',
    price_eur: product.price_eur ?? '',
    old_price_bgn: product.old_price_bgn ?? '',
    old_price_eur: product.old_price_eur ?? '',
    category: product.category ?? '',
    description: product.description,
    short_description: product.short_description,
    availability: product.availability,
    status: 'published',
  }
}

type SpecRow = { key: string; value: string }

function specRowsFromProduct(product: ProductDetail | null): SpecRow[] {
  if (!product) return []
  return Object.entries(product.specifications).map(([key, value]) => ({
    key,
    value: String(value),
  }))
}

function specRowsToObject(rows: SpecRow[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const row of rows) {
    const key = row.key.trim()
    if (key) result[key] = row.value
  }
  return result
}

/** Wrapper: waits for the existing product to load (edit mode) before mounting
 * the actual form, so its initial state can be a plain lazy useState — no
 * effect needed to sync async data into local state. */
export function AdminProductForm({
  productId,
  onSaved,
  onCancel,
  onCreated,
}: {
  productId: string | null
  onSaved: () => void
  onCancel: () => void
  /** Fired right after a brand-new product is created (after any image
   * upload has already completed) — purely informational, so the parent
   * can refresh the product list. The form itself already knows about the
   * new id internally and keeps itself open to show the uploaded images;
   * the parent must NOT respond by changing the `productId` prop back
   * down, or it re-triggers this wrapper's loading state and unmounts the
   * form that's currently showing them. */
  onCreated: (id: string) => void
}) {
  const { data: product } = useAdminProduct(productId)

  if (productId && !product) {
    return <p className="text-slate-500">Зареждане...</p>
  }

  return (
    <AdminProductFormFields
      key={productId ?? 'new'}
      productId={productId}
      initialProduct={product ?? null}
      onSaved={onSaved}
      onCancel={onCancel}
      onCreated={onCreated}
    />
  )
}

function AdminProductFormFields({
  productId,
  initialProduct,
  onSaved,
  onCancel,
  onCreated,
}: {
  productId: string | null
  initialProduct: ProductDetail | null
  onSaved: () => void
  onCancel: () => void
  onCreated: (id: string) => void
}) {
  const { data: categories } = useCategories()
  const [form, setForm] = useState<AdminProductPayload>(() =>
    initialProduct ? formFromProduct(initialProduct) : emptyForm,
  )
  const [images, setImages] = useState(initialProduct?.images ?? [])
  const [specRows, setSpecRows] = useState<SpecRow[]>(() => specRowsFromProduct(initialProduct))
  // Local preview of files picked but not yet uploaded — lets the admin see
  // (and remove) the wrong one before it's ever sent to the server, not
  // only after saving.
  const [pendingFiles, setPendingFiles] = useState<{ file: File; previewUrl: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The id of the product this form now represents. Starts as `productId`
  // (set when editing an existing product) and, for a brand-new product,
  // switches to the real id the moment `createAdminProduct` returns —
  // tracked locally rather than by waiting for the parent to pass a new
  // `productId` prop back down, which previously meant unmounting this
  // whole form and remounting it once a refetch resolved (a visible
  // "Зареждане..." flash) before the just-uploaded images ever appeared.
  const [savedProductId, setSavedProductId] = useState(productId)
  const isEdit = Boolean(savedProductId)

  function update<K extends keyof AdminProductPayload>(key: K, value: AdminProductPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // Revokes the previous batch's object URLs the moment a new batch replaces
  // them, and revokes whatever's left over if the form unmounts entirely —
  // object URLs otherwise leak memory for as long as the tab stays open.
  useEffect(() => {
    return () => {
      pendingFiles.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    }
  }, [pendingFiles])

  function handleFilesSelected(selected: FileList | null) {
    setPendingFiles(
      Array.from(selected ?? []).map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    )
  }

  function handleRemovePendingFile(previewUrl: string) {
    setPendingFiles((prev) => prev.filter((p) => p.previewUrl !== previewUrl))
  }

  function updateSpecRow(index: number, field: keyof SpecRow, value: string) {
    setSpecRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  function addSpecRow() {
    setSpecRows((prev) => [...prev, { key: '', value: '' }])
  }

  function removeSpecRow(index: number) {
    setSpecRows((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const cleaned = {
        ...form,
        category: form.category || null,
        specifications: specRowsToObject(specRows),
      }
      const files = pendingFiles.map((p) => p.file)
      if (savedProductId) {
        await updateAdminProduct(savedProductId, cleaned)
        if (files.length > 0) {
          const uploaded = await uploadProductImages(savedProductId, files)
          setImages((prev) => [...prev, ...uploaded])
          setPendingFiles([])
        }
        onSaved()
      } else {
        const created = await createAdminProduct(cleaned)
        setSavedProductId(created.id)
        if (files.length > 0) {
          const uploaded = await uploadProductImages(created.id, files)
          setImages(uploaded)
          setPendingFiles([])
        }
        // Tells the parent so the product list picks up the new row, but
        // this form's own display no longer depends on that round-trip.
        onCreated(created.id)
      }
    } catch {
      setError('Продуктът не можа да бъде запазен. Проверете полетата.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteImage(imageId: string) {
    if (!savedProductId) return
    await deleteProductImage(savedProductId, imageId)
    setImages((prev) => prev.filter((image) => image.id !== imageId))
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-ui border border-slate-200 p-4">
      <h2 className="font-semibold text-slate-900">
        {isEdit ? 'Редактиране на продукт' : 'Нов продукт'}
      </h2>

      <input
        type="text"
        required
        placeholder="Име на продукта"
        value={form.name}
        onChange={(event) => update('name', event.target.value)}
        className="rounded-ui border border-slate-300 px-3 py-2"
      />

      <select
        value={form.category ?? ''}
        onChange={(event) => update('category', event.target.value)}
        className="rounded-ui border border-slate-300 px-3 py-2"
      >
        <option value="">Без категория</option>
        {categories?.results.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="Цена (€)"
          value={form.price_eur}
          onChange={(event) => {
            const eur = event.target.value
            setForm((prev) => ({ ...prev, price_eur: eur, price_bgn: eurToBgn(eur) }))
          }}
          className="rounded-ui border border-slate-300 px-3 py-2"
        />
        <input
          type="text"
          placeholder="Цена (лв.)"
          value={form.price_bgn}
          onChange={(event) => {
            const bgn = event.target.value
            setForm((prev) => ({ ...prev, price_bgn: bgn, price_eur: bgnToEur(bgn) }))
          }}
          className="rounded-ui border border-slate-300 px-3 py-2"
        />
        <input
          type="text"
          placeholder="Стара цена (€) — за промоция"
          value={form.old_price_eur ?? ''}
          onChange={(event) => {
            const eur = event.target.value
            setForm((prev) => ({ ...prev, old_price_eur: eur, old_price_bgn: eurToBgn(eur) }))
          }}
          className="rounded-ui border border-slate-300 px-3 py-2"
        />
        <input
          type="text"
          placeholder="Стара цена (лв.) — за промоция"
          value={form.old_price_bgn ?? ''}
          onChange={(event) => {
            const bgn = event.target.value
            setForm((prev) => ({ ...prev, old_price_bgn: bgn, old_price_eur: bgnToEur(bgn) }))
          }}
          className="rounded-ui border border-slate-300 px-3 py-2"
        />
      </div>
      <p className="-mt-2 text-xs text-slate-500">
        Лева и евро се преизчисляват автоматично по фиксирания курс 1 € = {BGN_PER_EUR} лв. — все
        пак може да въведете и двете стойности ръчно, ако е нужно.
      </p>

      <textarea
        placeholder="Кратко описание"
        value={form.short_description}
        onChange={(event) => update('short_description', event.target.value)}
        className="rounded-ui border border-slate-300 px-3 py-2"
        rows={2}
      />
      <textarea
        placeholder="Описание"
        value={form.description}
        onChange={(event) => update('description', event.target.value)}
        className="rounded-ui border border-slate-300 px-3 py-2"
        rows={4}
      />

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">
          Характеристики (напр. цвят, размер, материал)
        </p>
        <div className="flex flex-col gap-2">
          {specRows.map((row, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                placeholder="Характеристика"
                value={row.key}
                onChange={(event) => updateSpecRow(index, 'key', event.target.value)}
                className="flex-1 rounded-ui border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Стойност"
                value={row.value}
                onChange={(event) => updateSpecRow(index, 'value', event.target.value)}
                className="flex-1 rounded-ui border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removeSpecRow(index)}
                aria-label="Премахни характеристиката"
                className="rounded-ui border border-slate-300 px-2 text-red-600"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addSpecRow}
          className="mt-2 text-sm text-primary hover:underline"
        >
          + Добави характеристика
        </button>
      </div>

      {images.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Снимки</p>
          <div className="flex flex-wrap gap-2">
            {images.map((image) => {
              const url = getImageUrl(image.path)
              return (
                <div key={image.id} className="relative h-20 w-20 rounded-ui border border-slate-200">
                  {url && <img src={url} alt="" className="h-full w-full object-contain" />}
                  <button
                    type="button"
                    onClick={() => handleDeleteImage(image.id)}
                    className="absolute -right-2 -top-2 rounded-full bg-red-600 px-1.5 text-xs text-white"
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <label className="text-sm text-slate-700">
        Добави снимки
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(event) => handleFilesSelected(event.target.files)}
          className="mt-1 block w-full text-sm"
        />
      </label>
      {pendingFiles.length > 0 && (
        <div>
          <p className="mb-2 text-sm text-primary">
            Избрани {pendingFiles.length} {pendingFiles.length === 1 ? 'снимка' : 'снимки'} — все
            още не са качени. Натиснете „Запази“, за да ги качите, или премахнете грешна снимка с ×.
          </p>
          <div className="flex flex-wrap gap-2">
            {pendingFiles.map((p) => (
              <div
                key={p.previewUrl}
                className="relative h-20 w-20 rounded-ui border border-dashed border-primary/40"
              >
                <img src={p.previewUrl} alt="" className="h-full w-full object-contain" />
                <button
                  type="button"
                  onClick={() => handleRemovePendingFile(p.previewUrl)}
                  aria-label="Премахни снимката от избора"
                  className="absolute -right-2 -top-2 rounded-full bg-red-600 px-1.5 text-xs text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {!isEdit && (
        <p className="text-xs text-slate-500">
          Продуктът трябва да бъде запазен веднъж, преди снимките да се качат — след „Запази“
          формата ще остане отворена, за да видите и управлявате качените снимки.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-ui bg-primary px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Запазване...' : 'Запази'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-ui border border-slate-300 px-4 py-2 text-slate-700"
        >
          {isEdit ? 'Готово' : 'Отказ'}
        </button>
      </div>
    </form>
  )
}
