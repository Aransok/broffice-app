import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useBrands } from '../../api/brands'
import { usePublicConfig } from '../../api/config'
import { getImageUrl } from '../../api/media'
import { getDisplayPrice } from '../../api/pricing'
import { useProducts } from '../../api/products'
import type { ProductListItem } from '../../api/types'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { useVat } from '../../context/VatContext'
import { announceCartAdd } from '../../lib/cartEvents'
import { useTheme } from '../../context/ThemeContext'
import { Aurora } from '../bold/Aurora'
import { Reveal, Tilt } from '../bold/motion'
import { ProductCard } from '../product/ProductCard'
import { QuickOrderTable } from './QuickOrderTable'

/** Top of the home page in the "BRoffice Bold" design: an aurora hero
 * with a live promo spotlight, the quick order with product preview, a
 * brand marquee, this week's promotions as a snap carousel and a trust
 * strip. (The category tiles and the numbers band were taken out at the
 * client's request; categories live in the Категории menu.) Only rendered when that
 * design is active (see HomePage). */
export function BoldHomeIntro() {
  const { isEnabled } = useTheme()
  return (
    <div className="mb-14 flex flex-col gap-14">
      <Hero />
      {isEnabled('brand_marquee') && <BrandMarquee />}
      {isEnabled('promo_carousel') && <PromoCarousel />}
      {isEnabled('trust_strip') && <TrustStrip />}
    </div>
  )
}

function Hero() {
  const { user } = useAuth()
  const { isEnabled } = useTheme()
  const quickOrder = isEnabled('quick_order')
  return (
    <section className="grid gap-5 lg:grid-cols-12">
      <div
        className={`relative isolate flex min-h-[520px] flex-col justify-between gap-10 overflow-hidden rounded-[32px] bg-[#070f1e] p-7 text-white sm:p-10 ${
          quickOrder ? 'lg:col-span-7' : 'lg:col-span-12'
        }`}
      >
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
        {isEnabled('spotlight') && <Spotlight />}
      </div>

      {quickOrder && (
        <Reveal delay={120} className="lg:col-span-5">
          <div className="flex h-full flex-col gap-4 rounded-[32px] border-[1.5px] border-[#0a1628] bg-surface p-6 shadow-[6px_6px_0_#0a1628] sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="display text-xl text-slate-900">Бърза поръчка</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Номер и брой, като в Excel. Продуктът се показва веднага, преди да го добавиш.
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
            <QuickOrderTable />
          </div>
        </Reveal>
      )}
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
              className="w-[46vw] shrink-0 snap-start sm:w-[210px]"
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
