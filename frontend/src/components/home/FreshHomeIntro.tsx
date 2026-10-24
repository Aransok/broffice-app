import { type FormEvent, type ReactNode, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCategoryTree } from '../../api/categories'
import { lookupProductCodes } from '../../api/products'
import { parseQuickOrder } from './parseQuickOrder'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'

/** The top of the home page in the "BRoffice 2026" design: hero, quick
 * order by item number, reorder, business account, trust bar and category
 * tiles. Ported from the 21st.dev-based mockup. Only rendered when that
 * design is active (see HomePage). */
export function FreshHomeIntro() {
  return (
    <div className="mb-12 flex flex-col gap-10">
      <section className="grid gap-4 md:grid-cols-3">
        <Hero />
        <QuickOrderCard />
        <ReorderCard />
        <BusinessCard />
      </section>
      <TrustBar />
      <CategoryTiles />
    </div>
  )
}

function Hero() {
  return (
    <div className="fresh-rise relative flex flex-wrap items-end justify-between gap-6 overflow-hidden rounded-[24px] bg-[#1d3f73] p-8 text-white md:col-span-3 md:p-12">
      <svg
        viewBox="0 0 200 200"
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-40 h-[520px] w-[520px] opacity-15"
      >
        <circle cx="100" cy="100" r="96" fill="none" stroke="#fff" strokeWidth="1" />
        <circle cx="100" cy="100" r="70" fill="none" stroke="#fff" strokeWidth="1" />
        <circle cx="100" cy="100" r="44" fill="none" stroke="#f07a32" strokeWidth="2" />
      </svg>
      <div className="relative flex max-w-2xl flex-col gap-4">
        <span className="self-start rounded-md bg-[#f07a32] px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[#14213a]">
          Офис консумативи онлайн
        </span>
        <h1 className="text-4xl font-extrabold leading-[1.05] md:text-5xl">
          Всичко за офиса, на фирмени цени.
        </h1>
        <p className="text-lg leading-relaxed text-[#cfdaee]">
          Хартия, тонери и канцеларски материали. Търси по име, марка или каталожен номер и поръчай
          за минути.
        </p>
      </div>
      <div className="relative flex flex-wrap gap-3">
        <Link
          to="/promotions"
          className="rounded-xl bg-[#f07a32] px-6 py-3.5 font-bold text-[#14213a] hover:brightness-105"
        >
          Разгледай промоциите
        </Link>
        <Link
          to="/register"
          className="rounded-xl border border-[#6f8bb8] px-6 py-3.5 font-semibold text-white hover:bg-white/10"
        >
          Фирмен акаунт
        </Link>
      </div>
    </div>
  )
}

function CardShell({
  iconBg,
  icon,
  title,
  text,
  children,
  delay,
}: {
  iconBg: string
  icon: ReactNode
  title: string
  text: string
  children: ReactNode
  delay: number
}) {
  return (
    <div
      className="fresh-rise flex flex-col gap-3.5 rounded-[24px] border border-slate-200 bg-surface p-7"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className={`grid h-12 w-12 place-items-center rounded-2xl ${iconBg}`}>{icon}</span>
      <h2 className="text-xl font-extrabold text-slate-900">{title}</h2>
      <p className="text-[15px] leading-relaxed text-slate-500">{text}</p>
      {children}
    </div>
  )
}

