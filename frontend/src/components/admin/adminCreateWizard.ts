import { fetchCategories } from '../../api/categories'
import type { CouponDiscountType } from '../../api/coupons'
import { createCoupon } from '../../api/coupons'
import { fetchProducts } from '../../api/products'
import type { PromotionDiscountType, PromotionScope } from '../../api/promotions'
import { createPromotion, searchAdminUsers } from '../../api/promotions'
import type { HelpLink } from '../../data/adminHelp'

export interface CandidateOption {
  id: string
  label: string
  /** Only ever set for product candidates (categories/users have neither). */
  image?: string | null
  /** The supplier's own product number — shown alongside the (small,
   * sometimes similar-looking) thumbnail so the admin can tell products
   * apart with certainty, not just by a photo. */
  number?: string | null
}

export interface WizardState {
  step: string
  data: Record<string, string | null>
  /** Numbered options shown on an ambiguous match — a lone number as the
   * next reply picks from this list instead of triggering a fresh search. */
  candidates: CandidateOption[]
}

export interface WizardResult {
  state: WizardState | null
  message: string
  link?: HelpLink
}

export const WIZARD_START_PROMPT =
  'Какво искате да създадете — промоция или купон? (напишете "промоция" или "купон", по всяко ' +
  'време може да напишете "отказ", за да излезете)'

export function startWizard(): WizardState {
  return { step: 'choose_kind', data: {}, candidates: [] }
}

