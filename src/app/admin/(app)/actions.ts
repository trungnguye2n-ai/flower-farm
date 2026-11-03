'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/auth/guard'
import { SESSION_COOKIE } from '@/auth/cookie'
import { revokeSession } from '@/auth/session'
import { getDb } from '@/db/client'

export async function logoutAction(): Promise<void> {
  await requireAdmin()
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) await revokeSession(getDb(), token)
  jar.delete(SESSION_COOKIE)
  redirect('/admin/login')
}
