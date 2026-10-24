import { useState } from 'react'
import {
  PRESET_OPTIONS,
  type PresetOption,
  presetLabel,
  useTheme,
} from '../../context/ThemeContext'

/** Opens the shop in a new tab with this design. Only that tab, and only
 * for an admin, shows it (see ThemeProvider / DesignPreviewGate). */
function previewHref(value: string) {
  return `/?design_preview=${encodeURIComponent(value)}`
}

/** A tiny drawn storefront in the design's own colors, so the owner can tell
 * the designs apart at a glance before opening a full preview. */
function DesignThumb({ option }: { option: PresetOption }) {
  const [bg, surface, primary, accent] = option.swatch
  const r = Math.min(option.radius, 12)
  const fresh = option.value === 'fresh'
  return (
    <div
      className="aspect-[16/10] overflow-hidden border-b border-slate-200"
      style={{ background: bg }}
      aria-hidden="true"
    >
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: surface }}>
        <span className="h-3 w-10 rounded-sm" style={{ background: primary }} />
        <span
          className="h-4 flex-1"
          style={{ background: bg, border: `1px solid ${primary}33`, borderRadius: r }}
        />
        <span
          className="h-4 w-6"
          style={{ background: fresh ? accent : primary, borderRadius: r / 2 }}
        />
      </div>
      <div className="flex flex-col gap-2 p-3">
        {fresh ? (
          <div className="grid grid-cols-3 gap-1.5">
            <span className="col-span-3 h-9" style={{ background: primary, borderRadius: r }}>
              <span className="m-2 block h-1.5 w-8 rounded-sm" style={{ background: accent }} />
            </span>
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-7" style={{ background: surface, borderRadius: r }} />
            ))}
          </div>
        ) : (
          <span
            className="h-9 opacity-80"
            style={{ background: `${primary}22`, borderRadius: r }}
          />
        )}
        <div className="grid grid-cols-4 gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="flex flex-col gap-1 p-1"
              style={{ background: surface, borderRadius: r }}
            >
              <span className="h-5 rounded-sm" style={{ background: bg }} />
              <span className="h-1.5 w-3/4 rounded-sm" style={{ background: `${primary}55` }} />
              <span
                className="h-2.5"
                style={{ background: fresh ? accent : primary, borderRadius: r / 2 }}
              />
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * "Дизайн": every storefront design the shop can switch to. "Преглед"
 * opens the real shop with that design in a new tab, visible only to this
 * admin. "Направи активен" switches it for every visitor at once, and can
 * be switched back the same way at any time.
 */
export function AdminDesignsPage() {
  const { liveDesign, makeDesignLive } = useTheme()
  const [savingValue, setSavingValue] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleMakeLive(option: PresetOption) {
    const ok = window.confirm(
      `Да направим ли „${option.label}“ дизайна на сайта за всички клиенти? Можете да го върнете по всяко време.`,
    )
    if (!ok) return
    setSavingValue(option.value)
    setError('')
    setMessage('')
    try {
      await makeDesignLive(option.value)
      setMessage(`„${option.label}“ вече е дизайнът на сайта.`)
    } catch {
      setError('Не успяхме да сменим дизайна. Опитайте пак.')
    } finally {
      setSavingValue(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Дизайн на магазина</h1>
        <p className="mt-1 max-w-3xl text-slate-600">
          Натиснете „Преглед“, за да разгледате целия магазин с друг дизайн в нов раздел. Само вие
          го виждате; клиентите продължават да виждат „{presetLabel(liveDesign)}“. Ако ви харесва,
          натиснете „Направи активен“ тук или в лентата на прегледа.
        </p>
      </div>

      {message && (
        <p className="rounded-ui bg-green-100 px-4 py-2 text-green-800" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-ui bg-red-100 px-4 py-2 text-red-800" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {PRESET_OPTIONS.map((option) => {
          const isLive = option.value === liveDesign
          return (
            <article
              key={option.value}
              className={`flex flex-col overflow-hidden rounded-ui border bg-surface ${
                isLive ? 'border-primary ring-2 ring-primary/30' : 'border-slate-200'
              }`}
            >
              <a
                href={previewHref(option.value)}
                target="_blank"
                rel="noopener"
                className="block transition-opacity hover:opacity-90"
                aria-label={`Преглед на „${option.label}“`}
              >
                <DesignThumb option={option} />
              </a>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-slate-900">{option.label}</h2>
                  {isLive && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white">
                      Активен
                    </span>
                  )}
                  {option.value === 'fresh' && !isLive && (
                    <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-slate-900">
                      Нов
                    </span>
                  )}
                </div>
                <p className="flex-1 text-sm text-slate-600">{option.description}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    href={previewHref(option.value)}
                    target="_blank"
                    rel="noopener"
                    className="rounded-ui border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-primary hover:text-primary"
                  >
                    Преглед
                  </a>
                  {!isLive && (
                    <button
                      type="button"
                      onClick={() => handleMakeLive(option)}
                      disabled={savingValue !== null}
                      className="rounded-ui bg-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                    >
                      {savingValue === option.value ? 'Запазване…' : 'Направи активен'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
