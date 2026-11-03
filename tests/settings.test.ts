import { beforeEach, describe, expect, test } from 'vitest'
import type { Db } from '@/db/client'
import { seed } from '@/db/seed'
import { getSettings, isVietnamPhone, saveSettings, type SettingsInput } from '@/admin/settings'
import { freshTestDb } from './helpers/db'

let db: Db
beforeEach(async () => {
  db = await freshTestDb()
  await seed(db)
})

const input = (over: Partial<SettingsInput> = {}): SettingsInput => ({
  shopName: 'Vườn hoa Đà Lạt',
  phone: '0901 234 567',
  zalo: '+84901234567',
  hours: '7:00 đến 18:00',
  deliveryArea: 'Nội thành',
  address: 'Đà Lạt',
  ...over,
})

test('getSettings returns the seeded row', async () => {
  expect(await getSettings(db)).toMatchObject({ shopName: 'Vườn hoa', address: 'Đà Lạt' })
})

test('saveSettings stores trimmed values', async () => {
  expect(await saveSettings(db, input({ shopName: '  Vườn hoa Đà Lạt ' }))).toEqual({ ok: true, data: null })
  expect(await getSettings(db)).toMatchObject({ shopName: 'Vườn hoa Đà Lạt', phone: '0901 234 567', zalo: '+84901234567' })
})

test('saveSettings rejects an empty name and bad phone numbers under their fields', async () => {
  expect(await saveSettings(db, input({ shopName: '', phone: '123', zalo: 'abc' }))).toEqual({
    ok: false,
    fieldErrors: { shopName: 'Cần nhập tên vườn', phone: 'Số điện thoại không hợp lệ', zalo: 'Số điện thoại không hợp lệ' },
  })
  expect((await getSettings(db)).shopName).toBe('Vườn hoa')
})

describe('isVietnamPhone', () => {
  test.each(['0901234567', '0901 234 567', '090.123.4567', '+84901234567', '+84 33-123-4567', '0812345678'])('%s ok', (s) => {
    expect(isVietnamPhone(s)).toBe(true)
  })
  test.each(['123', '0123456789', '090123456', '09012345678', '+8490123456', 'abc', '', '0601234567'])('%s rejected', (s) => {
    expect(isVietnamPhone(s)).toBe(false)
  })
})
