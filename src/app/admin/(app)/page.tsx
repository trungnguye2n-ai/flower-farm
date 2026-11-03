import { Suspense } from 'react'
import { requireAdmin } from '@/auth/guard'
import { listCatalog, type CatalogProduct } from '@/admin/catalog'
import { getDb } from '@/db/client'
import { imageSources } from '@/images/urls'
import { Catalog } from '@/components/admin/Catalog'
import type { UiProduct } from '@/components/admin/types'

export const dynamic = 'force-dynamic'

const withSources = (p: CatalogProduct): UiProduct => ({ ...p, images: p.images.map((i) => ({ ...i, ...imageSources(i) })) })

export default async function CatalogPage() {
  await requireAdmin()
  const db = getDb()
  const [live, deleted] = await Promise.all([listCatalog(db), listCatalog(db, { deleted: true })])
  return (
    <Suspense>
      <Catalog
        categories={live.map((c) => ({ ...c, products: c.products.map(withSources) }))}
        deleted={deleted.flatMap((c) => c.products).map(withSources)}
      />
    </Suspense>
  )
}
