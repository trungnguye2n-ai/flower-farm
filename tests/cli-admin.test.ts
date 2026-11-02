import { beforeEach, describe, expect, test } from 'vitest'
import type { Db } from '@/db/client'
import { verifyPassword } from '@/auth/password'
import { createSession, getSession } from '@/auth/session'
import { createAdmin, listAdmins, removeAdmin, resetPassword } from '@/cli/admin'
import { freshTestDb } from './helpers/db'

let db: Db
beforeEach(async () => {
  db = await freshTestDb()
})

describe('admin cli', () => {
  test('create then list shows the account', async () => {
    await createAdmin(db, { email: 'An@Vuon.vn', name: 'An', password: 'mat-khau-dai-123' })
    const list = await listAdmins(db)
    expect(list.map((a) => a.email)).toEqual(['an@vuon.vn'])
  })

  test('duplicate email in another case is refused', async () => {
    await createAdmin(db, { email: 'an@vuon.vn', name: 'An', password: 'mat-khau-dai-123' })
    await expect(createAdmin(db, { email: 'AN@vuon.vn', name: 'An 2', password: 'mat-khau-dai-456' })).rejects.toThrow('Email đã tồn tại')
  })

  test('short password is refused', async () => {
    await expect(createAdmin(db, { email: 'an@vuon.vn', name: 'An', password: 'ngan' })).rejects.toThrow('Mật khẩu cần ít nhất 10 ký tự')
  })

  test('malformed email is refused', async () => {
    await expect(createAdmin(db, { email: 'khong-phai-email', name: 'An', password: 'mat-khau-dai-123' })).rejects.toThrow('Email không hợp lệ')
  })

  test('resetPassword changes the password and signs every session out', async () => {
    const user = await createAdmin(db, { email: 'an@vuon.vn', name: 'An', password: 'mat-khau-cu-1234' })
    const { token } = await createSession(db, user.id)
    await resetPassword(db, { email: 'AN@vuon.vn', password: 'mat-khau-moi-5678' })
    const [row] = await listAdmins(db, { withHash: true })
    expect(await verifyPassword(row.passwordHash!, 'mat-khau-moi-5678')).toBe(true)
    expect(await getSession(db, token)).toBeNull()
  })

  test('resetPassword for an unknown email is refused', async () => {
    await expect(resetPassword(db, { email: 'ai@vuon.vn', password: 'mat-khau-moi-5678' })).rejects.toThrow('Không tìm thấy tài khoản')
  })

  test('removeAdmin deletes the account', async () => {
    await createAdmin(db, { email: 'an@vuon.vn', name: 'An', password: 'mat-khau-dai-123' })
    await removeAdmin(db, 'an@vuon.vn')
    expect(await listAdmins(db)).toEqual([])
    await expect(removeAdmin(db, 'an@vuon.vn')).rejects.toThrow('Không tìm thấy tài khoản')
  })
})
