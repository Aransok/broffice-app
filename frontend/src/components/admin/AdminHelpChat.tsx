import { type FormEvent, forwardRef, useImperativeHandle, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminMentionDropdown } from './AdminMentionDropdown'
import { useAdminHelpChat } from './useAdminHelpChat'

export interface AdminHelpChatHandle {
  /** Opens the panel and asks about a topic, as if the admin had typed
   * "/topic" themselves — used by the sidebar's "?" buttons. */
  askAbout: (topic: string) => void
}

export const AdminHelpChat = forwardRef<AdminHelpChatHandle>(function AdminHelpChat(_props, ref) {
  const [open, setOpen] = useState(false)
  const {
    messages,
    logRef,
    input,
    handleInputChange,
    mentionQuery,
    mentionResults,
    pickMention,
    submit,
    askAbout,
  } = useAdminHelpChat()

  useImperativeHandle(ref, () => ({
    askAbout(topic: string) {
      setOpen(true)
      askAbout(topic)
    },
  }))

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    submit(input)
  }

  return (
    // bottom-20 (not bottom-4) + z-60: CookieConsentBanner is a full-width
    // bar fixed to the very bottom with z-50 — at z-30/bottom-4 it painted
    // straight over this button, making it invisible/unclickable any time
    // consent hadn't been given yet.
    <div className="fixed bottom-20 right-4 z-60 sm:bottom-6 sm:right-6">
      {open && (
        <div className="mb-3 flex h-144 w-104 max-w-[90vw] flex-col overflow-hidden rounded-ui border border-slate-200 bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <span className="text-lg font-semibold text-slate-900">Помощ</span>
            <div className="flex items-center gap-3">
              <Link
                to="/admin/chat"
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-primary hover:underline"
              >
                Пълен изглед
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Затвори помощта"
                className="text-2xl text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>
          </div>
          <div ref={logRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={
                  message.role === 'user'
                    ? 'ml-auto max-w-[85%] whitespace-pre-line rounded-ui bg-primary px-4 py-2.5 text-base text-white'
                    : 'mr-auto max-w-[90%] whitespace-pre-line rounded-ui bg-slate-100 px-4 py-2.5 text-base text-slate-700'
                }
              >
                {message.text}
                {message.link && (
                  <Link
                    to={message.link.to}
                    onClick={() => setOpen(false)}
                    className="mt-2 block rounded-ui bg-primary px-3 py-1.5 text-center text-sm font-medium text-white hover:opacity-90"
                  >
                    {message.link.label} →
                  </Link>
                )}
              </div>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="relative border-t border-slate-200 p-3">
            {mentionQuery !== null && (
              <AdminMentionDropdown
                options={mentionResults}
                onPick={pickMention}
                className="absolute bottom-full left-3 right-3 mb-1 max-h-48"
              />
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="/помощ или @продукт"
                className="flex-1 rounded-ui border border-slate-300 px-3 py-2 text-base"
              />
              <button
                type="submit"
                className="rounded-ui bg-primary px-4 py-2 text-base font-medium text-white"
              >
                Изпрати
              </button>
            </div>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Затвори помощта' : 'Отвори помощта'}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-3xl font-bold text-white shadow-lg hover:opacity-90"
      >
        ?
      </button>
    </div>
  )
})
