import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '@/db/client'
import { SESSION_COOKIE } from './cookie'
import { currentAdmin, type Admin } from './current'

/** The logged-in admin, or a redirect to the login page. Call it in every admin page and action. */
export async function requireAdmin(): Promise<Admin> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const admin = await currentAdmin(getDb(), token)
  if (!admin) redirect('/admin/login')
  return admin
}
