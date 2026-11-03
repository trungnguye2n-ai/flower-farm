import { expect, test } from 'vitest'
import { orderTime } from '@/components/admin/order-format'

test('orderTime speaks Vietnam time', () => {
  const now = new Date('2026-11-03T10:00:00+07:00')
  expect(orderTime(new Date('2026-11-03T08:05:00+07:00'), now)).toBe('08:05 · hôm nay')
  expect(orderTime(new Date('2026-11-02T23:30:00+07:00'), now)).toBe('23:30 · hôm qua')
  expect(orderTime(new Date('2026-10-28T14:05:00+07:00'), now)).toBe('14:05 · 28/10')
  // 01:00 on the 3rd in Vietnam is still the 2nd in UTC
  expect(orderTime(new Date('2026-11-02T18:00:00Z'), now)).toBe('01:00 · hôm nay')
})
