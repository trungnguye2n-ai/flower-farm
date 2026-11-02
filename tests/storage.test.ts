import { describe, expect, test } from 'vitest'
import { randomUUID } from 'node:crypto'
import { deleteObject, pingStorage, publicUrl, putObject } from '@/storage/s3'

describe('storage', () => {
  test('an uploaded public object is readable at its public URL', async () => {
    const key = `public/test/${randomUUID()}.txt`
    await putObject(key, Buffer.from('xin chào'), 'text/plain; charset=utf-8')
    const res = await fetch(publicUrl(key))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('xin chào')
    await deleteObject(key)
  })

  test('a deleted object is gone', async () => {
    const key = `public/test/${randomUUID()}.txt`
    await putObject(key, Buffer.from('x'), 'text/plain')
    await deleteObject(key)
    expect((await fetch(publicUrl(key))).status).toBe(404)
  })

  test('objects outside public/ are not readable anonymously', async () => {
    const key = `private/${randomUUID()}.txt`
    await putObject(key, Buffer.from('bí mật'), 'text/plain')
    expect((await fetch(publicUrl(key))).status).toBe(403)
    await deleteObject(key)
  })

  test('pingStorage reports the bucket is reachable', async () => {
    expect(await pingStorage()).toBe(true)
  })
})
