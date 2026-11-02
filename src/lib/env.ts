import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.url(),
  DATABASE_URL_TEST: z.url().optional(),
  S3_ENDPOINT: z.url(),
  S3_PUBLIC_URL: z.url(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  APP_URL: z.url(),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  BACKUP_KEEP_DAYS: z.coerce.number().int().positive().default(14),
})

export type Env = z.infer<typeof schema>

/** Validate a set of variables; the error names every bad or missing one. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source)
  if (!result.success) {
    const lines = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    throw new Error(`Cấu hình môi trường không hợp lệ:\n${lines.join('\n')}`)
  }
  return result.data
}

let cached: Env | undefined

/** Parsed on first access, so `next build` never needs runtime secrets. */
export const env: Env = new Proxy({} as Env, {
  get(_, key: string) {
    cached ??= parseEnv(process.env)
    return cached[key as keyof Env]
  },
})
