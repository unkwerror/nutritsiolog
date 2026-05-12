import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate }  from 'drizzle-orm/postgres-js/migrator'
import postgres      from 'postgres'
import { config }   from '../core/config.js'

const sql = postgres(config.DATABASE_URL, { max: 1 })
const db  = drizzle(sql)

try {
    await migrate(db, { migrationsFolder: 'src/db/migrations' })
    console.log('Migrations applied successfully')
} finally {
    await sql.end()
}
