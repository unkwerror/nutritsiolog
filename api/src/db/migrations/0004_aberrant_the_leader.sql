CREATE TYPE "public"."analysis_type" AS ENUM('cbc', 'protein', 'carb', 'liver', 'lipid', 'thyroid', 'electrolytes', 'iron', 'inflammation');--> statement-breakpoint
ALTER TABLE "analyses" ADD COLUMN "analysis_type" varchar(20);--> statement-breakpoint
ALTER TABLE "analyses" ADD COLUMN "type_source" varchar(10) DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "analyses" ADD COLUMN "ocr_provider" varchar(20);--> statement-breakpoint
ALTER TABLE "analyses" ADD COLUMN "ocr_raw_text" text;--> statement-breakpoint
ALTER TABLE "markers" ADD COLUMN "is_edited" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "markers" ADD COLUMN "original_value" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "markers" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;