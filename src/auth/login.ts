// Email + password login with rate limiting. Every checked attempt is recorded;
// within LOGIN_WINDOW_MIN minutes, further attempts are refused (even with the
// right password) after:
//   - MAX_FAIL_EMAIL_IP failures for this email from this IP (a stranger guessing
//     from one place locks only themselves out, not the owner on another network),
//   - MAX_FAIL_IP failures from this IP across emails,
//   - MAX_FAIL_EMAIL failures for this email from anywhere (a spread-out attack).
// Advisory locks on the email and the IP make the count-check-record sequence
// atomic, so a burst of parallel requests cannot all slip in under the limit.
import { and, count, eq, gt, lt, sql } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { adminUsers, loginAttempts, sessions } from '@/db/schema'
import { hashPassword, verifyPassword } from './password'
import { createSession } from './session'

export const LOGIN_WINDOW_MIN = 15
export const MAX_FAIL_EMAIL_IP = 5
export const MAX_FAIL_IP = 20
export const MAX_FAIL_EMAIL = 50

const WRONG = 'Sai email hoặc mật khẩu'
const LIMITED = `Đăng nhập sai quá nhiều lần. Thử lại sau ${LOGIN_WINDOW_MIN} phút.`

let dummyHash: Promise<string> | undefined

export type LoginResult = { ok: true; token: string; expiresAt: Date } | { ok: false; error: string }

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

async function failures(tx: Tx, since: Date, where: { email?: string; ip?: string }) {
  const [row] = await tx
    .select({ n: count() })
    .from(loginAttempts)
    .where(
      and(
        where.email ? eq(loginAttempts.email, where.email) : undefined,
        where.ip ? eq(loginAttempts.ip, where.ip) : undefined,
        eq(loginAttempts.succeeded, false),
        gt(loginAttempts.createdAt, since),
      ),
    )
  return row.n
}

export async function login(db: Db, input: { email: string; password: string; ip: string }): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase()
  const ip = input.ip
  const now = Date.now()
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, new Date(now - 86_400_000)))
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date(now)))
  dummyHash ??= hashPassword('khong-phai-mat-khau-that')
  const dummy = await dummyHash

  const outcome = await db.transaction(async (tx) => {
    // Same order everywhere (email, then IP) so two requests never wait on each other in a cycle
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'login-email:' + email}))`)
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'login-ip:' + ip}))`)
    const since = new Date(now - LOGIN_WINDOW_MIN * 60_000)
    if (
      (await failures(tx, since, { email, ip })) >= MAX_FAIL_EMAIL_IP ||
      (await failures(tx, since, { ip })) >= MAX_FAIL_IP ||
      (await failures(tx, since, { email })) >= MAX_FAIL_EMAIL
    ) {
      return { limited: true as const }
    }
    const [user] = await tx.select().from(adminUsers).where(eq(sql`lower(${adminUsers.email})`, email))
    // Unknown emails still pay for a hash check, so both cases take as long
    const valid = await verifyPassword(user?.passwordHash ?? dummy, input.password)
    const succeeded = Boolean(user) && valid
    await tx.insert(loginAttempts).values({ email, ip, succeeded })
    if (succeeded) await tx.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, user.id))
    return { limited: false as const, userId: succeeded ? user.id : null }
  })

  if (outcome.limited) return { ok: false, error: LIMITED }
  if (!outcome.userId) return { ok: false, error: WRONG }
  return { ok: true, ...(await createSession(db, outcome.userId)) }
}

/** Caddy replaces X-Forwarded-For with the real client address. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers.get('x-real-ip')?.trim() || 'local'
}
