// Product photos: files in storage, one row per photo in product_images.
// A row is only written once every file is stored, and files are removed again
// if anything fails, so the page never points at a missing image.
import { randomUUID } from 'node:crypto'
import { and, asc, eq, isNull, max, ne } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { productImages, products } from '@/db/schema'
import { fail, ok, type Result } from '@/admin/result'
import { deleteObject, putObject } from '@/storage/s3'
import { IMAGE_WIDTHS, ImageError, processImage } from './process'
import { fileKey } from './urls'

export type Storage = { put(key: string, body: Buffer, type: string): Promise<void>; del(key: string): Promise<void> }
export const s3Storage: Storage = { put: putObject, del: deleteObject }

const filesOf = (storageKey: string) => IMAGE_WIDTHS.map((w) => fileKey(storageKey, w))

async function removeQuietly(storage: Storage, keys: string[]) {
  await Promise.all(keys.map((k) => storage.del(k).catch((e) => console.error('Không xoá được file ảnh', k, e))))
}

export async function addProductImage(
  db: Db,
  storage: Storage,
  input: { productId: string; file: Buffer; alt: string },
): Promise<Result<{ id: string }>> {
  let processed
  try {
    processed = await processImage(input.file)
  } catch (e) {
    if (e instanceof ImageError) return fail(e.message)
    throw e
  }

  const id = randomUUID()
  const storageKey = `public/products/${input.productId}/${id}`
  const stored: string[] = []
  try {
    for (const f of processed.files) {
      const key = fileKey(storageKey, f.width)
      await storage.put(key, f.body, 'image/webp')
      stored.push(key)
    }
  } catch (e) {
    console.error('Lưu ảnh thất bại', e)
    await removeQuietly(storage, stored)
    return fail('Không lưu được ảnh, thử lại')
  }

  try {
    return await db.transaction(async (tx) => {
      // Lock the product so two uploads at once cannot both become primary
      const [product] = await tx
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.id, input.productId), isNull(products.deletedAt)))
        .for('update')
      if (!product) throw new MissingProduct()
      const existing = await tx.select({ isPrimary: productImages.isPrimary }).from(productImages).where(eq(productImages.productId, product.id))
      const [{ n }] = await tx.select({ n: max(productImages.sortOrder) }).from(productImages).where(eq(productImages.productId, product.id))
      await tx.insert(productImages).values({
        id,
        productId: product.id,
        storageKey,
        width: processed.width,
        height: processed.height,
        blurData: processed.blurData,
        alt: input.alt.trim(),
        isPrimary: !existing.some((i) => i.isPrimary),
        sortOrder: (n ?? -1) + 1,
      })
      return ok({ id })
    })
  } catch (e) {
    await removeQuietly(storage, stored)
    if (e instanceof MissingProduct) return fail('Không tìm thấy sản phẩm')
    console.error('Ghi ảnh vào database thất bại', e)
    return fail('Không lưu được ảnh, thử lại')
  }
}

class MissingProduct extends Error {}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

/** Serialise photo changes per product (uploads take the same lock). */
async function lockProduct(tx: Tx, productId: string) {
  await tx.select({ id: products.id }).from(products).where(eq(products.id, productId)).for('update')
}

/** If the product has photos but none is primary, make the first one primary. */
async function ensurePrimary(tx: Tx, productId: string) {
  const rows = await tx
    .select({ id: productImages.id, isPrimary: productImages.isPrimary })
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt))
  if (rows.length && !rows.some((r) => r.isPrimary)) {
    await tx.update(productImages).set({ isPrimary: true }).where(eq(productImages.id, rows[0].id))
  }
}

export async function deleteProductImage(db: Db, storage: Storage, imageId: string): Promise<Result<null>> {
  const removed = await db.transaction(async (tx) => {
    const [image] = await tx.select({ productId: productImages.productId }).from(productImages).where(eq(productImages.id, imageId))
    if (!image) return null
    await lockProduct(tx, image.productId)
    const [row] = await tx.delete(productImages).where(eq(productImages.id, imageId)).returning()
    if (!row) return null
    await ensurePrimary(tx, row.productId)
    return row
  })
  if (!removed) return fail('Không tìm thấy ảnh')
  await removeQuietly(storage, filesOf(removed.storageKey))
  return ok(null)
}

export async function setPrimaryImage(db: Db, imageId: string): Promise<Result<null>> {
  return db.transaction(async (tx) => {
    const [found] = await tx.select({ productId: productImages.productId }).from(productImages).where(eq(productImages.id, imageId))
    if (!found) return fail('Không tìm thấy ảnh')
    await lockProduct(tx, found.productId)
    const [image] = await tx.select().from(productImages).where(eq(productImages.id, imageId))
    if (!image) return fail('Không tìm thấy ảnh')
    await tx
      .update(productImages)
      .set({ isPrimary: false })
      .where(and(eq(productImages.productId, image.productId), ne(productImages.id, imageId)))
    await tx.update(productImages).set({ isPrimary: true }).where(eq(productImages.id, imageId))
    return ok(null)
  })
}

/** `ids` must list every photo of the product exactly once. */
export async function reorderImages(db: Db, productId: string, ids: string[]): Promise<Result<null>> {
  return db.transaction(async (tx) => {
    const rows = await tx.select({ id: productImages.id }).from(productImages).where(eq(productImages.productId, productId))
    const all = new Set(rows.map((r) => r.id))
    if (ids.length !== all.size || new Set(ids).size !== ids.length || ids.some((id) => !all.has(id))) return fail('Danh sách ảnh không khớp')
    for (const [i, id] of ids.entries()) await tx.update(productImages).set({ sortOrder: i }).where(eq(productImages.id, id))
    return ok(null)
  })
}

/** Files of images whose rows are already gone (used after deleting a category). */
export async function removeImageFiles(storage: Storage, storageKeys: string[]): Promise<void> {
  await removeQuietly(storage, storageKeys.flatMap(filesOf))
}
