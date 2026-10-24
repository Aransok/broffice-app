import { Link } from 'react-router-dom'
import { useBrands } from '../../api/brands'
import { useCategoryTree } from '../../api/categories'
import { usePublicConfig } from '../../api/config'
import { useProducts } from '../../api/products'
import { CountUp } from '../bold/motion'
import { ProductCard } from '../product/ProductCard'
import { QuickOrderBox } from './QuickOrderBox'

/**
 * Design-neutral versions of the optional home blocks (admin "Елементи").
 * Bold and Paper have their own styled takes on most of these; every
 * other design (and Bold/Paper for the ones they lack) uses these, which
 * draw only from the shared tokens so each design recolors them itself.
 */

export function QuickOrderBlock() {
  return (
    <section className="flex flex-col gap-3 rounded-ui border border-slate-200 bg-surface p-5">
      <div>
        <h2 className="home-section-title text-xl font-semibold text-slate-900">Бърза поръчка</h2>
        <p className="mt-1 text-sm text-slate-500">
          Номер на продукта (№ от сайта) и количество, по един на ред. Продуктът се показва преди да
          го добавиш.
        </p>
      </div>
      <QuickOrderBox compact />
    </section>
  )
}

export function PromoCarouselBlock() {
  const { data } = useProducts({ on_promotion: true })
  const products = data?.results.slice(0, 10) ?? []
  if (products.length === 0) return null
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="home-section-title text-xl font-semibold text-slate-900">
          Промоции тази седмица
        </h2>
        <Link to="/promotions" className="text-sm font-semibold text-primary hover:underline">
          Всички промоции
        </Link>
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {products.map((product) => (
          <div key={product.id} className="w-[70vw] shrink-0 snap-start sm:w-[260px]">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  )
}

export function BrandMarqueeBlock() {
  const { data } = useBrands()
  const brands = (data?.results ?? []).filter((b) => b.name).slice(0, 30)
  if (brands.length < 4) return null
  const row = [...brands, ...brands]
  return (
    <section aria-label="Марки" className="relative -mx-4 overflow-hidden py-1">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-slate-50 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-slate-50 to-transparent" />
      <div className="bold-marquee flex w-max gap-3 whitespace-nowrap px-4">
        {row.map((brand, index) => (
          <Link
            key={`${brand.id}-${index}`}
            to={`/search?q=${encodeURIComponent(brand.name)}`}
            className="rounded-full border border-slate-300 bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 transition hover:border-primary hover:text-primary"
          >
            {brand.name}
          </Link>
        ))}
      </div>
    </section>
  )
}

const TINTS = ['#e8eef8', '#fde9dc', '#e3f4ea', '#efe9fb', '#e6f2f6', '#f5efe3']

export function categoryIcon(name: string) {
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

export function CategoryTilesBlock() {
  const { data: tree } = useCategoryTree()
  const top = (tree ?? []).slice(0, 12)
  if (top.length === 0) return null
  return (
    <section className="flex flex-col gap-4">
      <h2 className="home-section-title text-xl font-semibold text-slate-900">
        Пазарувай по категория
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {top.map((category, index) => (
          <Link
            key={category.id}
            to={`/category/${category.slug}`}
            className="fresh-tile flex flex-col overflow-hidden rounded-ui border border-slate-200 bg-surface text-slate-900"
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

export function NumbersBlock() {
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
    <section className="grid grid-cols-2 gap-4 rounded-ui bg-primary p-6 text-white sm:p-8 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-1">
          <span className="display text-3xl font-extrabold sm:text-4xl">
            <CountUp value={item.n} suffix={item.suffix ?? ''} />
          </span>
          <span className="text-sm text-white/75">{item.label}</span>
        </div>
      ))}
    </section>
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

export function TrustStripBlock() {
  const { data: config } = usePublicConfig()
  const items = TRUST_ITEMS.map((item, index) =>
    index === 0 && config?.company_phone
      ? { ...item, text: `${item.text} · ${config.company_phone}` }
      : item,
  )
  return (
    <section className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.title}
          className="flex items-center gap-3.5 rounded-ui border border-slate-200 bg-surface p-4 transition-colors hover:border-primary"
        >
          <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-slate-100">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
              className="text-primary"
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
