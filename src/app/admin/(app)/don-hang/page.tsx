import Link from 'next/link'
import { requireAdmin } from '@/auth/guard'
import { listOrders, ORDER_STATUSES, type OrderStatus } from '@/admin/orders'
import { getDb } from '@/db/client'
import { OrderRow } from '@/components/admin/OrderRow'
import { StatusFilter } from '@/components/admin/StatusFilter'
import { orderTime, STATUS_PARAM } from '@/components/admin/order-format'

export const dynamic = 'force-dynamic'
const PAGE = 30

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin()
  const params = await searchParams
  const status = ORDER_STATUSES.find((s) => STATUS_PARAM[s] === params['trang-thai']) as OrderStatus | undefined
  const before = params.truoc && !Number.isNaN(Date.parse(params.truoc)) ? new Date(params.truoc) : undefined
  const orders = await listOrders(getDb(), { status, before, limit: PAGE })
  const now = new Date()
  const query = (extra: Record<string, string>) => {
    const q = new URLSearchParams({ ...(status ? { 'trang-thai': STATUS_PARAM[status] } : {}), ...extra })
    return `/admin/don-hang${q.size ? `?${q}` : ''}`
  }

  return (
    <main className="page">
      <div className="page-head">
        <h1>Đơn hàng</h1>
      </div>
      <StatusFilter current={status} />
      {orders.length === 0 ? (
        <p className="empty">{before ? 'Không còn đơn cũ hơn.' : status ? 'Không có đơn nào ở trạng thái này.' : 'Chưa có đơn nào.'}</p>
      ) : (
        <ul className="orders">
          {orders.map((o) => (
            <OrderRow key={o.id} order={{ ...o, when: orderTime(o.createdAt, now), createdAt: o.createdAt.toISOString() }} />
          ))}
        </ul>
      )}
      <div className="pager">
        {before && (
          <Link className="btn quiet small" href={query({})}>
            Về đơn mới nhất
          </Link>
        )}
        {orders.length === PAGE && (
          <Link className="btn quiet small" href={query({ truoc: orders.at(-1)!.createdAt.toISOString() })}>
            Xem đơn cũ hơn
          </Link>
        )}
      </div>
    </main>
  )
}
