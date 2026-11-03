import { mkdirSync } from 'node:fs'
import sharp from 'sharp'
import { createAdmin } from '../src/cli/admin'
import { createDb } from '../src/db/client'
import { runMigrations } from '../src/db/migrate'
import { seed } from '../src/db/seed'
import { assertTestDatabase } from '../tests/helpers/guard'

export const E2E_ADMIN = { email: 'e2e@vuon.vn', name: 'Kiểm thử', password: 'mat-khau-e2e-123' }
export const PHOTO = 'e2e/.fixtures/photo.jpg'

export default async function globalSetup() {
  const url = process.env.DATABASE_URL_TEST
  if (!url) throw new Error('DATABASE_URL_TEST is required for e2e')
  assertTestDatabase(url)
  const { db, sql } = createDb(url, { max: 1 })
  try {
    await sql.unsafe('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;')
    await runMigrations(url)
    await seed(db)
    await createAdmin(db, E2E_ADMIN)
    const [o] = await sql`insert into orders (code, customer_name, customer_phone, total) values ('VH-0001', 'Chị Lan', '0901234567', 250000) returning id`
    await sql`insert into order_items (order_id, product_name, variant_name, unit_price, quantity) values (${o.id}, 'Đỏ nhung', 'Chậu đang nở', 250000, 1)`
  } finally {
    await sql.end()
  }
  mkdirSync('e2e/.fixtures', { recursive: true })
  await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#D9467C' } }).jpeg().toFile(PHOTO)
}
