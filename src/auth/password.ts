import { hash, verify } from '@node-rs/argon2'

/** argon2id with the library's defaults (OWASP-recommended parameters). */
export function hashPassword(plain: string): Promise<string> {
  return hash(plain)
}

export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  try {
    return await verify(stored, plain)
  } catch {
    return false
  }
}
