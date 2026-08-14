import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCategories } from '../../api/categories'
import { createCoupon } from '../../api/coupons'
import { fetchProducts } from '../../api/products'
import { createPromotion, searchAdminUsers } from '../../api/promotions'
import { advanceWizard, startWizard, type WizardState } from './adminCreateWizard'

vi.mock('../../api/categories', () => ({ fetchCategories: vi.fn() }))
vi.mock('../../api/products', () => ({ fetchProducts: vi.fn() }))
vi.mock('../../api/promotions', () => ({
  createPromotion: vi.fn(),
  searchAdminUsers: vi.fn(),
}))
vi.mock('../../api/coupons', () => ({ createCoupon: vi.fn() }))

const mockedFetchCategories = vi.mocked(fetchCategories)
const mockedFetchProducts = vi.mocked(fetchProducts)
const mockedSearchAdminUsers = vi.mocked(searchAdminUsers)
const mockedCreatePromotion = vi.mocked(createPromotion)
const mockedCreateCoupon = vi.mocked(createCoupon)

beforeEach(() => {
  vi.resetAllMocks()
})

describe('startWizard', () => {
  it('starts on choose_kind with empty data', () => {
    const state = startWizard()
    expect(state).toEqual({ step: 'choose_kind', data: {}, candidates: [] })
  })
})

describe('cancel', () => {
  it.each(['отказ', 'откажи', 'cancel', 'стоп', 'ОТКАЗ'])(
    'ends the wizard on "%s" from any step',
    async (word) => {
      const state: WizardState = { step: 'promo_value', data: { name: 'x' }, candidates: [] }
      const result = await advanceWizard(state, word)
      expect(result.state).toBeNull()
    },
  )
})

describe('choose_kind', () => {
  it('routes to promo_name on "промоция"', async () => {
    const result = await advanceWizard(startWizard(), 'промоция')
    expect(result.state?.step).toBe('promo_name')
  })

  it('routes to coupon_code on "купон"', async () => {
    const result = await advanceWizard(startWizard(), 'купон')
    expect(result.state?.step).toBe('coupon_code')
  })

  it('stays put and re-prompts on an unrecognized reply', async () => {
    const state = startWizard()
    const result = await advanceWizard(state, 'нещо друго')
    expect(result.state?.step).toBe('choose_kind')
  })
})

