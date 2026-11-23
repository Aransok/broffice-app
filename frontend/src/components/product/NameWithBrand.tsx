/**
 * Product name with the brand in bold at the start of the same line, as in
 * a shop listing ("**Bic** Химикалка Cristal..."), instead of the brand on a
 * row of its own above the name. Most imported names already start with the
 * brand, so in that case the existing word is bolded rather than repeated.
 */
export function NameWithBrand({ name, brand }: { name: string; brand?: string | null }) {
  const b = brand?.trim()
  if (!b) return <>{name}</>
  if (name.toLowerCase().startsWith(b.toLowerCase())) {
    return (
      <>
        <b className="font-bold">{name.slice(0, b.length)}</b>
        {name.slice(b.length)}
      </>
    )
  }
  return (
    <>
      <b className="font-bold">{b}</b> {name}
    </>
  )
}
