import { afterAll } from 'vitest'
import { createDb, type Db } from '@/db/client'
import { runMigrations } from '@/db/migrate'
import { assertTestDatabase } from './guard'

const url = process.env.DATABASE_URL_TEST
if (!url) throw new Error('DATABASE_URL_TEST is required for database tests')
assertTestDatabase(url)

const conn = createDb(url)
afterAll(() => conn.sql.end())

/** Empty the test database and apply every migration from scratch. */
export async function freshTestDb(): Promise<Db> {
  await conn.sql.unsafe('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;')
  await runMigrations(url!)
  return conn.db
}

export const testSql = conn.sql

/** Postgres error code of a rejected promise (23505 unique, 23514 check, 23503 fk). */
export async function pgCode(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p
  } catch (e) {
    const err = e as { code?: string; cause?: { code?: string } }
    return err.code ?? err.cause?.code
  }
  return undefined
}
