'use client'
import Link from 'next/link'
import { motion } from 'motion/react'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/admin', label: 'Sản phẩm', icon: 'M12 21c-4.5-2.2-7-5.6-7-9.5C5 8 7.5 5.5 12 3c4.5 2.5 7 5 7 8.5 0 3.9-2.5 7.3-7 9.5Zm0 0V9' },
  { href: '/admin/don-hang', label: 'Đơn hàng', icon: 'M6 4h12l1 16H5L6 4Zm3 4a3 3 0 0 0 6 0' },
  { href: '/admin/cai-dat', label: 'Cài đặt', icon: 'M4 7h10m4 0h2M4 17h2m4 0h10M14 4v6m-4 4v6' },
] as const

/** Section tabs; the pill slides to the current one. `place` is the desktop top bar or the phone bottom bar. */
export function AdminNav({ place, newOrders }: { place: 'top' | 'bottom'; newOrders: number }) {
  const path = usePathname()
  const current = TABS.findLast((t) => path === t.href || path.startsWith(`${t.href}/`))?.href
  return (
    <nav className={`tabs ${place === 'bottom' ? 'bottom glass' : ''}`} aria-label="Mục quản lý">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className="tab press" aria-current={current === t.href ? 'page' : undefined}>
          {current === t.href && <motion.span layoutId={`tab-pill-${place}`} className="tab-pill" transition={{ type: 'spring', bounce: 0, duration: 0.35 }} />}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={t.icon} />
          </svg>
          {t.label}
          {t.href === '/admin/don-hang' && newOrders > 0 && (
            <span className="badge" aria-label={`${newOrders} đơn mới`}>
              {newOrders > 99 ? '99+' : newOrders}
            </span>
          )}
        </Link>
      ))}
    </nav>
  )
}
