import { publicUrl } from '@/storage/s3'
import { fitInside, IMAGE_WIDTHS } from './process'

export const fileKey = (storageKey: string, box: number) => `${storageKey}-${box}.webp`

/** `src` and `srcSet` for an <img>; descriptors are each file's real width. */
export function imageSources(image: { storageKey: string; width: number; height: number }): { src: string; srcSet: string } {
  const seen = new Set<number>()
  const entries: string[] = []
  for (const box of IMAGE_WIDTHS) {
    const { width } = fitInside(image.width, image.height, box)
    if (seen.has(width)) continue
    seen.add(width)
    entries.push(`${publicUrl(fileKey(image.storageKey, box))} ${width}w`)
  }
  return { src: publicUrl(fileKey(image.storageKey, 960)), srcSet: entries.join(', ') }
}
