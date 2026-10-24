import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { presetLabel, useTheme } from '../context/ThemeContext'

/** Lets ThemeProvider apply a design preview only once the viewer is a
 * confirmed admin. Sits inside AuthProvider; renders nothing. */
export function DesignPreviewGate() {
  const { user, isLoading } = useAuth()
  const { setPreviewAllowed } = useTheme()
  useEffect(() => {
    if (isLoading) return
    setPreviewAllowed(Boolean(user?.is_admin_portal))
  }, [isLoading, user?.is_admin_portal, setPreviewAllowed])
  return null
}

/** Shown across the top of the shop while an admin previews a design that
 * isn't live yet. Only this tab sees it; clients keep the live design. */
export function DesignPreviewBanner() {
  const { previewDesign, liveDesign, exitDesignPreview, makeDesignLive } = useTheme()
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle')

  if (!previewDesign) return null

  async function handleMakeLive() {
    if (!previewDesign) return
    const ok = window.confirm(
      `Да направим ли „${presetLabel(previewDesign)}“ дизайна на сайта за всички клиенти?`,
    )
    if (!ok) return
    setState('saving')
    try {
      await makeDesignLive(previewDesign)
      setState('idle')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="sticky top-0 z-50 bg-slate-900 text-white" role="status">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm">
        <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-slate-900">
          ПРЕГЛЕД
        </span>
        <p className="min-w-0 flex-1">
          <span className="font-semibold">„{presetLabel(previewDesign)}“</span>
          <span className="hidden md:inline">
            {' '}
            Виждате го само вие, в този раздел. Клиентите виждат „{presetLabel(liveDesign)}“.
          </span>
          <span className="md:hidden"> · само за вас</span>
          {state === 'error' && (
            <span className="ml-2 font-semibold text-amber-300">
              Не успяхме да запазим. Опитайте пак.
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={handleMakeLive}
          disabled={state === 'saving'}
          className="rounded-ui bg-amber-400 px-3 py-1 font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-60"
        >
          {state === 'saving' ? 'Запазване…' : 'Направи го активен'}
        </button>
        <button
          type="button"
          onClick={exitDesignPreview}
          className="rounded-ui border border-white/40 px-3 py-1 font-medium hover:bg-white/10"
        >
          Изход от прегледа
        </button>
      </div>
    </div>
  )
}
