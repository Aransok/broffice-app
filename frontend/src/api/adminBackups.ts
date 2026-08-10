import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'

export interface Backup {
  name: string
  size_kb: number
  has_media: boolean
}

export interface RestoreStatus {
  state: 'idle' | 'pending' | 'in_progress' | 'done' | 'error'
  message: string
}

export function fetchBackups() {
  return apiClient.get<Backup[]>('/admin/backups/').then((res) => res.data)
}

export function useBackups() {
  return useQuery({ queryKey: ['admin-backups'], queryFn: fetchBackups })
}

export function requestRestore(name: string) {
  return apiClient
    .post<{ detail: string }>(`/admin/backups/${encodeURIComponent(name)}/restore/`)
    .then((res) => res.data)
}

export function fetchRestoreStatus() {
  return apiClient.get<RestoreStatus>('/admin/backups/status/').then((res) => res.data)
}

// Polls while a restore is actually in flight (pending/in_progress) so the
// UI reflects real progress from restore-watcher.ps1 without the user
// needing to refresh — stops polling once it settles into done/error/idle.
export function useRestoreStatus(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-backup-restore-status'],
    queryFn: fetchRestoreStatus,
    enabled,
    refetchInterval: (query) => {
      const state = query.state.data?.state
      return state === 'pending' || state === 'in_progress' ? 3000 : false
    },
  })
}
