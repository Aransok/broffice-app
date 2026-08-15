import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCategoryTree } from '../../api/categories'

export function CategoriesMegaMenu() {
  const [open, setOpen] = useState(false)
  const [activeRootId, setActiveRootId] = useState<string | null>(null)
  const { data: tree } = useCategoryTree()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const activeRoot = tree?.find((root) => root.id === activeRootId) ?? tree?.[0]

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value)
          if (!activeRootId && tree?.[0]) setActiveRootId(tree[0].id)
        }}
        className="flex items-center gap-3 rounded-ui bg-primary px-6 py-4 text-lg font-semibold text-white"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
        Категории
      </button>

      {tree && tree.length > 0 && (
        <div
          className={
            open
              ? 'absolute left-0 top-full z-20 mt-1 flex max-h-[80vh] w-[min(96vw,1300px)] translate-y-0 border border-slate-200 bg-surface opacity-100 shadow-xl transition-[opacity,transform] duration-200 ease-out'
              : 'pointer-events-none absolute left-0 top-full z-20 mt-1 flex max-h-[80vh] w-[min(96vw,1300px)] -translate-y-1 border border-slate-200 bg-surface opacity-0 shadow-xl transition-[opacity,transform] duration-150 ease-in'
          }
        >
          {/* Sizing/weight/color below checked against the real site's own
              CSS (officecenter-bg.com's .department-nav-menu .nav-link /
              .submenu-heading / .department-submenu ul li a rules) rather
              than guessed — the first version used much larger, uniformly
              bold/colored text with no hierarchy between root categories,
              group headings, and leaf links. */}
          <ul className="w-80 shrink-0 divide-y divide-slate-100 overflow-y-auto border-r border-slate-100">
            {tree.map((root) => (
              <li key={root.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveRootId(root.id)}
                  onClick={() => setActiveRootId(root.id)}
                  className={
                    root.id === activeRoot?.id
                      ? 'w-full border-l-2 border-primary bg-primary/5 px-7 py-3.25 text-left text-sm font-medium text-primary transition-colors duration-200'
                      : 'w-full border-l-2 border-transparent px-7 py-3.25 text-left text-sm font-medium text-slate-600 transition-colors duration-200 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                  }
                >
                  {root.name}
                </button>
              </li>
            ))}
          </ul>

          {/* `key` forces a remount whenever the active root changes, so the
              staggered fade-in below replays every time (not just on first
              open) — mirrors the live site's own department-submenu
              transition-delay stagger (checked in their CSS), just as a real
              @keyframes animation since ours swaps content instead of only
              revealing an already-mounted panel. */}
          <div key={activeRoot?.id} className="flex-1 overflow-y-auto p-8">
            {activeRoot && activeRoot.children.length > 0 ? (
              <div className="columns-2 gap-x-5 sm:columns-3">
                {activeRoot.children.map((mid, index) => (
                  <div
                    key={mid.id}
                    className="animate-menu-item-in mb-8 break-inside-avoid"
                    style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
                  >
                    {/* CSS multi-column (not grid) on purpose: with grid, every
                        cell in a row stretches to match its tallest neighbor,
                        so a childless heading (e.g. "Плотерни хартии" next to
                        a 4-item "Етикети") still ended up dragged down with a
                        big blank gap under it even after hiding its own empty
                        <ul>. Columns pack each entry by its own real height
                        instead, so short entries just sit close to the next
                        one rather than stretching to match a taller sibling. */}
                    <Link
                      to={`/category/${mid.slug}`}
                      onClick={() => setOpen(false)}
                      className={
                        mid.children.length > 0
                          ? 'mb-3 block text-base font-semibold text-slate-900 transition-colors duration-200 hover:text-primary'
                          : 'block text-base font-semibold text-slate-900 transition-colors duration-200 hover:text-primary'
                      }
                    >
                      {mid.name}
                    </Link>
                    {mid.children.length > 0 && (
                      <ul className="flex flex-col">
                        {mid.children.map((leaf) => (
                          <li key={leaf.id}>
                            <Link
                              to={`/category/${leaf.slug}`}
                              onClick={() => setOpen(false)}
                              className="block py-2.5 text-sm font-medium text-slate-700 transition-all duration-200 hover:translate-x-1 hover:text-primary"
                            >
                              {leaf.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              activeRoot && (
                <Link
                  to={`/category/${activeRoot.slug}`}
                  onClick={() => setOpen(false)}
                  className="text-lg font-medium text-primary transition-colors duration-200 hover:underline"
                >
                  Разгледай {activeRoot.name}
                </Link>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
