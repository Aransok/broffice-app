import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PasswordInput } from '../components/PasswordInput'
import { useAuth } from '../context/AuthContext'

export function RegisterPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password !== passwordConfirm) {
      setError('Паролите не съвпадат.')
      return
    }
    if (!termsAccepted) {
      setError('Трябва да приемете Общите условия и Политиката за поверителност.')
      return
    }
    setSubmitting(true)
    try {
      await register({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        password,
        password_confirm: passwordConfirm,
        terms_accepted: termsAccepted,
      })
      navigate('/')
    } catch (err) {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
      const firstFieldError = data ? Object.values(data)[0] : null
      setError(
        (Array.isArray(firstFieldError) ? firstFieldError[0] : firstFieldError) ??
          'Регистрацията не бе успешна. Проверете въведените данни.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Регистрация</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Име
            <input
              type="text"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              required
              className="rounded-ui border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Фамилия
            <input
              type="text"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="rounded-ui border border-slate-300 px-3 py-2"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Имейл
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="rounded-ui border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Телефон
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
            className="rounded-ui border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Парола
          <PasswordInput value={password} onChange={setPassword} required autoComplete="new-password" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Потвърди парола
          <PasswordInput
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            required
            autoComplete="new-password"
          />
        </label>
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
          className="rounded-ui bg-primary px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Регистриране...' : 'Регистрация'}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Вече имате акаунт?{' '}
        <Link to="/login" className="text-primary hover:underline">
          Вход
        </Link>
      </p>
    </div>
  )
}
