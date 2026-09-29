import { useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useState } from 'react'
import {
  setPigeonExpressPickupOffice,
  usePigeonExpressPickupOffice,
} from '../../api/adminPigeonExpress'
import { usePigeonExpressCities, usePigeonExpressOffices } from '../../api/shipping'
import type { PigeonExpressCity } from '../../api/types'

/**
 * Picks the Pigeon Express office we drop parcels off at. Every Pigeon quote
 * and shipment is sent from this office, so checkout with Pigeon doesn't
 * work until one is chosen.
 */
export function AdminPigeonExpressPage() {
  const queryClient = useQueryClient()
  const { data: current, isLoading: currentLoading } = usePigeonExpressPickupOffice()

  const [cityQuery, setCityQuery] = useState('Пловдив')
  const [city, setCity] = useState<PigeonExpressCity | null>(null)
  const [officeQuery, setOfficeQuery] = useState('Тракия')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const { data: cities, isFetching: citiesLoading } = usePigeonExpressCities(city ? '' : cityQuery)

  async function handleSelect(officeId: string) {
    setSavingId(officeId)
    setError('')
    setMessage('')
    try {
      const saved = await setPigeonExpressPickupOffice(officeId)
      queryClient.setQueryData(['admin-pigeon-express-pickup-office'], saved)
      setMessage(`Запазено: ${saved.office_name || saved.office_id}`)
    } catch (err) {
      const detail = isAxiosError<{ detail?: string }>(err) ? err.response?.data?.detail : undefined
      setError(detail || 'Неуспешно запазване на офиса.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-2 text-xl font-semibold text-slate-900">Pigeon Express</h1>
      <p className="mb-6 text-sm text-slate-500">
        Офисът, от който изпращаме пратките. Всички цени и пратки с Pigeon Express се изчисляват от
        него.
      </p>

      <div className="mb-8 rounded-ui border border-slate-200 p-4 text-sm">
        <div className="text-slate-500">Текущ офис за изпращане</div>
        {currentLoading ? (
          <div className="mt-1 text-slate-500">Зареждане...</div>
        ) : current?.office_id ? (
          <div className="mt-1 font-medium text-slate-900">
            {current.office_name || 'Зададен чрез .env'}{' '}
            <span className="font-normal text-slate-500">(ID: {current.office_id})</span>
          </div>
        ) : (
          <div className="mt-1 font-medium text-red-600">
            Не е избран — поръчките с Pigeon Express няма да работят, докато не изберете офис.
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-ui border border-slate-200 p-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Град</span>
          {city ? (
            <div className="flex items-center gap-3">
              <span className="font-medium text-slate-900">
                {city.name} {city.postal_code && `(${city.postal_code})`}
              </span>
              <button
                type="button"
                onClick={() => setCity(null)}
                className="text-xs font-medium text-primary underline"
              >
                Смени
              </button>
            </div>
          ) : (
            <input
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              className="rounded-ui border border-slate-300 px-3 py-2"
            />
          )}
        </label>

        {!city && (
          <div className="flex flex-col">
            {citiesLoading && <p className="text-sm text-slate-500">Търсене...</p>}
            {cities?.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCity(c)}
                className="px-3 py-1.5 text-left text-sm hover:bg-primary/10"
              >
                {c.name} {c.postal_code && `(${c.postal_code})`}
              </button>
            ))}
          </div>
        )}

        {city && (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-600">Търси офис (име или квартал, празно = всички)</span>
              <input
                value={officeQuery}
                onChange={(e) => setOfficeQuery(e.target.value)}
                className="rounded-ui border border-slate-300 px-3 py-2"
              />
            </label>

            <OfficeList
              cityId={city.id}
              query={officeQuery}
              currentId={current?.office_id ?? ''}
              savingId={savingId}
              onSelect={handleSelect}
            />
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}
      </div>
    </div>
  )
}

function OfficeList({
  cityId,
  query,
  currentId,
  savingId,
  onSelect,
}: {
  cityId: string
  query: string
  currentId: string
  savingId: string | null
  onSelect: (officeId: string) => void
}) {
  const { data: offices, isFetching } = usePigeonExpressOffices('office', cityId, query)

  if (isFetching) return <p className="text-sm text-slate-500">Зареждане на офиси...</p>
  if (!offices?.length) {
    return (
      <p className="text-sm text-slate-500">
        Няма намерени офиси. Опитайте с друго търсене или изчистете полето.
      </p>
    )
  }
  return (
    <ul className="divide-y divide-slate-100">
      {offices.map((office) => (
        <li key={office.id} className="flex items-center justify-between gap-3 py-2">
          <div className="text-sm">
            <div className="font-medium text-slate-900">{office.name}</div>
            <div className="text-slate-500">
              {office.address} <span className="text-slate-400">(ID: {office.id})</span>
            </div>
          </div>
          {currentId === String(office.id) ? (
            <span className="text-sm font-medium text-green-700">Избран</span>
          ) : (
            <button
              type="button"
              disabled={savingId !== null}
              onClick={() => onSelect(String(office.id))}
              className="shrink-0 rounded-ui bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {savingId === String(office.id) ? 'Запазване...' : 'Избери'}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
