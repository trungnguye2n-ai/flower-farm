import { beforeEach, describe, expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { categories, products, productVariants, siteSettings } from '@/db/schema'
import { seed } from '@/db/seed'
import { freshTestDb, testSql } from './helpers/db'

let db: Db
beforeEach(async () => {
  db = await freshTestDb()
})

async function counts() {
  const [r] = await testSql`select
    (select count(*) from categories)::int as categories,
    (select count(*) from products)::int as products,
    (select count(*) from product_variants)::int as variants,
    (select count(*) from site_settings)::int as settings`
  return r
}

describe('seed', () => {
  test('seed creates two categories and their products', async () => {
    await seed(db)
    const cats = await db.select().from(categories)
    expect(cats.map((c) => c.slug).sort()).toEqual(['bach-thuy-tien', 'muoi-gio'])
    for (const c of cats) expect(c.care.length).toBe(4)
    const c = await counts()
    expect(c.products).toBe(4)
    expect(c.settings).toBe(1)
    // every product can be bought: at least one variant
    const [{ orphans }] = await testSql`select count(*)::int as orphans from products p
      where not exists (select 1 from product_variants v where v.product_id = p.id)`
    expect(orphans).toBe(0)
  })

  test('seed is idempotent', async () => {
    await seed(db)
    const first = await counts()
    await seed(db)
    expect(await counts()).toEqual(first)
  })

  test('seed does not overwrite admin edits', async () => {
    await seed(db)
    const [v] = await db.select().from(productVariants).limit(1)
    await db.update(productVariants).set({ price: 999000 }).where(eq(productVariants.id, v.id))
    await db.update(siteSettings).set({ phone: '0988888888' })
    await db.update(products).set({ name: 'Tên mới' }).where(eq(products.id, v.productId))
    await seed(db)
    const [after] = await db.select().from(productVariants).where(eq(productVariants.id, v.id))
    expect(after.price).toBe(999000)
    const [s] = await db.select().from(siteSettings)
    expect(s.phone).toBe('0988888888')
    const [p] = await db.select().from(products).where(eq(products.id, v.productId))
    expect(p.name).toBe('Tên mới')
  })
})
