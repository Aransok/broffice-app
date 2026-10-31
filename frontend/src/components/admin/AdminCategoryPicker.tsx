import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { orderedCategoryOptions, useCategories } from '../../api/categories'

/** Lowercase, and Latin look-alikes folded to Cyrillic, so "a4" still finds
 * "А4" whichever keyboard layout the name was typed in. */
function normalize(text: string) {
  const lookalikes: Record<string, string> = {
    a: 'а',
    b: 'в',
    c: 'с',
    e: 'е',
    h: 'н',
    k: 'к',
    m: 'м',
    o: 'о',
    p: 'р',
    t: 'т',
    x: 'х',
    y: 'у',
  }
  return text
    .toLowerCase()
    .replace(/[abcehkmoptxy]/g, (ch) => lookalikes[ch] ?? ch)
    .trim()
}

/**
 * Searchable category picker for the admin promotion forms: type part of a
 * category or subcategory name and the list narrows to matches, each shown
 * with its full path ("Хартия › Копирни хартии"), instead of scrolling a
 * 390-entry dropdown. With nothing typed it lists the whole tree indented,
 * like the old dropdown. Arrow keys and Enter work too.
 */
export function AdminCategoryPicker({
  value,
  onChange,
  placeholder = 'Търси категория или подкатегория...',
}: {
  /** Selected category id, '' for none. */
  value: string
  onChange: (categoryId: string) => void
  placeholder?: string
}) {
  const { data: categories } = useCategories()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const options = useMemo(() => {
    const ordered = orderedCategoryOptions(categories?.results ?? [])
    const byId = new Map(ordered.map(({ category }) => [category.id, category]))
    return ordered.map(({ category, depth }) => {
      const names = [category.name]
      let parent = category.parent ? byId.get(category.parent) : undefined
      while (parent) {
        names.unshift(parent.name)
        parent = parent.parent ? byId.get(parent.parent) : undefined
      }
      return {
        category,
        depth,
        path: names.join(' › '),
        haystack: normalize(names.join(' ')),
      }
    })
  }, [categories])

  const selected = options.find((option) => option.category.id === value)
  const needle = normalize(query)
  const words = needle.split(/\s+/).filter(Boolean)
  const visible = words.length
    ? options.filter((option) => words.every((word) => option.haystack.includes(word)))
    : options

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${highlight}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [highlight])

  function choose(categoryId: string) {
    onChange(categoryId)
    setOpen(false)
    setQuery('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setHighlight((h) => Math.min(h + 1, visible.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (event.key === 'Enter') {
      if (open && visible[highlight]) {
        event.preventDefault()
        choose(visible[highlight].category.id)
      }
    } else if (event.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center rounded-ui border border-slate-300 bg-surface focus-within:border-primary">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="ml-3 shrink-0 text-slate-400"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-label="Категория"
          value={open ? query : (selected?.path ?? '')}
          placeholder={selected ? selected.path : placeholder}
          onFocus={() => {
            setOpen(true)
            setHighlight(0)
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setHighlight(0)
          }}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
        {value && (
          <button
            type="button"
            onClick={() => choose('')}
            aria-label="Изчисти категорията"
            className="px-3 text-lg leading-none text-slate-400 hover:text-red-600"
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-ui border border-slate-200 bg-surface py-1 shadow-lg"
        >
          {!categories && <li className="px-3 py-2 text-sm text-slate-500">Зареждане...</li>}
          {categories && visible.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">Няма категория с „{query}“.</li>
          )}
          {visible.map((option, index) => {
            const isSelected = option.category.id === value
            const isTop = option.depth === 0
            return (
              <li
                key={option.category.id}
                data-index={index}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(event) => {
                  event.preventDefault()
                  choose(option.category.id)
                }}
                className={`cursor-pointer px-3 py-1.5 text-sm ${
                  index === highlight ? 'bg-primary/10' : isTop && !words.length ? 'bg-sky-50' : ''
                } ${isSelected ? 'font-semibold text-primary' : 'text-slate-800'}`}
                style={words.length ? undefined : { paddingLeft: `${0.75 + option.depth * 1}rem` }}
              >
                {words.length ? (
                  <>
                    <span className="font-medium">{option.category.name}</span>
                    {option.depth > 0 && (
                      <span className="block text-xs text-slate-500">{option.path}</span>
                    )}
                  </>
                ) : (
                  <span className={isTop ? 'font-semibold' : ''}>
                    {option.depth > 0 ? '— ' : ''}
                    {option.category.name}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
