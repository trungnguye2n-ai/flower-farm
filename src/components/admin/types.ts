import type { CatalogCategory, CatalogImage, CatalogProduct } from '@/admin/catalog'

/** Catalog as sent to the browser: image URLs already resolved on the server. */
export type UiImage = CatalogImage & { src: string; srcSet: string }
export type UiProduct = Omit<CatalogProduct, 'images'> & { images: UiImage[] }
export type UiCategory = Omit<CatalogCategory, 'products'> & { products: UiProduct[] }

const vnd = new Intl.NumberFormat('vi-VN')
export const money = (n: number) => `${vnd.format(n)}đ`
export const priceRange = (p: Pick<CatalogProduct, 'minPrice' | 'maxPrice'>) =>
  p.minPrice === p.maxPrice ? money(p.minPrice) : `${money(p.minPrice)} – ${money(p.maxPrice)}`
