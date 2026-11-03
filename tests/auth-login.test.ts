import { beforeEach, describe, expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { adminUsers, sessions } from '@/db/schema'
import { createAdmin } from '@/cli/admin'
import { revokeSession } from '@/auth/session'
import { clientIp, login } from '@/auth/login'
import { currentAdmin } from '@/auth/current'
import { sessionCookieOptions } from '@/auth/cookie'
import { checkOrigin } from '@/auth/origin'
import { freshTestDb, testSql } from './helpers/db'

const PASSWORD = 'mat-khau-dai-123'
const WRONG = 'Sai email hoặc mật khẩu'
const LIMITED = 'Đăng nhập sai quá nhiều lần. Thử lại sau 15 phút.'

describe('login', () => {
  let db: Db
  beforeEach(async () => {
    db = await freshTestDb()
    await createAdmin(db, { email: 'an@vuon.vn', name: 'An', password: PASSWORD })
  })

  test('logs in with the right password', async () => {
    const r = await login(db, { email: 'an@vuon.vn', password: PASSWORD, ip: '1.1.1.1' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(await currentAdmin(db, r.token)).toMatchObject({ email: 'an@vuon.vn', name: 'An' })
    const [u] = await db.select().from(adminUsers)
    expect(u.lastLoginAt).not.toBeNull()
  })

  test('wrong password and unknown email give the same error', async () => {
    expect(await login(db, { email: 'an@vuon.vn', password: 'sai-mat-khau-1', ip: '1.1.1.1' })).toEqual({ ok: false, error: WRONG })
    expect(await login(db, { email: 'ai@vuon.vn', password: PASSWORD, ip: '1.1.1.1' })).toEqual({ ok: false, error: WRONG })
  })

  test('email is matched case-insensitively', async () => {
    const r = await login(db, { email: ' AN@Vuon.vn ', password: PASSWORD, ip: '1.1.1.1' })
    expect(r.ok).toBe(true)
  })

  test('5 failures for an email from one IP block that IP, not the owner elsewhere', async () => {
    for (let i = 0; i < 5; i++) await login(db, { email: 'an@vuon.vn', password: 'sai-mat-khau-1', ip: '2.2.2.2' })
    expect(await login(db, { email: 'an@vuon.vn', password: PASSWORD, ip: '2.2.2.2' })).toEqual({ ok: false, error: LIMITED })
    expect((await login(db, { email: 'an@vuon.vn', password: PASSWORD, ip: '3.3.3.3' })).ok).toBe(true)
    await testSql`update login_attempts set created_at = now() - interval '16 minutes'`
    expect((await login(db, { email: 'an@vuon.vn', password: PASSWORD, ip: '2.2.2.2' })).ok).toBe(true)
  })

  test('50 failures for an email from many IPs block it everywhere', async () => {
    for (let i = 0; i < 50; i++) await login(db, { email: 'an@vuon.vn', password: 'sai-mat-khau-1', ip: `6.6.${Math.floor(i / 4)}.${i % 4}` })
    expect(await login(db, { email: 'an@vuon.vn', password: PASSWORD, ip: '7.7.7.7' })).toEqual({ ok: false, error: LIMITED })
  })

  test('a burst of parallel wrong logins checks at most 5 passwords', async () => {
    await Promise.all(Array.from({ length: 12 }, () => login(db, { email: 'an@vuon.vn', password: 'sai-mat-khau-1', ip: '8.8.8.8' })))
    const [{ n }] = await testSql`select count(*)::int as n from login_attempts`
    expect(n).toBeLessThanOrEqual(5)
  })

  test('blocks an IP after 20 failures across emails', async () => {
    for (let i = 0; i < 20; i++) await login(db, { email: `x${i}@vuon.vn`, password: 'sai-mat-khau-1', ip: '4.4.4.4' })
    expect(await login(db, { email: 'an@vuon.vn', password: PASSWORD, ip: '4.4.4.4' })).toEqual({ ok: false, error: LIMITED })
    expect((await login(db, { email: 'an@vuon.vn', password: PASSWORD, ip: '5.5.5.5' })).ok).toBe(true)
  })

  test('purges attempts older than a day and expired sessions', async () => {
    await login(db, { email: 'an@vuon.vn', password: 'sai-mat-khau-1', ip: '1.1.1.1' })
    await testSql`update login_attempts set created_at = now() - interval '2 days'`
    const [u] = await db.select().from(adminUsers)
    await db.insert(sessions).values({ tokenHash: 'old', adminUserId: u.id, expiresAt: new Date(Date.now() - 1000) })
    await login(db, { email: 'an@vuon.vn', password: PASSWORD, ip: '1.1.1.1' })
    const [{ n }] = await testSql`select count(*)::int as n from login_attempts`
    expect(n).toBe(1)
    expect(await db.select().from(sessions).where(eq(sessions.tokenHash, 'old'))).toHaveLength(0)
  })
})

describe('currentAdmin', () => {
  let db: Db
  let token: string
  beforeEach(async () => {
    db = await freshTestDb()
    await createAdmin(db, { email: 'an@vuon.vn', name: 'An', password: PASSWORD })
    const r = await login(db, { email: 'an@vuon.vn', password: PASSWORD, ip: '1.1.1.1' })
    if (!r.ok) throw new Error('login failed')
    token = r.token
  })

  test('no cookie or a random token is nobody', async () => {
    expect(await currentAdmin(db, undefined)).toBeNull()
    expect(await currentAdmin(db, '')).toBeNull()
    expect(await currentAdmin(db, 'forged')).toBeNull()
  })

  test('an expired session is nobody', async () => {
    await testSql`update sessions set expires_at = now() - interval '1 minute'`
    expect(await currentAdmin(db, token)).toBeNull()
  })

  test('a revoked session is nobody', async () => {
    await revokeSession(db, token)
    expect(await currentAdmin(db, token)).toBeNull()
  })
})

describe('request helpers', () => {
  test('clientIp takes the first forwarded address', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4')
    expect(clientIp(new Headers({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9')
    expect(clientIp(new Headers())).toBe('local')
  })

  test('cookie is Secure only over https', () => {
    const at = new Date('2027-01-01')
    expect(sessionCookieOptions(at, 'http://localhost:3000')).toEqual({ httpOnly: true, sameSite: 'lax', path: '/', secure: false, expires: at })
    expect(sessionCookieOptions(at, 'https://vuon.vn').secure).toBe(true)
  })

  test('checkOrigin accepts only the same host', () => {
    expect(checkOrigin(new Headers({ origin: 'http://localhost:3000', host: 'localhost:3000' }))).toBe(true)
    expect(checkOrigin(new Headers({ origin: 'https://vuon.vn', host: 'app:3000', 'x-forwarded-host': 'vuon.vn' }))).toBe(true)
    expect(checkOrigin(new Headers({ host: 'localhost:3000' }))).toBe(false)
    expect(checkOrigin(new Headers({ origin: 'https://evil.example', host: 'localhost:3000' }))).toBe(false)
    expect(checkOrigin(new Headers({ origin: 'http://localhost:3000', host: 'localhost:3000', 'x-forwarded-host': 'vuon.vn' }))).toBe(false)
    expect(checkOrigin(new Headers({ origin: 'null', host: 'localhost:3000' }))).toBe(false)
  })
})
