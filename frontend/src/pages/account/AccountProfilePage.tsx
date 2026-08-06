import { type FormEvent, useState } from 'react'
import { updateMe } from '../../api/auth'
import type { Me } from '../../api/auth'
import { useAuth } from '../../context/AuthContext'

export function AccountProfilePage() {
  const { user } = useAuth()
  if (!user) return <p className="text-slate-500">Зареждане...</p>
  // Keyed by user id so the form re-initializes from fresh data if the
  // logged-in account ever changes, without syncing external state via effect.
  return <ProfileForm key={user.id} user={user} />
}

function ProfileForm({ user }: { user: Me }) {
  const [form, setForm] = useState({
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone: user.phone,
  })
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setStatus('saving')
    setError(null)
    try {
      await updateMe(form)
      setStatus('saved')
    } catch {
      setStatus('error')
      setError('Профилът не можа да бъде запазен. Възможно е имейлът вече да се използва.')
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Профил</h2>
      <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Име
            <input
              type="text"
              value={form.first_name}
              onChange={(event) => setForm((prev) => ({ ...prev, first_name: event.target.value }))}
              className="rounded-ui border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Фамилия
            <input
              type="text"
              value={form.last_name}
              onChange={(event) => setForm((prev) => ({ ...prev, last_name: event.target.value }))}
              className="rounded-ui border border-slate-300 px-3 py-2"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Имейл
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            className="rounded-ui border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Телефон
          <input
            type="tel"
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            className="rounded-ui border border-slate-300 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {status === 'saved' && <p className="text-sm text-green-700">Профилът е запазен.</p>}
        <button
          type="submit"
          disabled={status === 'saving'}
          className="w-fit rounded-ui bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {status === 'saving' ? 'Запазване...' : 'Запази'}
        </button>
      </form>
    </div>
  )
}
