import axios from 'axios'

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

/** Forces Django to set the csrftoken cookie so later POSTs can attach it. */
export function primeCsrfCookie() {
  return apiClient.get('/auth/csrf/')
}
