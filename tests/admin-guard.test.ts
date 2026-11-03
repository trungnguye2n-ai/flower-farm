// Every admin page, layout and Server Action must check the session on the
// server, and every admin API route must too. The proxy's cookie check is only
// a convenience redirect; this test keeps a new file from forgetting the real one.
import { globSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const files = (pattern: string) => globSync(pattern).filter((f) => !f.includes('/admin/login/'))

describe('admin guard', () => {
  const pages = files('src/app/admin/**/{page,layout}.tsx')
  const actions = files('src/app/admin/**/actions.ts')
  const routes = files('src/app/api/admin/**/route.ts')

  test('the globs find the admin files', () => {
    expect(pages.length).toBeGreaterThan(0)
    expect(actions.length).toBeGreaterThan(0)
    expect(routes.length).toBeGreaterThan(0)
  })

  test('every page and layout calls requireAdmin()', () => {
    const missing = pages.filter((f) => !readFileSync(f, 'utf8').includes('requireAdmin('))
    expect(missing).toEqual([])
  })

  test('every exported action calls requireAdmin() itself', () => {
    const missing: string[] = []
    for (const f of actions) {
      const src = readFileSync(f, 'utf8')
      const bodies = src.split(/export async function /).slice(1)
      expect(bodies.length, `${f} exports no async functions`).toBeGreaterThan(0)
      for (const body of bodies) {
        const name = body.slice(0, body.indexOf('('))
        if (!body.includes('requireAdmin(')) missing.push(`${f}: ${name}`)
      }
      // Arrow-function exports would dodge the check above
      expect(src, `${f} exports a non-function action`).not.toMatch(/export const \w+ = async/)
    }
    expect(missing).toEqual([])
  })

  test('every admin API route checks the session and the origin', () => {
    const missing = routes.filter((f) => {
      const src = readFileSync(f, 'utf8')
      return !src.includes('currentAdmin(') || !src.includes('checkOrigin(')
    })
    expect(missing).toEqual([])
  })
})
