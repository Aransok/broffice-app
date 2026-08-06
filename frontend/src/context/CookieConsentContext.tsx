import { createContext, type ReactNode, useContext, useState } from 'react'

const STORAGE_KEY = 'broffice.cookieConsent'

export interface CookieCategories {
  functional: boolean
  analytics: boolean
  marketing: boolean
}

interface StoredConsent extends CookieCategories {
  decided: true
}

interface CookieConsentContextValue {
  consent: CookieCategories | null
  isPreferencesOpen: boolean
  acceptAll: () => void
  rejectNonEssential: () => void
  savePreferences: (categories: CookieCategories) => void
  openPreferences: () => void
  closePreferences: () => void
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null)

function loadStoredConsent(): CookieCategories | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredConsent
    return { functional: parsed.functional, analytics: parsed.analytics, marketing: parsed.marketing }
  } catch {
    return null
  }
}

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<CookieCategories | null>(loadStoredConsent)
  const [isPreferencesOpen, setPreferencesOpen] = useState(false)

  function persist(categories: CookieCategories) {
    setConsent(categories)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...categories, decided: true }))
    setPreferencesOpen(false)
  }

  return (
    <CookieConsentContext.Provider
      value={{
        consent,
        isPreferencesOpen,
        acceptAll: () => persist({ functional: true, analytics: true, marketing: true }),
        rejectNonEssential: () =>
          persist({ functional: false, analytics: false, marketing: false }),
        savePreferences: persist,
        openPreferences: () => setPreferencesOpen(true),
        closePreferences: () => setPreferencesOpen(false),
      }}
    >
      {children}
    </CookieConsentContext.Provider>
  )
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext)
  if (!ctx) throw new Error('useCookieConsent must be used within CookieConsentProvider')
  return ctx
}
