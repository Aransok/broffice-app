import { type FormEvent, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { confirmPasswordReset } from '../api/auth'
import { PasswordInput } from '../components/PasswordInput'
import { Seo } from '../components/Seo'

export function ResetPasswordPage() {
  const { uid, token } = useParams<{ uid: string; token: string }>()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password !== confirmPassword) {
      setError('Паролите не съвпадат.')
      return
    }
    setSubmitting(true)
    try {
      await confirmPasswordReset(uid ?? '', token ?? '', password)
      navigate('/login')
    } catch {
      setError('Линкът е невалиден или изтекъл. Заявете нов.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <Seo title="Нова парола | BRoffice" robots="noindex, follow" />
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Нова парола</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Нова парола
          <PasswordInput value={password} onChange={setPassword} required autoComplete="new-password" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Потвърди паролата
          <PasswordInput
            value={confirmPassword}
            onChange={setConfirmPassword}
            required
            autoComplete="new-password"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-ui bg-primary px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Запазване...' : 'Смени паролата'}
        </button>
      </form>
    </div>
  )
}
