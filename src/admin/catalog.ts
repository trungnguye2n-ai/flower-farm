// Categories, products and their variants as the admin edits them.
// Every call is one transaction; validation errors come back keyed by field
// (`name`, `variants.0.price`, `care.1.title`) so the form can show each one
// under the input that caused it.
import { and, asc, eq, inArray, isNotNull, isNull, like, max, ne, or, sql } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { categories, productImages, products, productVariants, type CareItem } from '@/db/schema'
import { parsePrice, slugify } from './parse'
import { fail, ok, type FieldErrors, type Result } from './result'

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

export type CategoryInput = { id?: string; name: string; description: string; care: CareItem[]; isVisible: boolean }
export type VariantInput = { id?: string; name: string; price: string | number; inStock: boolean }
export type ProductInput = {
  id?: string
  categoryId: string
  name: string
  shortDescription: string
  accentColor: string
  isVisible: boolean
  variants: VariantInput[]
}

export type CatalogVariant = { id: string; name: string; price: number; inStock: boolean }
export type CatalogImage = { id: string; storageKey: string; width: number; height: number; blurData: string | null; alt: string; isPrimary: boolean }
export type CatalogProduct = {
  id: string
  categoryId: string
  slug: string
  name: string
  shortDescription: string
  accentColor: string
  isVisible: boolean
  inStock: boolean
  minPrice: number
  maxPrice: number
  variants: CatalogVariant[]
  images: CatalogImage[]
}
export type CatalogCategory = {
  id: string
  slug: string
  name: string
  description: string
  care: CareItem[]
  isVisible: boolean
  products: CatalogProduct[]
}

const HEX = /^#[0-9A-Fa-f]{6}$/

/** The catalog in display order. `deleted: true` lists only soft-deleted products instead. */
export async function listCatalog(db: Db, opts: { deleted?: boolean } = {}): Promise<CatalogCategory[]> {
  const cats = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name))
  const prods = await db
    .select()
    .from(products)
    .where(opts.deleted ? isNotNull(products.deletedAt) : isNull(products.deletedAt))
    .orderBy(asc(products.sortOrder), asc(products.createdAt))
  const ids = prods.map((p) => p.id)
  const variants = ids.length
    ? await db
        .select()
        .from(productVariants)
        .where(and(inArray(productVariants.productId, ids), isNull(productVariants.deletedAt)))
        .orderBy(asc(productVariants.sortOrder), asc(productVariants.createdAt))
    : []
  const images = ids.length
    ? await db.select().from(productImages).where(inArray(productImages.productId, ids)).orderBy(asc(productImages.sortOrder), asc(productImages.createdAt))
    : []

  return cats.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    care: c.care,
    isVisible: c.isVisible,
    products: prods
      .filter((p) => p.categoryId === c.id)
      .map((p) => {
        const vs = variants.filter((v) => v.productId === p.id).map((v) => ({ id: v.id, name: v.name, price: v.price, inStock: v.inStock }))
        const imgs = images
          .filter((i) => i.productId === p.id)
          .map((i) => ({ id: i.id, storageKey: i.storageKey, width: i.width, height: i.height, blurData: i.blurData, alt: i.alt, isPrimary: i.isPrimary }))
          .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
        const prices = vs.map((v) => v.price)
        return {
          id: p.id,
          categoryId: p.categoryId,
          slug: p.slug,
          name: p.name,
          shortDescription: p.shortDescription,
          accentColor: p.accentColor,
          isVisible: p.isVisible,
          inStock: vs.some((v) => v.inStock),
          minPrice: prices.length ? Math.min(...prices) : 0,
          maxPrice: prices.length ? Math.max(...prices) : 0,
          variants: vs,
          images: imgs,
        }
      }),
  }))
}

/** `base`, or `base-2`, `base-3`… whichever no live product (other than `exceptId`) uses. */
async function freeProductSlug(tx: Tx, base: string, exceptId?: string): Promise<string> {
  const rows = await tx
    .select({ slug: products.slug })
    .from(products)
    .where(
      and(
        isNull(products.deletedAt),
        or(eq(products.slug, base), like(products.slug, `${base}-%`)),
        exceptId ? ne(products.id, exceptId) : undefined,
      ),
    )
  const taken = new Set(rows.map((r) => r.slug))
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
}

