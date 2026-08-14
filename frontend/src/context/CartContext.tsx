import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react'
import { addMyCartItem, fetchMyCart, removeMyCartItem, updateMyCartItem } from '../api/cart'
import type { ProductListItem } from '../api/types'
import { useAuth } from './AuthContext'

export interface CartItem {
  productId: string
  slug: string
  name: string
  /** The supplier/catalog number shown as "№..." everywhere else a product
   * is listed (replaces SKU, which no longer exists) — null for a
   * manually-added product with no supplier number and no item_number yet. */
  productNumber: string | null
  price: string | null
  image: string | null
  quantity: number
}

interface GuestState {
  items: CartItem[]
}

type GuestAction =
  | { type: 'add'; product: ProductListItem; quantity: number }
  | { type: 'remove'; productId: string }
  | { type: 'setQuantity'; productId: string; quantity: number }
  | { type: 'clear' }

const STORAGE_KEY = 'broffice.cart.v1'

function readGuestState(): GuestState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { items: JSON.parse(raw) } : { items: [] }
  } catch {
    // Corrupt/old cart payload — start fresh.
    return { items: [] }
  }
}

function guestReducer(state: GuestState, action: GuestAction): GuestState {
  switch (action.type) {
    case 'add': {
      const existing = state.items.find((item) => item.productId === action.product.id)
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.productId === action.product.id
              ? { ...item, quantity: item.quantity + action.quantity }
              : item,
          ),
        }
      }
      return {
        items: [
          ...state.items,
          {
            productId: action.product.id,
            slug: action.product.slug,
            name: action.product.name,
            productNumber:
              action.product.supplier_id ||
              (action.product.item_number ? String(action.product.item_number) : null),
            price: action.product.client_price ?? action.product.price_bgn,
            image: action.product.primary_image,
            quantity: action.quantity,
          },
        ],
      }
    }
    case 'remove':
      return { items: state.items.filter((item) => item.productId !== action.productId) }
    case 'setQuantity':
      return {
        items: state.items.map((item) =>
          item.productId === action.productId
            ? { ...item, quantity: Math.max(1, action.quantity) }
            : item,
        ),
      }
    case 'clear':
      return { items: [] }
    default:
      return state
  }
}

interface CartContextValue {
  items: CartItem[]
  itemCount: number
  totalPrice: number
  addItem: (product: ProductListItem, quantity?: number) => void
  removeItem: (productId: string) => void
  setQuantity: (productId: string, quantity: number) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

/**
 * Guest visitors keep the original client-only/localStorage cart (no
 * account to attach a server cart to). Logged-in customers' cart lives on
 * the server (`/api/v1/cart/`) — the exact same `Cart` row the admin
 * per-customer cart tool reads/writes — so admin edits and the customer's
 * own storefront actions are always looking at one shared source of truth,
 * never two independent stores. The frontend here is only ever a view over
 * that server state for authenticated users; it never invents a price or
 * treats local state as authoritative.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth()
  const isAuthenticated = Boolean(user)
  const queryClient = useQueryClient()

  const [guestState, dispatchGuest] = useReducer(guestReducer, undefined, readGuestState)

  useEffect(() => {
    if (!isAuthenticated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(guestState.items))
    }
  }, [guestState.items, isAuthenticated])

  const { data: serverCart } = useQuery({
    queryKey: ['my-cart'],
    queryFn: fetchMyCart,
    enabled: isAuthenticated,
  })

  function invalidateCart() {
    queryClient.invalidateQueries({ queryKey: ['my-cart'] })
  }

  // Merge-on-login: whatever was collected as a guest gets pushed into the
  // now-authenticated customer's real server cart exactly once, then the
  // local guest copy is cleared so it can't be re-merged on a future login.
  const mergedForUserRef = useRef<string | null>(null)
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      mergedForUserRef.current = null
      return
    }
    if (mergedForUserRef.current === user.username) return
    mergedForUserRef.current = user.username

    const guestItems = readGuestState().items
    if (guestItems.length === 0) return

    void (async () => {
      for (const item of guestItems) {
        try {
          await addMyCartItem(item.productId, item.quantity)
        } catch {
          // Best-effort merge — one bad line (e.g. a since-removed product)
          // shouldn't block the rest of the guest cart from merging in.
        }
      }
      localStorage.removeItem(STORAGE_KEY)
      dispatchGuest({ type: 'clear' })
      invalidateCart()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading])

  const items: CartItem[] = useMemo(() => {
    if (!isAuthenticated) return guestState.items
    if (!serverCart) return []
    return serverCart.items.map((line) => ({
      productId: line.product_id,
      slug: line.product_slug,
      name: line.product_name,
      productNumber: line.product_number || null,
      price: line.unit_price,
      image: line.product_image,
      quantity: line.quantity,
    }))
  }, [isAuthenticated, serverCart, guestState.items])

  const itemIdByProduct = useMemo(() => {
    const map = new Map<string, string>()
    serverCart?.items.forEach((line) => map.set(line.product_id, line.item_id))
    return map
  }, [serverCart])

  function addItem(product: ProductListItem, quantity = 1) {
    if (isAuthenticated) {
      addMyCartItem(product.id, quantity)
        .then(invalidateCart)
        .catch(() => {
          /* surfaced to the user as the cart simply not updating; the
             invalidated query will reflect real server state either way */
        })
      return
    }
    dispatchGuest({ type: 'add', product, quantity })
  }

  function removeItem(productId: string) {
    if (isAuthenticated) {
      const itemId = itemIdByProduct.get(productId)
      if (!itemId) return
      removeMyCartItem(itemId).then(invalidateCart).catch(invalidateCart)
      return
    }
    dispatchGuest({ type: 'remove', productId })
  }

  function setQuantity(productId: string, quantity: number) {
    if (isAuthenticated) {
      const itemId = itemIdByProduct.get(productId)
      if (!itemId) return
      updateMyCartItem(itemId, Math.max(1, quantity)).then(invalidateCart).catch(invalidateCart)
      return
    }
    dispatchGuest({ type: 'setQuantity', productId, quantity })
  }

  function clear() {
    if (isAuthenticated) {
      if (!serverCart) return
      Promise.all(serverCart.items.map((line) => removeMyCartItem(line.item_id)))
        .then(invalidateCart)
        .catch(invalidateCart)
      return
    }
    dispatchGuest({ type: 'clear' })
  }

  const value = useMemo<CartContextValue>(() => {
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
    const totalPrice = items.reduce(
      (sum, item) => sum + (item.price ? Number(item.price) * item.quantity : 0),
      0,
    )
    return { items, itemCount, totalPrice, addItem, removeItem, setQuantity, clear }
    // addItem/removeItem/setQuantity/clear close over isAuthenticated/serverCart/
    // itemIdByProduct, all of which are already reflected via `items` changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
