import { type FormEvent, useState } from 'react'
import { requestPasswordReset } from '../api/auth'
import { Seo } from '../components/Seo'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await requestPasswordReset(email)
    } finally {
      // Always show the same confirmation regardless of outcome — the
      // backend intentionally never reveals whether the email matched an
      // account, so the UI must not either.
      setSubmitted(true)
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <Seo title="Забравена парола | BRoffice" robots="noindex, follow" />
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Забравена парола</h1>
      {submitted ? (
        <p className="text-slate-700">
          Ако имейлът съществува в системата, изпратихме линк за смяна на паролата.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          <button
            type="submit"
            disabled={submitting}
            className="rounded-ui bg-primary px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {submitting ? 'Изпращане...' : 'Изпрати линк'}
          </button>
        </form>
      )}
    </div>
  )
}
