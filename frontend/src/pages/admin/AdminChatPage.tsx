import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AdminMentionDropdown } from '../../components/admin/AdminMentionDropdown'
import { useAdminHelpChat } from '../../components/admin/useAdminHelpChat'

/** Full-page version of the floating help chat (AdminHelpChat) — same
 * conversation/wizard/@ mention logic via the shared hook, just given a lot
 * more room than the small popup allows. */
export function AdminChatPage() {
  const {
    messages,
    logRef,
    input,
    handleInputChange,
    mentionQuery,
    mentionResults,
    pickMention,
    submit,
  } = useAdminHelpChat()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    submit(input)
  }

  return (
    <div className="mx-auto flex h-[80vh] max-w-3xl flex-col px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Помощ и бърза поръчка</h1>

      <div
        ref={logRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-ui border border-slate-200 bg-surface p-6"
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className={
              message.role === 'user'
                ? 'ml-auto max-w-[75%] whitespace-pre-line rounded-ui bg-primary px-5 py-3 text-base text-white'
                : 'mr-auto max-w-[80%] whitespace-pre-line rounded-ui bg-slate-100 px-5 py-3 text-base text-slate-700'
            }
          >
            {message.text}
            {message.link && (
              <Link
                to={message.link.to}
                className="mt-3 block rounded-ui bg-primary px-4 py-2 text-center text-sm font-medium text-white hover:opacity-90"
              >
                {message.link.label} →
              </Link>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="relative mt-4">
        {mentionQuery !== null && (
          <AdminMentionDropdown
            options={mentionResults}
            onPick={pickMention}
            className="absolute bottom-full left-0 right-0 mb-2 max-h-64"
          />
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="/помощ, /създай или @продукт"
            autoFocus
            className="flex-1 rounded-ui border border-slate-300 px-4 py-3 text-base"
          />
          <button
            type="submit"
            className="rounded-ui bg-primary px-6 py-3 text-base font-medium text-white"
          >
            Изпрати
          </button>
        </div>
      </form>
    </div>
  )
}
