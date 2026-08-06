import { useState } from 'react'

interface PasswordInputProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  autoComplete?: string
  className?: string
}

/** Eye-icon toggle reused on every password field (spec #19). */
export function PasswordInput({
  value,
  onChange,
  required,
  autoComplete,
  className,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        autoComplete={autoComplete}
        className={className ?? 'w-full rounded-ui border border-slate-300 px-3 py-2 pr-10'}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        tabIndex={-1}
        aria-label={visible ? 'Скрий паролата' : 'Покажи паролата'}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
      >
        {visible ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
            <path d="M3 3l18 18" strokeLinecap="round" />
            <path
              d="M10.6 10.6a2 2 0 0 0 2.83 2.83M6.6 6.7C4.4 8.1 2.7 10 2 12c1.5 4 5.5 7 10 7 1.6 0 3.1-.4 4.4-1.1M9.9 4.3A10.8 10.8 0 0 1 12 4c4.5 0 8.5 3 10 7a12.6 12.6 0 0 1-2.2 3.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  )
}
