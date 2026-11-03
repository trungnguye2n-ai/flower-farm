// Convenience only: send visitors without a session cookie straight to the
// login page. The real check is requireAdmin() on the server in every page and action.
import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/auth/cookie'

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin/login')) return NextResponse.next()
  if (!request.cookies.has(SESSION_COOKIE)) return NextResponse.redirect(new URL('/admin/login', request.url))
  return NextResponse.next()
}

export const config = { matcher: ['/admin/:path*'] }
