// Before upload, in the browser: iPhone HEIC photos become JPEG (the server's
// sharp build cannot read HEIC), and very large photos are shrunk so an upload
// over 4G in the garden takes seconds, not minutes. The server still does the
// real resizing and strips metadata.
const SHRINK_ABOVE = 2.5 * 1024 * 1024
const MAX_SIDE = 2400

const isHeic = (f: File) => /image\/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name)
const asJpegName = (name: string) => name.replace(/\.[^.]+$/, '') + '.jpg'

/** Draw at most MAX_SIDE on the long side; createImageBitmap applies the EXIF orientation. */
async function reencode(file: Blob, name: string): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  if (!blob) throw new Error('Không đọc được ảnh')
  return new File([blob], asJpegName(name), { type: 'image/jpeg' })
}

export async function preparePhoto(file: File): Promise<File> {
  if (isHeic(file)) {
    // Safari reads HEIC itself; other browsers need the converter (loaded only now)
    try {
      return await reencode(file, file.name)
    } catch {
      const heic2any = (await import('heic2any')).default
      const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })
      const jpeg = new File([Array.isArray(out) ? out[0] : out], asJpegName(file.name), { type: 'image/jpeg' })
      return jpeg.size > SHRINK_ABOVE ? reencode(jpeg, jpeg.name).catch(() => jpeg) : jpeg
    }
  }
  if (file.size > SHRINK_ABOVE) return reencode(file, file.name).catch(() => file)
  return file
}
