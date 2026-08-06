import { getImageUrl } from '../../api/media'
import type { CandidateOption } from './adminCreateWizard'

export function AdminMentionDropdown({
  options,
  onPick,
  className = '',
}: {
  options: CandidateOption[]
  onPick: (option: CandidateOption) => void
  className?: string
}) {
  if (options.length === 0) return null
  return (
    <ul
      className={`divide-y divide-slate-100 overflow-y-auto rounded-ui border border-slate-200 bg-surface shadow-lg ${className}`}
    >
      {options.map((option) => {
        const imageUrl = getImageUrl(option.image ?? null)
        return (
          <li key={option.id}>
            <button
              type="button"
              // onMouseDown (not onClick) fires before the input's
              // blur/re-render would otherwise dismiss this list.
              onMouseDown={(event) => {
                event.preventDefault()
                onPick(option)
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-primary/10"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-ui border border-slate-200 bg-slate-100">
                {imageUrl && <img src={imageUrl} alt="" className="h-full w-full object-contain" />}
              </div>
              <span className="min-w-0 flex-1 truncate">
                {option.number && <span className="mr-1 text-slate-400">№{option.number}</span>}
                {option.label}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
