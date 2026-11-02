// Starting data: the two flowers the garden sells, a few products with
// placeholder prices (giá tạm), and the shop's contact row.
// Idempotent: rows that already exist (by slug, or the single settings row)
// are left exactly as the admin last edited them.
import { fileURLToPath } from 'node:url'
import { eq } from 'drizzle-orm'
import { createDb, type Db } from './client'
import { categories, products, productVariants, siteSettings, type CareItem } from './schema'

type SeedProduct = {
  slug: string
  name: string
  shortDescription: string
  accentColor: string
  variants: { name: string; price: number }[]
}

type SeedCategory = {
  slug: string
  name: string
  description: string
  care: CareItem[]
  products: SeedProduct[]
}

const DATA: SeedCategory[] = [
  {
    slug: 'bach-thuy-tien',
    name: 'Bách thủy tiên',
    description: 'Còn gọi là lan huệ. Củ to, cuống cao, mỗi cuống nở ba đến bốn bông lớn.',
    care: [
      { title: 'Ánh sáng', body: 'Cần nhiều sáng, tốt nhất là nắng buổi sáng. Thiếu sáng cuống sẽ vươn dài và yếu.' },
      { title: 'Tưới nước', body: 'Tưới khi mặt đất đã khô. Không để chậu đọng nước, củ dễ thối.' },
      { title: 'Đất và chậu', body: 'Đất tơi, thoát nước tốt. Trồng để một phần ba củ nhô trên mặt đất.' },
      { title: 'Sau khi hoa tàn', body: 'Cắt cuống hoa, giữ lại lá để nuôi củ. Củ khoẻ sẽ ra hoa lại mùa sau.' },
    ],
    products: [
      {
        slug: 'bach-thuy-tien-do-nhung',
        name: 'Đỏ nhung',
        shortDescription: 'Đỏ thẫm, cánh dày như nhung. (giá tạm)',
        accentColor: '#9E1B32',
        variants: [
          { name: 'Củ trần', price: 60000 },
          { name: 'Chậu đã trồng', price: 150000 },
          { name: 'Chậu đang nở', price: 250000 },
        ],
      },
      {
        slug: 'bach-thuy-tien-trang-vien-do',
        name: 'Trắng viền đỏ',
        shortDescription: 'Cánh trắng, viền và gân đỏ. (giá tạm)',
        accentColor: '#B8323F',
        variants: [
          { name: 'Củ trần', price: 70000 },
          { name: 'Chậu đang nở', price: 280000 },
        ],
      },
    ],
  },
  {
    slug: 'muoi-gio',
    name: 'Hoa mười giờ',
    description: 'Nở rộ dưới nắng, dễ trồng, lên màu rực trên ban công và bồn cửa sổ.',
    care: [
      { title: 'Ánh sáng', body: 'Cần nắng trực tiếp ít nhất sáu giờ mỗi ngày. Càng nắng hoa càng nở nhiều.' },
      { title: 'Tưới nước', body: 'Chịu hạn tốt. Tưới ít, để đất khô giữa hai lần tưới, tránh úng.' },
      { title: 'Đất', body: 'Đất thoát nước tốt, có thể trộn thêm cát hoặc trấu.' },
      { title: 'Nhân giống', body: 'Cắt một đoạn cành cắm xuống đất ẩm, vài ngày là ra rễ.' },
    ],
    products: [
      {
        slug: 'muoi-gio-thai-kep',
        name: 'Mười giờ Thái kép',
        shortDescription: 'Hoa kép nhiều lớp cánh, nhiều màu. (giá tạm)',
        accentColor: '#D9467C',
        variants: [
          { name: '1 chậu', price: 35000 },
          { name: 'Khay 12 chậu', price: 360000 },
        ],
      },
      {
        slug: 'muoi-gio-my',
        name: 'Mười giờ Mỹ',
        shortDescription: 'Bông to, lá tròn, nở lâu trong ngày. (giá tạm)',
        accentColor: '#E8902A',
        variants: [
          { name: '1 chậu', price: 30000 },
          { name: 'Khay 12 chậu', price: 300000 },
        ],
      },
    ],
  },
]

const SETTINGS = {
  id: 1,
  shopName: 'Vườn hoa',
  phone: '0900000000',
  zalo: '0900000000',
  hours: '7:00 đến 18:00, mỗi ngày',
  deliveryArea: 'Nội thành trong 2 giờ, đi tỉnh 2 đến 3 ngày',
  address: 'Đà Lạt',
}

export async function seed(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [ci, c] of DATA.entries()) {
      await tx
        .insert(categories)
        .values({ slug: c.slug, name: c.name, description: c.description, care: c.care, sortOrder: ci })
        .onConflictDoNothing({ target: categories.slug })
      const [category] = await tx.select().from(categories).where(eq(categories.slug, c.slug))

      for (const [pi, p] of c.products.entries()) {
        // Any row with this slug, even soft-deleted, means the admin has had it: leave it
        const existing = await tx.select({ id: products.id }).from(products).where(eq(products.slug, p.slug))
        if (existing.length) continue
        const [created] = await tx
          .insert(products)
          .values({
            categoryId: category.id,
            slug: p.slug,
            name: p.name,
            shortDescription: p.shortDescription,
            accentColor: p.accentColor,
            sortOrder: pi,
          })
          .returning({ id: products.id })
        await tx.insert(productVariants).values(p.variants.map((v, vi) => ({ productId: created.id, name: v.name, price: v.price, sortOrder: vi })))
      }
    }
    await tx.insert(siteSettings).values(SETTINGS).onConflictDoNothing({ target: siteSettings.id })
  })
}

// Run as a script: `npm run db:seed`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('Thiếu DATABASE_URL')
    process.exit(1)
  }
  const { db, sql } = createDb(url, { max: 1 })
  seed(db)
    .then(() => console.log('Đã nạp dữ liệu mẫu'))
    .catch((e) => {
      console.error(e)
      process.exitCode = 1
    })
    .finally(() => sql.end())
}