function validateProduct(input: ProductInput): { errors: FieldErrors; prices: number[] } {
  const errors: FieldErrors = {}
  const prices: number[] = []
  if (!input.name.trim()) errors.name = 'Cần nhập tên'
  if (!HEX.test(input.accentColor)) errors.accentColor = 'Màu không hợp lệ'
  if (!input.variants.length) errors.variants = 'Cần ít nhất một kiểu bán'
  input.variants.forEach((v, i) => {
    if (!v.name.trim()) errors[`variants.${i}.name`] = 'Cần nhập tên kiểu bán'
    const price = parsePrice(v.price)
    if (price === null) errors[`variants.${i}.price`] = 'Giá không hợp lệ'
    prices.push(price ?? 0)
  })
  return { errors, prices }
}

export async function saveProduct(db: Db, input: ProductInput): Promise<Result<{ id: string; slug: string }>> {
  const { errors, prices } = validateProduct(input)
  if (Object.keys(errors).length) return fail(errors)

  return db.transaction(async (tx) => {
    const [category] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.id, input.categoryId))
    if (!category) return fail({ categoryId: 'Không tìm thấy loại hoa' })

    const fields = {
      categoryId: input.categoryId,
      name: input.name.trim(),
      shortDescription: input.shortDescription.trim(),
      accentColor: input.accentColor.toUpperCase(),
      isVisible: input.isVisible,
    }

    let id: string
    let slug: string
    if (input.id) {
      const [existing] = await tx.select().from(products).where(and(eq(products.id, input.id), isNull(products.deletedAt)))
      if (!existing) return fail('Không tìm thấy sản phẩm')
      const owned = await tx
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(and(eq(productVariants.productId, existing.id), isNull(productVariants.deletedAt)))
      const ownedIds = new Set(owned.map((v) => v.id))
      if (input.variants.some((v) => v.id && !ownedIds.has(v.id))) return fail({ variants: 'Kiểu bán không thuộc sản phẩm này' })

      const moved = existing.categoryId !== input.categoryId
      const sortOrder = moved ? await nextProductOrder(tx, input.categoryId) : existing.sortOrder
      await tx.update(products).set({ ...fields, sortOrder }).where(eq(products.id, existing.id))
      const keep = new Set(input.variants.flatMap((v) => (v.id ? [v.id] : [])))
      const dropped = [...ownedIds].filter((v) => !keep.has(v))
      if (dropped.length) await tx.update(productVariants).set({ deletedAt: new Date() }).where(inArray(productVariants.id, dropped))
      id = existing.id
      slug = existing.slug
    } else {
      slug = await freeProductSlug(tx, slugify(input.name) || 'san-pham')
      const [created] = await tx
        .insert(products)
        .values({ ...fields, slug, sortOrder: await nextProductOrder(tx, input.categoryId) })
        .returning({ id: products.id })
      id = created.id
    }

    for (const [i, v] of input.variants.entries()) {
      const values = { name: v.name.trim(), price: prices[i], inStock: v.inStock, sortOrder: i }
      if (v.id) await tx.update(productVariants).set(values).where(eq(productVariants.id, v.id))
      else await tx.insert(productVariants).values({ ...values, productId: id })
    }
    return ok({ id, slug })
  })
}

async function nextProductOrder(tx: Tx, categoryId: string): Promise<number> {
  const [row] = await tx
    .select({ n: max(products.sortOrder) })
    .from(products)
    .where(and(eq(products.categoryId, categoryId), isNull(products.deletedAt)))
  return (row.n ?? -1) + 1
}

export async function setProductInStock(db: Db, id: string, inStock: boolean): Promise<void> {
  await db
    .update(productVariants)
    .set({ inStock })
    .where(and(eq(productVariants.productId, id), isNull(productVariants.deletedAt)))
}

export async function softDeleteProduct(db: Db, id: string): Promise<void> {
  await db.update(products).set({ deletedAt: new Date() }).where(and(eq(products.id, id), isNull(products.deletedAt)))
}

