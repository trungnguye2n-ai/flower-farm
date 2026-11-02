/** Test helpers drop the whole schema: only ever let them near a *_test database. */
export function assertTestDatabase(url: string): void {
  const name = new URL(url).pathname.replace(/^\//, '')
  if (!name.endsWith('_test')) {
    throw new Error(`DATABASE_URL_TEST trỏ vào "${name}": test chỉ chạy trên database có tên kết thúc bằng _test`)
  }
}
