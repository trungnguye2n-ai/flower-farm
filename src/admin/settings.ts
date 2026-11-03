import { eq } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { siteSettings } from '@/db/schema'
import { fail, ok, type FieldErrors, type Result } from './result'

export type SettingsInput = { shopName: string; phone: string; zalo: string; hours: string; deliveryArea: string; address: string }

/** 0 or +84, then a mobile prefix 3/5/7/8/9 and 8 more digits; spaces, dots and dashes ignored. */
export function isVietnamPhone(s: string): boolean {
  return /^(0|\+84)[35789]\d{8}$/.test(s.replace(/[\s.-]/g, ''))
}

export async function getSettings(db: Db): Promise<SettingsInput> {
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1))
  if (!row) return { shopName: '', phone: '', zalo: '', hours: '', deliveryArea: '', address: '' }
  return { shopName: row.shopName, phone: row.phone, zalo: row.zalo, hours: row.hours, deliveryArea: row.deliveryArea, address: row.address }
}

export async function saveSettings(db: Db, input: SettingsInput): Promise<Result<null>> {
  const v = Object.fromEntries(Object.entries(input).map(([k, s]) => [k, String(s ?? '').trim()])) as SettingsInput
  const errors: FieldErrors = {}
  if (!v.shopName) errors.shopName = 'Cần nhập tên vườn'
  if (!isVietnamPhone(v.phone)) errors.phone = 'Số điện thoại không hợp lệ'
  if (v.zalo && !isVietnamPhone(v.zalo)) errors.zalo = 'Số điện thoại không hợp lệ'
  if (Object.keys(errors).length) return fail(errors)
  await db
    .insert(siteSettings)
    .values({ id: 1, ...v })
    .onConflictDoUpdate({ target: siteSettings.id, set: v })
  return ok(null)
}
