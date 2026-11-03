'use client'
import Link from 'next/link'
import { motion } from 'motion/react'
import type { OrderStatus } from '@/admin/orders'
import { STATUS_LABEL, STATUS_PARAM } from './order-format'

const FILTERS: (OrderStatus | undefined)[] = [undefined, 'new', 'confirmed', 'delivered', 'cancelled']

/** Status filter; the selection slides between segments. */
export function StatusFilter({ current }: { current?: OrderStatus }) {
  return (
    <nav className="filter" aria-label="Lọc theo trạng thái">
      {FILTERS.map((s) => (
        <Link
          key={s ?? 'all'}
          href={s ? `/admin/don-hang?trang-thai=${STATUS_PARAM[s]}` : '/admin/don-hang'}
          aria-current={s === current ? 'page' : undefined}
          className="press"
          scroll={false}
        >
          {s === current && <motion.span layoutId="order-filter" className="filter-pill" transition={{ type: 'spring', bounce: 0, duration: 0.35 }} />}
          {s ? STATUS_LABEL[s] : 'Tất cả'}
        </Link>
      ))}
    </nav>
  )
}
