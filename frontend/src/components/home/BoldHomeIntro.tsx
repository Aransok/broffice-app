import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useBrands } from '../../api/brands'
import { useCategoryTree } from '../../api/categories'
import { usePublicConfig } from '../../api/config'
import { getImageUrl } from '../../api/media'
import { getDisplayPrice } from '../../api/pricing'
import { useProducts } from '../../api/products'
import type { ProductListItem } from '../../api/types'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { useVat } from '../../context/VatContext'
import { announceCartAdd } from '../../lib/cartEvents'
import { Aurora } from '../bold/Aurora'
import { CountUp, Reveal, Tilt } from '../bold/motion'
import { ProductCard } from '../product/ProductCard'
import { QuickOrderBox } from './QuickOrderBox'

/** Top of the home page in the "BRoffice Bold" design: an aurora hero
 * with a live promo spotlight, the quick order with product preview, a
 * brand marquee, this week's promotions as a snap carousel, a bento grid
 * of categories, live numbers and a trust strip. Only rendered when that
 * design is active (see HomePage). */
export function BoldHomeIntro() {
  return (
    <div className="mb-14 flex flex-col gap-14">
      <Hero />
      <BrandMarquee />
      <PromoCarousel />
      <BentoCategories />
      <Numbers />
      <TrustStrip />
    </div>
  )
}

function Hero() {
  const { user } = useAuth()
  return (
    <section className="grid gap-5 lg:grid-cols-12">
      <div className="relative isolate flex min-h-[520px] flex-col justify-between gap-10 overflow-hidden rounded-[32px] bg-[#070f1e] p-7 text-white sm:p-10 lg:col-span-7">
        <Aurora />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at 30% 40%, black, transparent 70%)',
          }}
        />
        <div className="relative flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.22em] text-white/70">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff6b1f] opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#ff6b1f]" />
          </span>
          Офис консумативи · доставка в цяла България
        </div>
        <div className="relative flex flex-col gap-6">
          <h1 className="display text-[2.8rem] leading-[0.92] sm:text-6xl lg:text-[5.2rem]">
            <span className="bold-word block" style={{ animationDelay: '0ms' }}>
              Офисът.
            </span>
            <span className="bold-word block text-[#ff6b1f]" style={{ animationDelay: '140ms' }}>
              Зареден.
            </span>
          </h1>
          <p
            className="bold-word max-w-lg text-base leading-relaxed text-white/75 sm:text-lg"
            style={{ animationDelay: '280ms' }}
          >
            Хартия, тонери, канцеларски материали и техника на фирмени цени. Търси по номер, име или
            марка и поръчай за минута.
          </p>
        </div>
        <div
          className="bold-word relative flex flex-wrap gap-3"
          style={{ animationDelay: '400ms' }}
        >
          <Link
            to="/promotions"
            className="bold-shine rounded-full bg-[#ff6b1f] px-6 py-3.5 font-extrabold text-[#0a1628] transition hover:brightness-105"
          >
            Промоции
          </Link>
          <Link
            to={user ? '/account/orders' : '/register'}
            className="rounded-full border border-white/30 bg-white/5 px-6 py-3.5 font-bold text-white backdrop-blur transition hover:bg-white/10"
          >
            {user ? 'Моите поръчки' : 'Фирмен акаунт'}
          </Link>
        </div>
        <Spotlight />
      </div>

      <Reveal delay={120} className="lg:col-span-5">
        <div className="flex h-full flex-col gap-4 rounded-[32px] border-[1.5px] border-[#0a1628] bg-surface p-6 shadow-[6px_6px_0_#0a1628] sm:p-7">
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
      </Reveal>
    </section>
  )
}

/** One real promotion floating in the hero as a tilting glass card. */
function Spotlight() {
  const { data } = useProducts({ on_promotion: true })
  const { displayPrice } = useVat()
  const { addItem } = useCart()
  const imageRef = useRef<HTMLImageElement>(null)
  const product = data?.results.find((p) => p.primary_image) ?? data?.results[0]
  if (!product) return null
  const raw = getDisplayPrice(product)
  const price = displayPrice(raw.currentEur)
  const old = displayPrice(raw.oldEur)
  const image = getImageUrl(product.primary_image ?? '')
  const pct =
    raw.oldEur && raw.currentEur
      ? Math.round((1 - Number(raw.currentEur) / Number(raw.oldEur)) * 100)
      : null
  return (
    <div
      className="bold-word absolute bottom-8 right-8 hidden w-64 lg:block"
      style={{ animationDelay: '500ms' }}
    >
      <Tilt className="bold-float">
        <div className="relative overflow-hidden rounded-[24px] border border-white/20 bg-white/10 p-4 text-white shadow-[0_30px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <span className="absolute left-4 top-4 z-10 rounded-full bg-[#ff6b1f] px-2.5 py-1 text-[11px] font-extrabold text-[#0a1628]">
            {pct ? `−${pct}%` : 'ПРОМО'}
          </span>
          <Link to={`/product/${product.slug}`} className="block">
            <span className="grid aspect-square place-items-center overflow-hidden rounded-2xl bg-white">
              {image ? (
                <img
                  ref={imageRef}
                  src={image}
                  alt={product.name}
                  className="h-full w-full object-contain p-3"
                />
              ) : (
                <span className="text-xs text-slate-400">Промоция</span>
              )}
            </span>
            <span className="mt-3 line-clamp-2 block text-sm font-semibold leading-snug">
              {product.name}
            </span>
          </Link>
          <div className="mt-2 flex items-end justify-between gap-2">
            <span>
              {old && <span className="block text-xs text-white/50 line-through">€{old}</span>}
              <span className="display text-xl text-[#ffb27a]">€{price}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                addItem(product, 1)
                announceCartAdd({ product, quantity: 1, source: imageRef.current })
              }}
              className="rounded-full bg-white px-3.5 py-2 text-xs font-extrabold text-[#0a1628] hover:bg-[#ffb27a]"
            >
              Купи
            </button>
          </div>
        </div>
      </Tilt>
    </div>
  )
}

