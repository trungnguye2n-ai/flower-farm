/** Highest price accepted from the admin, in đồng. */
export const MAX_PRICE = 2_000_000_000

/**
 * A price typed the way people in Vietnam write it: 150000, 150.000, 150,000,
 * 150 000, 150.000đ, 150k. Returns whole đồng, or null when it is not a price.
 */
export function parsePrice(input: string | number): number | null {
  if (typeof input === 'number') return Number.isInteger(input) && input >= 0 && input <= MAX_PRICE ? input : null
  let s = input.trim().toLowerCase().replace(/\s+/g, '').replace(/(đ|vnđ|vnd)$/, '')
  let multiplier = 1
  if (s.endsWith('k')) {
    multiplier = 1000
    s = s.slice(0, -1)
  }
  if (!/^(\d+|\d{1,3}([.,]\d{3})+)$/.test(s)) return null
  const value = Number(s.replace(/[.,]/g, '')) * multiplier
  return value <= MAX_PRICE ? value : null
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
