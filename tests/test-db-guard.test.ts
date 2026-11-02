import { describe, expect, test } from 'vitest'
import { assertTestDatabase } from './helpers/guard'

describe('test database guard', () => {
  test('accepts a database whose name ends in _test', () => {
    expect(() => assertTestDatabase('postgres://u:p@127.0.0.1:55432/vuonhoa_test')).not.toThrow()
  })

  test('refuses the real database so npm test can never wipe the shop', () => {
    expect(() => assertTestDatabase('postgres://u:p@db:5432/vuonhoa')).toThrow(/_test/)
  })
})
