import { expect, test, type Page } from '@playwright/test'
import { E2E_ADMIN, PHOTO } from './global-setup'

async function signIn(page: Page) {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(E2E_ADMIN.email)
  await page.getByLabel('Mật khẩu').fill(E2E_ADMIN.password)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL('/admin')
}

test('redirects to login without a session, and with a forged one', async ({ page, context }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL('/admin/login')
  await context.addCookies([{ name: 'vh_session', value: 'forged', url: 'http://localhost:3100' }])
  await page.goto('/admin/don-hang')
  await expect(page).toHaveURL('/admin/login')
})

test('logs in, changes a price, sees it saved', async ({ page }) => {
  await signIn(page)
  await page.getByRole('button', { name: 'Sửa Đỏ nhung' }).click()
  const price = page.getByLabel('Giá kiểu 1')
  await price.fill('abc')
  await page.getByRole('button', { name: 'Lưu' }).click()
  await expect(page.getByText('Giá không hợp lệ')).toBeVisible()
  await price.fill('150.000')
  await page.locator('button.save').click()
  await expect(page.locator('button.save')).toHaveText(/Đã lưu/)
  await page.goto('/admin')
  await expect(page.getByRole('button', { name: 'Sửa Đỏ nhung' })).toContainText('150.000đ')
})

test('uploads a photo; the product then has a primary photo', async ({ page }) => {
  await signIn(page)
  await page.getByRole('button', { name: 'Sửa Mười giờ Mỹ' }).click()
  const tiles = page.locator('.photo-list .photo')
  const before = await tiles.count()
  await page.locator('.photos input[type=file]').setInputFiles(PHOTO)
  await expect(tiles).toHaveCount(before + 1, { timeout: 20_000 })
  await expect(page.locator('.photo-list .photo-badge')).toHaveText('Ảnh chính')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Sửa Mười giờ Mỹ' }).locator('.thumb img')).toBeVisible()
})

test('changes an order status', async ({ page }) => {
  await signIn(page)
  await page.goto('/admin/don-hang')
  const order = page.locator('.order', { hasText: 'VH-0001' })
  await order.locator('.order-side .status').click()
  await order.locator('.status-pick').getByRole('button', { name: 'Đã giao' }).click()
  await expect(order.locator('.order-side .status')).toHaveText('Đã giao')
  await page.reload()
  await expect(page.locator('.order', { hasText: 'VH-0001' }).locator('.order-side .status')).toHaveText('Đã giao')
})

test('upload route refuses a cross-site POST', async ({ request }) => {
  const res = await request.post('/api/admin/images', {
    headers: { origin: 'https://evil.example' },
    multipart: { productId: '00000000-0000-0000-0000-000000000000', file: { name: 'a.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('x') } },
  })
  expect(res.status()).toBe(403)
})
