import { pgTable, text, integer, bigint, index, primaryKey, jsonb } from "drizzle-orm/pg-core"
import { ProjectTable } from "../project/project.sql"
import type { MessageV2 } from "./message-v2"
import type { Snapshot } from "@/snapshot"
import type { PermissionNext } from "@/permission/next"
import { Timestamps } from "@/storage/schema.sql"

type PartData = Omit<MessageV2.Part, "id" | "sessionID" | "messageID">
type InfoData = Omit<MessageV2.Info, "id" | "sessionID">

export const SessionTable = pgTable(
  "session",
  {
    id: text().primaryKey(),
    project_id: text()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    workspace_id: text(),
    parent_id: text(),
    slug: text().notNull(),
    directory: text().notNull(),
    title: text().notNull(),
    version: text().notNull(),
    share_url: text(),
    summary_additions: integer(),
    summary_deletions: integer(),
    summary_files: integer(),
    summary_diffs: jsonb().$type<Snapshot.FileDiff[]>(),
    revert: jsonb().$type<{ messageID: string; partID?: string; snapshot?: string; diff?: string }>(),
    permission: jsonb().$type<PermissionNext.Ruleset>(),
    ...Timestamps,
    time_compacting: bigint({ mode: "number" }),
    time_archived: bigint({ mode: "number" }),
  },
  (table) => [
    index("session_project_idx").on(table.project_id),
    index("session_workspace_idx").on(table.workspace_id),
    index("session_parent_idx").on(table.parent_id),
  ],
)

export const MessageTable = pgTable(
  "message",
  {
    id: text().primaryKey(),
    session_id: text()
      .notNull()
      .references(() => SessionTable.id, { onDelete: "cascade" }),
    ...Timestamps,
    data: jsonb().notNull().$type<InfoData>(),
  },
  (table) => [index("message_session_idx").on(table.session_id)],
)

export const PartTable = pgTable(
  "part",
  {
    id: text().primaryKey(),
    message_id: text()
      .notNull()
      .references(() => MessageTable.id, { onDelete: "cascade" }),
    session_id: text().notNull(),
    ...Timestamps,
    data: jsonb().notNull().$type<PartData>(),
  },
  (table) => [index("part_message_idx").on(table.message_id), index("part_session_idx").on(table.session_id)],
)

export const TodoTable = pgTable(
  "todo",
  {
    session_id: text()
      .notNull()
      .references(() => SessionTable.id, { onDelete: "cascade" }),
    content: text().notNull(),
    status: text().notNull(),
    priority: text().notNull(),
    position: integer().notNull(),
    ...Timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.session_id, table.position] }),
    index("todo_session_idx").on(table.session_id),
  ],
)

export const PermissionTable = pgTable("permission", {
  project_id: text()
    .primaryKey()
    .references(() => ProjectTable.id, { onDelete: "cascade" }),
  ...Timestamps,
  data: jsonb().notNull().$type<PermissionNext.Ruleset>(),
})
