import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useCategoryTree } from '../../api/categories'
import type { CategoryTreeNode } from '../../api/categories'

// Layout copied from officecenter-bg.com's own department menu CSS
// (.department-nav-menu / .megamenu / .department-submenu): a 250px list
// with a 28px icon, 13px row padding, hairline dividers and a chevron that
// turns to point right on hover, plus a 990px (870px below 1400px) panel
// beside it with a 3-column grid of 16px headings and 14px links.

/** Lucide-style icons standing in for Office Center's Font Awesome ones,
 * keyed by category external_id (= Office Center's category id). */
const ICON_PATHS: Record<string, ReactNode> = {
  // Канцеларски материали (pen-to-square)
  '1': (
    <>
      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
    </>
  ),
  // Хартия и продукти от хартия (note-sticky)
  '232': (
    <>
      <path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z" />
      <path d="M15 3v6h6" />
    </>
  ),
  // Компютри и периферия (computer)
  '635': (
    <>
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  // Консумативи за принтери (file-circle-plus)
  '189': (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M9 15h6M12 18v-6" />
    </>
  ),
  // Мебели (couch)
  '323': (
    <>
      <path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3" />
      <path d="M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z" />
      <path d="M4 18v2M20 18v2" />
    </>
  ),
  // Опаковъчни материали (box-taped)
  '369': (
    <>
      <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
      <path d="M12 22V12" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="m7.5 4.27 9 5.15" />
    </>
  ),
  // Принтери, скенери и МФУ (print)
  '278': (
    <>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </>
  ),
  // Техника (hard-drive)
  '245': (
    <>
      <path d="M22 12H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      <path d="M6 16h.01M10 16h.01" />
    </>
  ),
  // Ученически и детски стоки (children)
  '77': (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  // Хигиена и козметика (pump-soap)
  '395': (
    <>
      <path d="M3 3h.01M7 5h.01M11 7h.01M3 7h.01M7 9h.01M3 11h.01" />
      <rect width="4" height="4" x="15" y="5" />
      <path d="m19 9 2 2v10c0 .6-.4 1-1 1h-6c-.6 0-1-.4-1-1V11l2-2" />
      <path d="m13 14 8-2M13 19l8-2" />
    </>
  ),
  // Роботи (robot)
  '711': (
    <>
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
    </>
  ),
  // Други (arrow-right-long)
  '645': <path d="M5 12h14M12 5l7 7-7 7" />,
}

const FALLBACK_ICON = (
  <>
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </>
)

const PROMO_ICON = (
  <>
    <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
    <path d="m15 9-6 6M9 9h.01M15 15h.01" />
  </>
)

function MenuIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mr-3.5 shrink-0"
    >
      {children}
    </svg>
  )
}

function Chevron({ active }: { active: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={
        active
          ? 'ml-2 shrink-0 text-primary transition-transform duration-300 max-lg:rotate-180 lg:-rotate-90'
          : 'ml-2 shrink-0 text-[#c5c5c5] transition-transform duration-300'
      }
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

const ROW_CLASS =
  'flex w-full items-center border-b border-[#f3f3f3] py-[13px] text-left text-sm transition-colors duration-300'

function isDesktop() {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
}

function SubmenuGrid({ root, onNavigate }: { root: CategoryTreeNode; onNavigate: () => void }) {
  if (root.children.length === 0) {
    return (
      <Link
        to={`/category/${root.slug}`}
        onClick={onNavigate}
        className="text-sm font-medium text-slate-500 transition-colors duration-300 hover:text-primary"
      >
        Разгледай {root.name}
      </Link>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-x-5 sm:grid-cols-2 lg:grid-cols-3">
      {root.children.map((heading, index) => (
        <div
          key={heading.id}
          className="animate-menu-item-in mb-5 lg:mb-[30px]"
          style={{ animationDelay: `${(index % 3) * 100}ms` }}
        >
          <Link
            to={`/category/${heading.slug}`}
            onClick={onNavigate}
            className="mb-3 block text-base font-semibold text-black transition-colors duration-300 hover:text-primary"
          >
            {heading.name}
          </Link>
          {heading.children.length > 0 && (
            <ul>
              {heading.children.map((leaf) => (
                <li key={leaf.id}>
                  <Link
                    to={`/category/${leaf.slug}`}
                    onClick={onNavigate}
                    className="block py-2.5 text-sm font-medium text-slate-500 transition-colors duration-300 hover:text-primary"
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
  )
}

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

  function close() {
    setOpen(false)
    setActiveRootId(null)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value)
          setActiveRootId(null)
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
        <ul
          onMouseLeave={() => {
            if (isDesktop()) setActiveRootId(null)
          }}
          className={
            open
              ? 'absolute left-0 top-full z-30 mt-1 w-[min(92vw,360px)] border border-[#f3f3f3] bg-white py-1.5 opacity-100 shadow-[0_0_40px_rgba(0,0,0,0.1)] transition-opacity duration-300 max-lg:max-h-[75vh] max-lg:overflow-y-auto lg:w-[250px]'
              : 'pointer-events-none invisible absolute left-0 top-full z-30 mt-1 w-[min(92vw,360px)] border border-[#f3f3f3] bg-white py-1.5 opacity-0 shadow-[0_0_40px_rgba(0,0,0,0.1)] transition-opacity duration-300 lg:w-[250px]'
          }
        >
          <li className="px-[30px]" onMouseEnter={() => setActiveRootId(null)}>
            <Link
              to="/promotions"
              onClick={close}
              className={`${ROW_CLASS} font-bold text-[#999] hover:text-slate-900`}
            >
              <MenuIcon>{PROMO_ICON}</MenuIcon>
              <span className="flex-1">Промоции</span>
            </Link>
          </li>
          {tree.map((root, index) => {
            const active = root.id === activeRootId
            const last = index === tree.length - 1
            return (
              <li
                key={root.id}
                className="px-[30px]"
                onMouseEnter={() => {
                  if (isDesktop()) setActiveRootId(root.id)
                }}
              >
                <Link
                  to={`/category/${root.slug}`}
                  aria-expanded={active}
                  onClick={(event) => {
                    // Phones/tablets have no hover: first tap opens the
                    // subcategories underneath, the heading links go on.
                    if (!isDesktop()) {
                      event.preventDefault()
                      setActiveRootId(active ? null : root.id)
                      return
                    }
                    close()
                  }}
                  className={`${ROW_CLASS} ${last && !active ? 'border-b-0' : ''} ${
                    active
                      ? 'font-medium text-slate-900'
                      : 'font-medium text-[#999] hover:text-slate-900'
                  }`}
                >
                  <MenuIcon>{ICON_PATHS[root.external_id] ?? FALLBACK_ICON}</MenuIcon>
                  <span className="flex-1">{root.name}</span>
                  <Chevron active={active} />
                </Link>

                {active && (
                  <>
                    <div className="border-b border-[#f3f3f3] pt-4 lg:hidden">
                      <SubmenuGrid root={root} onNavigate={close} />
                    </div>
                    <div
                      key={root.id}
                      className="animate-menu-item-in absolute left-full top-0 ml-px hidden max-h-[80vh] min-h-full w-[870px] overflow-y-auto rounded-br-3xl bg-white p-[60px] pb-[30px] shadow-[5px_5px_15px_20px_rgba(36,41,47,0.1)] lg:block 2xl:w-[990px]"
                    >
                      <SubmenuGrid root={root} onNavigate={close} />
                    </div>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
