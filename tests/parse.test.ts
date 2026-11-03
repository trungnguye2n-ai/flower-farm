import { describe, expect, test } from 'vitest'
import { parsePrice, slugify } from '@/admin/parse'

describe('parsePrice', () => {
  test.each([150000, '150000', '150.000', '150,000', '150.000đ', ' 150 000 ', '150k', '150K', '150.000 đ', '150000đ'])('%s → 150000', (input) => {
    expect(parsePrice(input)).toBe(150000)
  })

  test('zero is a valid price', () => {
    expect(parsePrice('0')).toBe(0)
  })

  test.each(['', 'abc', '-5', '1.5', '1.50.000', '150kk', 'k', -1, 1.5, 2_000_000_001, '2.000.000.001'])('%s → null', (input) => {
    expect(parsePrice(input)).toBeNull()
  })
})

describe('slugify', () => {
  test('drops Vietnamese marks and đ', () => {
    expect(slugify('Bách thủy tiên Đỏ nhung')).toBe('bach-thuy-tien-do-nhung')
  })
  test('trims and collapses punctuation', () => {
    expect(slugify('  Mười giờ — Thái!! ')).toBe('muoi-gio-thai')
  })
})
