export type FieldErrors = Record<string, string>
export type Result<T> = { ok: true; data: T } | { ok: false; error?: string; fieldErrors?: FieldErrors }

export const ok = <T>(data: T): Result<T> => ({ ok: true, data })

export function fail(problem: string | FieldErrors): { ok: false; error?: string; fieldErrors?: FieldErrors } {
  return typeof problem === 'string' ? { ok: false, error: problem } : { ok: false, fieldErrors: problem }
}
