import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { fetchLiveDesign, setLiveDesign } from '../api/design'

export type ColorMode = 'light' | 'dark'
export type DesignPreset = 'classic' | 'modern' | 'compact' | 'premium' | 'soft' | 'brand' | 'fresh'

export interface PresetOption {
  value: DesignPreset
  label: string
  description: string
  /** Swatch colors for the admin "Дизайн" cards: background, surface, primary, accent. */
  swatch: [string, string, string, string]
  radius: number
}

export const PRESET_OPTIONS: PresetOption[] = [
  {
    value: 'fresh',
    label: 'BRoffice 2026',
    description:
      'Новият дизайн: голяма търсачка, бърза поръчка по каталожен номер, плочки с категории и по-големи продуктови карти.',
    swatch: ['#f3f5f8', '#ffffff', '#1d3f73', '#f07a32'],
    radius: 16,
  },
  {
    value: 'classic',
    label: 'Clean Business',
    description: 'Сегашният изглед на сайта. Изчистен и познат.',
    swatch: ['#f8fafc', '#ffffff', '#3577f0', '#dc2626'],
    radius: 8,
  },
  {
    value: 'brand',
    label: 'BRoffice (фирмени цветове)',
    description: 'Сегашното оформление с цветовете от логото: синьо и оранжево.',
    swatch: ['#f8fafc', '#ffffff', '#215f9a', '#ef6e35'],
    radius: 8,
  },
  {
    value: 'modern',
    label: 'Modern Commerce',
    description: 'Виолетови акценти, по-заоблени карти и меки сенки.',
    swatch: ['#f5f4fe', '#ffffff', '#6d5ce8', '#dc2626'],
    radius: 14,
  },
  {
    value: 'compact',
    label: 'Compact Professional',
    description: 'По-плътно, повече продукти на екран, остри ъгли.',
    swatch: ['#f4f6f9', '#ffffff', '#2f5fd6', '#dc2626'],
    radius: 4,
  },
  {
    value: 'premium',
    label: 'Premium',
    description: 'Топли неутрални тонове, серифни заглавия, тъмносин акцент.',
    swatch: ['#f8f6f3', '#ffffff', '#1f3a5f', '#dc2626'],
    radius: 2,
  },
  {
    value: 'soft',
    label: 'Soft / Friendly',
    description: 'Топли цветове, много заоблено, тюркоазен акцент.',
    swatch: ['#fdf6ef', '#ffffff', '#14b8a6', '#dc2626'],
    radius: 22,
  },
]

export function presetLabel(value: string) {
  return PRESET_OPTIONS.find((p) => p.value === value)?.label ?? value
}

function isPreset(value: unknown): value is DesignPreset {
  return PRESET_OPTIONS.some((p) => p.value === value)
}

const MODE_KEY = 'broffice.colorMode'
/** Last live design seen, so a returning visitor doesn't flash the default
 * before /design/ answers. */
const LIVE_CACHE_KEY = 'broffice.liveDesign'
/** Admin preview, per browser tab (sessionStorage), like "Преглед като клиента". */
const PREVIEW_KEY = 'broffice.designPreview'
const PREVIEW_PARAM = 'design_preview'

function storageGet(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key)
  } catch {
    return null
  }
}

function storageSet(storage: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) storage().removeItem(key)
    else storage().setItem(key, value)
  } catch {
    // Private mode etc.: the in-memory state still works for this page.
  }
}

const local = () => window.localStorage
const session = () => window.sessionStorage