function parseNumber(text: string): number | null {
  const cleaned = text.trim().replace(',', '.').replace('%', '').replace('€', '')
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

function tryPickFromCandidates(state: WizardState, reply: string): CandidateOption | null {
  const index = Number(reply.trim())
  if (Number.isInteger(index) && index >= 1 && index <= state.candidates.length) {
    return state.candidates[index - 1]
  }
  return null
}

function ambiguous(
  state: WizardState,
  options: CandidateOption[],
  onResolved: (option: CandidateOption) => WizardResult | Promise<WizardResult>,
  nextStep: string,
  notFoundMessage: string,
): WizardResult | Promise<WizardResult> {
  if (options.length === 0) return { state, message: notFoundMessage }
  if (options.length === 1) return onResolved(options[0])
  const shortlist = options.slice(0, 8)
  const listText = shortlist.map((option, i) => `${i + 1}. ${option.label}`).join('\n')
  return {
    state: { ...state, step: nextStep, candidates: shortlist },
    message: `Намерих няколко съвпадения — напишете номера:\n\n${listText}`,
  }
}

function promoConfirmState(state: WizardState): WizardResult {
  const d = state.data
  const scopeLabel =
    d.scope === 'global'
      ? 'всички продукти'
      : d.scope === 'category'
        ? `категория „${d.categoryLabel}“`
        : `продукт „${d.productLabel}“`
  const audienceLabel = d.userLabel ? `само за клиент ${d.userLabel}` : 'за всички клиенти'
  const valueLabel = d.discount_type === 'percent' ? `-${d.value}%` : `крайна цена €${d.value}`
  const message =
    `Промоция „${d.name}“\nОбхват: ${scopeLabel}\nЗа кого: ${audienceLabel}\n` +
    `Отстъпка: ${valueLabel}\n\nПотвърждавате ли създаването? (да/не)`
  return { state: { ...state, step: 'promo_confirm', candidates: [] }, message }
}

function promoAudienceState(state: WizardState): WizardResult {
  return {
    state: { ...state, step: 'promo_audience', candidates: [] },
    message:
      'За конкретен клиент ли е, или за всички клиенти? Напишете име/имейл на клиент, ' +
      'или "всички клиенти".',
  }
}

function couponConfirmState(state: WizardState): WizardResult {
  const d = state.data
  const codeLabel = d.code ? `код ${d.code}` : 'автоматично генериран код'
  const valueLabel = d.discount_type === 'percent' ? `${d.value}%` : `€${d.value}`
  const userLabel = d.userLabel ? `само за ${d.userLabel}` : 'отворен за всеки'
  const minLabel = d.min_order_amount ? `, минимална поръчка €${d.min_order_amount}` : ''
  const message =
    `Купон — ${codeLabel}\nОтстъпка: ${valueLabel}${minLabel}\n${userLabel}\n\n` +
    'Потвърждавате ли създаването? (да/не)'
  return { state: { ...state, step: 'coupon_confirm', candidates: [] }, message }
}

export async function advanceWizard(
  state: WizardState,
  rawReply: string,
  /** Set when the reply was composed using an "@" mention picked from the
   * live autocomplete — resolves the current step directly instead of
   * running a fresh (and possibly ambiguous) search. What it searches
   * (products vs clients) depends on which step is pending — see
   * useAdminHelpChat's mention-context logic. */
  mentionedOption?: CandidateOption | null,
): Promise<WizardResult> {
  const reply = rawReply.trim()
  const normalized = reply.toLowerCase()

  if (['отказ', 'откажи', 'cancel', 'стоп'].includes(normalized)) {
    return { state: null, message: 'Отказано — нищо не е създадено.' }
  }

  switch (state.step) {
    case 'choose_kind': {
      if (normalized.includes('промоц')) {
        return {
          state: { ...state, step: 'promo_name' },
          message: 'Как да се казва промоцията? (напр. "Лятна разпродажба")',
        }
      }
      if (normalized.includes('купон')) {
        return {
          state: { ...state, step: 'coupon_code' },
          message:
            'Искате ли конкретен код, или да го генерирам автоматично? Напишете кода ' +
            '(напр. LqTO2026) или "генерирай".',
        }
      }
      return { state, message: 'Не разбрах — напишете "промоция" или "купон" (или "отказ").' }
    }

    case 'promo_name': {
      if (!reply) return { state, message: 'Моля въведете име за промоцията.' }
      return {
        state: { ...state, step: 'promo_discount_type', data: { ...state.data, name: reply } },
        message: 'Тип отстъпка — "процент" (%) или "крайна" цена (€)?',
      }
    }

    case 'promo_discount_type': {
      if (normalized.includes('процент') || normalized.includes('%')) {
        return {
          state: {
            ...state,
            step: 'promo_value',
            data: { ...state.data, discount_type: 'percent' },
          },
          message: 'Каква стойност в проценти? (напр. 20 за -20%)',
        }
      }
      if (
        normalized.includes('крайн') ||
        normalized.includes('финал') ||
        normalized.includes('€')
      ) {
        return {
          state: { ...state, step: 'promo_value', data: { ...state.data, discount_type: 'flat' } },
          message: 'Каква да е крайната цена в €? (напр. 9.99)',
        }
      }
      return { state, message: 'Напишете "процент" или "крайна".' }
    }

    case 'promo_value': {
      const value = parseNumber(reply)
      if (value === null) return { state, message: 'Моля въведете число, напр. 20 или 9.99.' }
      return {
        state: { ...state, step: 'promo_scope', data: { ...state.data, value: String(value) } },
        message: 'За какво важи? Изберете: "всички" (цяла страница), "категория" или "продукт".',
      }
    }

    case 'promo_scope': {
      if (normalized.includes('всичк') || normalized.includes('глобал')) {
        return promoAudienceState({ ...state, data: { ...state.data, scope: 'global' } })
      }
      if (normalized.includes('категор')) {
        return {
          state: { ...state, step: 'promo_category', data: { ...state.data, scope: 'category' } },
          message: 'Коя категория? Напишете (част от) името.',
        }
      }
      if (normalized.includes('продукт')) {
        return {
          state: { ...state, step: 'promo_product', data: { ...state.data, scope: 'product' } },
          message: 'Търсете продукт — напишете (част от) името или SKU.',
        }
      }
      return { state, message: 'Изберете едно от: "всички", "категория", "продукт".' }
    }

    case 'promo_category': {
      const picked = tryPickFromCandidates(state, reply)
      if (picked) {
        return promoAudienceState({
          ...state,
          data: { ...state.data, category: picked.id, categoryLabel: picked.label },
        })
      }
      const categories = await fetchCategories()
      return ambiguous(
        state,
        categories.results.map((c) => ({ id: c.id, label: c.name })),
        (option) =>
          promoAudienceState({
            ...state,
            data: { ...state.data, category: option.id, categoryLabel: option.label },
          }),
        'promo_category',
        'Не намерих категория с това име. Опитайте пак, или напишете "отказ".',
      )
    }

    case 'promo_product': {
      if (mentionedOption) {
        return promoAudienceState({
          ...state,
          data: {
            ...state.data,
            product: mentionedOption.id,
            productLabel: mentionedOption.label,
          },
        })
      }
      const picked = tryPickFromCandidates(state, reply)
      if (picked) {
        return promoAudienceState({
          ...state,
          data: { ...state.data, product: picked.id, productLabel: picked.label },
        })
      }
      const products = await fetchProducts({ search: reply })
      return ambiguous(
        state,
        products.results.map((p) => ({ id: p.id, label: `${p.name} (SKU: ${p.sku || '—'})` })),
        (option) =>
          promoAudienceState({
            ...state,
            data: { ...state.data, product: option.id, productLabel: option.label },
          }),
        'promo_product',
        'Не намерих продукт с това име/SKU. Опитайте пак, или напишете "отказ".',
      )
    }

    case 'promo_audience': {
      if (normalized.includes('всеки') || normalized.includes('всички')) {
        return promoConfirmState({
          ...state,
          data: { ...state.data, user: null, userLabel: null },
        })
      }
      if (mentionedOption) {
        return promoConfirmState({
          ...state,
          data: { ...state.data, user: mentionedOption.id, userLabel: mentionedOption.label },
        })
      }
      const picked = tryPickFromCandidates(state, reply)
      if (picked) {
        return promoConfirmState({
          ...state,
          data: { ...state.data, user: picked.id, userLabel: picked.label },
        })
      }
      const users = await searchAdminUsers(reply)
      return ambiguous(
        state,
        users.map((u) => ({ id: String(u.id), label: `${u.username} (${u.email})` })),
        (option) =>
          promoConfirmState({
            ...state,
            data: { ...state.data, user: option.id, userLabel: option.label },
          }),
        'promo_audience',
        'Не намерих клиент. Опитайте пак, или напишете "всички клиенти".',
      )
    }

    case 'promo_confirm': {
      if (normalized.includes('да')) {
        try {
          const d = state.data
          const promotion = await createPromotion({
            name: d.name ?? '',
            discount_type: d.discount_type as PromotionDiscountType,
            value: d.value ?? '0',
            scope: d.scope as PromotionScope,
            category: d.category ?? null,
            product: d.product ?? null,
            user: d.user ? Number(d.user) : null,
            active: true,
          })
          return {
            state: null,
            message: `Готово! Промоция „${promotion.name}“ е създадена и активна.`,
            link: { to: '/admin/promotions', label: 'Отвори Промоции' },
          }
        } catch {
          return {
            state: null,
            message: 'Възникна грешка при създаването. Проверете данните в „Промоции“.',
            link: { to: '/admin/promotions', label: 'Отвори Промоции' },
          }
        }
      }
      return { state: null, message: 'Отказано — нищо не е създадено.' }
    }

    case 'coupon_code': {
      const code = normalized.includes('генерир') ? '' : reply.toUpperCase()
      return {
        state: { ...state, step: 'coupon_discount_type', data: { ...state.data, code } },
        message: 'Тип отстъпка — "процент" (%) или "фиксирана" сума (€)?',
      }
    }

    case 'coupon_discount_type': {
      if (normalized.includes('процент') || normalized.includes('%')) {
        return {
          state: {
            ...state,
            step: 'coupon_value',
            data: { ...state.data, discount_type: 'percent' },
          },
          message: 'Каква стойност в проценти? (напр. 15)',
        }
      }
      if (normalized.includes('фикс') || normalized.includes('€') || normalized.includes('сума')) {
        return {
          state: { ...state, step: 'coupon_value', data: { ...state.data, discount_type: 'flat' } },
          message: 'Каква сума в € да е отстъпката? (напр. 5)',
        }
      }
      return { state, message: 'Напишете "процент" или "фиксирана".' }
    }

    case 'coupon_value': {
      const value = parseNumber(reply)
      if (value === null) return { state, message: 'Моля въведете число.' }
      return {
        state: {
          ...state,
          step: 'coupon_min_order',
          data: { ...state.data, value: String(value) },
        },
        message: 'Минимална сума на поръчката, за да важи купонът? (напишете число или "няма")',
      }
    }

    case 'coupon_min_order': {
      if (normalized.includes('няма') || normalized === '-' || normalized === '0') {
        return {
          state: {
            ...state,
            step: 'coupon_user',
            data: { ...state.data, min_order_amount: null },
          },
          message:
            'За конкретен клиент ли е, или отворен за всеки? Напишете име/имейл на клиент, ' +
            'или "всеки".',
        }
      }
      const value = parseNumber(reply)
      if (value === null) return { state, message: 'Моля въведете число или "няма".' }
      return {
        state: {
          ...state,
          step: 'coupon_user',
          data: { ...state.data, min_order_amount: String(value) },
        },
        message:
          'За конкретен клиент ли е, или отворен за всеки? Напишете име/имейл на клиент, ' +
          'или "всеки".',
      }
    }

    case 'coupon_user': {
      if (normalized.includes('всеки') || normalized.includes('всички')) {
        return couponConfirmState({
          ...state,
          data: { ...state.data, user: null, userLabel: null },
        })
      }
      if (mentionedOption) {
        return couponConfirmState({
          ...state,
          data: { ...state.data, user: mentionedOption.id, userLabel: mentionedOption.label },
        })
      }
      const picked = tryPickFromCandidates(state, reply)
      if (picked) {
        return couponConfirmState({
          ...state,
          data: { ...state.data, user: picked.id, userLabel: picked.label },
        })
      }
      const users = await searchAdminUsers(reply)
      return ambiguous(
        state,
        users.map((u) => ({ id: String(u.id), label: `${u.username} (${u.email})` })),
        (option) =>
          couponConfirmState({
            ...state,
            data: { ...state.data, user: option.id, userLabel: option.label },
          }),
        'coupon_user',
        'Не намерих клиент. Опитайте пак, или напишете "всеки".',
      )
    }

    case 'coupon_confirm': {
      if (normalized.includes('да')) {
        try {
          const d = state.data
          const coupon = await createCoupon({
            code: d.code || undefined,
            discount_type: d.discount_type as CouponDiscountType,
            value: d.value ?? '0',
            min_order_amount: d.min_order_amount ?? null,
            user: d.user ? Number(d.user) : null,
            active: true,
          })
          return {
            state: null,
            message: `Готово! Купон „${coupon.code}“ е създаден.`,
            link: { to: '/admin/coupons', label: 'Отвори Купони' },
          }
        } catch {
          return {
            state: null,
            message: 'Възникна грешка при създаването. Проверете данните в „Купони“.',
            link: { to: '/admin/coupons', label: 'Отвори Купони' },
          }
        }
      }
      return { state: null, message: 'Отказано — нищо не е създадено.' }
    }

    default:
      return { state: null, message: 'Нещо се обърка — пробвайте пак с /създай.' }
  }
}
