import { eq } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { adminUsers } from '@/db/schema'
import { getSession } from './session'

export type Admin = { id: string; email: string; name: string }

/** The admin a session token belongs to, or null for a missing, unknown, expired or revoked one. */
export async function currentAdmin(db: Db, token: string | undefined): Promise<Admin | null> {
  if (!token) return null
  const session = await getSession(db, token)
  if (!session) return null
  const [user] = await db
    .select({ id: adminUsers.id, email: adminUsers.email, name: adminUsers.name })
    .from(adminUsers)
    .where(eq(adminUsers.id, session.adminUserId))
  return user ?? null
}
