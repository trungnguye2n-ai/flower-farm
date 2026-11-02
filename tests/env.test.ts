import { describe, expect, test } from 'vitest'
import { parseEnv } from '@/lib/env'

const full = {
  DATABASE_URL: 'postgres://u:p@127.0.0.1:55432/vuonhoa',
  DATABASE_URL_TEST: 'postgres://u:p@127.0.0.1:55432/vuonhoa_test',
  S3_ENDPOINT: 'http://127.0.0.1:59100',
  S3_PUBLIC_URL: 'http://127.0.0.1:59100',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'vuonhoa',
  S3_ACCESS_KEY: 'key',
  S3_SECRET_KEY: 'secret',
  APP_URL: 'http://localhost:3000',
}

describe('parseEnv', () => {
  test('returns typed config with defaults', () => {
    const env = parseEnv(full)
    expect(env.SESSION_TTL_DAYS).toBe(30)
    expect(env.BACKUP_KEEP_DAYS).toBe(14)
    expect(env.S3_BUCKET).toBe('vuonhoa')
  })

  test('reads numeric overrides as numbers', () => {
    expect(parseEnv({ ...full, SESSION_TTL_DAYS: '7' }).SESSION_TTL_DAYS).toBe(7)
  })

  test('names the missing variable', () => {
    const { DATABASE_URL: _, ...rest } = full
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/)
  })

  test('rejects a malformed URL', () => {
    expect(() => parseEnv({ ...full, S3_ENDPOINT: 'not a url' })).toThrow(/S3_ENDPOINT/)
  })
})
