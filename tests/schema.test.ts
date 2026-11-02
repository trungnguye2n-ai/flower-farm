import { beforeEach, describe, expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { categories, orderItems, orders, productImages, products, productVariants, siteSettings } from '@/db/schema'
import { freshTestDb, pgCode, testSql } from './helpers/db'

let db: Db

async function category(slug = 'bach-thuy-tien') {
  const [c] = await db.insert(categories).values({ slug, name: 'Bách thủy tiên' }).returning()
  return c
}
async function product(slug = 'do-nhung') {
  const c = await category()
  const [p] = await db.insert(products).values({ categoryId: c.id, slug, name: 'Đỏ nhung', accentColor: '#9E1B32' }).returning()
  return p
}

beforeEach(async () => {
  db = await freshTestDb()
})

describe('schema', () => {
  test('migrations apply to an empty database', async () => {
    const [{ n }] = await testSql`select count(*)::int as n from drizzle.__drizzle_migrations`
    expect(n).toBeGreaterThanOrEqual(1)
  })

  test('rejects negative price', async () => {
    const p = await product()
    expect(await pgCode(db.insert(productVariants).values({ productId: p.id, name: 'Củ trần', price: -1 }))).toBe('23514')
  })

  test('rejects second primary image', async () => {
    const p = await product()
    await db.insert(productImages).values({ productId: p.id, storageKey: 'public/a.webp', width: 10, height: 10, isPrimary: true })
    expect(
      await pgCode(db.insert(productImages).values({ productId: p.id, storageKey: 'public/b.webp', width: 10, height: 10, isPrimary: true })),
    ).toBe('23505')
  })

  test('slug can be reused after soft delete', async () => {
    const p = await product('a')
    await db.update(products).set({ deletedAt: new Date() }).where(eq(products.id, p.id))
    await db.insert(products).values({ categoryId: p.categoryId, slug: 'a', name: 'Mới', accentColor: '#112233' })
    expect(await pgCode(db.insert(products).values({ categoryId: p.categoryId, slug: 'a', name: 'Trùng', accentColor: '#112233' }))).toBe('23505')
  })

  test('rejects a malformed accent color', async () => {
    const c = await category()
    expect(await pgCode(db.insert(products).values({ categoryId: c.id, slug: 'x', name: 'X', accentColor: 'red' }))).toBe('23514')
  })

  test('order_items keep snapshot when product is hard-deleted', async () => {
    const p = await product()
    const [v] = await db.insert(productVariants).values({ productId: p.id, name: 'Chậu đang nở', price: 250000 }).returning()
    const [o] = await db.insert(orders).values({ code: 'VH-0001', customerName: 'An', customerPhone: '0912345678', total: 250000 }).returning()
    await db.insert(orderItems).values({ orderId: o.id, productId: p.id, variantId: v.id, productName: 'Đỏ nhung', variantName: 'Chậu đang nở', unitPrice: 250000, quantity: 1 })
    await db.delete(products).where(eq(products.id, p.id))
    const [item] = await db.select().from(orderItems)
    expect(item.productId).toBeNull()
    expect(item.variantId).toBeNull()
    expect(item.productName).toBe('Đỏ nhung')
    expect(item.unitPrice).toBe(250000)
  })

  test('cannot delete category that still has products', async () => {
    const p = await product()
    expect(await pgCode(db.delete(categories).where(eq(categories.id, p.categoryId)))).toBe('23001') // ON DELETE RESTRICT
  })

  test('updated_at changes on update', async () => {
    const p = await product()
    await new Promise((r) => setTimeout(r, 20))
    const [u] = await db.update(products).set({ name: 'Đỏ nhung kép' }).where(eq(products.id, p.id)).returning()
    expect(u.updatedAt.getTime()).toBeGreaterThan(p.updatedAt.getTime())
  })

  test('site_settings allows one row only', async () => {
    await db.insert(siteSettings).values({ id: 1, shopName: 'Vườn hoa' })
    expect(await pgCode(db.insert(siteSettings).values({ id: 2, shopName: 'Khác' }))).toBe('23514')
  })

  test('order quantity must be positive', async () => {
    const [o] = await db.insert(orders).values({ code: 'VH-0002', customerName: 'An', customerPhone: '0912345678', total: 0 }).returning()
    expect(
      await pgCode(db.insert(orderItems).values({ orderId: o.id, productName: 'X', variantName: 'Y', unitPrice: 1, quantity: 0 })),
    ).toBe('23514')
  })

  test('order code is unique', async () => {
    await db.insert(orders).values({ code: 'VH-0003', customerName: 'An', customerPhone: '0912345678', total: 0 })
    expect(await pgCode(db.insert(orders).values({ code: 'VH-0003', customerName: 'Bình', customerPhone: '0912345679', total: 0 }))).toBe('23505')
  })

  test('new orders default to status new', async () => {
    const [o] = await db.insert(orders).values({ code: 'VH-0004', customerName: 'An', customerPhone: '0912345678', total: 0 }).returning()
    expect(o.status).toBe('new')
  })
})
