import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PasswordInput } from '../components/PasswordInput'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(username, password)
      navigate('/')
    } catch {
      setError('Грешно потребителско име или парола.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Вход</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Имейл или потребителско име
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            className="rounded-ui border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Парола
          <PasswordInput value={password} onChange={setPassword} required autoComplete="current-password" />
        </label>
        <Link to="/forgot-password" className="-mt-2 text-sm text-primary hover:underline">
          Забравена парола?
        </Link>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-ui bg-primary px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Влизане...' : 'Вход'}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Нямате акаунт?{' '}
        <Link to="/register" className="text-primary hover:underline">
          Регистрация
        </Link>
      </p>
    </div>
  )
}
