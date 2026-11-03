// Server-side photo pipeline: apply the camera's orientation, drop every bit of
// metadata (GPS included), and write WebP files that fit inside each box size.
import sharp from 'sharp'

/** Box sizes: each file fits inside W×W, never enlarged. */
export const IMAGE_WIDTHS = [480, 960, 1920] as const
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
const ACCEPTED = new Set(['jpeg', 'png', 'webp'])

export class ImageError extends Error {
  constructor(readonly code: 'too_large' | 'unsupported') {
    super(code === 'too_large' ? 'Ảnh lớn hơn 15 MB' : 'Chỉ nhận ảnh JPEG, PNG hoặc WebP')
  }
}

export type ProcessedImage = {
  width: number
  height: number
  blurData: string
  files: { width: (typeof IMAGE_WIDTHS)[number]; body: Buffer }[]
}

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  if (input.length > MAX_UPLOAD_BYTES) throw new ImageError('too_large')
  const meta = await sharp(input)
    .metadata()
    .catch(() => null)
  if (!meta?.format || !ACCEPTED.has(meta.format) || !meta.width || !meta.height) throw new ImageError('unsupported')

  // EXIF orientations 5–8 swap width and height once applied
  const [w, h] = (meta.orientation ?? 1) >= 5 ? [meta.height, meta.width] : [meta.width, meta.height]
  const largest = fitInside(w, h, IMAGE_WIDTHS.at(-1)!)

  const pipeline = (box: number) => sharp(input).rotate().resize({ width: box, height: box, fit: 'inside', withoutEnlargement: true })
  const files = await Promise.all(IMAGE_WIDTHS.map(async (box) => ({ width: box, body: await pipeline(box).webp({ quality: 82 }).toBuffer() })))
  const blur = await pipeline(16).webp({ quality: 40 }).toBuffer()

  return { width: largest.width, height: largest.height, blurData: `data:image/webp;base64,${blur.toString('base64')}`, files }
}

/** Size of a w×h image fitted inside a box×box square, never enlarged. */
export function fitInside(w: number, h: number, box: number): { width: number; height: number } {
  const scale = Math.min(1, box / Math.max(w, h))
  return { width: Math.round(w * scale), height: Math.round(h * scale) }
}
