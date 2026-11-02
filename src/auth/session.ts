// Sessions live in the database so they can be revoked. The browser holds a
// random token; the database only ever stores its SHA-256.
import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { sessions } from '@/db/schema'
import { env } from '@/lib/env'

const digest = (token: string) => createHash('sha256').update(token).digest('hex')

export async function createSession(db: Db, adminUserId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 86_400_000)
  await db.insert(sessions).values({ tokenHash: digest(token), adminUserId, expiresAt })
  return { token, expiresAt }
}

export async function getSession(db: Db, token: string): Promise<{ adminUserId: string; expiresAt: Date } | null> {
  const [row] = await db
    .select({ adminUserId: sessions.adminUserId, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, digest(token)), gt(sessions.expiresAt, new Date())))
  return row ?? null
}

export async function revokeSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, digest(token)))
}

export async function revokeAllSessions(db: Db, adminUserId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.adminUserId, adminUserId))
}
