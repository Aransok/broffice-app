import { Link } from 'react-router-dom'
import { useBrands } from '../../api/brands'
import { useCategoryTree } from '../../api/categories'
import { usePublicConfig } from '../../api/config'
import { useAuth } from '../../context/AuthContext'
import { QuickOrderBox } from './QuickOrderBox'

/** Top of the home page in the "BRoffice Bold" design: an ink-navy hero
 * with drifting color blobs and an oversized headline, the live quick
 * order next to it, a brand marquee, a bento grid of categories and a
 * trust strip. Only rendered when that design is active (see HomePage). */
export function BoldHomeIntro() {
  return (
    <div className="mb-14 flex flex-col gap-12">
      <section className="grid gap-5 lg:grid-cols-12">
        <Hero />
        <QuickOrderCard />
      </section>
      <BrandMarquee />
      <BentoCategories />
      <TrustStrip />
    </div>
  )
}

function Hero() {
  const { user } = useAuth()
  return (
    <div className="bold-rise relative isolate flex min-h-[420px] flex-col justify-between gap-8 overflow-hidden rounded-[28px] bg-[#0a1628] p-7 text-white sm:p-10 lg:col-span-7">
      <div
        aria-hidden="true"
        className="bold-blob absolute -left-20 -top-24 -z-10 h-80 w-80 rounded-full bg-[#2f5fd6] opacity-70"
      />
      <div
        aria-hidden="true"
        className="bold-blob absolute -bottom-32 right-0 -z-10 h-96 w-96 rounded-full bg-[#ff6b1f] opacity-50"
        style={{ animationDelay: '-6s' }}
      />
      <div
        aria-hidden="true"
        className="bold-blob absolute right-1/4 top-1/3 -z-10 h-56 w-56 rounded-full bg-[#14b8a6] opacity-40"
        style={{ animationDelay: '-10s' }}
      />
      <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-white/70">
        <span className="h-2 w-2 rounded-full bg-[#ff6b1f]" />
        Офис консумативи · доставка в цяла България
      </div>
      <div className="flex flex-col gap-5">
        <h1 className="display text-[2.6rem] leading-[0.95] sm:text-6xl lg:text-7xl">
          Офисът.
          <br />
          <span className="text-[#ff6b1f]">Зареден.</span>
        </h1>
        <p className="max-w-lg text-base leading-relaxed text-white/75 sm:text-lg">
          Хартия, тонери, канцеларски материали и техника на фирмени цени. Търси по номер, име или
          марка и поръчай за минута.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          to="/promotions"
          className="rounded-full bg-[#ff6b1f] px-6 py-3.5 font-extrabold text-[#0a1628] transition hover:brightness-105"
        >
          Промоции
        </Link>
        <Link
          to={user ? '/account/orders' : '/register'}
          className="rounded-full border border-white/30 px-6 py-3.5 font-bold text-white transition hover:bg-white/10"
        >
          {user ? 'Моите поръчки' : 'Фирмен акаунт'}
        </Link>
      </div>
    </div>
  )
}

