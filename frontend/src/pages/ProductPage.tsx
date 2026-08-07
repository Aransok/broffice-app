import { Link, useParams } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { trackProductView } from '../api/activity'
import { useProduct, useRecommendedProducts, useSimilarProducts } from '../api/products'
import { getImageUrl } from '../api/media'
import { getDisplayPrice } from '../api/pricing'
import { AdminPriceEditor } from '../components/product/AdminPriceEditor'
import { ProductCard } from '../components/product/ProductCard'
import { Seo } from '../components/Seo'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useVat } from '../context/VatContext'

export function ProductPage() {
  const { slug = '' } = useParams()
  const { data: product, isLoading, isError } = useProduct(slug)
  const { data: similarProducts } = useSimilarProducts(slug)
  const { data: recommendedProducts } = useRecommendedProducts(slug)
  const [activeImage, setActiveImage] = useState(0)
  const [added, setAdded] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const { addItem } = useCart()
  const { displayPrice } = useVat()
  const { user } = useAuth()

  // Powers the admin "Активност" tab (which products this customer has
  // looked at) — one call per distinct product visited while logged in,
  // never for guests (matches the backend's authenticated-only tracking).
  const trackedProductIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!user || !product) return
    if (trackedProductIdRef.current === product.id) return
    trackedProductIdRef.current = product.id
    void trackProductView(product.id)
  }, [user, product])

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <p className="text-slate-500">Зареждане...</p>
      </div>
    )
  }

  if (isError || !product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <p className="text-red-600">Продуктът не е намерен.</p>
      </div>
    )
  }

  const raw = getDisplayPrice(product)
  const current = displayPrice(raw.current)
  const currentEur = displayPrice(raw.currentEur)
  const old = displayPrice(raw.old)
  const oldEur = displayPrice(raw.oldEur)
  const { onSale } = raw
  const images = product.images
  const mainImage = images[activeImage] ?? images[0]
  const mainImageUrl = mainImage ? getImageUrl(mainImage.path) : null
  const specEntries = Object.entries(product.specifications ?? {})

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Seo data={product.seo} />
      <nav className="mb-6 text-sm text-slate-500">
        <Link to="/" className="hover:text-primary">
          Начало
        </Link>{' '}
        /{' '}
        {product.category_name && product.category_slug && (
          <>
            <Link to={`/category/${product.category_slug}`} className="hover:text-primary">
              {product.category_name}
            </Link>{' '}
            /{' '}
          </>
        )}
        <span className="text-slate-700">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <div className="aspect-square rounded-ui border border-slate-200 bg-slate-50">
            {mainImageUrl ? (
              <img
                src={mainImageUrl}
                alt={product.name}
                className="h-full w-full object-contain p-6"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400">
                Няма изображение
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2">
              {images.map((image, index) => {
                const thumbUrl = getImageUrl(image.path)
                if (!thumbUrl) return null
                return (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    className={
                      index === activeImage
                        ? 'h-16 w-16 rounded-ui border-2 border-primary p-1'
                        : 'h-16 w-16 rounded-ui border border-slate-200 p-1'
                    }
                  >
                    <img src={thumbUrl} alt="" className="h-full w-full object-contain" />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div>
          {product.brand_name && (
            <span className="text-sm text-slate-500">{product.brand_name}</span>
          )}
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {product.supplier_id && <span className="text-slate-400">№{product.supplier_id} </span>}
            {product.name}
          </h1>
          {product.sku && <p className="mt-1 text-xs text-slate-400">Код: {product.sku}</p>}

          <div className="mt-4 flex items-baseline gap-3">
            {onSale && oldEur && (
              <span className="text-lg text-slate-400 line-through">€{oldEur}</span>
            )}
            <span
              className={
                onSale ? 'text-2xl font-bold text-red-600' : 'text-2xl font-bold text-slate-900'
              }
            >
              {currentEur ? `€${currentEur}` : 'Цена при запитване'}
            </span>
          </div>
          {current && (
            <div className="text-sm text-slate-500">
              {onSale && old && <span className="mr-1 line-through">{old} лв.</span>}
              {current} лв.
            </div>
          )}
          {product.pack_quantity && product.pack_quantity > 1 && (
            <p className="mt-1 text-sm text-slate-500">Опаковка: {product.pack_quantity} бр.</p>
          )}

          <AdminPriceEditor product={product} />

          <div className="mt-6 flex items-center gap-2">
            <span className="text-sm text-slate-600" id="qty-label">
              Количество
            </span>
            <div className="flex items-center rounded-ui border border-slate-300">
              <button
                type="button"
                aria-label="Намали количеството"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="px-3 py-2 text-lg text-slate-600 hover:text-primary disabled:opacity-40"
              >
                −
              </button>
              <input
                type="text"
                inputMode="numeric"
                aria-labelledby="qty-label"
                value={quantity}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, '')
                  if (digits === '') {
                    setQuantity(1)
                    return
                  }
                  setQuantity(Math.max(1, Number(digits)))
                }}
                className="w-12 border-x border-slate-300 py-2 text-center focus:outline-none"
              />
              <button
                type="button"
                aria-label="Увеличи количеството"
                onClick={() => setQuantity((q) => q + 1)}
                className="px-3 py-2 text-lg text-slate-600 hover:text-primary"
              >
                +
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              addItem(product, quantity)
              setAdded(true)
            }}
            className="mt-3 w-full rounded-ui bg-primary px-4 py-3 font-medium text-white hover:opacity-90"
          >
            {added ? 'Добавено в количката' : 'Добави в количката'}
          </button>

          {product.short_description && (
            <p className="mt-6 whitespace-pre-line text-slate-700">{product.short_description}</p>
          )}
        </div>
      </div>

      {specEntries.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Характеристики</h2>
          <table className="w-full border-collapse text-sm">
            <tbody>
              {specEntries.map(([key, value]) => (
                <tr key={key} className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-slate-500">{key}</td>
                  <td className="py-2 text-slate-800">{String(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {product.description && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Описание</h2>
          <p className="whitespace-pre-line text-slate-700">{product.description}</p>
        </section>
      )}

      {/* Personalized to the viewer's own browsing activity — doesn't
          render for guests or logged-in users with no view history yet. */}
      {recommendedProducts && recommendedProducts.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Препоръчано за вас</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {recommendedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {similarProducts && similarProducts.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Подобни продукти</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {similarProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