describe('promotion flow', () => {
  function stateAt(step: string, data: WizardState['data'] = {}): WizardState {
    return { step, data, candidates: [] }
  }

  it('rejects an empty name', async () => {
    const result = await advanceWizard(stateAt('promo_name'), '   ')
    expect(result.state?.step).toBe('promo_name')
  })

  it('records the name and asks for discount type', async () => {
    const result = await advanceWizard(stateAt('promo_name'), 'Лятна разпродажба')
    expect(result.state?.step).toBe('promo_discount_type')
    expect(result.state?.data.name).toBe('Лятна разпродажба')
  })

  it('parses "процент" as a percent discount type', async () => {
    const result = await advanceWizard(stateAt('promo_discount_type'), 'процент')
    expect(result.state?.step).toBe('promo_value')
    expect(result.state?.data.discount_type).toBe('percent')
  })

  it('parses "крайна" as a flat discount type', async () => {
    const result = await advanceWizard(stateAt('promo_discount_type'), 'крайна цена')
    expect(result.state?.data.discount_type).toBe('flat')
  })

  it('rejects a non-numeric discount value', async () => {
    const result = await advanceWizard(stateAt('promo_value'), 'много')
    expect(result.state?.step).toBe('promo_value')
  })

  it('accepts a numeric discount value and moves to scope', async () => {
    const result = await advanceWizard(stateAt('promo_value'), '20')
    expect(result.state?.step).toBe('promo_scope')
    expect(result.state?.data.value).toBe('20')
  })

  it('scope "всички" skips straight to the audience question (no category/product step)', async () => {
    const result = await advanceWizard(stateAt('promo_scope'), 'всички')
    expect(result.state?.step).toBe('promo_audience')
    expect(result.state?.data.scope).toBe('global')
  })

  it('scope "категория" asks for a category name', async () => {
    const result = await advanceWizard(stateAt('promo_scope'), 'категория')
    expect(result.state?.step).toBe('promo_category')
  })

  it('scope "продукт" asks for a product', async () => {
    const result = await advanceWizard(stateAt('promo_scope'), 'продукт')
    expect(result.state?.step).toBe('promo_product')
  })

  it('promo_category resolves directly to audience on a single match', async () => {
    mockedFetchCategories.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [{ id: 'cat-1', name: 'Хартия', slug: 'hartiya' } as never],
    })
    const result = await advanceWizard(stateAt('promo_category', { scope: 'category' }), 'харт')
    expect(result.state?.step).toBe('promo_audience')
    expect(result.state?.data.category).toBe('cat-1')
    // Regression guard: this must actually search by what the admin typed,
    // not show an arbitrary unfiltered list (the real cause of a
    // "Chemicals -10%" promotion once landing on the "Glues" category).
    expect(mockedFetchCategories).toHaveBeenCalledWith({ search: 'харт' })
  })

  it('promo_category lists numbered candidates on multiple matches', async () => {
    mockedFetchCategories.mockResolvedValue({
      count: 2,
      next: null,
      previous: null,
      results: [
        { id: 'cat-1', name: 'Хартия А' } as never,
        { id: 'cat-2', name: 'Хартия Б' } as never,
      ],
    })
    const result = await advanceWizard(stateAt('promo_category', { scope: 'category' }), 'харт')
    expect(result.state?.step).toBe('promo_category')
    expect(result.state?.candidates).toHaveLength(2)
    expect(result.message).toContain('1. Хартия А')
  })

  it('promo_category picks a candidate by number on the next reply', async () => {
    const state: WizardState = {
      step: 'promo_category',
      data: { scope: 'category' },
      candidates: [
        { id: 'cat-1', label: 'Хартия А' },
        { id: 'cat-2', label: 'Хартия Б' },
      ],
    }
    const result = await advanceWizard(state, '2')
    expect(result.state?.step).toBe('promo_audience')
    expect(result.state?.data.category).toBe('cat-2')
  })

  it('promo_category reports no match without touching state.step forward', async () => {
    mockedFetchCategories.mockResolvedValue({
      count: 0,
      next: null,
      previous: null,
      results: [],
    })
    const result = await advanceWizard(stateAt('promo_category', { scope: 'category' }), 'xyz')
    expect(result.state?.step).toBe('promo_category')
  })

  it('promo_product resolves directly via an @-mentioned product, skipping search', async () => {
    const result = await advanceWizard(
      stateAt('promo_product', { scope: 'product' }),
      'anything typed',
      { id: 'prod-1', label: 'Продукт X' },
    )
    expect(mockedFetchProducts).not.toHaveBeenCalled()
    expect(result.state?.step).toBe('promo_audience')
    expect(result.state?.data.product).toBe('prod-1')
  })

  it('promo_audience "всички" clears the user and moves to confirm', async () => {
    const result = await advanceWizard(
      stateAt('promo_audience', { name: 'Промо', scope: 'global' }),
      'всички клиенти',
    )
    expect(result.state?.step).toBe('promo_confirm')
    expect(result.state?.data.user).toBeNull()
  })

  it('promo_audience resolves an @-mentioned client directly', async () => {
    const result = await advanceWizard(
      stateAt('promo_audience', { name: 'Промо', scope: 'global' }),
      'anything',
      { id: '42', label: 'ivan@example.com' },
    )
    expect(mockedSearchAdminUsers).not.toHaveBeenCalled()
    expect(result.state?.step).toBe('promo_confirm')
    expect(result.state?.data.user).toBe('42')
  })

  it('promo_confirm "да" creates the promotion and ends the wizard', async () => {
    mockedCreatePromotion.mockResolvedValue({ name: 'Лятна разпродажба' } as never)
    const result = await advanceWizard(
      stateAt('promo_confirm', {
        name: 'Лятна разпродажба',
        discount_type: 'percent',
        value: '20',
        scope: 'global',
        user: null,
      }),
      'да',
    )
    expect(mockedCreatePromotion).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Лятна разпродажба', value: '20' }),
    )
    expect(result.state).toBeNull()
    expect(result.message).toContain('Готово')
  })

  it('promo_confirm surfaces a failure without crashing', async () => {
    mockedCreatePromotion.mockRejectedValue(new Error('network down'))
    const result = await advanceWizard(
      stateAt('promo_confirm', { name: 'X', value: '10', scope: 'global' }),
      'да',
    )
    expect(result.state).toBeNull()
    expect(result.message).toContain('грешка')
  })

  it('promo_confirm anything but "да" cancels without calling the API', async () => {
    const result = await advanceWizard(
      stateAt('promo_confirm', { name: 'X', value: '10', scope: 'global' }),
      'не',
    )
    expect(mockedCreatePromotion).not.toHaveBeenCalled()
    expect(result.state).toBeNull()
  })
})

describe('coupon flow end-to-end', () => {
  it('walks through code -> discount -> value -> min order -> user -> confirm -> create', async () => {
    let result = await advanceWizard(startWizard(), 'купон')
    expect(result.state?.step).toBe('coupon_code')

    result = await advanceWizard(result.state as WizardState, 'генерирай')
    expect(result.state?.step).toBe('coupon_discount_type')
    expect(result.state?.data.code).toBe('')

    result = await advanceWizard(result.state as WizardState, 'процент')
    expect(result.state?.step).toBe('coupon_value')

    result = await advanceWizard(result.state as WizardState, '15')
    expect(result.state?.step).toBe('coupon_min_order')

    result = await advanceWizard(result.state as WizardState, 'няма')
    expect(result.state?.step).toBe('coupon_user')
    expect(result.state?.data.min_order_amount).toBeNull()

    result = await advanceWizard(result.state as WizardState, 'всеки')
    expect(result.state?.step).toBe('coupon_confirm')

    mockedCreateCoupon.mockResolvedValue({ code: 'ABC123' } as never)
    result = await advanceWizard(result.state as WizardState, 'да')
    expect(mockedCreateCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ discount_type: 'percent', value: '15' }),
    )
    expect(result.state).toBeNull()
    expect(result.message).toContain('ABC123')
  })

  it('coupon_user resolves an @-mentioned client directly, skipping search', async () => {
    const state: WizardState = {
      step: 'coupon_user',
      data: { code: 'X', discount_type: 'flat', value: '5' },
      candidates: [],
    }
    const result = await advanceWizard(state, 'anything', {
      id: '7',
      label: 'maria@example.com',
    })
    expect(mockedSearchAdminUsers).not.toHaveBeenCalled()
    expect(result.state?.step).toBe('coupon_confirm')
    expect(result.state?.data.user).toBe('7')
  })
})

describe('unknown step', () => {
  it('resets gracefully instead of throwing', async () => {
    const result = await advanceWizard(
      { step: 'not_a_real_step', data: {}, candidates: [] },
      'hello',
    )
    expect(result.state).toBeNull()
  })
})
