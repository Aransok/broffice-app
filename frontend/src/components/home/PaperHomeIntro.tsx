import { Link } from 'react-router-dom'
import { useBrands } from '../../api/brands'
import { useCategoryTree } from '../../api/categories'
import { usePublicConfig } from '../../api/config'
import { getImageUrl } from '../../api/media'
import { getDisplayPrice } from '../../api/pricing'
import { useProducts } from '../../api/products'
import { useTheme } from '../../context/ThemeContext'
import { useVat } from '../../context/VatContext'
import { Reveal } from '../bold/motion'
import { ProductCard } from '../product/ProductCard'
import { QuickOrderBox } from './QuickOrderBox'

/** Top of the home page in the "BRoffice Paper" design: a magazine cover
 * (vertical kicker, serif headline, one large product photo), the quick
 * order as a quiet form, a thin brand line, an editorial promo row, and
 * categories as a numbered index. Only rendered when that design is
 * active (see HomePage). */
export function PaperHomeIntro() {
  const { isEnabled } = useTheme()
  return (
    <div className="mb-16 flex flex-col gap-16">
      <Cover />
      {isEnabled('brand_marquee') && <BrandLine />}
      {isEnabled('promo_carousel') && <EditorialPromos />}
      {isEnabled('category_tiles') && <CategoryIndex />}
      {isEnabled('trust_strip') && <Notes />}
    </div>
  )
}

function Cover() {
  const { isEnabled } = useTheme()
  const { data } = useProducts({ on_promotion: true })
  const { displayPrice } = useVat()
  const featured = data?.results.find((p) => p.primary_image) ?? data?.results[0]
  const image = featured ? getImageUrl(featured.primary_image ?? '') : null
  const price = featured ? displayPrice(getDisplayPrice(featured).currentEur) : null
  const quickOrder = isEnabled('quick_order')
  return (
    <section className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      <div className="paper-fade flex flex-col justify-between gap-10 lg:col-span-7">
        <div className="flex gap-5">
          <span
            className="hidden text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500 sm:block"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Офис консумативи · Пловдив · {new Date().getFullYear()}
          </span>
          <div className="flex flex-col gap-6">
            <h1 className="display text-5xl leading-[1.02] text-slate-900 sm:text-6xl lg:text-7xl">
              Всичко за офиса,
              <br />
              <em className="italic text-[var(--color-sage)]">подредено</em> както трябва.
            </h1>
            <p className="max-w-md text-base leading-relaxed text-slate-500 sm:text-lg">
              Хартия, тонери, канцеларски материали и техника. Фирмени цени, фактура при всяка
              поръчка, доставка в цяла България.
            </p>
            <div className="flex flex-wrap items-center gap-5">
              <Link
                to="/promotions"
                className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold tracking-wide text-white transition hover:bg-[var(--color-sage)]"
              >
                Промоции
              </Link>
              <Link
                to="/catalog"
                className="text-sm font-semibold text-slate-900 underline decoration-[var(--color-sage)] decoration-2 underline-offset-[6px]"
              >
                Разгледай каталога
              </Link>
            </div>
          </div>
        </div>
        {quickOrder && (
          <div className="flex flex-col gap-3 border-t border-slate-200 pt-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="display text-2xl text-slate-900">Бърза поръчка</h2>
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                номер × количество
              </span>
            </div>
            <QuickOrderBox compact placeholder="70031" />
          </div>
        )}
      </div>

      <div className="paper-fade lg:col-span-5" style={{ animationDelay: '150ms' }}>
        <Link
          to={featured ? `/product/${featured.slug}` : '/promotions'}
          className="group relative block overflow-hidden rounded-md border border-slate-200 bg-surface"
        >
          <span className="grid aspect-[4/5] place-items-center p-8">
            {image ? (
              <img
                src={image}
                alt={featured?.name ?? ''}
                className="max-h-full max-w-full object-contain transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <span className="display text-7xl italic text-slate-200">BR</span>
            )}
          </span>
          {featured && (
            <span className="flex items-end justify-between gap-3 border-t border-slate-200 p-4">
              <span className="min-w-0">
                <span className="block text-[11px] uppercase tracking-[0.18em] text-[var(--color-sage)]">
                  Избор на седмицата
                </span>
                <span className="line-clamp-1 text-sm font-medium text-slate-900">
                  {featured.name}
                </span>
              </span>
              {price && <span className="display shrink-0 text-xl text-slate-900">€{price}</span>}
            </span>
          )}
        </Link>
      </div>
    </section>
  )
}

function BrandLine() {
  const { data } = useBrands()
  const brands = (data?.results ?? []).filter((b) => b.name).slice(0, 14)
  if (brands.length < 4) return null
  return (
    <Reveal>
      <section className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-y border-slate-200 py-5">
        {brands.map((brand) => (
          <Link
            key={brand.id}
            to={`/search?q=${encodeURIComponent(brand.name)}`}
            className="display text-lg italic text-slate-500 transition hover:text-slate-900"
          >
            {brand.name}
          </Link>
        ))}
      </section>
    </Reveal>
  )
}

function EditorialPromos() {
  const { data } = useProducts({ on_promotion: true })
  const products = data?.results.slice(0, 4) ?? []
  if (products.length === 0) return null
  return (
    <Reveal>
      <section className="flex flex-col gap-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-sage)]">
              Тази седмица
            </span>
            <h2 className="home-section-title mt-1 text-slate-900">Промоции</h2>
          </div>
          <Link
            to="/promotions"
            className="text-sm font-semibold text-slate-900 underline decoration-[var(--color-sage)] decoration-2 underline-offset-[6px]"
          >
            Всички
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </Reveal>
  )
}

function CategoryIndex() {
  const { data: tree } = useCategoryTree()
  const top = (tree ?? []).slice(0, 8)
  if (top.length === 0) return null
  return (
    <Reveal>
      <section className="flex flex-col gap-6">
        <h2 className="home-section-title text-slate-900">Категории</h2>
        <ol className="grid border-t border-slate-200 sm:grid-cols-2">
          {top.map((category, index) => (
            <li key={category.id} className="border-b border-slate-200">
              <Link
                to={`/category/${category.slug}`}
                className="group flex items-baseline gap-5 py-5 pr-4 transition hover:pl-2"
              >
                <span className="display w-8 shrink-0 text-sm italic text-slate-400">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="display flex-1 text-2xl text-slate-900 group-hover:text-[var(--color-sage)]">
                  {category.name}
                </span>
                <span className="text-xs text-slate-500">
                  {category.children.length > 0 ? `${category.children.length} подкатегории` : ''}
                </span>
                <span
                  aria-hidden="true"
                  className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-900"
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </Reveal>
  )
}

function Notes() {
  const { data: config } = usePublicConfig()
  const items = [
    ['Доставка', 'Speedy, Pigeon Express или наш транспорт, в цяла България.'],
    ['Фактура', 'При всяка фирмена поръчка, с ЕИК и ДДС номер.'],
    ['Цени', 'В € и лв, с или без ДДС, както ви е удобно.'],
    [
      'Поръчки',
      config?.company_phone ? `По телефон: ${config.company_phone}` : 'По телефон и онлайн.',
    ],
  ]
  return (
    <Reveal>
      <section className="grid gap-x-10 gap-y-6 border-t border-slate-200 pt-8 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-2">
            <span className="display text-lg italic text-slate-900">{k}</span>
            <span className="text-sm leading-relaxed text-slate-500">{v}</span>
          </div>
        ))}
      </section>
    </Reveal>
  )
}
