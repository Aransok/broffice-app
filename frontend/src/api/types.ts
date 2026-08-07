export interface SeoData {
  title: string
  description: string
  keywords: string
  canonical: string
  robots: string
  open_graph: Record<string, string>
  json_ld: Record<string, unknown>[]
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface Brand {
  id: string
  external_id: string
  slug: string
  name: string
  logo_path: string
}

export interface Category {
  id: string
  external_id: string
  slug: string
  name: string
  parent: string | null
  image_path: string
  sort_order: number
  /** Only present on the single-category fetch (CategoryDetailSerializer),
   * never the paginated list — this category's own direct subcategories. */
  children?: Category[]
  /** Only present on the single-category fetch, same as `children`. */
  seo?: SeoData
}

export interface ProductImage {
  id: string
  path: string
  alt_text: string
  sort_order: number
  thumbnail_path: string
  webp_path: string
}

export interface ProductListItem {
  id: string
  external_id: string
  item_number: number | null
  /** The supplier's own numeric product id (blank for legacy/manually-added
   * products never synced from the supplier catalog). */
  supplier_id: string
  slug: string
  sku: string
  name: string
  category: string | null
  category_name: string | null
  category_slug: string | null
  brand: string | null
  brand_name: string | null
  price_bgn: string | null
  price_eur: string | null
  old_price_bgn: string | null
  old_price_eur: string | null
  client_price: string | null
  admin_price: string | null
  promo_price_bgn: string | null
  currency: string
  availability: string
  primary_image: string | null
  is_favorited: boolean
}

export interface ProductDetail extends ProductListItem {
  description: string
  short_description: string
  pack_quantity: number | null
  specifications: Record<string, unknown>
  images: ProductImage[]
  seo: SeoData
}

export interface MenuItem {
  id: string
  label: string
  url: string
  category: string | null
  sort_order: number
  children: MenuItem[]
}

export interface Menu {
  id: string
  name: string
  location: string
  items: MenuItem[]
}

export interface SearchResponse {
  results: ProductListItem[]
  query: string
}

export interface Address {
  id: string
  label: string
  full_name: string
  phone: string
  city: string
  post_code: string
  address_line: string
  is_default: boolean
}

export interface SpeedyOffice {
  id: string
  external_id: string
  name: string
  city: string
  address: string
  phone: string
}

export type ShippingMethod = 'speedy_address' | 'speedy_office'
export type PaymentMethod = 'cash_on_delivery'

export interface OrderItemDto {
  id: string
  product: string | null
  product_name: string
  product_external_id: string
  product_sku: string
  product_slug: string | null
  product_image: string | null
  quantity: number
  original_unit_price: string | null
  unit_price: string
  line_total: string
  discount_label: string
  /** Admin-only — reseller cost snapshot vs. unit_price, null for
   * non-admins and for orders/products with no recorded cost. */
  profit_bgn: string | null
}

export interface Invoice {
  id: string
  number: string
  issued_at: string
  pdf_file: string | null
}

export interface Order {
  id: string
  number: string
  /** The registered account that placed this order, if any — distinct from
   * `customer_name`/`customer_email` below, which are whatever was typed at
   * checkout (guest or logged-in) and never change even if the account's
   * profile does later. Null for guest checkouts. */
  user: number | null
  username: string | null
  customer_email: string
  customer_name: string
  customer_phone: string
  is_company_order: boolean
  company_name: string
  company_eik: string
  company_vat_number: string
  company_address: string
  company_mol: string
  status: 'pending' | 'confirmed' | 'rejected'
  shipping_method: ShippingMethod | ''
  payment_method: PaymentMethod
  delivery_address_line: string
  delivery_city: string
  delivery_post_code: string
  speedy_office_id: string
  speedy_office_name: string
  shipping_cost_bgn: string
  subtotal_bgn: string
  coupon_code: string
  coupon_discount_bgn: string
  vat_rate_percent: string
  vat_amount_bgn: string
  total_bgn: string
  notes: string
  reject_reason: string
  items: OrderItemDto[]
  invoice: Invoice | null
  /** Admin-only — null for non-admins and for orders with no recorded cost
   * on any line (e.g. placed before cost tracking existed). */
  total_profit_bgn: string | null
  created_at: string
}

export interface OrderCreatePayload {
  customer_email: string
  customer_name?: string
  customer_phone?: string
  notes?: string
  items: { product_id: string; quantity: number }[]
  address_id?: string
  shipping_method?: ShippingMethod | ''
  delivery_address_line?: string
  delivery_city?: string
  delivery_post_code?: string
  speedy_office_id?: string
  payment_method?: PaymentMethod
  coupon_code?: string
  is_company_order?: boolean
  company_name?: string
  company_eik?: string
  company_vat_number?: string
  company_address?: string
  company_mol?: string
}
