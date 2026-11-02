import { describe, expect, test } from 'vitest'
import { checkHealth } from '@/app/api/health/check'

const ok = async () => true
const fails = async () => {
  throw new Error('down')
}
const hangs = () => new Promise<boolean>((r) => setTimeout(() => r(true), 5000))

describe('health', () => {
  test('both dependencies up → 200', async () => {
    const res = await checkHealth({ pingDb: ok, pingStorage: ok })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok', db: true, storage: true })
  })

  test('database down → 503 naming the database', async () => {
    const res = await checkHealth({ pingDb: fails, pingStorage: ok })
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ status: 'error', db: false, storage: true })
  })

  test('storage hanging → 503 within the timeout', async () => {
    const started = Date.now()
    const res = await checkHealth({ pingDb: ok, pingStorage: hangs })
    expect(Date.now() - started).toBeLessThan(2500)
    expect(res.status).toBe(503)
    expect((await res.json()).storage).toBe(false)
  })
})
