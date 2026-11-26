import { createContext, type ReactNode, useContext, useMemo, useState } from 'react'
import { usePublicConfig } from '../api/config'

const STORAGE_KEY = 'broffice.showInclVat'

/** Prices are always shown both without and with VAT (<DualPrice>), so
 * there is no display switch. The only choice left is at checkout: whether
 * the order is placed with or without VAT (`showInclVat`, sent as the
 * order's prices_include_vat, exactly as the old header switch did). */
interface VatContextValue {
  /** Checkout: order with VAT (true) or without (false). */
  showInclVat: boolean
  setShowInclVat: (value: boolean) => void
  vatRatePercent: number
  /** A base price (as stored/quoted server-side) with VAT. The single place
   * this math happens, so every view stays consistent. */
  inclVatPrice: (base: string | null | undefined) => string | null
  /** The same base price without VAT. */
  exclVatPrice: (base: string | null | undefined) => string | null
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

  const { inclVatPrice, exclVatPrice } = useMemo(() => {
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
      inclVatPrice: (base: string | null | undefined) => convert(base, true),
      exclVatPrice: (base: string | null | undefined) => convert(base, false),
    }
  }, [baseIncludesVat, vatRatePercent])

  return (
    <VatContext.Provider
      value={{
        showInclVat,
        setShowInclVat,
        vatRatePercent,
        inclVatPrice,
        exclVatPrice,
      }}
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
