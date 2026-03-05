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
    await pgMigrate(db, { migrationsFolder: path.join(import.meta.dirname, "../../migration") })
    log.info("migrations applied")
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
