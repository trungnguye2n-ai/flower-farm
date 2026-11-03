'use server'
// Catalog writes. Each action checks the session itself (the page that called
// it is no proof), calls the service, and refreshes the landing and the admin.
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/auth/guard'
import { SESSION_COOKIE } from '@/auth/cookie'
import { revokeSession } from '@/auth/session'
import { getDb } from '@/db/client'
import {
  deleteCategory,
  reorder,
  restoreProduct,
  saveCategory,
  saveProduct,
  setProductInStock,
  softDeleteProduct,
  type CategoryInput,
  type ProductInput,
} from '@/admin/catalog'
import { ok, type Result } from '@/admin/result'
import { deleteProductImage, removeImageFiles, reorderImages, s3Storage, setPrimaryImage } from '@/images/service'

function refresh<T>(result: Result<T>): Result<T> {
  if (result.ok) {
    revalidatePath('/')
    revalidatePath('/admin')
  }
  return result
}

export async function logoutAction(): Promise<void> {
  await requireAdmin()
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) await revokeSession(getDb(), token)
  jar.delete(SESSION_COOKIE)
  redirect('/admin/login')
}

export async function saveProductAction(input: ProductInput): Promise<Result<{ id: string; slug: string }>> {
  await requireAdmin()
  return refresh(await saveProduct(getDb(), input))
}

export async function setInStockAction(id: string, inStock: boolean): Promise<Result<null>> {
  await requireAdmin()
  await setProductInStock(getDb(), id, inStock)
  return refresh(ok(null))
}

export async function deleteProductAction(id: string): Promise<Result<null>> {
  await requireAdmin()
  await softDeleteProduct(getDb(), id)
  return refresh(ok(null))
}

export async function restoreProductAction(id: string): Promise<Result<{ slug: string }>> {
  await requireAdmin()
  return refresh(await restoreProduct(getDb(), id))
}

export async function reorderAction(kind: 'categories' | 'products', ids: string[]): Promise<Result<null>> {
  await requireAdmin()
  return refresh(await reorder(getDb(), kind, ids))
}

export async function saveCategoryAction(input: CategoryInput): Promise<Result<{ id: string; slug: string }>> {
  await requireAdmin()
  return refresh(await saveCategory(getDb(), input))
}

export async function deleteCategoryAction(id: string): Promise<Result<null>> {
  await requireAdmin()
  const result = await deleteCategory(getDb(), id)
  if (!result.ok) return result
  await removeImageFiles(s3Storage, result.data.storageKeys)
  return refresh(ok(null))
}

export async function setPrimaryImageAction(imageId: string): Promise<Result<null>> {
  await requireAdmin()
  return refresh(await setPrimaryImage(getDb(), imageId))
}

export async function deleteImageAction(imageId: string): Promise<Result<null>> {
  await requireAdmin()
  return refresh(await deleteProductImage(getDb(), s3Storage, imageId))
}

export async function reorderImagesAction(productId: string, ids: string[]): Promise<Result<null>> {
  await requireAdmin()
  return refresh(await reorderImages(getDb(), productId, ids))
}
