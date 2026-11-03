// The database, as described in the design spec §4.
// Money is always an integer number of đồng. Soft-deleted rows keep `deleted_at`.
import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

const id = () => uuid('id').primaryKey().defaultRandom()
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
const deletedAt = () => timestamp('deleted_at', { withTimezone: true })

export type CareItem = { title: string; body: string }

export const categories = pgTable('categories', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  care: jsonb('care').$type<CareItem[]>().notNull().default([]),
  sortOrder: integer('sort_order').notNull().default(0),
  isVisible: boolean('is_visible').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const products = pgTable(
  'products',
  {
    id: id(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    shortDescription: text('short_description').notNull().default(''),
    accentColor: text('accent_color').notNull(),
    isVisible: boolean('is_visible').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex('products_slug_live').on(t.slug).where(sql`${t.deletedAt} IS NULL`),
    index('products_category_sort').on(t.categoryId, t.sortOrder),
    check('products_accent_color_hex', sql`${t.accentColor} ~ '^#[0-9A-Fa-f]{6}$'`),
  ],
)

export const productVariants = pgTable(
  'product_variants',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    price: integer('price').notNull(),
    inStock: boolean('in_stock').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index('product_variants_product_sort').on(t.productId, t.sortOrder),
    check('product_variants_price_non_negative', sql`${t.price} >= 0`),
  ],
)

export const productImages = pgTable(
  'product_images',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull().unique(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    blurData: text('blur_data'),
    alt: text('alt').notNull().default(''),
    isPrimary: boolean('is_primary').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('product_images_one_primary').on(t.productId).where(sql`${t.isPrimary}`),
    index('product_images_product_sort').on(t.productId, t.sortOrder),
  ],
)

export const adminUsers = pgTable(
  'admin_users',
  {
    id: id(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('admin_users_email_lower').on(sql`lower(${t.email})`)],
)

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    tokenHash: text('token_hash').notNull().unique(),
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_admin_user').on(t.adminUserId)],
)

export const siteSettings = pgTable(
  'site_settings',
  {
    id: integer('id').primaryKey().default(1),
    shopName: text('shop_name').notNull(),
    phone: text('phone').notNull().default(''),
    zalo: text('zalo').notNull().default(''),
    hours: text('hours').notNull().default(''),
    deliveryArea: text('delivery_area').notNull().default(''),
    address: text('address').notNull().default(''),
    updatedAt: updatedAt(),
  },
  (t) => [check('site_settings_single_row', sql`${t.id} = 1`)],
)

export const orderStatus = pgEnum('order_status', ['new', 'confirmed', 'delivered', 'cancelled'])

export const orders = pgTable(
  'orders',
  {
    id: id(),
    code: text('code').notNull().unique(),
    customerName: text('customer_name').notNull(),
    customerPhone: text('customer_phone').notNull(),
    recipientName: text('recipient_name'),
    recipientPhone: text('recipient_phone'),
    deliveryAddress: text('delivery_address'),
    deliveryTime: text('delivery_time'),
    note: text('note'),
    status: orderStatus('status').notNull().default('new'),
    total: integer('total').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('orders_status_created').on(t.status, t.createdAt.desc()),
    check('orders_total_non_negative', sql`${t.total} >= 0`),
  ],
)

export const orderItems = pgTable(
  'order_items',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
    productName: text('product_name').notNull(),
    variantName: text('variant_name').notNull(),
    unitPrice: integer('unit_price').notNull(),
    quantity: integer('quantity').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('order_items_order').on(t.orderId),
    check('order_items_unit_price_non_negative', sql`${t.unitPrice} >= 0`),
    check('order_items_quantity_positive', sql`${t.quantity} > 0`),
  ],
)

// Every login attempt, for rate limiting. Rows older than a day are purged on login.
export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: id(),
    email: text('email').notNull(),
    ip: text('ip').notNull(),
    succeeded: boolean('succeeded').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('login_attempts_email_created').on(t.email, t.createdAt), index('login_attempts_ip_created').on(t.ip, t.createdAt)],
)
