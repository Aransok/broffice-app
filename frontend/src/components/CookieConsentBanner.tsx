import { useState } from 'react'
import { Link } from 'react-router-dom'
import { type CookieCategories, useCookieConsent } from '../context/CookieConsentContext'

const CATEGORY_LABELS: { key: keyof CookieCategories; label: string; description: string }[] = [
  {
    key: 'functional',
    label: 'Функционални',
    description: 'Запомнят предпочитания като избора за цени с/без ДДС.',
  },
  {
    key: 'analytics',
    label: 'Аналитични',
    description: 'В момента не се използват — категорията е готова за бъдеща употреба.',
  },
  {
    key: 'marketing',
    label: 'Маркетингови',
    description: 'В момента не се използват — категорията е готова за бъдеща употреба.',
  },
]

function PreferencesModal() {
  const { consent, savePreferences, closePreferences } = useCookieConsent()
  const [draft, setDraft] = useState<CookieCategories>(
    consent ?? { functional: false, analytics: false, marketing: false },
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-ui bg-surface p-6 shadow-lg">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Настройки на бисквитките</h2>
        <div className="mb-4 flex flex-col gap-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-slate-900">Необходими</p>
              <p className="text-slate-500">Задължителни за работата на сайта (сесия, CSRF).</p>
            </div>
            <input type="checkbox" checked disabled />
          </div>
          {CATEGORY_LABELS.map((cat) => (
            <div key={cat.key} className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">{cat.label}</p>
                <p className="text-slate-500">{cat.description}</p>
              </div>
              <input
                type="checkbox"
                checked={draft[cat.key]}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, [cat.key]: event.target.checked }))
                }
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={closePreferences}
            className="rounded-ui border border-slate-300 px-4 py-2 text-sm text-slate-700"
          >
            Отказ
          </button>
          <button
            type="button"
            onClick={() => savePreferences(draft)}
            className="rounded-ui bg-primary px-4 py-2 text-sm font-medium text-white"
          >
            Запази
          </button>
        </div>
      </div>
    </div>
  )
}

export function CookieConsentBanner() {
  const { consent, isPreferencesOpen, acceptAll, rejectNonEssential, openPreferences } =
    useCookieConsent()

  if (isPreferencesOpen) return <PreferencesModal />
  if (consent !== null) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-surface p-4 shadow-lg">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-700">
          Използваме бисквитки за нормалната работа на сайта. Вижте{' '}
          <Link to="/cookie-policy" className="text-primary hover:underline">
            Политиката за бисквитки
          </Link>
          .
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openPreferences}
            className="rounded-ui border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
          >
            Настройки
          </button>
          <button
            type="button"
            onClick={rejectNonEssential}
            className="rounded-ui border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
          >
            Само необходими
          </button>
          <button
            type="button"
            onClick={acceptAll}
            className="rounded-ui bg-primary px-3 py-1.5 text-sm font-medium text-white"
          >
            Приеми всички
          </button>
        </div>
      </div>
    </div>
  )
}
