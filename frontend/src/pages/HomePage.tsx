import { useHomeSections } from '../api/homeSections'
import type { ProductListItem } from '../api/types'
import { BannerCarousel } from '../components/home/BannerCarousel'
import { ProductCard } from '../components/product/ProductCard'

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
      <h2 className="mb-4 text-xl font-semibold text-slate-900">{title}</h2>
      {!products && <p className="text-slate-500">Зареждане...</p>}
      {products && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {isError && <p className="text-red-600">Продуктите не могат да бъдат заредени в момента.</p>}

      <BannerCarousel />

      {/* Personalized to the viewer's own browsing activity — doesn't
          render for guests or logged-in users with no view history yet. */}
      <ProductSection title="Препоръчано за вас" products={data?.recommended} />
      {/* Best Sellers is computed from real confirmed orders — it simply
          doesn't render until there's real order history to draw from. */}
      <ProductSection title="Най-продавани" products={data?.best_sellers} />
      <ProductSection title="Нови продукти" products={data?.new_products} />
      <ProductSection title="Промоции" products={data?.promotions} />
    </div>
  )
}
