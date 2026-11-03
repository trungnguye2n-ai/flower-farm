'use server'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { clientIp, login } from '@/auth/login'
import { SESSION_COOKIE, sessionCookieOptions } from '@/auth/cookie'
import { getDb } from '@/db/client'
import { env } from '@/lib/env'

export type LoginState = { error?: string; email?: string }

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') ?? '')
  const password = String(form.get('password') ?? '')
  if (!email.trim() || !password) return { error: 'Nhập email và mật khẩu', email }
  const result = await login(getDb(), { email, password, ip: clientIp(await headers()) })
  if (!result.ok) return { error: result.error, email }
  ;(await cookies()).set(SESSION_COOKIE, result.token, sessionCookieOptions(result.expiresAt, env.APP_URL))
  redirect('/admin')
}
