import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import {
  type FeatureOverrides,
  fetchLiveDesign,
  setDesignFeatures,
  setLiveDesign,
} from '../api/design'

export type ColorMode = 'light' | 'dark'
export type DesignPreset =
  'classic' | 'modern' | 'compact' | 'premium' | 'soft' | 'brand' | 'fresh' | 'bold' | 'paper'

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
    value: 'paper',
    label: 'BRoffice Paper',
    description:
      'Светъл, списанен стил: много въздух, едри серифни заглавия, снимките водят, тънки линии и пастелен акцент. Спокоен и скъп.',
    swatch: ['#fbfaf7', '#ffffff', '#1a1a1a', '#7a9e7e'],
    radius: 6,
  },
  {
    value: 'bold',
    label: 'BRoffice Bold',
    description:
      'Пълен редизайн: тъмна лента, едри заглавия, живи цветове, категории в мозайка, бърза поръчка с преглед на продукта и лента за телефон.',
    swatch: ['#f4f1ea', '#ffffff', '#0a1628', '#ff6b1f'],
    radius: 18,
  },
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

/** Optional storefront blocks the owner can switch on/off per design
 * (admin "Дизайн"). Every switch exists on every design (except the few
 * that only make sense inside one design's layout, see `designs`);
 * `defaultOn` lists the designs where it starts switched on, which keeps
 * each design looking exactly as designed until the owner changes it.
 * Keys match STOREFRONT_FEATURE_KEYS in backend/core/models.py. */
export interface FeatureOption {
  key: string
  label: string
  description: string
  /** Designs that can show it at all. Default: all. */
  designs?: DesignPreset[]
  /** Designs where it's on until the owner flips it. */
  defaultOn: DesignPreset[]
}

const ALL_DESIGNS: DesignPreset[] = [
  'classic',
  'modern',
  'compact',
  'premium',
  'soft',
  'brand',
  'fresh',
  'bold',
  'paper',
]

export const FEATURES: FeatureOption[] = [
  {
    key: 'banner_carousel',
    label: 'Банери с промоции',
    description: 'Автоматичните банери от активните промоции на началната страница.',
    defaultOn: ALL_DESIGNS,
  },
  {
    key: 'quick_order',
    label: 'Бърза поръчка',
    description: 'Поле за номера и количества с преглед на продукта преди добавяне.',
    defaultOn: ['fresh', 'bold', 'paper'],
  },
  {
    key: 'instant_search',
    label: 'Търсене на живо',
    description: 'Резултати със снимка и цена под търсачката, докато пишеш.',
    defaultOn: ['bold', 'paper'],
  },
  {
    key: 'cart_drawer',
    label: 'Количка отстрани',
    description:
      'Малка количка отстрани, която се отваря от иконата на количката, без да напускаш страницата.',
    defaultOn: ['bold', 'paper'],
  },
  {
    key: 'spotlight',
    label: 'Промоция в заглавието',
    description: 'Една актуална промоция като плаваща карта в голямото заглавие.',
    designs: ['bold'],
    defaultOn: ['bold'],
  },
  {
    key: 'promo_carousel',
    label: 'Лента с промоции',
    description: 'Промоциите на седмицата в хоризонтална лента горе.',
    defaultOn: ['bold', 'paper'],
  },
  {
    key: 'brand_marquee',
    label: 'Лента с марки',
    description: 'Движеща се лента с марките от каталога.',
    defaultOn: ['bold', 'paper'],
  },
  {
    key: 'category_tiles',
    label: 'Плочки с категории',
    description: 'Категориите като големи плочки на началната страница.',
    // Taken out of Bold at the client's request.
    designs: ALL_DESIGNS.filter((d) => d !== 'bold'),
    defaultOn: ['fresh', 'paper'],
  },
  {
    key: 'numbers',
    label: 'Числа',
    description: 'Брой продукти, марки и категории, броящи се нагоре.',
    // Taken out of Bold at the client's request.
    designs: ALL_DESIGNS.filter((d) => d !== 'bold'),
    defaultOn: [],
  },
  {
    key: 'trust_strip',
    label: 'Лента с предимства',
    description: 'Доставка, фактура, цени в € и лв.',
    defaultOn: ['fresh', 'bold', 'paper'],
  },
  {
    key: 'mobile_bar',
    label: 'Долна лента на телефон',
    description: 'Начало, промоции, търсене и количка, залепени долу на телефон.',
    defaultOn: ['bold', 'paper'],
  },
]

export function featuresFor(design: DesignPreset) {
  return FEATURES.filter((f) => !f.designs || f.designs.includes(design))
}

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
  /** The owner's per-design feature overrides. */
  featureOverrides: FeatureOverrides
  /** Whether a feature is on for the design applied in this tab. */
  isEnabled: (key: string) => boolean
  /** Saves one design's feature switches for everyone. Admin only. */
  saveFeatures: (design: DesignPreset, features: Record<string, boolean>) => Promise<void>
}

export function resolveFeature(
  overrides: FeatureOverrides,
  design: DesignPreset,
  key: string,
): boolean {
  const option = FEATURES.find((f) => f.key === key)
  if (!option || (option.designs && !option.designs.includes(design))) return false
  const value = overrides[design]?.[key]
  return value ?? option.defaultOn.includes(design)
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
  const [featureOverrides, setFeatureOverrides] = useState<FeatureOverrides>({})
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
      .then(({ design, features }) => {
        if (cancelled) return
        if (isPreset(design)) applyLive(design)
        setFeatureOverrides(features ?? {})
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
    // Each design loads only its own fonts (free, Google Fonts, Cyrillic),
    // so the other designs pay nothing for them.
    const fonts: Partial<Record<DesignPreset, string>> = {
      fresh: 'Onest:wght@400;500;600;700;800',
      bold: 'Manrope:wght@400;500;600;700;800&family=Unbounded:wght@500;700;800',
      paper: 'Playfair+Display:ital,wght@0,500;0,700;1,500&family=Inter:wght@400;500;600;700',
    }
    const family = fonts[preset]
    const id = `font-${preset}`
    if (family && !document.getElementById(id)) {
      const link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?family=${family}&display=swap`
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

  const isEnabled = useCallback(
    (key: string) => resolveFeature(featureOverrides, preset, key),
    [featureOverrides, preset],
  )

  const saveFeatures = useCallback(
    async (design: DesignPreset, features: Record<string, boolean>) => {
      const saved = await setDesignFeatures(design, features)
      setFeatureOverrides(saved.features ?? {})
    },
    [],
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
        featureOverrides,
        isEnabled,
        saveFeatures,
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
