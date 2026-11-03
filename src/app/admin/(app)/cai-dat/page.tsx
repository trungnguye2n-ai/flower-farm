import { requireAdmin } from '@/auth/guard'
import { getSettings } from '@/admin/settings'
import { getDb } from '@/db/client'
import { SettingsForm } from '@/components/admin/SettingsForm'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  await requireAdmin()
  const settings = await getSettings(getDb())
  return (
    <main className="page narrow">
      <div className="page-head">
        <div>
          <h1>Thông tin vườn</h1>
          <p>Hiện trên trang cho khách và trong nội dung đơn gửi qua Zalo.</p>
        </div>
      </div>
      <SettingsForm initial={settings} />
    </main>
  )
}
