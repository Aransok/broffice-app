import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { type BannerEntry, useBanners } from '../../api/banners'
import { getImageUrl } from '../../api/media'

const ROTATE_INTERVAL_MS = 6500

/** Days/hours left on a promotion, or null when it has no end. */
function useCountdown(endsAt: string) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!endsAt) return
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [endsAt])
  if (!endsAt) return null
  const ms = new Date(endsAt).getTime() - now
  if (Number.isNaN(ms) || ms <= 0) return null
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  if (days > 0) return `Още ${days} ${days === 1 ? 'ден' : 'дни'}`
  return `Още ${Math.max(1, hours)} ${hours === 1 ? 'час' : 'часа'}`
}

const PALETTES = [
  ['#0f2140', '#2f5fd6'],
  ['#3a1d0b', '#ff6b1f'],
  ['#0b2e2a', '#14b8a6'],
  ['#2a1248', '#a855f7'],
  ['#3b2a05', '#f59e0b'],
]

/** "€12,34" / "12.34 €" -> 12.34 */
function parseEur(text: string) {
  const n = Number(text.replace(/[^\d.,]/g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

/** The big number on the slide is always a percentage: the promo's own
 * "-20%", or one worked out from old vs new price for flat / cost-plus
 * promotions (which have a price as their label). */
function discountPercent(banner: BannerEntry): string | null {
  if (/%/.test(banner.discount_label)) return banner.discount_label
  const oldPrice = parseEur(banner.old_price)
  const price = parseEur(banner.price)
  if (!oldPrice || !price || price >= oldPrice) return null
  return `-${Math.round((1 - price / oldPrice) * 100)}%`
}

const GROUP_COLUMNS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-2 grid-rows-2',
}

function ProductArt({
  images,
  fallback,
  accent,
  active,
}: {
  images: string[]
  fallback: string | null
  accent: string
  active: boolean
}) {
  const zoom = `transition-transform duration-[6000ms] ease-out ${active ? 'scale-105' : 'scale-100'}`
  const glow = (
    <span
      aria-hidden="true"
      className="absolute left-1/2 top-1/2 aspect-square w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
      style={{ background: accent }}
    />
  )

  if (images.length === 1) {
    // One product: the background-removed cut-out floats on the slide.
    return (
      <div className="relative h-full w-full">
        {glow}
        <img
          src={images[0]}
          alt=""
          className={`absolute inset-[6%] h-[88%] w-[88%] object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.45)] ${zoom}`}
        />
      </div>
    )
  }

  if (images.length > 1) {
    // Category promo: a small collection of products from across the
    // category, each on its own white tile, staggered like a product shelf.
    const items = images.slice(0, 4)
    const four = items.length === 4
    return (
      <div className="relative flex h-full w-full items-center justify-center">
        {glow}
        <div
          className={`relative grid w-[92%] gap-2.5 sm:gap-4 ${GROUP_COLUMNS[items.length]} ${
            four ? 'h-[80%]' : ''
          } ${zoom}`}
        >
          {items.map((src, index) => (
            <span
              key={src}
              className={`relative overflow-hidden rounded-xl bg-white shadow-[0_14px_30px_rgba(0,0,0,0.35)] sm:rounded-2xl ${
                four ? 'h-full' : 'aspect-square'
              } ${index % 2 === 1 ? 'translate-y-[6%]' : '-translate-y-[3%]'}`}
            >
              <img
                src={src}
                alt=""
                className="absolute inset-0 h-full w-full object-contain p-2 sm:p-3"
              />
            </span>
          ))}
        </div>
      </div>
    )
  }

  if (fallback) {
    // No cut-out yet (banner from before cut-outs existed, or background
    // removal failed): the plain photo on a white card that always fits it.
    return (
      <span className="relative h-[78%] w-[88%] overflow-hidden rounded-[22px] bg-white shadow-[0_24px_50px_rgba(0,0,0,0.4)]">
        <img
          src={fallback}
          alt=""
          className={`absolute inset-0 h-full w-full object-contain p-4 ${zoom}`}
        />
      </span>
    )
  }

  return (
    <span
      aria-hidden="true"
      className="display text-[7rem] font-extrabold leading-none opacity-20 sm:text-[9rem]"
      style={{ color: accent }}
    >
      %
    </span>
  )
}

function Slide({ banner, index, active }: { banner: BannerEntry; index: number; active: boolean }) {
  const countdown = useCountdown(banner.ends_at)
  const [dark, accent] = PALETTES[index % PALETTES.length]
  const cutouts = (banner.subject_images ?? [])
    .map((path) => getImageUrl(path))
    .filter((url): url is string => Boolean(url))
  const fallback = getImageUrl(banner.subject_image || '')
  const isCategory = banner.type === 'category'
  const percent = discountPercent(banner)
  return (
    <Link
      to={banner.target_url}
      aria-hidden={!active}
      tabIndex={active ? 0 : -1}
      className="promo-slide absolute inset-0 flex items-stretch overflow-hidden text-white transition-opacity duration-700"
      style={{
        opacity: active ? 1 : 0,
        zIndex: active ? 1 : 0,
        pointerEvents: active ? 'auto' : 'none',
        background: `radial-gradient(120% 140% at 85% 20%, ${accent}cc 0%, transparent 55%), linear-gradient(135deg, ${dark} 0%, #070f1e 100%)`,
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.7) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'linear-gradient(90deg, black, transparent 60%)',
        }}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between gap-2 p-5 pb-9 sm:p-8 sm:pb-10 sm:pl-16 lg:max-w-[58%]">
        <span
          aria-hidden="true"
          className="promo-slide-badge self-start whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#0a1628] sm:text-xs"
          style={{ background: accent }}
        >
          {isCategory ? 'Категория' : 'Промоция'}
          {countdown && <span className="hidden sm:inline"> · {countdown}</span>}
        </span>
        <div className="flex flex-col gap-2 sm:gap-4">
          <span
            className="promo-slide-discount display text-4xl font-extrabold leading-none sm:text-7xl lg:text-8xl"
            style={{ color: accent }}
          >
            {percent ?? banner.discount_label}
          </span>
          <span className="promo-slide-title display line-clamp-2 text-base font-bold leading-tight sm:text-3xl">
            {banner.title}
          </span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/80">
            {(banner.price || (percent && !/%/.test(banner.discount_label))) && (
              <span>
                {banner.old_price && (
                  <span className="mr-2 text-white/50 line-through">{banner.old_price}</span>
                )}
                <span className="text-base font-extrabold text-white sm:text-lg">
                  {banner.price}
                </span>
              </span>
            )}
            <span className="promo-slide-cta hidden items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-[#0a1628] transition group-hover:gap-3 sm:inline-flex">
              {isCategory ? 'Виж категорията' : 'Виж продукта'} <span aria-hidden="true">→</span>
            </span>
          </span>
        </div>
      </div>

      <div className="promo-slide-art relative flex w-[40%] shrink-0 items-center justify-center py-5 pr-4 sm:w-[42%] sm:p-6">
        <ProductArt images={cutouts} fallback={fallback} accent={accent} active={active} />
      </div>
    </Link>
  )
}

/**
 * Promotion banners on the home page, composed live from the manifest
 * (discount, product photo, prices, countdown) instead of a flat picture:
 * auto-advances with a progress bar, pauses on hover, swipes on touch,
 * arrows and dots. Gated by the "Банери с промоции" switch (admin Дизайн).
 */
export function BannerCarousel() {
  const { data: banners } = useBanners()
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [cycle, setCycle] = useState(0)
  const touchStart = useRef<number | null>(null)
  const count = banners?.length ?? 0

  useEffect(() => {
    if (count < 2 || paused) return
    const timer = setTimeout(() => {
      setActiveIndex((current) => (current + 1) % count)
      setCycle((c) => c + 1)
    }, ROTATE_INTERVAL_MS)
    return () => clearTimeout(timer)
  }, [count, paused, activeIndex])

  if (!banners || banners.length === 0) return null

  function go(next: number) {
    setActiveIndex((next + count) % count)
    setCycle((c) => c + 1)
  }

  return (
    <section
      aria-label="Промоции"
      aria-roledescription="carousel"
      className="promo-carousel group relative mb-10 aspect-[16/11] w-full overflow-hidden rounded-[28px] bg-[#0a1628] sm:aspect-[3/1]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(event) => {
        touchStart.current = event.touches[0].clientX
      }}
      onTouchEnd={(event) => {
        if (touchStart.current === null) return
        const dx = event.changedTouches[0].clientX - touchStart.current
        touchStart.current = null
        if (Math.abs(dx) > 40) go(activeIndex + (dx < 0 ? 1 : -1))
      }}
    >
      {banners.map((banner, index) => (
        <Slide key={banner.id} banner={banner} index={index} active={index === activeIndex} />
      ))}

      {banners.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(activeIndex - 1)}
            aria-label="Предишен банер"
            className="absolute left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white opacity-0 backdrop-blur transition hover:bg-white/30 group-hover:opacity-100 sm:grid"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => go(activeIndex + 1)}
            aria-label="Следващ банер"
            className="absolute right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white opacity-0 backdrop-blur transition hover:bg-white/30 group-hover:opacity-100 sm:grid"
          >
            ›
          </button>
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
            {banners.map((banner, index) => (
              <button
                key={banner.id}
                type="button"
                onClick={() => go(index)}
                aria-label={`Банер ${index + 1}`}
                aria-current={index === activeIndex}
                className={`h-1.5 overflow-hidden rounded-full bg-white/35 transition-all ${
                  index === activeIndex ? 'w-10' : 'w-2.5 hover:bg-white/60'
                }`}
              >
                {index === activeIndex && (
                  <span
                    key={cycle}
                    className="promo-progress block h-full rounded-full bg-white"
                    style={{
                      animationDuration: `${ROTATE_INTERVAL_MS}ms`,
                      animationPlayState: paused ? 'paused' : 'running',
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
