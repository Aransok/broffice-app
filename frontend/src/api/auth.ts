import { apiClient } from './client'

export interface Me {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  phone: string
  is_staff: boolean
  is_admin_portal: boolean
  is_developer: boolean
}

export interface RegisterPayload {
  first_name: string
  last_name?: string
  email: string
  phone: string
  password: string
  password_confirm: string
  terms_accepted: boolean
}

export interface ProfileUpdatePayload {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
}

export function fetchMe() {
  return apiClient.get<Me>('/me/').then((res) => res.data)
}

export function updateMe(payload: ProfileUpdatePayload) {
  return apiClient.patch<Me>('/me/', payload).then((res) => res.data)
}

export function register(payload: RegisterPayload) {
  return apiClient.post<Me>('/auth/register/', payload).then((res) => res.data)
}

export function login(username: string, password: string) {
  return apiClient.post<Me>('/auth/login/', { username, password }).then((res) => res.data)
}

export function logout() {
  return apiClient.post('/auth/logout/')
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
  newPasswordConfirm: string,
) {
  return apiClient
    .post<{ detail: string }>('/auth/change-password/', {
      current_password: currentPassword,
      new_password: newPassword,
      new_password_confirm: newPasswordConfirm,
    })
    .then((res) => res.data)
}

export function requestPasswordReset(email: string) {
  return apiClient
    .post<{ detail: string }>('/auth/password-reset/', { email })
    .then((res) => res.data)
}

export function confirmPasswordReset(uid: string, token: string, newPassword: string) {
  return apiClient
    .post<{ detail: string }>('/auth/password-reset/confirm/', {
      uid,
      token,
      new_password: newPassword,
    })
    .then((res) => res.data)
}
