// Email + password login with rate limiting. Every attempt is recorded; within
// LOGIN_WINDOW_MIN minutes, too many failures for one email or one IP block
// further attempts, even with the right password.
import { and, count, eq, gt, lt, sql } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { adminUsers, loginAttempts, sessions } from '@/db/schema'
import { hashPassword, verifyPassword } from './password'
import { createSession } from './session'

export const LOGIN_WINDOW_MIN = 15
export const MAX_FAIL_EMAIL = 5
export const MAX_FAIL_IP = 20

const WRONG = 'Sai email hoặc mật khẩu'
const LIMITED = `Đăng nhập sai quá nhiều lần. Thử lại sau ${LOGIN_WINDOW_MIN} phút.`

// Verified against when the email is unknown, so both cases take as long
let dummyHash: Promise<string> | undefined

export type LoginResult = { ok: true; token: string; expiresAt: Date } | { ok: false; error: string }

async function failures(db: Db, column: typeof loginAttempts.email | typeof loginAttempts.ip, value: string, since: Date) {
  const [row] = await db
    .select({ n: count() })
    .from(loginAttempts)
    .where(and(eq(column, value), eq(loginAttempts.succeeded, false), gt(loginAttempts.createdAt, since)))
  return row.n
}

export async function login(db: Db, input: { email: string; password: string; ip: string }): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase()
  const now = Date.now()
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, new Date(now - 86_400_000)))
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date(now)))

  const since = new Date(now - LOGIN_WINDOW_MIN * 60_000)
  if ((await failures(db, loginAttempts.email, email, since)) >= MAX_FAIL_EMAIL || (await failures(db, loginAttempts.ip, input.ip, since)) >= MAX_FAIL_IP) {
    return { ok: false, error: LIMITED }
  }

  const [user] = await db.select().from(adminUsers).where(eq(sql`lower(${adminUsers.email})`, email))
  dummyHash ??= hashPassword('khong-phai-mat-khau-that')
  const valid = await verifyPassword(user?.passwordHash ?? (await dummyHash), input.password)
  const succeeded = Boolean(user) && valid
  await db.insert(loginAttempts).values({ email, ip: input.ip, succeeded })
  if (!succeeded) return { ok: false, error: WRONG }

  await db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, user.id))
  return { ok: true, ...(await createSession(db, user.id)) }
}

/** Caddy replaces X-Forwarded-For with the real client address. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers.get('x-real-ip')?.trim() || 'local'
}
