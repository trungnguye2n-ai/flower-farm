import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { createDb } from './client'

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url))

/** Apply every pending migration in drizzle/. Safe to run repeatedly. */
export async function runMigrations(url: string): Promise<void> {
  const { db, sql } = createDb(url, { max: 1 })
  try {
    await migrate(db, { migrationsFolder })
  } finally {
    await sql.end()
  }
}

// Run as a script: `npm run db:migrate` (also the `migrate` container's command)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('Thiếu DATABASE_URL')
    process.exit(1)
  }
  runMigrations(url)
    .then(() => console.log('Đã áp dụng migration'))
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
