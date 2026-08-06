import { type FormEvent, useState } from 'react'
import { submitContactForm } from '../api/contact'
import { usePublicConfig } from '../api/config'

export function ContactPage() {
  const { data: config } = usePublicConfig()
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  // Prefer an explicit embed URL (e.g. the official Maps Embed API with a
  // key) if one is configured; otherwise fall back to Google's free keyless
  // "q=...&output=embed" iframe, which needs no API key/billing at all — no
  // key is hardcoded here either way.
  const mapsEmbedUrl =
    import.meta.env.VITE_GOOGLE_MAPS_EMBED_URL ||
    (config
      ? `https://www.google.com/maps?q=${encodeURIComponent(config.company_address)}&output=embed`
      : undefined)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setStatus('sending')
    try {
      await submitContactForm(form)
      setStatus('sent')
      setForm({ name: '', email: '', phone: '', subject: '', message: '' })
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Контакти</h1>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <div className="mb-6 space-y-1 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">{config?.company_name}</p>
            <p>{config?.company_address}</p>
            <p>ЕИК: {config?.company_eik}</p>
            {config?.company_vat_number && <p>ДДС номер: {config.company_vat_number}</p>}
            <p>
              Имейл:{' '}
              <a href={`mailto:${config?.company_email}`} className="text-primary hover:underline">
                {config?.company_email}
              </a>
            </p>
            <p>
              Телефон:{' '}
              <a
                href={`tel:${config?.company_phone.replace(/\s/g, '')}`}
                className="text-primary hover:underline"
              >
                {config?.company_phone}
              </a>
            </p>
            <p>Работно време: {config?.company_working_hours}</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="text"
              required
              placeholder="Име"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="rounded-ui border border-slate-300 px-3 py-2"
            />
            <input
              type="email"
              required
              placeholder="Имейл"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              className="rounded-ui border border-slate-300 px-3 py-2"
            />
            <input
              type="text"
              placeholder="Телефон (по избор)"
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              className="rounded-ui border border-slate-300 px-3 py-2"
            />
            <input
              type="text"
              placeholder="Тема"
              value={form.subject}
              onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
              className="rounded-ui border border-slate-300 px-3 py-2"
            />
            <textarea
              required
              placeholder="Съобщение"
              rows={5}
              value={form.message}
              onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
              className="rounded-ui border border-slate-300 px-3 py-2"
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="rounded-ui bg-primary px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              {status === 'sending' ? 'Изпращане...' : 'Изпрати'}
            </button>
            {status === 'sent' && (
              <p className="text-sm text-green-700">Съобщението е изпратено успешно!</p>
            )}
            {status === 'error' && (
              <p className="text-sm text-red-600">Възникна грешка. Опитайте отново.</p>
            )}
          </form>
        </div>

        <div className="min-h-[300px] overflow-hidden rounded-ui border border-slate-200">
          {mapsEmbedUrl && (
            <iframe
              title="Карта с местоположението ни"
              src={mapsEmbedUrl}
              className="h-full min-h-[300px] w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          )}
        </div>
      </div>
    </div>
  )
}
