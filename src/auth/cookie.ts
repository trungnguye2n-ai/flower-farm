export const SESSION_COOKIE = 'vh_session'

export function sessionCookieOptions(expiresAt: Date, appUrl: string) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: appUrl.startsWith('https:'),
    expires: expiresAt,
  }
}
