import { drizzle } from 'drizzle-orm/postgres-js'
import postgres     from 'postgres'
import { config }   from '../core/config.js'

export const sql = postgres(config.DATABASE_URL)
export const db  = drizzle(sql)
