import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export function createDb(url: string, options: { max?: number } = {}) {
  const sql = postgres(url, { max: options.max ?? 10, onnotice: () => {} })
  return { db: drizzle(sql, { schema }), sql }
}

export type Db = ReturnType<typeof createDb>['db']

let shared: ReturnType<typeof createDb> | undefined

/** The app's connection, opened on first use from DATABASE_URL. */
export function getDb(): Db {
  if (!shared) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL chưa được cấu hình')
    shared = createDb(url)
  }
  return shared.db
}