function QuickOrderCard() {
  return (
    <div
      className="bold-rise flex flex-col gap-4 rounded-[28px] border-[1.5px] border-[#0a1628] bg-surface p-6 shadow-[6px_6px_0_#0a1628] sm:p-7 lg:col-span-5"
      style={{ animationDelay: '120ms' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="display text-xl text-slate-900">Бърза поръчка</h2>
          <p className="mt-1 text-sm text-slate-500">
            Номер и количество на ред. Продуктът се показва веднага, преди да го добавиш.
          </p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#ff6b1f] text-[#0a1628]">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            aria-hidden="true"
          >
            <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
          </svg>
        </span>
      </div>
      <QuickOrderBox />
    </div>
  )
}

function BrandMarquee() {
  const { data } = useBrands()
  const brands = (data?.results ?? []).filter((b) => b.name).slice(0, 24)
  if (brands.length < 4) return null
  const row = [...brands, ...brands]
  return (
    <section
      aria-label="Марки"
      className="relative -mx-4 overflow-hidden border-y border-[#0a1628]/15 py-3"
    >
      <div className="bold-marquee flex w-max gap-10 whitespace-nowrap px-4">
        {row.map((brand, index) => (
          <span
            key={`${brand.id}-${index}`}
            className="display text-sm uppercase tracking-[0.18em] text-slate-500"
          >
            {brand.name}
          </span>
        ))}
      </div>
    </section>
  )
}

const TINTS = [
  '#dbe7ff',
  '#ffe1cc',
  '#d8f3e6',
  '#ece2ff',
  '#fff0b8',
  '#d9f0f7',
  '#f3e3d6',
  '#e4e9f2',
]

function categoryIcon(name: string) {
  const n = name.toLowerCase()
  if (/хартия|тетрад|бележ|плик/.test(n)) return 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7'
  if (/тонер|мастил|консуматив|принтер/.test(n)) return 'M6 9V3h12v6M6 17H4v-7h16v7h-2M7 14h10v7H7z'
  if (/пиш|химикал|маркер|молив|канцел/.test(n)) return 'M16 3l5 5L9 20H4v-5zM14 5l5 5'
  if (/класьор|папк|архив|организ/.test(n)) return 'M3 6h6l2 2h10v12H3zM3 10h18'
  if (/техник|калкул|електр|компют/.test(n)) return 'M3 5h18v11H3zM8 20h8M12 16v4'
  if (/мебел|стол|бюр/.test(n)) return 'M5 11h14v4H5zM7 15v6M17 15v6M7 11V5h10v6'
  if (/почист|хигиен|кухн|домак/.test(n)) return 'M8 3h8l-1 5H9zM7 8h10l1 13H6z'
  return 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10'
}

function BentoCategories() {
  const { data: tree } = useCategoryTree()
  const top = (tree ?? []).slice(0, 7)
  if (top.length === 0) return null
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="home-section-title text-slate-900">Категории</h2>
        <Link
          to="/catalog"
          className="text-sm font-bold text-slate-900 underline underline-offset-4"
        >
          Всички категории
        </Link>
      </div>
      <div className="grid auto-rows-[150px] grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {top.map((category, index) => {
          const big = index === 0
          return (
            <Link
              key={category.id}
              to={`/category/${category.slug}`}
              className={`bold-tile bold-rise group relative flex flex-col justify-between overflow-hidden rounded-[22px] border-[1.5px] border-[#0a1628] p-4 text-[#0a1628] ${
                big ? 'col-span-2 row-span-2' : ''
              }`}
              style={{
                background: TINTS[index % TINTS.length],
                animationDelay: `${index * 60}ms`,
              }}
            >
              <svg
                className={`absolute -bottom-4 -right-4 opacity-20 transition-transform duration-500 group-hover:scale-110 group-hover:opacity-30 ${
                  big ? 'h-56 w-56' : 'h-28 w-28'
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                aria-hidden="true"
              >
                <path d={categoryIcon(category.name)} />
              </svg>
              {big && (
                <span className="self-start rounded-full bg-[#0a1628] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                  Най-търсено
                </span>
              )}
              <span className="relative">
                <b
                  className={`display block leading-tight ${big ? 'text-2xl sm:text-3xl' : 'text-base'}`}
                >
                  {category.name}
                </b>
                {category.children.length > 0 && (
                  <span className="mt-1 block text-xs font-semibold text-[#0a1628]/60">
                    {category.children.length} подкатегории
                  </span>
                )}
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

function TrustStrip() {
  const { data: config } = usePublicConfig()
  const items = [
    { k: 'Доставка', v: 'Speedy, Pigeon Express или наш транспорт' },
    { k: 'Фактура', v: 'За всяка фирмена поръчка, с ЕИК и ДДС' },
    { k: 'Цени', v: 'В € и лв, с или без ДДС' },
    { k: 'Поръчки', v: config?.company_phone || 'по телефон и онлайн' },
  ]
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.k}
          className="flex flex-col gap-1 rounded-[18px] border-[1.5px] border-[#0a1628]/15 bg-surface px-4 py-3.5"
        >
          <span className="display text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {item.k}
          </span>
          <span className="text-sm font-semibold text-slate-900">{item.v}</span>
        </div>
      ))}
    </section>
  )
}
