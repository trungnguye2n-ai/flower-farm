/**
 * CSRF check for route handlers, the same rule Next applies to Server Actions:
 * the request's Origin must name the host it was sent to.
 */
export function checkOrigin(headers: Headers): boolean {
  const origin = headers.get('origin')
  const host = headers.get('x-forwarded-host') ?? headers.get('host')
  if (!origin || !host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}
