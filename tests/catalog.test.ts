import { beforeEach, describe, expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { categories, productImages, products, productVariants } from '@/db/schema'
import { seed } from '@/db/seed'
import {
  deleteCategory,
  listCatalog,
  reorder,
  restoreProduct,
  saveCategory,
  saveProduct,
  setProductInStock,
  softDeleteProduct,
  type ProductInput,
} from '@/admin/catalog'
import { freshTestDb, testSql } from './helpers/db'

let db: Db
let btt: string // bach-thuy-tien category id
let mg: string // muoi-gio
beforeEach(async () => {
  db = await freshTestDb()
  await seed(db)
  const cats = await db.select().from(categories)
  btt = cats.find((c) => c.slug === 'bach-thuy-tien')!.id
  mg = cats.find((c) => c.slug === 'muoi-gio')!.id
})

const product = (over: Partial<ProductInput> = {}): ProductInput => ({
  categoryId: btt,
  name: 'Bách thủy tiên Đỏ nhung',
  shortDescription: 'Đỏ thẫm',
  accentColor: '#9E1B32',
  isVisible: true,
  variants: [{ name: 'Củ trần', price: '60.000', inStock: true }],
  ...over,
})

async function findProduct(slug: string) {
  const cats = await listCatalog(db)
  return cats.flatMap((c) => c.products).find((p) => p.slug === slug)
}

describe('listCatalog', () => {
  test('returns both seeded categories with products, prices and stock', async () => {
    const cats = await listCatalog(db)
    expect(cats.map((c) => c.slug)).toEqual(['bach-thuy-tien', 'muoi-gio'])
    const p = cats[0].products.find((p) => p.slug === 'bach-thuy-tien-do-nhung')!
    expect(p.minPrice).toBe(60000)
    expect(p.maxPrice).toBe(250000)
    expect(p.inStock).toBe(true)
    expect(p.variants.map((v) => v.name)).toEqual(['Củ trần', 'Chậu đã trồng', 'Chậu đang nở'])
    expect(cats[0].care.length).toBe(4)
  })
})

describe('saveProduct', () => {
  test('creates a product with variants, a fresh slug, last in its category', async () => {
    const r = await saveProduct(db, product())
    expect(r).toEqual({ ok: true, data: { id: expect.any(String), slug: 'bach-thuy-tien-do-nhung-2' } })
    const cats = await listCatalog(db)
    const last = cats[0].products.at(-1)!
    expect(last.slug).toBe('bach-thuy-tien-do-nhung-2')
    expect(last.variants).toEqual([{ id: expect.any(String), name: 'Củ trần', price: 60000, inStock: true }])
  })

  test('rejects bad input with a message under each field and writes nothing', async () => {
    const before = await testSql`select count(*)::int as n from products`
    const r = await saveProduct(
      db,
      product({ name: ' ', accentColor: 'red', variants: [{ name: 'Củ', price: 'abc', inStock: true }, { name: '', price: '1', inStock: true }] }),
    )
    expect(r).toEqual({
      ok: false,
      fieldErrors: {
        name: 'Cần nhập tên',
        accentColor: 'Màu không hợp lệ',
        'variants.0.price': 'Giá không hợp lệ',
        'variants.1.name': 'Cần nhập tên kiểu bán',
      },
    })
    expect(await saveProduct(db, product({ variants: [] }))).toEqual({ ok: false, fieldErrors: { variants: 'Cần ít nhất một kiểu bán' } })
    expect(await saveProduct(db, product({ categoryId: '00000000-0000-0000-0000-000000000000' }))).toEqual({
      ok: false,
      fieldErrors: { categoryId: 'Không tìm thấy loại hoa' },
    })
    expect(await testSql`select count(*)::int as n from products`).toEqual(before)
  })

  test('editing keeps the slug, updates variants and drops a removed one softly', async () => {
    const p = (await findProduct('bach-thuy-tien-do-nhung'))!
    const [keep, , drop] = p.variants
    await testSql`insert into orders (code, customer_name, customer_phone, total) values ('VH-0001', 'Lan', '0901234567', 250000)`
    const [order] = await testSql`select id from orders`
    await testSql`insert into order_items (order_id, product_id, variant_id, product_name, variant_name, unit_price, quantity)
      values (${order.id}, ${p.id}, ${drop.id}, 'Đỏ nhung', 'Chậu đang nở', 250000, 1)`

    const r = await saveProduct(db, {
      id: p.id,
      categoryId: btt,
      name: 'Đỏ nhung mới',
      shortDescription: p.shortDescription,
      accentColor: p.accentColor,
      isVisible: true,
      variants: [
        { id: keep.id, name: 'Củ trần', price: '65k', inStock: true },
        { name: 'Khay 6 củ', price: '350.000', inStock: false },
      ],
    })
    expect(r).toEqual({ ok: true, data: { id: p.id, slug: 'bach-thuy-tien-do-nhung' } })
    const after = (await findProduct('bach-thuy-tien-do-nhung'))!
    expect(after.name).toBe('Đỏ nhung mới')
    expect(after.variants.map((v) => [v.name, v.price, v.inStock])).toEqual([
      ['Củ trần', 65000, true],
      ['Khay 6 củ', 350000, false],
    ])
    const [dropped] = await db.select().from(productVariants).where(eq(productVariants.id, drop.id))
    expect(dropped.deletedAt).not.toBeNull()
    const [item] = await testSql`select variant_id, unit_price from order_items`
    expect(item).toEqual({ variant_id: drop.id, unit_price: 250000 })
  })

  test('a variant id from another product is refused', async () => {
    const a = (await findProduct('bach-thuy-tien-do-nhung'))!
    const b = (await findProduct('muoi-gio-my'))!
    const r = await saveProduct(db, { ...product({ id: a.id }), variants: [{ id: b.variants[0].id, name: 'x', price: 1, inStock: true }] })
    expect(r.ok).toBe(false)
    expect((await findProduct('muoi-gio-my'))!.variants[0].name).toBe('1 chậu')
  })
})

describe('stock, delete, restore', () => {
  test('setProductInStock(false) marks every variant out', async () => {
    const p = (await findProduct('bach-thuy-tien-do-nhung'))!
    await setProductInStock(db, p.id, false)
    const after = (await findProduct('bach-thuy-tien-do-nhung'))!
    expect(after.inStock).toBe(false)
    expect(after.variants.every((v) => !v.inStock)).toBe(true)
  })

  test('soft delete hides the product; restore brings it back', async () => {
    const p = (await findProduct('muoi-gio-my'))!
    await softDeleteProduct(db, p.id)
    expect(await findProduct('muoi-gio-my')).toBeUndefined()
    const deleted = await listCatalog(db, { deleted: true })
    expect(deleted.flatMap((c) => c.products).map((x) => x.slug)).toEqual(['muoi-gio-my'])
    expect(await restoreProduct(db, p.id)).toEqual({ ok: true, data: { slug: 'muoi-gio-my' } })
    expect(await findProduct('muoi-gio-my')).toBeDefined()
  })

  test('restore re-slugs when a live product took the slug', async () => {
    const p = (await findProduct('muoi-gio-my'))!
    await softDeleteProduct(db, p.id)
    await saveProduct(db, product({ categoryId: mg, name: 'Mười giờ Mỹ' }))
    expect(await restoreProduct(db, p.id)).toEqual({ ok: true, data: { slug: 'muoi-gio-my-2' } })
  })
})

describe('reorder', () => {
  test('sets the order', async () => {
    const [c] = await listCatalog(db)
    const ids = c.products.map((p) => p.id).reverse()
    expect(await reorder(db, 'products', ids)).toEqual({ ok: true, data: null })
    const [after] = await listCatalog(db)
    expect(after.products.map((p) => p.id)).toEqual(ids)
    await reorder(db, 'categories', [mg, btt])
    expect((await listCatalog(db)).map((c) => c.id)).toEqual([mg, btt])
  })

  test('refuses products from two categories', async () => {
    const cats = await listCatalog(db)
    const r = await reorder(db, 'products', [cats[0].products[0].id, cats[1].products[0].id])
    expect(r.ok).toBe(false)
  })
})

describe('categories', () => {
  test('saveCategory creates and edits, with care items checked', async () => {
    const r = await saveCategory(db, { name: 'Sen đá', description: '', care: [{ title: 'Nắng', body: 'Nhiều nắng' }], isVisible: true })
    expect(r).toEqual({ ok: true, data: { id: expect.any(String), slug: 'sen-da' } })
    if (!r.ok) return
    expect(await saveCategory(db, { id: r.data.id, name: 'Sen đá', description: '', care: [{ title: '', body: 'x' }], isVisible: true })).toEqual({
      ok: false,
      fieldErrors: { 'care.0.title': 'Cần nhập tiêu đề' },
    })
    expect((await listCatalog(db)).at(-1)!.name).toBe('Sen đá')
  })

  test('deleteCategory refuses while live products exist', async () => {
    expect(await deleteCategory(db, mg)).toEqual({ ok: false, error: 'Loại hoa còn sản phẩm' })
  })

  test('deleteCategory succeeds when only soft-deleted products remain', async () => {
    const [, c] = await listCatalog(db)
    for (const p of c.products) await softDeleteProduct(db, p.id)
    await db.insert(productImages).values({ productId: c.products[0].id, storageKey: 'public/products/x/y', width: 10, height: 10, isPrimary: true })
    expect(await deleteCategory(db, mg)).toEqual({ ok: true, data: { storageKeys: ['public/products/x/y'] } })
    expect(await db.select().from(categories).where(eq(categories.id, mg))).toHaveLength(0)
    expect(await db.select().from(products).where(eq(products.categoryId, mg))).toHaveLength(0)
  })
})
