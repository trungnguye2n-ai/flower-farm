import { beforeAll, beforeEach, describe, expect, test } from 'vitest'
import sharp from 'sharp'
import { eq } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { productImages, products } from '@/db/schema'
import { seed } from '@/db/seed'
import { publicUrl } from '@/storage/s3'
import { IMAGE_WIDTHS, ImageError, MAX_UPLOAD_BYTES, processImage } from '@/images/process'
import { addProductImage, deleteProductImage, reorderImages, s3Storage, setPrimaryImage, type Storage } from '@/images/service'
import { imageSources } from '@/images/urls'
import { POST } from '@/app/api/admin/images/route'
import { freshTestDb } from './helpers/db'

const solid = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: '#9E1B32' } })

let phonePhoto: Buffer
beforeAll(async () => {
  // A landscape sensor image the phone marks "rotate 90°", with a GPS position
  phonePhoto = await solid(4000, 3000)
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExif({ IFD0: { Make: 'Apple' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '11/1 56/1 0/1' } })
    .toBuffer()
})

describe('processImage', () => {
  test('turns a rotated phone photo upright and strips metadata', async () => {
    const r = await processImage(phonePhoto)
    expect([r.width, r.height]).toEqual([1440, 1920])
    expect(r.files.map((f) => f.width)).toEqual([...IMAGE_WIDTHS])
    for (const f of r.files) {
      const m = await sharp(f.body).metadata()
      expect(m.format).toBe('webp')
      expect(m.exif).toBeUndefined()
      expect(m.orientation).toBeUndefined()
      expect(m.height!).toBeGreaterThan(m.width!)
      expect(Math.max(m.width!, m.height!)).toBeLessThanOrEqual(1920)
    }
    const largest = await sharp(r.files.at(-1)!.body).metadata()
    expect([largest.width, largest.height]).toEqual([1440, 1920])
  })

  test('never enlarges a small image', async () => {
    const r = await processImage(await solid(600, 400).png().toBuffer())
    expect([r.width, r.height]).toEqual([600, 400])
    for (const f of r.files) expect((await sharp(f.body).metadata()).width).toBeLessThanOrEqual(600)
  })

  test('blurData is a small webp data URL', async () => {
    const { blurData } = await processImage(phonePhoto)
    expect(blurData).toMatch(/^data:image\/webp;base64,/)
    expect(blurData.length).toBeLessThan(1500)
  })

  test('rejects non-images, GIFs and oversize input', async () => {
    const code = (p: Promise<unknown>) => p.then(() => 'none', (e) => (e instanceof ImageError ? e.code : String(e)))
    expect(await code(processImage(Buffer.from('không phải ảnh')))).toBe('unsupported')
    expect(await code(processImage(await solid(10, 10).gif().toBuffer()))).toBe('unsupported')
    expect(await code(processImage(Buffer.alloc(MAX_UPLOAD_BYTES + 1)))).toBe('too_large')
    const err = await processImage(Buffer.from('x')).catch((e) => e)
    expect(err.message).toBe('Chỉ nhận ảnh JPEG, PNG hoặc WebP')
  })
})

