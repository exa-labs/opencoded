import { pgTable, text, jsonb } from "drizzle-orm/pg-core"
import { ProjectTable } from "@/project/project.sql"

export const WorkspaceTable = pgTable("workspace", {
  id: text().primaryKey(),
  type: text().notNull(),
  branch: text(),
  name: text(),
  directory: text(),
  extra: jsonb(),
  project_id: text()
    .notNull()
    .references(() => ProjectTable.id, { onDelete: "cascade" }),
})
