import { usePage } from '../api/pages'

/**
 * Minimal markdown-lite renderer for `Page.body` — blocks separated by a
 * blank line, "## " starts a heading. Avoids pulling in a markdown library
 * for what is currently four static legal/info pages.
 */
function renderBody(body: string) {
  return body.split(/\n\n+/).map((block, index) => {
    if (block.startsWith('## ')) {
      return (
        <h2 key={index} className="mb-3 mt-6 text-lg font-semibold text-slate-900 first:mt-0">
          {block.slice(3)}
        </h2>
      )
    }
    return (
      <p key={index} className="mb-3 whitespace-pre-line text-slate-700">
        {block}
      </p>
    )
  })
}

export function LegalPage({ slug }: { slug: string }) {
  const { data: page, isLoading, isError } = usePage(slug)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {isLoading && <p className="text-slate-500">Зареждане...</p>}
      {isError && <p className="text-red-600">Страницата не може да бъде заредена.</p>}
      {page && (
        <>
          <h1 className="mb-6 text-2xl font-semibold text-slate-900">{page.title}</h1>
          {renderBody(page.body)}
        </>
      )}
    </div>
  )
}
