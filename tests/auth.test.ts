import { beforeEach, describe, expect, test } from 'vitest'
import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { adminUsers, sessions } from '@/db/schema'
import { hashPassword, verifyPassword } from '@/auth/password'
import { createSession, getSession, revokeAllSessions, revokeSession } from '@/auth/session'
import { freshTestDb, testSql } from './helpers/db'

describe('password', () => {
  test('hashes with argon2id and never stores the plain text', async () => {
    const hash = await hashPassword('mat-khau-dai-123')
    expect(hash).not.toContain('mat-khau-dai-123')
    expect(hash.startsWith('$argon2id$')).toBe(true)
  })

  test('verifies the right password only', async () => {
    const hash = await hashPassword('mat-khau-dai-123')
    expect(await verifyPassword(hash, 'mat-khau-dai-123')).toBe(true)
    expect(await verifyPassword(hash, 'mat-khau-sai-123')).toBe(false)
  })

  test('a malformed hash verifies as false instead of throwing', async () => {
    expect(await verifyPassword('not-a-hash', 'x')).toBe(false)
  })
})

describe('sessions', () => {
  let db: Db
  let userId: string
  beforeEach(async () => {
    db = await freshTestDb()
    const [u] = await db.insert(adminUsers).values({ email: 'a@vuon.vn', name: 'An', passwordHash: 'x' }).returning()
    userId = u.id
  })

  test('a fresh token resolves to its user', async () => {
    const { token, expiresAt } = await createSession(db, userId)
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86400_000)
    expect((await getSession(db, token))?.adminUserId).toBe(userId)
  })

  test('an unknown token resolves to null', async () => {
    expect(await getSession(db, 'khong-ton-tai')).toBeNull()
  })

  test('a revoked token resolves to null', async () => {
    const { token } = await createSession(db, userId)
    await revokeSession(db, token)
    expect(await getSession(db, token)).toBeNull()
  })

  test('an expired token resolves to null', async () => {
    const { token } = await createSession(db, userId)
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) })
    expect(await getSession(db, token)).toBeNull()
  })

  test('revokeAllSessions ends every session of that user', async () => {
    const a = await createSession(db, userId)
    const b = await createSession(db, userId)
    await revokeAllSessions(db, userId)
    expect(await getSession(db, a.token)).toBeNull()
    expect(await getSession(db, b.token)).toBeNull()
  })

  test('the database never holds the raw token', async () => {
    const { token } = await createSession(db, userId)
    const [{ n }] = await testSql`select count(*)::int as n from sessions where token_hash = ${token}`
    expect(n).toBe(0)
    const sha = createHash('sha256').update(token).digest('hex')
    const rows = await db.select().from(sessions).where(eq(sessions.tokenHash, sha))
    expect(rows.length).toBe(1)
  })
})
