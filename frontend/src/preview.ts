/** Admin "Преглед като клиента": the admin customer page opens the shop in a
 * new tab with `?preview_as=<id>&preview_name=<name>`. That tab remembers
 * the client in sessionStorage (so only that tab is in preview, the admin's
 * other tabs stay normal) and sends X-Preview-As-User on every read, so the
 * backend prices everything as that client (see get_pricing_user in
 * backend/api/views.py — it ignores the header for non-admins). */

const STORAGE_KEY = 'preview-as-user'

export interface PreviewUser {
  id: number
  name: string
}

function readStorage(): PreviewUser | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PreviewUser) : null
  } catch {
    return null
  }
}

let current: PreviewUser | null = readStorage()

/** Picks up `?preview_as=` once on load and strips it from the address bar. */
export function initPreviewFromUrl() {
  const url = new URL(window.location.href)
  const id = Number(url.searchParams.get('preview_as'))
  if (!id) return
  current = { id, name: url.searchParams.get('preview_name') || `Клиент #${id}` }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Private mode etc.: preview still works for this page load.
  }
  url.searchParams.delete('preview_as')
  url.searchParams.delete('preview_name')
  window.history.replaceState(window.history.state, '', url.toString())
}

export function getPreviewUser(): PreviewUser | null {
  return current
}

export function exitPreview() {
  const customerId = current?.id
  current = null
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing stored.
  }
  window.close()
  // window.close() is ignored when the tab wasn't opened by script.
  window.location.assign(customerId ? `/admin/customers/${customerId}` : '/admin/customers')
}

export function previewUrl(customerId: number, customerName: string, path = '/promotions') {
  const params = new URLSearchParams({ preview_as: String(customerId), preview_name: customerName })
  return `${path}?${params.toString()}`
}
