import { sql } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { pingStorage } from '@/storage/s3'
import { checkHealth } from './check'

export const dynamic = 'force-dynamic'

export function GET() {
  return checkHealth({
    pingDb: async () => {
      await getDb().execute(sql`select 1`)
      return true
    },
    pingStorage,
  })
}
