import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, type ReactNode, useContext } from 'react'
import {
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  type Me,
  type RegisterPayload,
} from '../api/auth'

interface AuthContextValue {
  user: Me | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<Me>
  register: (payload: RegisterPayload) => Promise<Me>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    retry: false,
    // Not logged in is the expected default state, not an error to surface.
    throwOnError: false,
  })

  // Wipes every OTHER cached query (cart, favorites, orders, addresses,
  // product lists carrying admin-only reseller price/profit, ...) so
  // switching accounts in the same tab never shows stale data from a
  // previous session — but deliberately never touches the 'me' query itself.
  // queryClient.clear() (removing *everything*, 'me' included) was the
  // actual cause of a real bug: it destroys the Query object backing the
  // AuthProvider's own actively-mounted useQuery(['me']) observer, and that
  // observer doesn't reliably reattach to the query recreated a line later
  // by setQueryData — only a full remount (a page reload) picked it up
  // again. Excluding 'me' here means that observer's query object is never
  // torn down, so the UI updates immediately on login/logout/register.
  function clearOtherQueries() {
    const predicate = (query: { queryKey: readonly unknown[] }) => query.queryKey[0] !== 'me'
    // invalidateQueries first, while the data's still there — this is what
    // actually forces every currently-mounted query (e.g. a product page
    // still on screen, showing the reseller price/profit the admin
    // session unlocked) to refetch and re-render right away. removeQueries
    // alone only clears the cache entry; an already-rendered component just
    // keeps showing its last data until something else triggers a refetch —
    // in practice that meant needing a full page reload after logout.
    queryClient.invalidateQueries({ predicate })
    queryClient.removeQueries({ predicate })
  }

  async function login(username: string, password: string) {
    const me = await apiLogin(username, password)
    queryClient.setQueryData(['me'], me)
    clearOtherQueries()
    return me
  }

  async function register(payload: RegisterPayload) {
    const me = await apiRegister(payload)
    queryClient.setQueryData(['me'], me)
    clearOtherQueries()
    return me
  }

  async function logout() {
    await apiLogout()
    queryClient.setQueryData(['me'], null)
    clearOtherQueries()
  }

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