function QuickOrderCard() {
  const { addItem } = useCart()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{
    added: { code: string; quantity: number; name: string; number: string }[]
    missing: string[]
    failed: boolean
  } | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const lines = parseQuickOrder(text)
    if (lines.length === 0) return
    setBusy(true)
    setResult(null)
    try {
      const found = await lookupProductCodes(lines.map((line) => line.code))
      const added: { code: string; quantity: number; name: string; number: string }[] = []
      const missing: string[] = []
      for (const line of lines) {
        const product = found[line.code]
        if (product) {
          addItem(product, line.quantity)
          added.push({
            code: line.code,
            quantity: line.quantity,
            name: product.name,
            number: product.supplier_id || String(product.item_number ?? ''),
          })
        } else {
          missing.push(line.code)
        }
      }
      setResult({ added, missing, failed: false })
      if (missing.length === 0) setText('')
    } catch {
      setResult({ added: [], missing: [], failed: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <CardShell
      delay={80}
      iconBg="bg-[#fde9dc]"
      icon={
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#c4501a"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
        </svg>
      }
      title="Бърза поръчка"
      text="Напиши номера на продукта (№ от сайта) и количество, по един на ред."
    >
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-3">
        <label htmlFor="quick-order" className="sr-only">
          Каталожни номера и количества
        </label>
        <textarea
          id="quick-order"
          rows={3}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={'CF283A x 4\n70031 x 10'}
          className="resize-y rounded-xl border-[1.5px] border-slate-300 bg-slate-50 px-3.5 py-3 font-mono text-sm leading-relaxed text-slate-900 focus:border-primary focus:outline-none"
        />
        {result && (
          <div className="flex flex-col gap-1 text-sm" role="status">
            {result.failed && <p className="text-red-600">Нещо се обърка. Опитайте пак.</p>}
            {result.added.length > 0 && (
              <>
                <p className="font-semibold text-green-700">Добавено в количката:</p>
                <ul className="flex flex-col gap-0.5 text-slate-700">
                  {result.added.map((item) => (
                    <li key={item.code} className="truncate">
                      {item.quantity} × <span className="text-slate-500">№{item.number}</span>{' '}
                      {item.name}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {result.missing.length > 0 && (
              <p className="text-red-600">Няма продукт с номер: {result.missing.join(', ')}</p>
            )}
          </div>
        )}
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="mt-auto rounded-xl bg-primary px-4 py-3.5 font-bold text-white hover:brightness-110 disabled:opacity-60"
        >
          {busy ? 'Търсене…' : 'Добави всички в количката'}
        </button>
      </form>
    </CardShell>
  )
}

function ReorderCard() {
  const { user } = useAuth()
  return (
    <CardShell
      delay={160}
      iconBg="bg-[#e8eef8]"
      icon={
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#1d3f73"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
        </svg>
      }
      title="Поръчай пак"
      text="Всичките ти поръчки на едно място. Отвори последната и добави същите продукти отново."
    >
      <Link
        to={user ? '/account/orders' : '/login'}
        className="mt-auto rounded-xl border-[1.5px] border-slate-900 px-4 py-3.5 text-center font-bold text-slate-900 hover:bg-slate-100"
      >
        {user ? 'Моите поръчки' : 'Вход в профила'}
      </Link>
    </CardShell>
  )
}

function BusinessCard() {
  return (
    <CardShell
      delay={240}
      iconBg="bg-[#e3f4ea]"
      icon={
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#1f7a4a"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M6 2h9l4 4v16H6z" />
          <path d="M9 11h7M9 15h7" />
        </svg>
      }
      title="За фирми"
      text="Фактура на фирмата при всяка поръчка и цени с или без ДДС, както ти е удобно."
    >
      <Link
        to="/register"
        className="mt-auto rounded-xl bg-primary px-4 py-3.5 text-center font-bold text-white hover:brightness-110"
      >
        Създай фирмен акаунт
      </Link>
    </CardShell>
  )
}

const TRUST_ITEMS = [
  {
    title: 'Speedy и Pigeon Express',
    text: 'До адрес, офис или автомат',
    icon: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 18h.01M17 18h.01',
  },
  {
    title: 'Фактура за фирми',
    text: 'С ЕИК и ДДС номер',
    icon: 'M6 2h9l4 4v16H6zM9 11h7M9 15h7',
  },
  {
    title: 'Цени в € и лв',
    text: 'Курс 1,95583 лв за 1 €',
    icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 11h6M8 13h6',
  },
  {
    title: 'Цени с или без ДДС',
    text: 'Превключваш горе вдясно',
    icon: 'M4 6h16M4 12h16M4 18h10',
  },
]

function TrustBar() {
  return (
    <section className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      {TRUST_ITEMS.map((item) => (
        <div
          key={item.title}
          className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-surface p-4 transition-colors hover:border-primary"
        >
          <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-[#e8eef8]">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2a5fa5"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d={item.icon} />
            </svg>
          </span>
          <span className="flex flex-col">
            <b className="text-[15px] text-slate-900">{item.title}</b>
            <span className="text-[13px] text-slate-500">{item.text}</span>
          </span>
        </div>
      ))}
    </section>
  )
}

const TINTS = ['#e8eef8', '#fde9dc', '#e3f4ea', '#efe9fb', '#e6f2f6', '#f5efe3']

/** Picks a line icon from the category name; a generic box otherwise. */
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

function CategoryTiles() {
  const { data: tree } = useCategoryTree()
  const top = (tree ?? []).slice(0, 12)
  if (top.length === 0) return null
  return (
    <section className="flex flex-col gap-4">
      <h2 className="home-section-title text-slate-900">Пазарувай по категория</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {top.map((category, index) => (
          <Link
            key={category.id}
            to={`/category/${category.slug}`}
            className="fresh-tile flex flex-col overflow-hidden rounded-[18px] border border-slate-200 bg-surface text-slate-900"
          >
            <span
              className="grid aspect-[4/3] place-items-center overflow-hidden"
              style={{ background: TINTS[index % TINTS.length] }}
            >
              <svg
                className="fresh-tile-art"
                width="56"
                height="56"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#1d3f73"
                strokeWidth="1.4"
                aria-hidden="true"
              >
                <path d={categoryIcon(category.name)} />
              </svg>
            </span>
            <span className="flex items-center justify-between gap-2 px-4 py-3">
              <b className="text-[15px] leading-snug">{category.name}</b>
              {category.children.length > 0 && (
                <span className="whitespace-nowrap text-xs text-slate-500">
                  {category.children.length} подкат.
                </span>
              )}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
