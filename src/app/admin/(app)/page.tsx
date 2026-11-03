import { requireAdmin } from '@/auth/guard'

export const dynamic = 'force-dynamic'

export default async function CatalogPage() {
  await requireAdmin()
  return (
    <main className="page">
      <div className="page-head">
        <h1>Sản phẩm</h1>
      </div>
    </main>
  )
}