describe('product images', () => {
  let db: Db
  let productId: string
  beforeEach(async () => {
    db = await freshTestDb()
    await seed(db)
    ;[{ id: productId }] = await db.select({ id: products.id }).from(products).where(eq(products.slug, 'muoi-gio-my'))
  })

  const add = async (storage: Storage = s3Storage, id = productId) =>
    addProductImage(db, storage, { productId: id, file: await solid(800, 600).jpeg().toBuffer(), alt: 'Mười giờ Mỹ' })

  test('stores three files and one primary row', async () => {
    const r = await add()
    expect(r.ok).toBe(true)
    const rows = await db.select().from(productImages).where(eq(productImages.productId, productId))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ isPrimary: true, width: 800, height: 600, alt: 'Mười giờ Mỹ' })
    expect(rows[0].storageKey).toBe(`public/products/${productId}/${rows[0].id}`)
    for (const w of IMAGE_WIDTHS) {
      const res = await fetch(publicUrl(`${rows[0].storageKey}-${w}.webp`))
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('image/webp')
    }
    const second = await add()
    expect(second.ok).toBe(true)
    const all = await db.select().from(productImages).where(eq(productImages.productId, productId))
    expect(all.filter((i) => i.isPrimary)).toHaveLength(1)
  })

  test('leaves nothing behind when storage fails on the second file', async () => {
    const put: string[] = []
    const deleted: string[] = []
    let calls = 0
    const flaky: Storage = {
      put: async (key) => {
        if (++calls === 2) throw new Error('storage down')
        put.push(key)
      },
      del: async (key) => {
        deleted.push(key)
      },
    }
    const r = await add(flaky)
    expect(r).toEqual({ ok: false, error: 'Không lưu được ảnh, thử lại' })
    expect(await db.select().from(productImages)).toHaveLength(0)
    expect(deleted.sort()).toEqual(put.sort())
    expect(put).toHaveLength(1)
  })

  test('removes uploaded files when the database insert fails', async () => {
    const put: string[] = []
    const deleted: string[] = []
    const recording: Storage = { put: async (k) => void put.push(k), del: async (k) => void deleted.push(k) }
    const r = await add(recording, '00000000-0000-0000-0000-000000000000')
    expect(r.ok).toBe(false)
    expect(put).toHaveLength(IMAGE_WIDTHS.length)
    expect(deleted.sort()).toEqual(put.sort())
  })

  test('deleting the primary image promotes the next one and removes its files', async () => {
    const a = await add()
    const b = await add()
    if (!a.ok || !b.ok) throw new Error('upload failed')
    const deleted: string[] = []
    await deleteProductImage(db, { put: async () => {}, del: async (k) => void deleted.push(k) }, a.data.id)
    const rows = await db.select().from(productImages)
    expect(rows.map((r) => [r.id, r.isPrimary])).toEqual([[b.data.id, true]])
    expect(deleted).toHaveLength(IMAGE_WIDTHS.length)
  })

  test('setPrimaryImage moves the flag; reorderImages sets the order', async () => {
    const a = await add()
    const b = await add()
    if (!a.ok || !b.ok) throw new Error('upload failed')
    await setPrimaryImage(db, b.data.id)
    const rows = await db.select().from(productImages)
    expect(rows.filter((r) => r.isPrimary).map((r) => r.id)).toEqual([b.data.id])
    expect((await reorderImages(db, productId, [b.data.id, a.data.id])).ok).toBe(true)
    const sorted = (await db.select().from(productImages)).sort((x, y) => x.sortOrder - y.sortOrder)
    expect(sorted.map((r) => r.id)).toEqual([b.data.id, a.data.id])
    expect((await reorderImages(db, productId, [a.data.id])).ok).toBe(false)
  })
})

describe('imageSources', () => {
  test('points at the 960 file with a srcset of real widths', () => {
    const s = imageSources({ storageKey: 'public/products/p/i', width: 1440, height: 1920 })
    expect(s.src).toBe(publicUrl('public/products/p/i-960.webp'))
    const url = (w: number) => publicUrl(`public/products/p/i-${w}.webp`)
    expect(s.srcSet).toBe(`${url(480)} 360w, ${url(960)} 720w, ${url(1920)} 1440w`)
  })

  test('a small image lists each real width once', () => {
    const s = imageSources({ storageKey: 'k', width: 600, height: 400 })
    expect(s.srcSet).toBe(`${publicUrl('k-480.webp')} 480w, ${publicUrl('k-960.webp')} 600w`)
  })
})

describe('upload route', () => {
  const request = (headers: Record<string, string>) => {
    const body = new FormData()
    body.set('productId', '00000000-0000-0000-0000-000000000000')
    body.set('file', new Blob([Buffer.from('x')], { type: 'image/jpeg' }), 'a.jpg')
    return new Request('http://localhost:3000/api/admin/images', { method: 'POST', headers, body })
  }

  test('rejects a foreign Origin (403)', async () => {
    const res = await POST(request({ origin: 'https://evil.example', host: 'localhost:3000', cookie: 'vh_session=x' }))
    expect(res.status).toBe(403)
  })

  test('rejects requests without a session (401)', async () => {
    expect((await POST(request({ origin: 'http://localhost:3000', host: 'localhost:3000' }))).status).toBe(401)
    expect((await POST(request({ origin: 'http://localhost:3000', host: 'localhost:3000', cookie: 'vh_session=forged' }))).status).toBe(401)
  })
})
