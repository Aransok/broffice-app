import { describe, expect, it } from 'vitest'
import { parseQuickOrder } from './parseQuickOrder'

describe('parseQuickOrder', () => {
  it('reads code and quantity in the common formats', () => {
    expect(parseQuickOrder('CF283A x 4\n70031   x 10\n70031;3\nES-811 2 бр.\n123')).toEqual([
      { code: 'CF283A', quantity: 4 },
      { code: '70031', quantity: 10 },
      { code: '70031', quantity: 3 },
      { code: 'ES-811', quantity: 2 },
      { code: '123', quantity: 1 },
    ])
  })

  it('skips blank lines', () => {
    expect(parseQuickOrder('\n  \nA1 х 2\n')).toEqual([{ code: 'A1', quantity: 2 }])
  })
})
