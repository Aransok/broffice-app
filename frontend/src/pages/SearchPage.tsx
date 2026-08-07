import { useSearchParams } from 'react-router-dom'
import { useSearch } from '../api/search'
import { ProductCard } from '../components/product/ProductCard'
import { Seo } from '../components/Seo'

export function SearchPage() {
  const [searchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const { data, isLoading, isError } = useSearch(q)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Internal search results are excluded from robots.txt too — infinite
          query permutations have no indexing value, this is belt-and-suspenders
          for any crawler that ignores robots.txt. */}
      <Seo
        title={q ? `Резултати за "${q}" | BRoffice` : 'Търсене | BRoffice'}
        robots="noindex, follow"
      />
      <h1 className="mb-6 text-xl font-semibold text-slate-900">
        Резултати за &quot;{q}&quot;
      </h1>

      {!q && <p className="text-slate-500">Въведете дума за търсене.</p>}
      {isLoading && <p className="text-slate-500">Търсене...</p>}
      {isError && <p className="text-red-600">Търсенето не бе успешно в момента.</p>}
      {data && data.results.length === 0 && (
        <p className="text-slate-500">Няма намерени продукти.</p>
      )}
      {data && data.results.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {data.results.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}
