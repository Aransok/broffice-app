/**
 * Bulgaria's lev has been pegged to the Deutsche Mark/euro at this exact,
 * legally fixed rate since the 1997 currency board arrangement — it does
 * not float and is the same rate set for Bulgaria's actual euro adoption.
 * Safe to hardcode for the same reason the 20% VAT rate is: a public,
 * permanent statutory fact, not a business-specific or market-fluctuating
 * one that would need to come from the client.
 */
export const BGN_PER_EUR = 1.95583

export function bgnToEur(bgn: string): string {
  const value = Number(bgn)
  if (!bgn.trim() || Number.isNaN(value)) return ''
  return (value / BGN_PER_EUR).toFixed(2)
}

export function eurToBgn(eur: string): string {
  const value = Number(eur)
  if (!eur.trim() || Number.isNaN(value)) return ''
  return (value * BGN_PER_EUR).toFixed(2)
}

/** EUR is the only displayed currency sitewide (BGN was officially retired)
 * — storage stays BGN internally, this only formats it for display. Mirrors
 * backend/common/currency.py's format_eur(). */
export function formatEur(bgn: string | number | null | undefined): string {
  if (bgn === null || bgn === undefined) return '-'
  const eur = bgnToEur(String(bgn))
  return eur ? `€${eur}` : '-'
}

/** Client price minus reseller/cost price (both BGN) — the per-unit profit
 * margin. Null if either side is missing (nothing meaningful to subtract). */
export function computeProfitBgn(
  clientBgn: string | number | null | undefined,
  resellerBgn: string | number | null | undefined,
): string | null {
  if (clientBgn === null || clientBgn === undefined) return null
  if (resellerBgn === null || resellerBgn === undefined) return null
  const client = Number(clientBgn)
  const reseller = Number(resellerBgn)
  if (Number.isNaN(client) || Number.isNaN(reseller)) return null
  return (client - reseller).toFixed(2)
}
