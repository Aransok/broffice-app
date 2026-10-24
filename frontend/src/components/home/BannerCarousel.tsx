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

function Slide({ banner, index, active }: { banner: BannerEntry; index: number; active: boolean }) {
  const countdown = useCountdown(banner.ends_at)
  const [dark, accent] = PALETTES[index % PALETTES.length]
  const subject = getImageUrl(banner.subject_image || '')
  const isCategory = banner.type === 'category'
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
      <span
        aria-hidden="true"
        className="promo-slide-badge absolute left-5 top-5 z-10 rounded-full px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.18em] text-[#0a1628] sm:left-8 sm:top-8"
        style={{ background: accent }}
      >
        {isCategory ? 'Категория' : 'Промоция'}
        {countdown ? ` · ${countdown}` : ''}
      </span>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-end gap-3 p-5 pt-14 sm:gap-4 sm:p-8 sm:pt-16 lg:max-w-[58%]">
        <span
          className="promo-slide-discount display text-5xl font-extrabold leading-none sm:text-7xl lg:text-8xl"
          style={{ color: accent }}
        >
          {banner.discount_label}
        </span>
        <span className="promo-slide-title display line-clamp-2 text-xl font-bold leading-tight sm:text-3xl">
          {banner.title}
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/80">
          {banner.price && (
            <span>
              {banner.old_price && (
                <span className="mr-2 text-white/50 line-through">{banner.old_price}</span>
              )}
              <span className="text-lg font-extrabold text-white">{banner.price}</span>
            </span>
          )}
          <span className="promo-slide-cta inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-[#0a1628] transition group-hover:gap-3">
            {isCategory ? 'Виж категорията' : 'Виж продукта'} <span aria-hidden="true">→</span>
          </span>
        </span>
      </div>

      <div className="promo-slide-art relative hidden w-[42%] items-center justify-center p-6 sm:flex">
        {subject ? (
          <span className="grid h-full max-h-[260px] w-full place-items-center rounded-[28px] bg-white/95 p-6 shadow-[0_30px_60px_rgba(0,0,0,0.45)]">
            <img
              src={subject}
              alt=""
              className={`max-h-full max-w-full object-contain transition-transform duration-[6000ms] ease-out ${
                active ? 'scale-105' : 'scale-100'
              }`}
            />
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="display text-[9rem] font-extrabold leading-none opacity-20"
            style={{ color: accent }}
          >
            %
          </span>
        )}
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
      className="promo-carousel group relative mb-10 aspect-[16/7] w-full overflow-hidden rounded-[28px] bg-[#0a1628] sm:aspect-[3/1]"
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
