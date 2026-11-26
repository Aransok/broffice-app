import { createContext, type ReactNode, useContext, useMemo } from 'react'
import { usePublicConfig } from '../api/config'

/** Prices are always shown both without and with VAT (<DualPrice>), and
 * every order is placed with VAT, so there is no switch of any kind. The
 * without-VAT price is for companies, who get the VAT back. */
interface VatContextValue {
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
