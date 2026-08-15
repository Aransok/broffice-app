import { type FormEvent, useState } from 'react'
import { orderedCategoryOptions, useCategories } from '../../api/categories'
import { AdminProductPicker } from '../../components/admin/AdminProductPicker'
import {
  type AdminUserResult,
  type Promotion,
  type PromotionDiscountType,
  type PromotionScope,
  createPromotion,
  deletePromotion,
  searchAdminUsers,
  updatePromotion,
  usePromotions,
} from '../../api/promotions'
import { bgnToEur, eurToBgn } from '../../utils/currency'

const SCOPE_LABELS: Record<PromotionScope, string> = {
  global: 'Цялата страница',
  category: 'Категория',
  product: 'Конкретен продукт',
}

const emptyForm = {
  name: '',
  discount_type: 'percent' as PromotionDiscountType,
  value: '',
  maxQuantity: '',
  scope: 'global' as PromotionScope,
  category: '',
  productId: '',
  productName: '',
  userSearch: '',
  userId: '',
  username: '',
  active: true,
}

export function AdminPromotionsPage() {
  const { data: promotions, refetch } = usePromotions()
  const { data: categories } = useCategories()
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [userResults, setUserResults] = useState<AdminUserResult[]>([])
  const [error, setError] = useState<string | null>(null)

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
  }

  function editPromotion(promo: Promotion) {
    setEditingId(promo.id)
    setForm({
      ...emptyForm,
      name: promo.name,
      discount_type: promo.discount_type,
      // Flat discounts are stored in BGN (the pricing engine's base
      // currency) but entered/edited in EUR — convert for display here,
      // back to BGN on submit, at the fixed currency-board rate.
      value: promo.discount_type === 'flat' ? bgnToEur(promo.value) : promo.value,
      maxQuantity: promo.max_quantity ? String(promo.max_quantity) : '',
      scope: promo.scope,
      category: promo.category ?? '',
      productId: promo.product ?? '',
      userId: promo.user ? String(promo.user) : '',
      username: promo.username ?? '',
      active: promo.active,
    })
  }

  async function handleUserSearch(value: string) {
    setForm((prev) => ({ ...prev, userSearch: value, userId: '' }))
    if (value.trim().length > 1) {
      setUserResults(await searchAdminUsers(value))
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
      setUserResults(await searchAdminUsers(form.userSearch))
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      const payload = {
        name: form.name,
        discount_type: form.discount_type,
        value: form.discount_type === 'flat' ? eurToBgn(form.value) : form.value,
        max_quantity: form.maxQuantity ? Number(form.maxQuantity) : null,
        scope: form.scope,
        category: form.scope === 'category' ? form.category || null : null,
        product: form.scope === 'product' ? form.productId || null : null,
        user: form.userId ? Number(form.userId) : null,
        active: form.active,
      }
      if (editingId) {
        await updatePromotion(editingId, payload)
      } else {
        await createPromotion(payload)
      }
      resetForm()
      await refetch()
    } catch {
      setError('Промоцията не можа да бъде запазена. Проверете полетата.')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Изтриване на промоцията?')) return
    await deletePromotion(id)
    await refetch()
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Промоции (админ)</h1>

      <form
        onSubmit={handleSubmit}
        className="mb-8 flex flex-col gap-4 rounded-ui border border-slate-200 p-4"
      >
        <h2 className="font-semibold text-slate-900">
          {editingId ? 'Редактиране на промоция' : 'Нова промоция'}
        </h2>

        <input
          type="text"
          required
          placeholder="Име на промоцията"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          className="rounded-ui border border-slate-300 px-3 py-2"
        />

        <div className="grid grid-cols-2 gap-3">
          <select
            value={form.discount_type}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                discount_type: event.target.value as PromotionDiscountType,
              }))
            }
            className="rounded-ui border border-slate-300 px-3 py-2"
          >
            <option value="percent">Процент (%)</option>
            <option value="flat">Крайна цена (€)</option>
          </select>
          <input
            type="text"
            required
            placeholder={form.discount_type === 'percent' ? 'Стойност (%)' : 'Крайна цена (€)'}
            value={form.value}
            onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))}
            className="rounded-ui border border-slate-300 px-3 py-2"
          />
        </div>
        {form.discount_type === 'flat' && (
          <p className="-mt-2 text-xs text-slate-500">
            Продуктът ще струва точно тази цена за клиента (не отстъпка от текущата цена).
          </p>
        )}

        <input
          type="text"
          inputMode="numeric"
          placeholder="Максимален брой в поръчка (по избор)"
          value={form.maxQuantity}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, maxQuantity: event.target.value.replace(/\D/g, '') }))
          }
          className="rounded-ui border border-slate-300 px-3 py-2"
        />
        <p className="-mt-2 text-xs text-slate-500">
          Ако клиентът поръча повече от този брой, само първите N бройки получават промоцията —
          останалите се плащат на нормална цена. Оставете празно за без ограничение.
        </p>

        <select
          value={form.scope}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, scope: event.target.value as PromotionScope }))
          }
          className="rounded-ui border border-slate-300 px-3 py-2"
        >
          <option value="global">Цялата страница (всички продукти)</option>
          <option value="category">Категория</option>
          <option value="product">Конкретен продукт</option>
        </select>

        {form.scope === 'category' && (
          <select
            value={form.category}
            onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
            className="rounded-ui border border-slate-300 px-3 py-2"
          >
            <option value="">Избери категория (вкл. подкатегории)</option>
            {orderedCategoryOptions(categories?.results ?? []).map(({ category, depth }) => (
              <option key={category.id} value={category.id}>
                {'  '.repeat(depth)}
                {depth > 0 ? '— ' : ''}
                {category.name}
              </option>
            ))}
          </select>
        )}

        {form.scope === 'product' && (
          <div>
            <AdminProductPicker
              onSelect={(product) =>
                setForm((prev) => ({
                  ...prev,
                  productId: product.id,
                  productName: product.name,
                }))
              }
            />
            {form.productId && (
              <p className="mt-1 text-sm text-primary">Избран: {form.productName}</p>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm text-slate-700">
            За конкретен клиент (по избор) — ако не изберете, важи за всички клиенти
          </label>
          <input
            type="text"
            placeholder="Изберете от списъка или потърсете по име/имейл..."
            value={form.userSearch}
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
                      setForm((prev) => ({
                        ...prev,
                        userId: String(user.id),
                        username: user.username,
                        userSearch: '',
                      }))
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
          {form.userId && (
            <>
              <p className="mt-1 text-sm text-primary">
                Избран: {form.username}{' '}
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, userId: '', username: '' }))}
                  className="ml-1 text-slate-500 underline"
                >
                  премахни
                </button>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Тази промоция ще е видима само за {form.username} — за да проверите, че НЕ е
                видима за други, проверявайте от анонимен/инкогнито прозорец, а не докато сте
                влезли в неговия акаунт.
              </p>
            </>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
          />
          Активна
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button type="submit" className="rounded-ui bg-primary px-4 py-2 font-medium text-white">
            Запази
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-ui border border-slate-300 px-4 py-2 text-slate-700"
            >
              Отказ
            </button>
          )}
        </div>
      </form>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2">Име</th>
            <th className="py-2">Обхват</th>
            <th className="py-2">Отстъпка</th>
            <th className="py-2">Активна</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {promotions?.results.map((promo) => (
            <tr key={promo.id} className="border-b border-slate-100">
              <td className="py-2 pr-4">
                {promo.name}
                {promo.username && (
                  <span
                    className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                    title={`Видима само за ${promo.username} — проверявайте в анонимен/инкогнито прозорец, не докато сте влезли в неговия акаунт`}
                  >
                    🔒 Лично: {promo.username}
                  </span>
                )}
              </td>
              <td className="py-2 pr-4 text-slate-500">
                {SCOPE_LABELS[promo.scope]}
                {promo.scope === 'category' && promo.category_name && (
                  <span className="block text-xs text-slate-700">{promo.category_name}</span>
                )}
                {promo.scope === 'product' && promo.product_name && (
                  <span className="block text-xs text-slate-700">{promo.product_name}</span>
                )}
              </td>
              <td className="py-2 pr-4">
                {promo.discount_type === 'percent'
                  ? `${promo.value}%`
                  : `€${bgnToEur(promo.value)}`}
              </td>
              <td className="py-2 pr-4">{promo.active ? 'Да' : 'Не'}</td>
              <td className="flex gap-3 py-2">
                <button
                  type="button"
                  onClick={() => editPromotion(promo)}
                  className="text-primary hover:underline"
                >
                  Редактирай
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(promo.id)}
                  className="text-red-600 hover:underline"
                >
                  Изтрий
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
