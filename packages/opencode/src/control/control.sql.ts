import { pgTable, text, bigint, boolean, primaryKey, uniqueIndex } from "drizzle-orm/pg-core"
import { eq } from "drizzle-orm"
import { Timestamps } from "@/storage/schema.sql"

export const ControlAccountTable = pgTable(
  "control_account",
  {
    email: text().notNull(),
    url: text().notNull(),
    access_token: text().notNull(),
    refresh_token: text().notNull(),
    token_expiry: bigint({ mode: "number" }),
    active: boolean()
      .notNull()
      .$default(() => false),
    ...Timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.email, table.url] }),
    // uniqueIndex("control_account_active_idx").on(table.email).where(eq(table.active, true)),
  ],
)