function readStoredMode(): ColorMode | null {
  const stored = storageGet(local, MODE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : null
}

/** Picks up `?design_preview=<preset>` once on load (the admin "Дизайн" page
 * opens the shop in a new tab with it) and strips it from the address bar. */
function readInitialPreview(): DesignPreset | null {
  const url = new URL(window.location.href)
  const fromUrl = url.searchParams.get(PREVIEW_PARAM)
  if (fromUrl !== null) {
    url.searchParams.delete(PREVIEW_PARAM)
    window.history.replaceState(window.history.state, '', url.toString())
    if (isPreset(fromUrl)) {
      storageSet(session, PREVIEW_KEY, fromUrl)
      return fromUrl
    }
  }
  const stored = storageGet(session, PREVIEW_KEY)
  return isPreset(stored) ? stored : null
}

interface ThemeContextValue {
  mode: ColorMode
  setMode: (mode: ColorMode) => void
  /** The design actually applied in this tab. */
  preset: DesignPreset
  /** The design every visitor gets. */
  liveDesign: DesignPreset
  /** The design this admin tab is previewing, if any (only once the viewer
   * is confirmed to be an admin). */
  previewDesign: DesignPreset | null
  exitDesignPreview: () => void
  /** Saves `design` as live for everyone. Admin only (the API enforces it). */
  makeDesignLive: (design: DesignPreset) => Promise<void>
  /** Called by DesignPreviewGate once auth is known. */
  setPreviewAllowed: (allowed: boolean) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/** Two independent axes, `mode` (light/dark, the visitor's own choice) and
 * `preset` (the site design), applied as data-attributes on <html> and
 * consumed through index.css's centralized tokens.
 *
 * The design is no longer each visitor's pick: the owner chooses it in the
 * admin panel ("Дизайн") and it comes from /design/. An admin can preview
 * any design in a single tab before making it live; nobody else ever sees a
 * preview, because it only applies after DesignPreviewGate confirms the
 * viewer is an admin. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ColorMode>(() => {
    const stored = readStoredMode()
    if (stored) return stored
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [liveDesign, setLiveDesignState] = useState<DesignPreset>(() => {
    const cached = storageGet(local, LIVE_CACHE_KEY)
    return isPreset(cached) ? cached : 'classic'
  })
  const [requestedPreview, setRequestedPreview] = useState<DesignPreset | null>(readInitialPreview)
  const [previewAllowed, setPreviewAllowed] = useState(false)

  const previewDesign = previewAllowed ? requestedPreview : null
  const preset = previewDesign ?? liveDesign

  const applyLive = useCallback((design: DesignPreset) => {
    setLiveDesignState(design)
    storageSet(local, LIVE_CACHE_KEY, design)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchLiveDesign()
      .then((design) => {
        if (!cancelled && isPreset(design)) applyLive(design)
      })
      .catch(() => {
        // Keep the cached/default design; the shop still works.
      })
    return () => {
      cancelled = true
    }
  }, [applyLive])

  useEffect(() => {
    document.documentElement.setAttribute('data-mode', mode)
  }, [mode])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', preset)
    // The 2026 design uses Onest (free, Google Fonts, Cyrillic). Loaded only
    // when that design is on, so the other designs pay nothing for it.
    if (preset === 'fresh' && !document.getElementById('font-onest')) {
      const link = document.createElement('link')
      link.id = 'font-onest'
      link.rel = 'stylesheet'
      link.href =
        'https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&display=swap'
      document.head.appendChild(link)
    }
  }, [preset])

  function setMode(next: ColorMode) {
    setModeState(next)
    storageSet(local, MODE_KEY, next)
  }

  const exitDesignPreview = useCallback(() => {
    setRequestedPreview(null)
    storageSet(session, PREVIEW_KEY, null)
  }, [])

  const makeDesignLive = useCallback(
    async (design: DesignPreset) => {
      const saved = await setLiveDesign(design)
      if (isPreset(saved.design)) applyLive(saved.design)
      if (requestedPreview === design) exitDesignPreview()
    },
    [applyLive, exitDesignPreview, requestedPreview],
  )

  const allowPreview = useCallback((allowed: boolean) => {
    setPreviewAllowed(allowed)
    // A non-admin who got hold of a preview link never keeps it around.
    if (!allowed) storageSet(session, PREVIEW_KEY, null)
  }, [])

  return (
    <ThemeContext.Provider
      value={{
        mode,
        setMode,
        preset,
        liveDesign,
        previewDesign,
        exitDesignPreview,
        makeDesignLive,
        setPreviewAllowed: allowPreview,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
