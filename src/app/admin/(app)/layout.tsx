import type { ReactNode } from 'react'
import Link from 'next/link'
import { requireAdmin } from '@/auth/guard'
import { countNewOrders } from '@/admin/orders'
import { getDb } from '@/db/client'
import { AdminNav } from '@/components/admin/AdminNav'
import { Toasts } from '@/components/admin/Toast'
import { logoutAction } from './actions'
import '@/components/admin/admin.css'

export const metadata = { title: 'Quản lý · Vườn hoa', robots: { index: false } }

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin()
  const newOrders = await countNewOrders(getDb())
  return (
    <div className="admin">
      <header className="topbar glass">
        <div className="topbar-inner">
        <Link href="/admin" className="brand">
          Vườn hoa<small>quản lý</small>
        </Link>
        <AdminNav place="top" newOrders={newOrders} />
        <span className="who">{admin.name}</span>
        <form action={logoutAction}>
          <button className="btn quiet small">Đăng xuất</button>
        </form>
        </div>
      </header>
      <Toasts>{children}</Toasts>
      <AdminNav place="bottom" newOrders={newOrders} />
    </div>
  )
}
