'use server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/auth/guard'
import { setOrderStatus, type OrderStatus } from '@/admin/orders'
import type { Result } from '@/admin/result'
import { getDb } from '@/db/client'

export async function setOrderStatusAction(id: string, status: OrderStatus): Promise<Result<null>> {
  await requireAdmin()
  const result = await setOrderStatus(getDb(), id, status)
  // The "new orders" badge lives in the shared layout
  if (result.ok) revalidatePath('/admin', 'layout')
  return result
}
