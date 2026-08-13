import { useState } from 'react'
import { updateProductPricing } from '../../api/adminProducts'
import { usePromotions } from '../../api/promotions'
import type { ProductDetail } from '../../api/types'
import { useAuth } from '../../context/AuthContext'
import { bgnToEur, eurToBgn } from '../../utils/currency'
import { AdminQuickPromotionButton } from '../admin/AdminQuickPromotionButton'

export function AdminPriceEditor({ product }: { product: ProductDetail }) {
  const { user } = useAuth()
  const [clientPrice, setClientPrice] = useState(product.client_price ?? '')
  const [clientPriceEur, setClientPriceEur] = useState(bgnToEur(product.client_price ?? ''))
  const [adminPrice, setAdminPrice] = useState(product.admin_price ?? '')
  const [adminPriceEur, setAdminPriceEur] = useState(bgnToEur(product.admin_price ?? ''))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const { data: promotions, refetch: refetchPromotions } = usePromotions({
    product: product.id,
  })

  if (!user?.is_admin_portal) return null

  // user === null: the "for everyone" promo on this product, not a
  // different client's own product-targeted discount (both can now coexist
  // — see promotions target/audience decoupling).
  const productPromotion =
    promotions?.results.find(
      (p) => p.scope === 'product' && p.product === product.id && p.user === null,
    ) ?? null

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      await updateProductPricing(product.id, {
        client_price: clientPrice || undefined,
        admin_price: adminPrice || undefined,
      })
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 rounded-ui border border-dashed border-primary/40 bg-primary/5 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
        Админ цени (видими само за теб)
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-600">
          Цена за клиент (€)
          <input
            type="text"
            value={clientPriceEur}
            onChange={(event) => {
              const eur = event.target.value
              setClientPriceEur(eur)
              setClientPrice(eurToBgn(eur))
            }}
            className="mt-1 w-full rounded-ui border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-slate-600">
          Цена за реселър (€)
          <input
            type="text"
            value={adminPriceEur}
            onChange={(event) => {
              const eur = event.target.value
              setAdminPriceEur(eur)
              setAdminPrice(eurToBgn(eur))
            }}
            className="mt-1 w-full rounded-ui border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-2 rounded-ui bg-primary px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? 'Запазване...' : saved ? 'Запазено' : 'Запази цените'}
      </button>

      <div className="mt-3 border-t border-primary/20 pt-2">
        <AdminQuickPromotionButton
          audience="everyone"
          productId={product.id}
          productName={product.name}
          existingPromotion={productPromotion}
          onCreated={() => void refetchPromotions()}
        />
      </div>
    </div>
  )
}
