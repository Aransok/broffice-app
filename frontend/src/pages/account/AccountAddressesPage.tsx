import { type FormEvent, useState } from 'react'
import {
  createAddress,
  deleteAddress,
  updateAddress,
  useAddresses,
} from '../../api/addresses'
import type { Address } from '../../api/types'

const emptyForm = {
  label: '',
  full_name: '',
  phone: '',
  city: '',
  post_code: '',
  address_line: '',
  is_default: false,
  is_company: false,
  company_name: '',
  company_eik: '',
  company_vat_number: '',
  company_address: '',
  company_mol: '',
}

export function AccountAddressesPage() {
  const { data, refetch, isLoading } = useAddresses(true)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
  }

  function editAddress(address: Address) {
    setEditingId(address.id)
    setForm({
      label: address.label,
      full_name: address.full_name,
      phone: address.phone,
      city: address.city,
      post_code: address.post_code,
      address_line: address.address_line,
      is_default: address.is_default,
      is_company: address.is_company,
      company_name: address.company_name,
      company_eik: address.company_eik,
      company_vat_number: address.company_vat_number,
      company_address: address.company_address,
      company_mol: address.company_mol,
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      if (editingId) {
        await updateAddress(editingId, form)
      } else {
        await createAddress(form)
      }
      resetForm()
      await refetch()
    } catch {
      setError('Адресът не можа да бъде запазен. Проверете полетата.')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Изтриване на адреса?')) return
    await deleteAddress(id)
    await refetch()
  }

  async function handleSetDefault(id: string) {
    await updateAddress(id, { is_default: true })
    await refetch()
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Адреси</h2>

      <form
        onSubmit={handleSubmit}
        className="mb-6 flex flex-col gap-3 rounded-ui border border-slate-200 p-4"
      >
        <h3 className="font-semibold text-slate-900">
          {editingId ? 'Редактиране на адрес' : 'Нов адрес'}
        </h3>
        <input
          type="text"
          placeholder="Етикет (напр. Дом, Офис)"
          value={form.label}
          onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
          className="rounded-ui border border-slate-300 px-3 py-2"
        />
        <input
          type="text"
          required
          placeholder="Име и фамилия"
          value={form.full_name}
          onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
          className="rounded-ui border border-slate-300 px-3 py-2"
        />
        <input
          type="text"
          required
          placeholder="Телефон"
          value={form.phone}
          onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
          className="rounded-ui border border-slate-300 px-3 py-2"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            required
            placeholder="Град"
            value={form.city}
            onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
            className="rounded-ui border border-slate-300 px-3 py-2"
          />
          <input
            type="text"
            placeholder="Пощ. код"
            value={form.post_code}
            onChange={(event) => setForm((prev) => ({ ...prev, post_code: event.target.value }))}
            className="rounded-ui border border-slate-300 px-3 py-2"
          />
        </div>
        <input
          type="text"
          required
          placeholder="Адрес"
          value={form.address_line}
          onChange={(event) => setForm((prev) => ({ ...prev, address_line: event.target.value }))}
          className="rounded-ui border border-slate-300 px-3 py-2"
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, is_default: event.target.checked }))
            }
          />
          Използвай като адрес по подразбиране
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.is_company}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, is_company: event.target.checked }))
            }
          />
          Фирмени данни за поръчки към този адрес
        </label>
        {form.is_company && (
          <div className="flex flex-col gap-3 rounded-ui border border-slate-100 bg-slate-50 p-3">
            <input
              type="text"
              placeholder="Име на фирма"
              value={form.company_name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, company_name: event.target.value }))
              }
              className="rounded-ui border border-slate-300 px-3 py-2"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="ЕИК"
                value={form.company_eik}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, company_eik: event.target.value }))
                }
                className="rounded-ui border border-slate-300 px-3 py-2"
              />
              <input
                type="text"
                placeholder="ДДС №"
                value={form.company_vat_number}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, company_vat_number: event.target.value }))
                }
                className="rounded-ui border border-slate-300 px-3 py-2"
              />
            </div>
            <input
              type="text"
              placeholder="Адрес по регистрация"
              value={form.company_address}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, company_address: event.target.value }))
              }
              className="rounded-ui border border-slate-300 px-3 py-2"
            />
            <input
              type="text"
              placeholder="МОЛ"
              value={form.company_mol}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, company_mol: event.target.value }))
              }
              className="rounded-ui border border-slate-300 px-3 py-2"
            />
          </div>
        )}
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

      {isLoading && <p className="text-slate-500">Зареждане...</p>}
      <div className="flex flex-col gap-3">
        {data?.results.map((address) => (
          <div key={address.id} className="rounded-ui border border-slate-200 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">
                  {address.label || address.full_name}
                  {address.is_default && (
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      По подразбиране
                    </span>
                  )}
                </p>
                <p className="text-sm text-slate-600">
                  {address.full_name} · {address.phone}
                </p>
                <p className="text-sm text-slate-500">
                  {address.address_line}, {address.city} {address.post_code}
                </p>
                {address.is_company && (
                  <p className="text-sm text-slate-500">
                    {address.company_name} · ЕИК {address.company_eik}
                  </p>
                )}
              </div>
              <div className="flex gap-3 text-sm">
                {!address.is_default && (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(address.id)}
                    className="text-primary hover:underline"
                  >
                    По подразбиране
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => editAddress(address)}
                  className="text-primary hover:underline"
                >
                  Редактирай
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(address.id)}
                  className="text-red-600 hover:underline"
                >
                  Изтрий
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {data && data.results.length === 0 && (
        <p className="text-slate-500">Нямате запазени адреси.</p>
      )}
    </div>
  )
}
