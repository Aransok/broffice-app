import { Link } from 'react-router-dom'
import { removeFavorite, useFavorites } from '../../api/favorites'
import { getImageUrl } from '../../api/media'

export function AccountFavoritesPage() {
  const { data, refetch, isLoading } = useFavorites(true)

  async function handleRemove(favoriteId: string) {
    await removeFavorite(favoriteId)
    await refetch()
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Любими продукти</h2>
      {isLoading && <p className="text-slate-500">Зареждане...</p>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {data?.results.map((favorite) => {
          const imageUrl = getImageUrl(favorite.product.primary_image)
          return (
            <div key={favorite.id} className="rounded-ui border border-slate-200 p-3">
              <Link to={`/product/${favorite.product.slug}`}>
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt={favorite.product.name}
                    className="mb-2 aspect-square w-full rounded-ui object-cover"
                  />
                )}
                <p className="line-clamp-2 text-sm font-medium text-slate-900">
                  {favorite.product.name}
                </p>
              </Link>
              <button
                type="button"
                onClick={() => handleRemove(favorite.id)}
                className="mt-2 text-sm text-red-600 hover:underline"
              >
                Премахни от любими
              </button>
            </div>
          )
        })}
      </div>
      {data && data.results.length === 0 && (
        <p className="text-slate-500">Нямате любими продукти още.</p>
      )}
    </div>
  )
}
