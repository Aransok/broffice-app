import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'

export type ColorMode = 'light' | 'dark'
export type DesignPreset = 'classic' | 'modern' | 'compact' | 'premium' | 'soft' | 'brand'

export const PRESET_OPTIONS: { value: DesignPreset; label: string }[] = [
  { value: 'classic', label: 'Clean Business' },
  { value: 'modern', label: 'Modern Commerce' },
  { value: 'compact', label: 'Compact Professional' },
  { value: 'premium', label: 'Premium' },
  { value: 'soft', label: 'Soft / Friendly' },
  { value: 'brand', label: 'BRoffice (фирмени цветове)' },
]

const MODE_KEY = 'broffice.colorMode'
const PRESET_KEY = 'broffice.designPreset'

function readStoredMode(): ColorMode | null {
  const stored = localStorage.getItem(MODE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : null
}

function readStoredPreset(): DesignPreset {
  const stored = localStorage.getItem(PRESET_KEY)
  return PRESET_OPTIONS.some((p) => p.value === stored) ? (stored as DesignPreset) : 'classic'
}

interface ThemeContextValue {
  mode: ColorMode
  setMode: (mode: ColorMode) => void
  preset: DesignPreset
  setPreset: (preset: DesignPreset) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/** Two independent axes — `mode` (light/dark) and `preset` (5 visual
 * designs) — applied as data-attributes on <html> and consumed entirely
 * through index.css's centralized tokens (see the big comment there).
 * Neither axis touches routes, data, cart/checkout/admin logic, or any
 * component's structure — purely CSS. Both persist in localStorage;
 * `mode` falls back to the OS preference only on a visitor's first-ever
 * visit (no stored choice yet), never overriding an explicit pick. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ColorMode>(() => {
    const stored = readStoredMode()
    if (stored) return stored
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [preset, setPresetState] = useState<DesignPreset>(readStoredPreset)

  useEffect(() => {
    document.documentElement.setAttribute('data-mode', mode)
  }, [mode])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', preset)
  }, [preset])

  function setMode(next: ColorMode) {
    setModeState(next)
    localStorage.setItem(MODE_KEY, next)
  }

  function setPreset(next: DesignPreset) {
    setPresetState(next)
    localStorage.setItem(PRESET_KEY, next)
  }

  return (
    <ThemeContext.Provider value={{ mode, setMode, preset, setPreset }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
