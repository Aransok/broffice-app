import axios from 'axios'
import { getPreviewUser } from '../preview'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1',
  withCredentials: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
  // axios only auto-attaches the XSRF header for same-origin requests by
  // default; the API is cross-origin (different port) from the SPA in dev,
  // so this must be forced on or the header silently never gets sent.
  withXSRFToken: true,
})

// Admin previewing the shop as a client: reads are priced as that client.
// Only reads - the cart, orders etc. stay the admin's own.
apiClient.interceptors.request.use((config) => {
  const preview = getPreviewUser()
  if (preview && (config.method ?? 'get').toLowerCase() === 'get') {
    config.headers.set('X-Preview-As-User', String(preview.id))
  }
  return config
})

/** Forces Django to set the csrftoken cookie so later POSTs can attach it. */
export function primeCsrfCookie() {
  return apiClient.get('/auth/csrf/')
}
