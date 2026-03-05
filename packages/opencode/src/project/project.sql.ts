import { pgTable, text, bigint, jsonb } from "drizzle-orm/pg-core"
import { Timestamps } from "@/storage/schema.sql"

export const ProjectTable = pgTable("project", {
  id: text().primaryKey(),
  worktree: text().notNull(),
  vcs: text(),
  name: text(),
  icon_url: text(),
  icon_color: text(),
  ...Timestamps,
  time_initialized: bigint({ mode: "number" }),
  sandboxes: jsonb().notNull().$type<string[]>(),
  commands: jsonb().$type<{ start?: string }>(),
})
