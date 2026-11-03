import { beforeEach, describe, expect, test } from 'vitest'
import type { Db } from '@/db/client'
import { countNewOrders, listOrders, setOrderStatus, telLink, zaloLink } from '@/admin/orders'
import { freshTestDb, testSql } from './helpers/db'

let db: Db
const ids: Record<string, string> = {}
beforeEach(async () => {
  db = await freshTestDb()
  const rows = [
    ['VH-0001', 'new', '2026-11-01T08:00:00Z'],
    ['VH-0002', 'confirmed', '2026-11-02T08:00:00Z'],
    ['VH-0003', 'new', '2026-11-03T08:00:00Z'],
  ] as const
  for (const [code, status, at] of rows) {
    const [o] = await testSql`insert into orders (code, customer_name, customer_phone, status, total, created_at, note)
      values (${code}, 'Lan', '0901234567', ${status}, 310000, ${at}, 'Chúc mừng sinh nhật') returning id`
    ids[code] = o.id
    await testSql`insert into order_items (order_id, product_name, variant_name, unit_price, quantity)
      values (${o.id}, 'Đỏ nhung', 'Chậu đang nở', 250000, 1), (${o.id}, 'Mười giờ Mỹ', '1 chậu', 30000, 2)`
  }
})

describe('listOrders', () => {
  test('newest first, with items in order', async () => {
    const orders = await listOrders(db, {})
    expect(orders.map((o) => o.code)).toEqual(['VH-0003', 'VH-0002', 'VH-0001'])
    expect(orders[0]).toMatchObject({ customerName: 'Lan', total: 310000, note: 'Chúc mừng sinh nhật', status: 'new' })
    expect(orders[0].items).toEqual([
      { productName: 'Đỏ nhung', variantName: 'Chậu đang nở', unitPrice: 250000, quantity: 1 },
      { productName: 'Mười giờ Mỹ', variantName: '1 chậu', unitPrice: 30000, quantity: 2 },
    ])
  })

  test('filters by status and pages with before', async () => {
    expect((await listOrders(db, { status: 'new' })).map((o) => o.code)).toEqual(['VH-0003', 'VH-0001'])
    const first = await listOrders(db, { limit: 2 })
    expect(first.map((o) => o.code)).toEqual(['VH-0003', 'VH-0002'])
    expect((await listOrders(db, { limit: 2, before: first.at(-1)!.createdAt })).map((o) => o.code)).toEqual(['VH-0001'])
  })
})

describe('status', () => {
  test('setOrderStatus changes it either way; unknown id is refused', async () => {
    expect(await setOrderStatus(db, ids['VH-0001'], 'delivered')).toEqual({ ok: true, data: null })
    expect(await setOrderStatus(db, ids['VH-0001'], 'new')).toEqual({ ok: true, data: null })
    expect(await setOrderStatus(db, '00000000-0000-0000-0000-000000000000', 'new')).toEqual({ ok: false, error: 'Không tìm thấy đơn' })
  })

  test('countNewOrders', async () => {
    expect(await countNewOrders(db)).toBe(2)
    await setOrderStatus(db, ids['VH-0003'], 'cancelled')
    expect(await countNewOrders(db)).toBe(1)
  })
})

describe('links', () => {
  test('keep only digits', () => {
    expect(zaloLink('0901 234 567')).toBe('https://zalo.me/0901234567')
    expect(telLink('+84 901.234.567')).toBe('tel:+84901234567')
  })
})
