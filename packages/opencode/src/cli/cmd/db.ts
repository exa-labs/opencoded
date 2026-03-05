import type { Argv } from "yargs"
import { Database } from "../../storage/db"
import { UI } from "../ui"
import { cmd } from "./cmd"

const QueryCommand = cmd({
  command: "$0 [query]",
  describe: "run a SQL query against the database",
  builder: (yargs: Argv) => {
    return yargs
      .positional("query", {
        type: "string",
        describe: "SQL query to execute",
      })
      .option("format", {
        type: "string",
        choices: ["json", "tsv"],
        default: "tsv",
        describe: "Output format",
      })
  },
  handler: async (args: { query?: string; format: string }) => {
    const query = args.query as string | undefined
    if (!query) {
      UI.error("Please provide a SQL query to execute")
      process.exit(1)
      return
    }
    try {
      const result = await Database.use(async (db) => {
        return db.execute(query) as unknown as Record<string, unknown>[]
      })
      const rows = Array.isArray(result) ? result : []
      if (args.format === "json") {
        console.log(JSON.stringify(rows, null, 2))
      } else if (rows.length > 0) {
        const keys = Object.keys(rows[0])
        console.log(keys.join("\t"))
        for (const row of rows) {
          console.log(keys.map((k) => row[k]).join("\t"))
        }
      }
    } catch (err) {
      UI.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  },
})

const InfoCommand = cmd({
  command: "info",
  describe: "print database connection info",
  handler: () => {
    const url = process.env.DATABASE_URL
    if (url) {
      // Mask credentials in URL
      console.log(url.replace(/\/\/.*@/, "//***@"))
    } else {
      console.log("DATABASE_URL not set")
    }
  },
})

const MigrateCommand = cmd({
  command: "migrate",
  describe: "apply pending database migrations",
  handler: async () => {
    try {
      await Database.applyMigrations()
      UI.println("Migrations applied successfully")
    } catch (err) {
      UI.error(`Migration failed: ${err instanceof Error ? err.message : String(err)}`)
      process.exit(1)
    }
  },
})

export const DbCommand = cmd({
  command: "db",
  describe: "database tools",
  builder: (yargs: Argv) => {
    return yargs.command(QueryCommand).command(InfoCommand).command(MigrateCommand).demandCommand()
  },
  handler: () => {},
})
