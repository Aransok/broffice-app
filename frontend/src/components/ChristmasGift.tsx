import { useEffect, useState } from 'react'
import { markChristmasGiftOpened } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { Snowfall } from './bold/Snowfall'

const DESIGN = 'bold_christmas'
/** After this the surprise is pointless (the holidays are over). */
const SHOW_UNTIL = new Date('2027-01-07T00:00:00')

/**
 * A one-time surprise for admin accounts: a wrapped present saying
 * "Подарък от Доан". Clicking it opens the box and the new Christmas design
 * rises out of it; clicking that opens the design preview (admins only, the
 * shop's normal ?design_preview flow, so customers never see it).
 *
 * Shown once per admin ACCOUNT (the server records it, so a second device
 * or cleared browser data doesn't bring it back), only until early
 * January. Not shown while the Christmas design is being previewed; if it
 * is already live, the gift still shows and the button opens the shop.
 */
export function ChristmasGift() {
  const { user, isLoading } = useAuth()
  const { liveDesign, previewDesign } = useTheme()
  const [dismissed, setDismissed] = useState(false)
  const [open, setOpen] = useState(false)

  const visible =
    !isLoading &&
    Boolean(user?.is_admin_portal) &&
    !user?.christmas_gift_opened &&
    previewDesign !== DESIGN &&
    new Date() < SHOW_UNTIL &&
    !dismissed

  useEffect(() => {
    if (!visible) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [visible])

  if (!visible || !user) return null

  const alreadyLive = liveDesign === DESIGN

  /** Records it on the account. A failed call only means it may show once
   * more, so it never blocks closing or opening the preview. */
  function markOpened() {
    return markChristmasGiftOpened().catch(() => undefined)
  }

  function close() {
    void markOpened()
    setDismissed(true)
  }

  async function goToPreview() {
    // Saved before leaving: the full page load below would cut the request.
    await Promise.race([markOpened(), new Promise((resolve) => setTimeout(resolve, 2000))])
    // A full load: the preview parameter is read once when the shop starts.
    window.location.href = alreadyLive ? '/' : `/?design_preview=${DESIGN}`
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Подарък от Доан"
      className="gift-overlay fixed inset-0 z-[200] flex items-center justify-center overflow-hidden px-4"
    >
      <Snowfall variant="hero" />
      <button
        type="button"
        onClick={close}
        className="absolute right-4 top-4 z-10 rounded-full px-3 py-1.5 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white"
      >
        Затвори ✕
      </button>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center text-white">
        <p className="gift-title display text-3xl leading-tight sm:text-4xl">Подарък от Доан</p>
        <p className="mt-2 min-h-[3rem] text-base text-white/80">
          {open ? 'Нов дизайн за сайта, за празниците.' : 'Натисни кутията, за да я отвориш.'}
        </p>

        <div className={`gift ${open ? 'gift-open' : ''}`}>
          {/* The design comes out of the box once it is open. */}
          <button
            type="button"
            onClick={goToPreview}
            tabIndex={open ? 0 : -1}
            aria-hidden={!open}
            className="gift-reveal"
          >
            <MiniStore />
            <span className="mt-3 block font-bold text-slate-900">BRoffice Bold Коледа</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Сняг, коледни цветове и шапка на логото
            </span>
            <span className="gift-cta mt-3 inline-block rounded-full px-5 py-2 text-sm font-bold">
              {alreadyLive ? 'Виж го на сайта →' : 'Виж дизайна →'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={open}
            aria-label="Отвори подаръка"
            className="gift-box"
          >
            <span className="gift-lid">
              <span className="gift-bow" aria-hidden="true">
                <svg viewBox="0 0 80 40">
                  <path d="M40 34 C 28 6 4 2 6 18 C 8 30 30 32 40 34 Z" fill="#f5c451" />
                  <path d="M40 34 C 52 6 76 2 74 18 C 72 30 50 32 40 34 Z" fill="#f5c451" />
                  <path d="M40 34 C 30 14 14 10 14 18 C 14 26 30 30 40 34 Z" fill="#e0a92e" />
                  <path d="M40 34 C 50 14 66 10 66 18 C 66 26 50 30 40 34 Z" fill="#e0a92e" />
                  <circle cx="40" cy="33" r="6" fill="#f7d06b" />
                </svg>
              </span>
            </span>
            <span className="gift-body" />
          </button>
        </div>
      </div>
    </div>
  )
}

/** A tiny drawn storefront in the Christmas design's colors. */
function MiniStore() {
  return (
    <span className="block overflow-hidden rounded-xl border border-slate-200 bg-[#f3f0ea] text-left">
      <span className="flex items-center gap-1.5 bg-white px-2.5 py-2">
        <span className="relative text-[11px] font-extrabold">
          <span className="absolute -left-1 -top-2 h-2.5 w-3 rotate-[-16deg] rounded-t-full bg-[#d42a35]" />
          <span className="text-[#215f9a]">BR</span>
          <span className="text-[#ef6e35]">office</span>
        </span>
        <span className="h-2.5 flex-1 rounded-full bg-[#f3f0ea]" />
        <span className="h-2.5 w-6 rounded-full bg-[#d42a35]" />
      </span>
      <span className="block h-3 bg-[#12452f]" />
      <span className="flex gap-2 p-2.5">
        <span className="flex h-16 flex-[1.4] flex-col justify-end rounded-lg bg-gradient-to-br from-[#a51b26] via-[#7e1420] to-[#12452f] p-2">
          <span className="h-1.5 w-10 rounded bg-white/90" />
          <span className="mt-1 h-1.5 w-8 rounded bg-[#f5c451]" />
        </span>
        {[0, 1].map((i) => (
          <span
            key={i}
            className="relative flex h-16 flex-1 flex-col justify-end rounded-lg border border-[#12452f] bg-white p-1.5"
          >
            <span className="absolute left-1 top-1 text-[9px] leading-none">🌿</span>
            <span className="h-1 w-full rounded bg-slate-200" />
            <span className="mt-1 h-2 w-full rounded bg-[#d42a35]" />
          </span>
        ))}
      </span>
    </span>
  )
}
