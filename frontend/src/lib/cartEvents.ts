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

export function announceCartAdd(detail: CartAddDetail) {
  window.dispatchEvent(new CustomEvent<CartAddDetail>(EVENT, { detail }))
}

export function onCartAdd(handler: (detail: CartAddDetail) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<CartAddDetail>).detail)
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