function BrandMarquee() {
  const { data } = useBrands()
  const brands = (data?.results ?? []).filter((b) => b.name).slice(0, 30)
  if (brands.length < 4) return null
  const row = [...brands, ...brands]
  return (
    <section aria-label="Марки" className="relative -mx-4 overflow-hidden py-2">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[var(--color-paper)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[var(--color-paper)] to-transparent" />
      <div className="bold-marquee flex w-max gap-4 whitespace-nowrap px-4">
        {row.map((brand, index) => (
          <Link
            key={`${brand.id}-${index}`}
            to={`/search?q=${encodeURIComponent(brand.name)}`}
            className="display rounded-full border-[1.5px] border-[#0a1628]/20 bg-surface px-5 py-2 text-xs uppercase tracking-[0.16em] text-slate-700 transition hover:border-[#0a1628] hover:bg-[#0a1628] hover:text-white"
          >
            {brand.name}
          </Link>
        ))}
      </div>
    </section>
  )
}

function PromoCarousel() {
  const { data } = useProducts({ on_promotion: true })
  const products: ProductListItem[] = data?.results.slice(0, 10) ?? []
  if (products.length === 0) return null
  return (
    <Reveal>
      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="display text-[11px] uppercase tracking-[0.2em] text-[#e85a12]">
              Само тази седмица
            </span>
            <h2 className="home-section-title mt-1 text-slate-900">Промоции</h2>
          </div>
          <Link
            to="/promotions"
            className="text-sm font-bold text-slate-900 underline underline-offset-4"
          >
            Всички промоции
          </Link>
        </div>
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {products.map((product, index) => (
            <div
              key={product.id}
              className="w-[72vw] shrink-0 snap-start sm:w-[300px]"
              style={{ transitionDelay: `${index * 40}ms` }}
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </section>
    </Reveal>
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
    <Reveal>
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
                className={`bold-tile group relative flex flex-col justify-between overflow-hidden rounded-[22px] border-[1.5px] border-[#0a1628] p-4 text-[#0a1628] ${
                  big ? 'col-span-2 row-span-2' : ''
                }`}
                style={{ background: TINTS[index % TINTS.length] }}
              >
                <svg
                  className={`absolute -bottom-4 -right-4 opacity-25 transition-transform duration-500 group-hover:scale-110 group-hover:opacity-40 ${
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
                    <span className="mt-1 block text-xs font-semibold text-[#0a1628]/70">
                      {category.children.length} подкатегории
                    </span>
                  )}
                </span>
                <span className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-[#0a1628] text-white opacity-0 transition group-hover:opacity-100">
                  →
                </span>
              </Link>
            )
          })}
        </div>
      </section>
    </Reveal>
  )
}

function Numbers() {
  const { data: products } = useProducts({ page: 1 })
  const { data: brands } = useBrands()
  const { data: tree } = useCategoryTree()
  const items = [
    { n: products?.count ?? 0, label: 'продукта в каталога' },
    { n: brands?.count ?? 0, label: 'марки' },
    { n: tree?.length ?? 0, label: 'категории' },
    { n: 1, label: 'ден до повечето градове', suffix: '-2' },
  ].filter((i) => i.n > 0)
  if (items.length < 3) return null
  return (
    <Reveal>
      <section className="grid grid-cols-2 gap-4 rounded-[28px] bg-[#0a1628] p-6 text-white sm:p-8 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-1">
            <span className="display text-3xl text-[#ffb27a] sm:text-4xl">
              <CountUp value={item.n} suffix={item.suffix ?? ''} />
            </span>
            <span className="text-sm text-white/70">{item.label}</span>
          </div>
        ))}
      </section>
    </Reveal>
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
    <Reveal>
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
    </Reveal>
  )
}
