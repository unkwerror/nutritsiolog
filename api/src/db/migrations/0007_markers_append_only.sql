-- Append-only marker editing (decisions 034/039):
-- edits INSERT a new revision; the old row is only flipped to is_current=false.
ALTER TABLE "markers" ADD COLUMN "revision" integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE "markers" ADD COLUMN "is_current" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
DROP INDEX IF EXISTS "markers_analysis_id_name_method_unique";
--> statement-breakpoint
-- Partial unique: only ONE current revision per (analysis_id, name, method).
-- NULLS NOT DISTINCT: two markers with same (analysis_id, name, method=NULL) conflict.
CREATE UNIQUE INDEX "markers_analysis_id_name_method_current_unique"
    ON "markers" ("analysis_id", "name", "method") NULLS NOT DISTINCT
    WHERE "is_current" = true;
