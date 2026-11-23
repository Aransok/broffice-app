import { createContext, type ReactNode, useContext, useMemo, useState } from 'react'
import { usePublicConfig } from '../api/config'

const STORAGE_KEY = 'broffice.showInclVat'

interface VatContextValue {
  showInclVat: boolean
  setShowInclVat: (value: boolean) => void
  vatRatePercent: number
  /** Converts a base price (as stored/quoted server-side) to the currently
   * selected display convention (incl. or excl. VAT) — the single place this
   * conversion happens, so every listing/cart/checkout view stays consistent
   * (spec #9) instead of each page doing its own VAT math. */
  displayPrice: (base: string | null | undefined) => string | null
  /** The same base price always converted to incl. VAT, whatever the
   * toggle says. Used for the "с ДДС" line shown under every price while
   * the visitor browses without VAT, so nobody orders thinking the
   * without-VAT number is what they will pay. */
  inclVatPrice: (base: string | null | undefined) => string | null
}

const VatContext = createContext<VatContextValue | null>(null)

export function VatProvider({ children }: { children: ReactNode }) {
  const { data: config } = usePublicConfig()
  const [showInclVat, setShowInclVatState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === null ? false : stored === 'true'
  })

  function setShowInclVat(value: boolean) {
    setShowInclVatState(value)
    localStorage.setItem(STORAGE_KEY, String(value))
  }

  const vatRatePercent = config ? Number(config.vat_rate_percent) : 20
  const baseIncludesVat = config?.prices_include_vat ?? false

  const { displayPrice, inclVatPrice } = useMemo(() => {
    const convert = (base: string | null | undefined, inclVat: boolean) => {
      if (base === null || base === undefined || base === '') return null
      const value = Number(base)
      if (Number.isNaN(value)) return null
      if (inclVat === baseIncludesVat) return value.toFixed(2)
      const rate = vatRatePercent / 100
      const converted = inclVat ? value * (1 + rate) : value / (1 + rate)
      return converted.toFixed(2)
    }
    return {
      displayPrice: (base: string | null | undefined) => convert(base, showInclVat),
      inclVatPrice: (base: string | null | undefined) => convert(base, true),
    }
  }, [showInclVat, baseIncludesVat, vatRatePercent])

  return (
    <VatContext.Provider
      value={{ showInclVat, setShowInclVat, vatRatePercent, displayPrice, inclVatPrice }}
    >
      {children}
    </VatContext.Provider>
  )
}

export function useVat() {
  const ctx = useContext(VatContext)
  if (!ctx) throw new Error('useVat must be used within VatProvider')
  return ctx
}
