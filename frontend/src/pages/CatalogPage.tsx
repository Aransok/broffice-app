import { Link } from 'react-router-dom'
import { useCategoryTree } from '../api/categories'

/** "Каталози" — the legacy site scrape found zero catalog PDFs or menu-target
 * data for this nav item (docs/discovery/downloads.md), so rather than invent
 * a download feature with nothing to put in it, this reuses the exact same
 * category tree the mega-menu already shows, as a full browsable page. No
 * new category data or backend endpoint. */
export function CatalogPage() {
  const { data: tree, isLoading } = useCategoryTree()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-4 text-sm text-slate-500">
        <Link to="/" className="hover:text-primary">
          Начало
        </Link>{' '}
        / <span className="text-slate-700">Каталози</span>
      </nav>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Каталози</h1>

      {isLoading && <p className="text-slate-500">Зареждане...</p>}
      {tree && tree.length === 0 && <p className="text-slate-500">Няма налични категории.</p>}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {tree?.map((root) => (
          <div key={root.id} className="rounded-ui border border-slate-200 p-4">
            <Link
              to={`/category/${root.slug}`}
              className="mb-3 block text-base font-semibold text-slate-900 hover:text-primary"
            >
              {root.name}
            </Link>
            {root.children.length > 0 ? (
              <div className="flex flex-col gap-3">
                {root.children.map((mid) => (
                  <div key={mid.id}>
                    <Link
                      to={`/category/${mid.slug}`}
                      className="block text-sm font-medium text-slate-700 hover:text-primary"
                    >
                      {mid.name}
                    </Link>
                    {mid.children.length > 0 && (
                      <ul className="mt-1 flex flex-col gap-1 pl-3">
                        {mid.children.map((leaf) => (
                          <li key={leaf.id}>
                            <Link
                              to={`/category/${leaf.slug}`}
                              className="text-sm text-slate-500 hover:text-primary"
                            >
                              {leaf.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Без подкатегории.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
