import { useHomeSections } from '../api/homeSections'
import type { ProductListItem } from '../api/types'
import { BannerCarousel } from '../components/home/BannerCarousel'
import { BoldHomeIntro } from '../components/home/BoldHomeIntro'
import { FreshHomeIntro } from '../components/home/FreshHomeIntro'
import { PaperHomeIntro } from '../components/home/PaperHomeIntro'
import {
  BrandMarqueeBlock,
  CategoryTilesBlock,
  NumbersBlock,
  PromoCarouselBlock,
  QuickOrderBlock,
  TrustStripBlock,
} from '../components/home/blocks'
import { ProductCard } from '../components/product/ProductCard'
import { Seo } from '../components/Seo'
import { useTheme } from '../context/ThemeContext'

const HOME_JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'BRoffice',
    url: window.location.origin,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'BRoffice',
    url: window.location.origin,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${window.location.origin}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  },
]

function ProductSection({
  title,
  products,
}: {
  title: string
  products: ProductListItem[] | undefined
}) {
  if (products && products.length === 0) return null

  return (
    <section className="mb-10">
      <h2 className="home-section-title mb-4 text-xl font-semibold text-slate-900">{title}</h2>
      {!products && <p className="text-slate-500">Зареждане...</p>}
      {products && (
        <div className="home-product-grid grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  )
}

export function HomePage() {
  const { data, isError } = useHomeSections()
  const { preset, isEnabled } = useTheme()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Seo
        title="BRoffice | Онлайн магазин за офис консумативи"
        description="BRoffice — онлайн магазин за офис консумативи, канцеларски материали и техника с доставка в цяла България."
        jsonLd={HOME_JSON_LD}
      />
      {isError && <p className="text-red-600">Продуктите не могат да бъдат заредени в момента.</p>}

      {preset === 'fresh' && <FreshHomeIntro />}
      {preset === 'bold' && <BoldHomeIntro />}
      {preset === 'paper' && <PaperHomeIntro />}
      {/* Optional blocks (admin Дизайн → Елементи). Bold/Paper/Fresh draw
          their own versions of some inside their intros; everything else,
          when switched on, comes from the shared blocks here. */}
      {/* Classic designs: the banner leads, then the optional blocks. */}
      {isEnabled('banner_carousel') && !['fresh', 'bold', 'paper'].includes(preset) && (
        <BannerCarousel />
      )}
      {!['fresh', 'bold', 'paper'].includes(preset) && (
        <div className="mb-10 flex flex-col gap-8">
          {isEnabled('quick_order') && <QuickOrderBlock />}
          {isEnabled('brand_marquee') && <BrandMarqueeBlock />}
          {isEnabled('promo_carousel') && <PromoCarouselBlock />}
          {isEnabled('category_tiles') && <CategoryTilesBlock />}
          {isEnabled('numbers') && <NumbersBlock />}
          {isEnabled('trust_strip') && <TrustStripBlock />}
        </div>
      )}
      {preset === 'fresh' && (
        <div className="mb-10 flex flex-col gap-8">
          {isEnabled('brand_marquee') && <BrandMarqueeBlock />}
          {isEnabled('promo_carousel') && <PromoCarouselBlock />}
          {isEnabled('numbers') && <NumbersBlock />}
        </div>
      )}
      {preset === 'paper' && isEnabled('numbers') && (
        <div className="mb-10">
          <NumbersBlock />
        </div>
      )}

      {isEnabled('banner_carousel') && ['fresh', 'bold', 'paper'].includes(preset) && (
        <BannerCarousel />
      )}

      {/* Personalized to the viewer's own browsing activity — doesn't
          render for guests or logged-in users with no view history yet. */}
      <ProductSection title="Препоръчано за вас" products={data?.recommended} />
      {/* Best Sellers is computed from real confirmed orders — it simply
          doesn't render until there's real order history to draw from. */}
      <ProductSection title="Най-продавани" products={data?.best_sellers} />
      <ProductSection title="Нови продукти" products={data?.new_products} />
      {/* Bold already shows this week's promotions up top. */}
      {/* Skipped when the promo carousel already shows them up top. */}
      {!isEnabled('promo_carousel') && (
        <ProductSection title="Промоции" products={data?.promotions} />
      )}
    </div>
  )
}
