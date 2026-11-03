import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { currentAdmin } from '@/auth/current'
import { SESSION_COOKIE } from '@/auth/cookie'
import { getDb } from '@/db/client'
import { LoginForm } from './LoginForm'
import '@/components/admin/admin.css'

export const metadata = { title: 'Đăng nhập · Vườn hoa', robots: { index: false } }

export default async function LoginPage() {
  // Already signed in: go straight to the admin
  if (await currentAdmin(getDb(), (await cookies()).get(SESSION_COOKIE)?.value)) redirect('/admin')
  return (
    <main className="login">
      <LoginForm />
    </main>
  )
}
