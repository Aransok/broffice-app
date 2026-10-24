import type { ProductListItem } from '../api/types'

/** Fired by any "add to cart" button so design-level UI (the Bold cart
 * drawer, the fly-to-cart animation) can react without each button
 * knowing about them. `source` is the element the animation starts from. */
export interface CartAddDetail {
  product: ProductListItem
  quantity: number
  source?: HTMLElement | null
}

const EVENT = 'broffice:cart-add'
const OPEN_EVENT = 'broffice:cart-open'

/** Asks the cart drawer (if the design has one) to open. Returns false
 * when nobody is listening, so the caller can fall back to /cart. */
export function requestCartOpen(): boolean {
  const event = new CustomEvent(OPEN_EVENT, { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

export function onCartOpen(handler: () => void) {
  const listener = (event: Event) => {
    event.preventDefault()
    handler()
  }
  window.addEventListener(OPEN_EVENT, listener)
  return () => window.removeEventListener(OPEN_EVENT, listener)
}

export function announceCartAdd(detail: CartAddDetail) {
  window.dispatchEvent(new CustomEvent<CartAddDetail>(EVENT, { detail }))
}

export function onCartAdd(handler: (detail: CartAddDetail) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<CartAddDetail>).detail)
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
