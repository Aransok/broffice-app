import { useState } from 'react'
import { requestRestore, useBackups, useRestoreStatus } from '../../api/adminBackups'
import { useAuth } from '../../context/AuthContext'

const STATE_LABELS: Record<string, string> = {
  idle: '',
  pending: 'Изчаква да бъде поето от watcher-а...',
  in_progress: 'В процес на възстановяване...',
  done: 'Възстановяването приключи успешно.',
  error: 'Грешка при възстановяване.',
}

export function AdminBackupsPage() {
  const { user } = useAuth()
  const { data: backups, isLoading, refetch } = useBackups()
  const [pendingName, setPendingName] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [requestedName, setRequestedName] = useState<string | null>(null)

  const { data: status } = useRestoreStatus(Boolean(requestedName))

  // Backend already enforces this (IsDeveloperUser) - this is just so the
  // page doesn't render a confusing empty shell for anyone who somehow
  // lands here without dev access, same as AdminRoute does for the whole
  // admin panel.
  if (!user?.is_developer) {
    return (
      <div className="p-6 text-slate-600">Нямате достъп до тази страница.</div>
    )
  }

  async function handleConfirmRestore() {
    if (!pendingName || confirmText !== pendingName) return
    setRequesting(true)
    try {
      await requestRestore(pendingName)
      setRequestedName(pendingName)
      setPendingName(null)
      setConfirmText('')
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-2 text-xl font-semibold text-slate-900">Резервни копия</h1>
      <p className="mb-6 text-sm text-slate-500">
        Само за разработчика - възстановяването замества цялата текуща база данни.
      </p>

      {requestedName && status && status.state !== 'idle' && (
        <div
          className={`mb-6 rounded-ui border p-4 text-sm ${
            status.state === 'error'
              ? 'border-red-300 bg-red-50 text-red-700'
              : status.state === 'done'
                ? 'border-green-300 bg-green-50 text-green-700'
                : 'border-blue-300 bg-blue-50 text-blue-700'
          }`}
        >
          <div className="font-medium">{STATE_LABELS[status.state]}</div>
          {status.message && <div className="mt-1 text-xs opacity-80">{status.message}</div>}
          {(status.state === 'done' || status.state === 'error') && (
            <button
              type="button"
              onClick={() => {
                setRequestedName(null)
                void refetch()
              }}
              className="mt-2 text-xs font-medium underline"
            >
              Затвори
            </button>
          )}
        </div>
      )}

      {isLoading && <p className="text-slate-500">Зареждане...</p>}

      {backups && backups.length === 0 && (
        <p className="text-slate-500">Няма намерени резервни копия.</p>
      )}

      {backups && backups.length > 0 && (
        <div className="divide-y divide-slate-200 rounded-ui border border-slate-200">
          {backups.map((b) => (
            <div key={b.name} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-medium text-slate-900">{b.name}</div>
                <div className="text-xs text-slate-500">
                  {b.size_kb} KB{b.has_media ? ' · с медия' : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingName(b.name)
                  setConfirmText('')
                }}
                disabled={Boolean(requestedName)}
                className="rounded-ui border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                Възстанови
              </button>
            </div>
          ))}
        </div>
      )}

      {pendingName && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-ui bg-surface p-6">
            <h2 className="mb-2 text-lg font-semibold text-slate-900">
              Възстановяване от {pendingName}
            </h2>
            <p className="mb-4 text-sm text-red-600">
              Това ще замести текущата база данни. Всичко създадено след {pendingName} ще бъде
              изгубено.
            </p>
            <label className="mb-1 block text-sm text-slate-700">
              Въведете точно <span className="font-mono font-semibold">{pendingName}</span> за
              потвърждение:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mb-4 w-full rounded-ui border border-slate-300 px-3 py-2 font-mono text-sm"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingName(null)}
                className="rounded-ui border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Отказ
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={confirmText !== pendingName || requesting}
                className="rounded-ui bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {requesting ? 'Изпращане...' : 'Възстанови сега'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
