import { type FormEvent, type ReactNode, useState } from 'react'
import type { BrandFacet } from '../../api/products'
import { BGN_PER_EUR } from '../../utils/currency'
import { PriceRangeSlider } from '../PriceRangeSlider'
import { SORT_OPTIONS } from './sort'

/** Shared by the category page and the search page: the sort dropdown and
 * the sidebar filters (brand, price), plus page buttons. Both pages keep
 * their filters in the URL (?sort=&min=&max=&brand=&page=). */

// Static bounds for the slider track, in EUR (what the inputs collect) — a
// convenience on top of the manual inputs (which accept any value,
// including outside this range).
const PRICE_BOUNDS: [number, number] = [0, Math.round(5000 / BGN_PER_EUR)]

/** Brands shown before "Покажи всички". */
const BRANDS_COLLAPSED = 8

export function FilterSection({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mb-6">
      <h2 className="mb-5 flex items-baseline justify-between border-b-2 border-slate-200 pb-2.5 text-lg font-medium text-slate-900">
        {title}
        {action}
      </h2>
      {children}
    </div>
  )
}

export function SortSelect({
  value,
  onChange,
  defaultLabel,
}: {
  value: string
  onChange: (value: string) => void
  /** Label for "default" (e.g. "Най-подходящи" on search). */
  defaultLabel?: string
}) {
  return (
    <label className="text-sm text-slate-700">
      Подреди по
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="ml-2 rounded-ui border border-slate-300 px-2 py-1.5"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.value === 'default' && defaultLabel ? defaultLabel : option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function BrandFilter({
  facets,
  selected,
  onToggle,
  onClear,
}: {
  facets: BrandFacet[]
  selected: string[]
  onToggle: (slug: string) => void
  onClear: () => void
}) {
  const [showAll, setShowAll] = useState(false)
  const collapsible = facets.length > BRANDS_COLLAPSED + 2
  const visible =
    collapsible && !showAll
      ? // Keep ticked brands visible even when collapsed.
        facets.filter((b, i) => i < BRANDS_COLLAPSED || selected.includes(b.slug))
      : facets

  return (
    <FilterSection
      title="Марка"
      action={
        selected.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-primary hover:underline"
          >
            Изчисти
          </button>
        )
      }
    >
      <ul className="flex flex-col">
        {visible.map((brand) => {
          const checked = selected.includes(brand.slug)
          return (
            <li key={brand.slug}>
              <label className="flex cursor-pointer items-center gap-2.5 py-1.5 text-sm font-medium text-slate-700 hover:text-primary">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(brand.slug)}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                <span className={`flex-1 ${checked ? 'text-primary' : ''}`}>{brand.name}</span>
                <span className="text-xs text-slate-400 tabular-nums">{brand.count}</span>
              </label>
            </li>
          )
        })}
      </ul>
      {collapsible && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-1 text-sm font-medium text-primary hover:underline"
        >
          {showAll ? 'Покажи по-малко' : `Покажи всички (${facets.length})`}
        </button>
      )}
    </FilterSection>
  )
}

/** Price range in EUR. Remount it (key) when the URL's min/max change from
 * outside, so the inputs pick the new values up. */
export function PriceFilter({
  min,
  max,
  onApply,
}: {
  min: string
  max: string
  onApply: (min: string, max: string) => void
}) {
  const [minInput, setMinInput] = useState(min)
  const [maxInput, setMaxInput] = useState(max)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onApply(minInput, maxInput)
  }

  const sliderValue: [number, number] = [
    minInput ? Number(minInput) : PRICE_BOUNDS[0],
    maxInput ? Number(maxInput) : PRICE_BOUNDS[1],
  ]

  return (
    <FilterSection title="Цена">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <label className="text-sm text-slate-700">
            От (€)
            <input
              type="number"
              min={0}
              value={minInput}
              onChange={(event) => setMinInput(event.target.value)}
              className="mt-1 block w-full rounded-ui border border-slate-300 px-2 py-1.5"
            />
          </label>
          <label className="text-sm text-slate-700">
            До (€)
            <input
              type="number"
              min={0}
              value={maxInput}
              onChange={(event) => setMaxInput(event.target.value)}
              className="mt-1 block w-full rounded-ui border border-slate-300 px-2 py-1.5"
            />
          </label>
        </div>
        <div
          className="px-1"
          onMouseUp={() => onApply(minInput, maxInput)}
          onTouchEnd={() => onApply(minInput, maxInput)}
        >
          <PriceRangeSlider
            bounds={PRICE_BOUNDS}
            value={sliderValue}
            onChange={([lo, hi]) => {
              setMinInput(String(lo))
              setMaxInput(String(hi))
            }}
          />
        </div>
        <button
          type="submit"
          className="rounded-ui bg-primary px-3 py-1.5 text-sm font-medium text-white"
        >
          Приложи
        </button>
      </form>
    </FilterSection>
  )
}

export function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number
  totalPages: number
  onPage: (page: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="mt-8 flex flex-wrap justify-center gap-2">
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPage(p)}
          className={
            p === page
              ? 'rounded-ui bg-primary px-3 py-1 text-sm text-white'
              : 'rounded-ui border border-slate-300 px-3 py-1 text-sm text-slate-700'
          }
        >
          {p}
        </button>
      ))}
    </div>
  )
}