export async function restoreProduct(db: Db, id: string): Promise<Result<{ slug: string }>> {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(products).where(and(eq(products.id, id), isNotNull(products.deletedAt)))
    if (!p) return fail('Không tìm thấy sản phẩm đã xoá')
    const slug = await freeProductSlug(tx, p.slug, p.id)
    await tx
      .update(products)
      .set({ deletedAt: null, slug, sortOrder: await nextProductOrder(tx, p.categoryId) })
      .where(eq(products.id, id))
    return ok({ slug })
  })
}

export async function reorder(db: Db, kind: 'categories' | 'products', ids: string[]): Promise<Result<null>> {
  if (new Set(ids).size !== ids.length) return fail('Danh sách bị trùng')
  return db.transaction(async (tx) => {
    if (kind === 'categories') {
      const rows = ids.length ? await tx.select({ id: categories.id }).from(categories).where(inArray(categories.id, ids)) : []
      if (rows.length !== ids.length) return fail('Không tìm thấy loại hoa')
      for (const [i, id] of ids.entries()) await tx.update(categories).set({ sortOrder: i }).where(eq(categories.id, id))
    } else {
      const rows = ids.length
        ? await tx
            .select({ id: products.id, categoryId: products.categoryId })
            .from(products)
            .where(and(inArray(products.id, ids), isNull(products.deletedAt)))
        : []
      if (rows.length !== ids.length) return fail('Không tìm thấy sản phẩm')
      if (new Set(rows.map((r) => r.categoryId)).size > 1) return fail('Chỉ sắp xếp sản phẩm trong cùng một loại hoa')
      for (const [i, id] of ids.entries()) await tx.update(products).set({ sortOrder: i }).where(eq(products.id, id))
    }
    return ok(null)
  })
}

export async function saveCategory(db: Db, input: CategoryInput): Promise<Result<{ id: string; slug: string }>> {
  const errors: FieldErrors = {}
  if (!input.name.trim()) errors.name = 'Cần nhập tên'
  input.care.forEach((c, i) => {
    if (!c.title.trim()) errors[`care.${i}.title`] = 'Cần nhập tiêu đề'
    if (!c.body.trim()) errors[`care.${i}.body`] = 'Cần nhập nội dung'
  })
  if (Object.keys(errors).length) return fail(errors)

  const fields = {
    name: input.name.trim(),
    description: input.description.trim(),
    care: input.care.map((c) => ({ title: c.title.trim(), body: c.body.trim() })),
    isVisible: input.isVisible,
  }
  return db.transaction(async (tx) => {
    if (input.id) {
      const [row] = await tx.update(categories).set(fields).where(eq(categories.id, input.id)).returning({ id: categories.id, slug: categories.slug })
      return row ? ok(row) : fail('Không tìm thấy loại hoa')
    }
    const base = slugify(input.name) || 'loai-hoa'
    const taken = new Set(
      (await tx.select({ slug: categories.slug }).from(categories).where(or(eq(categories.slug, base), like(categories.slug, `${base}-%`)))).map((r) => r.slug),
    )
    let slug = base
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`
    const [{ n }] = await tx.select({ n: max(categories.sortOrder) }).from(categories)
    const [row] = await tx
      .insert(categories)
      .values({ ...fields, slug, sortOrder: (n ?? -1) + 1 })
      .returning({ id: categories.id, slug: categories.slug })
    return ok(row)
  })
}

/**
 * Deletes a category that has no live products. Its soft-deleted products go
 * with it; their image keys come back so the caller can remove the files.
 */
export async function deleteCategory(db: Db, id: string): Promise<Result<{ storageKeys: string[] }>> {
  return db.transaction(async (tx) => {
    const [category] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.id, id))
    if (!category) return fail('Không tìm thấy loại hoa')
    const [{ live }] = await tx
      .select({ live: sql<number>`count(*)::int` })
      .from(products)
      .where(and(eq(products.categoryId, id), isNull(products.deletedAt)))
    if (live > 0) return fail('Loại hoa còn sản phẩm')
    const keys = await tx
      .select({ key: productImages.storageKey })
      .from(productImages)
      .innerJoin(products, eq(products.id, productImages.productId))
      .where(eq(products.categoryId, id))
    await tx.delete(products).where(eq(products.categoryId, id))
    await tx.delete(categories).where(eq(categories.id, id))
    return ok({ storageKeys: keys.map((k) => k.key) })
  })
}
