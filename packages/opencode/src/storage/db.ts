import postgres from "postgres"
import { drizzle, type PostgresJsDatabase, type PostgresJsTransaction } from "drizzle-orm/postgres-js"
import { migrate as pgMigrate } from "drizzle-orm/postgres-js/migrator"
export * from "drizzle-orm"
import { Context } from "../util/context"
import { lazy } from "../util/lazy"
import { Log } from "../util/log"
import { NamedError } from "@opencode-ai/util/error"
import z from "zod"
import path from "path"
import * as schema from "./schema"

declare const OPENCODE_MIGRATIONS: { sql: string; timestamp: number }[] | undefined

export const NotFoundError = NamedError.create(
  "NotFoundError",
  z.object({
    message: z.string(),
  }),
)

const log = Log.create({ service: "db" })

export namespace Database {
  type Schema = typeof schema
  export type Transaction = PostgresJsTransaction<Schema, any, any>

  type Client = PostgresJsDatabase<Schema>

  type Journal = { sql: string; timestamp: number }[]

  const state = {
    sql: undefined as ReturnType<typeof postgres> | undefined,
  }

  export const Client = lazy(() => {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL environment variable is required. " +
          "Set it to a PostgreSQL connection string, e.g. postgres://user:pass@host:5432/dbname",
      )
    }

    log.info("opening database", { url: databaseUrl.replace(/\/\/.*@/, "//***@") })

    const sql = postgres(databaseUrl, {
      max: 20,
      idle_timeout: 20,
      connect_timeout: 10,
    })
    state.sql = sql

    const db = drizzle({ client: sql, schema })

    return db
  })

  export async function applyMigrations() {
    const db = Client()

    // When running from a compiled binary, OPENCODE_MIGRATIONS is inlined at
    // build time (see script/build.ts).  The migration *folder* does not exist
    // on disk in that case, so we run the bundled SQL statements directly
    // inside a migration-tracking table that mirrors what drizzle-kit creates.
    if (typeof OPENCODE_MIGRATIONS !== "undefined" && OPENCODE_MIGRATIONS && OPENCODE_MIGRATIONS.length > 0) {
      log.info("applying bundled migrations", { count: OPENCODE_MIGRATIONS.length })
      const raw = (db as any)._.session?.client
      if (!raw) throw new Error("cannot obtain raw postgres client from drizzle instance")

      // Ensure the drizzle migrations journal table exists
      await raw`
        CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
          id SERIAL PRIMARY KEY,
          hash TEXT NOT NULL,
          created_at BIGINT
        )
      `

      // Fetch already-applied hashes so we skip them
      const applied = new Set(
        (await raw`SELECT hash FROM "__drizzle_migrations"`).map((r: any) => r.hash),
      )

      for (const m of OPENCODE_MIGRATIONS) {
        // drizzle-kit uses a simple hash of the SQL content
        const hash = simpleHash(m.sql)
        if (applied.has(hash)) continue
        await raw.unsafe(m.sql)
        await raw`INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (${hash}, ${m.timestamp})`
        log.info("applied migration", { hash, timestamp: m.timestamp })
      }
      log.info("bundled migrations applied")
    } else {
      // Running from source — use the on-disk migration folder
      await pgMigrate(db, { migrationsFolder: path.join(import.meta.dirname, "../../migration") })
      log.info("migrations applied")
    }
  }

  /** Simple string hash matching drizzle-kit's approach. */
  function simpleHash(s: string): string {
    let hash = 5381
    let i = s.length
    while (i) hash = (hash * 33) ^ s.charCodeAt(--i)
    return (hash >>> 0).toString(16)
  }

  export async function close() {
    const sql = state.sql
    if (!sql) return
    await sql.end()
    state.sql = undefined
    Client.reset()
  }

  export type TxOrDb = Transaction | Client

  const ctx = Context.create<{
    tx: TxOrDb
    effects: (() => void | Promise<void>)[]
  }>("database")

  export async function use<T>(callback: (trx: TxOrDb) => T | Promise<T>): Promise<T> {
    try {
      return await callback(ctx.use().tx)
    } catch (err) {
      if (err instanceof Context.NotFound) {
        const effects: (() => void | Promise<void>)[] = []
        const result = await ctx.provide({ effects, tx: Client() }, () => callback(Client()))
        for (const effect of effects) effect()
        return result
      }
      throw err
    }
  }

  export function effect(fn: () => any | Promise<any>) {
    try {
      ctx.use().effects.push(fn)
    } catch {
      fn()
    }
  }

  export async function transaction<T>(callback: (tx: TxOrDb) => T | Promise<T>): Promise<T> {
    try {
      return await callback(ctx.use().tx)
    } catch (err) {
      if (err instanceof Context.NotFound) {
        const effects: (() => void | Promise<void>)[] = []
        const result = await Client().transaction(async (tx) => {
          return await ctx.provide({ tx, effects }, () => callback(tx))
        })
        for (const effect of effects) effect()
        return result
      }
      throw err
    }
  }
}
