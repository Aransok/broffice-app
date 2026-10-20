import { Link } from 'react-router-dom'
import { exitPreview, getPreviewUser } from '../preview'

/** Shown across the top of the shop while an admin previews it as a client. */
export function PreviewBanner() {
  const preview = getPreviewUser()
  if (!preview) return null
  return (
    <div className="sticky top-0 z-40 bg-amber-400 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm">
        <p className="flex-1">
          <span className="font-semibold">Преглед като клиента: {preview.name}.</span> Цените и
          промоциите са точно както ги вижда клиентът. Количката и поръчките остават вашите.
        </p>
        <Link
          to="/promotions"
          className="rounded-ui border border-slate-900/30 px-3 py-1 font-medium hover:bg-amber-300"
        >
          Неговите промоции
        </Link>
        <button
          type="button"
          onClick={exitPreview}
          className="rounded-ui bg-slate-900 px-3 py-1 font-medium text-white hover:bg-slate-700"
        >
          Изход от прегледа
        </button>
      </div>
    </div>
  )
}
