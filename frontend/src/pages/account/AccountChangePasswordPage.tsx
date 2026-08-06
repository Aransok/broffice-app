import { type FormEvent, useState } from 'react'
import { changePassword } from '../../api/auth'
import { PasswordInput } from '../../components/PasswordInput'

export function AccountChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (newPassword !== newPasswordConfirm) {
      setError('Новите пароли не съвпадат.')
      return
    }
    setStatus('saving')
    try {
      await changePassword(currentPassword, newPassword, newPasswordConfirm)
      setStatus('saved')
      setCurrentPassword('')
      setNewPassword('')
      setNewPasswordConfirm('')
    } catch {
      setStatus('error')
      setError('Текущата парола е грешна или новата парола не отговаря на изискванията.')
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Смяна на парола</h2>
      <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Текуща парола
          <PasswordInput
            value={currentPassword}
            onChange={setCurrentPassword}
            required
            autoComplete="current-password"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Нова парола
          <PasswordInput
            value={newPassword}
            onChange={setNewPassword}
            required
            autoComplete="new-password"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Потвърди нова парола
          <PasswordInput
            value={newPasswordConfirm}
            onChange={setNewPasswordConfirm}
            required
            autoComplete="new-password"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {status === 'saved' && <p className="text-sm text-green-700">Паролата е сменена успешно.</p>}
        <button
          type="submit"
          disabled={status === 'saving'}
          className="w-fit rounded-ui bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {status === 'saving' ? 'Запазване...' : 'Смени паролата'}
        </button>
      </form>
    </div>
  )
}
