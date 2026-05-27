-- Drop unique constraint on (analysis_id, name) to allow duplicate marker names from OCR
DROP INDEX IF EXISTS "markers_analysis_id_name_unique";

-- Add analysis_types column to store auto-detected analysis categories (comma-separated)
ALTER TABLE "analyses" ADD COLUMN "analysis_types" text;