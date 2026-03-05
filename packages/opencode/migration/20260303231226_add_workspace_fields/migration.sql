ALTER TABLE "workspace" ADD COLUMN "type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "directory" text;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "extra" text;--> statement-breakpoint
ALTER TABLE "workspace" DROP COLUMN "config";