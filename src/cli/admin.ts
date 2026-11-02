// Admin accounts, managed from the server's command line (no in-app signup or
// password reset, by design). Usage:
//   npm run admin -- create --email a@vuon.vn --name "An"
//   npm run admin -- reset-password --email a@vuon.vn
//   npm run admin -- list
//   npm run admin -- remove --email a@vuon.vn
// The password is typed twice without echo, or piped on stdin.
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { asc, eq, sql } from 'drizzle-orm'
import { hashPassword } from '@/auth/password'
import { revokeAllSessions } from '@/auth/session'
import { createDb, type Db } from '@/db/client'
import { adminUsers } from '@/db/schema'

const MIN_PASSWORD = 10
const normalize = (email: string) => email.trim().toLowerCase()

function checkPassword(password: string) {
  if (password.length < MIN_PASSWORD) throw new Error(`Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự`)
}

async function findByEmail(db: Db, email: string) {
  const [row] = await db.select().from(adminUsers).where(eq(sql`lower(${adminUsers.email})`, normalize(email)))
  return row
}

export async function createAdmin(db: Db, input: { email: string; name: string; password: string }) {
  const email = normalize(input.email)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email không hợp lệ')
  checkPassword(input.password)
  if (await findByEmail(db, email)) throw new Error('Email đã tồn tại')
  const [row] = await db
    .insert(adminUsers)
    .values({ email, name: input.name.trim(), passwordHash: await hashPassword(input.password) })
    .returning({ id: adminUsers.id, email: adminUsers.email })
  return row
}

export async function resetPassword(db: Db, input: { email: string; password: string }) {
  checkPassword(input.password)
  const user = await findByEmail(db, input.email)
  if (!user) throw new Error('Không tìm thấy tài khoản')
  await db.update(adminUsers).set({ passwordHash: await hashPassword(input.password) }).where(eq(adminUsers.id, user.id))
  await revokeAllSessions(db, user.id)
}

export async function listAdmins(db: Db, opts: { withHash?: boolean } = {}) {
  const rows = await db.select().from(adminUsers).orderBy(asc(adminUsers.createdAt))
  return rows.map((r) => ({
    email: r.email,
    name: r.name,
    lastLoginAt: r.lastLoginAt,
    ...(opts.withHash ? { passwordHash: r.passwordHash } : {}),
  }))
}

export async function removeAdmin(db: Db, email: string) {
  const user = await findByEmail(db, email)
  if (!user) throw new Error('Không tìm thấy tài khoản')
  await db.delete(adminUsers).where(eq(adminUsers.id, user.id))
}

/* ---------- command line ---------- */

function ask(question: string, hidden: boolean): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    if (hidden) {
      // Write the prompt, then swallow the echo of every key typed after it
      const out = rl as unknown as { _writeToOutput: (s: string) => void }
      out._writeToOutput = (s: string) => {
        if (s.includes(question)) process.stdout.write(s)
      }
    }
    rl.question(question, (answer) => {
      rl.close()
      if (hidden) process.stdout.write('\n')
      resolve(answer)
    })
  })
}

async function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin })
    for await (const line of rl) return line
    throw new Error('Không đọc được mật khẩu từ stdin')
  }
  const first = await ask('Mật khẩu: ', true)
  const second = await ask('Nhập lại mật khẩu: ', true)
  if (first !== second) throw new Error('Hai lần nhập mật khẩu không khớp')
  return first
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { email: { type: 'string' }, name: { type: 'string' } },
  })
  const [command] = positionals
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('Thiếu DATABASE_URL')
  const { db, sql: conn } = createDb(url, { max: 1 })
  const need = (v: string | undefined, flag: string) => {
    if (!v) throw new Error(`Thiếu --${flag}`)
    return v
  }
  try {
    switch (command) {
      case 'create': {
        const email = need(values.email, 'email')
        const name = need(values.name, 'name')
        await createAdmin(db, { email, name, password: await readPassword() })
        console.log(`Đã tạo tài khoản ${normalize(email)}`)
        break
      }
      case 'reset-password': {
        const email = need(values.email, 'email')
        await resetPassword(db, { email, password: await readPassword() })
        console.log(`Đã đặt lại mật khẩu cho ${normalize(email)} và đăng xuất mọi phiên`)
        break
      }
      case 'list': {
        const rows = await listAdmins(db)
        if (!rows.length) console.log('Chưa có tài khoản nào')
        for (const r of rows) console.log(`${r.email}\t${r.name}\t${r.lastLoginAt?.toISOString() ?? 'chưa đăng nhập'}`)
        break
      }
      case 'remove': {
        const email = need(values.email, 'email')
        await removeAdmin(db, email)
        console.log(`Đã xoá tài khoản ${normalize(email)}`)
        break
      }
      default:
        console.log('Lệnh: create --email --name | reset-password --email | list | remove --email')
        process.exitCode = 1
    }
  } finally {
    await conn.end()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e: Error) => {
    console.error(e.message)
    process.exit(1)
  })
}
