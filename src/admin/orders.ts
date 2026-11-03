// The order log as the admin reads it: newest first, filter by status, any
// status can be set (so a mistaken tap can be undone).
import { and, asc, count, desc, eq, inArray, lt } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { orderItems, orders, orderStatus } from '@/db/schema'
import { fail, ok, type Result } from './result'

export type OrderStatus = (typeof orderStatus.enumValues)[number]
export const ORDER_STATUSES = orderStatus.enumValues

export type OrderView = {
  id: string
  code: string
  status: OrderStatus
  customerName: string
  customerPhone: string
  recipientName: string | null
  recipientPhone: string | null
  deliveryAddress: string | null
  deliveryTime: string | null
  note: string | null
  total: number
  createdAt: Date
  items: { productName: string; variantName: string; unitPrice: number; quantity: number }[]
}

export async function listOrders(db: Db, opts: { status?: OrderStatus; limit?: number; before?: Date }): Promise<OrderView[]> {
  const rows = await db
    .select()
    .from(orders)
    .where(and(opts.status ? eq(orders.status, opts.status) : undefined, opts.before ? lt(orders.createdAt, opts.before) : undefined))
    .orderBy(desc(orders.createdAt))
    .limit(opts.limit ?? 50)
  const items = rows.length
    ? await db
        .select()
        .from(orderItems)
        .where(
          inArray(
            orderItems.orderId,
            rows.map((r) => r.id),
          ),
        )
        .orderBy(asc(orderItems.createdAt), asc(orderItems.productName), asc(orderItems.variantName))
    : []
  return rows.map((o) => ({
    id: o.id,
    code: o.code,
    status: o.status,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    recipientName: o.recipientName,
    recipientPhone: o.recipientPhone,
    deliveryAddress: o.deliveryAddress,
    deliveryTime: o.deliveryTime,
    note: o.note,
    total: o.total,
    createdAt: o.createdAt,
    items: items
      .filter((i) => i.orderId === o.id)
      .map((i) => ({ productName: i.productName, variantName: i.variantName, unitPrice: i.unitPrice, quantity: i.quantity })),
  }))
}

export async function setOrderStatus(db: Db, id: string, status: OrderStatus): Promise<Result<null>> {
  if (!ORDER_STATUSES.includes(status)) return fail('Trạng thái không hợp lệ')
  const rows = await db.update(orders).set({ status }).where(eq(orders.id, id)).returning({ id: orders.id })
  return rows.length ? ok(null) : fail('Không tìm thấy đơn')
}

export async function countNewOrders(db: Db): Promise<number> {
  const [row] = await db.select({ n: count() }).from(orders).where(eq(orders.status, 'new'))
  return row.n
}

export { telLink, zaloLink } from './order-links'
