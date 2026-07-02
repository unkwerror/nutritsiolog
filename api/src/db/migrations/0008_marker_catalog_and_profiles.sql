CREATE TYPE "public"."optimum_gender" AS ENUM('all', 'male', 'female');
--> statement-breakpoint
CREATE TABLE "marker_sections" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"code" varchar(30) NOT NULL,
	"title" varchar(120) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "marker_sections_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "marker_catalog" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"key" varchar(40) NOT NULL,
	"section_code" varchar(30) NOT NULL,
	"display" varchar(200) NOT NULL,
	"unit" varchar(50),
	"aliases" jsonb NOT NULL,
	CONSTRAINT "marker_catalog_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "marker_optimums" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"catalog_id" integer NOT NULL,
	"gender" "optimum_gender" DEFAULT 'all' NOT NULL,
	"optimum_min" numeric(12, 4),
	"optimum_max" numeric(12, 4),
	"unit" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "profile_calculations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"user_id" uuid NOT NULL,
	"profile_type" varchar(30) NOT NULL,
	"health_score" integer,
	"section_scores" jsonb NOT NULL,
	"signals" jsonb NOT NULL,
	"findings" jsonb NOT NULL,
	"tags" jsonb NOT NULL,
	"trigger_source" varchar(30) NOT NULL,
	"calculated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation_content" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"kind" varchar(20) NOT NULL,
	"key" varchar(60) NOT NULL,
	"title" varchar(200),
	"body" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "recommendation_content_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "markers" ADD COLUMN "catalog_id" integer;
--> statement-breakpoint
ALTER TABLE "markers" ADD CONSTRAINT "markers_catalog_id_marker_catalog_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."marker_catalog"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "marker_optimums" ADD CONSTRAINT "marker_optimums_catalog_id_marker_catalog_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."marker_catalog"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "profile_calculations" ADD CONSTRAINT "profile_calculations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "marker_catalog_section_idx" ON "marker_catalog" ("section_code");
--> statement-breakpoint
CREATE UNIQUE INDEX "marker_optimums_catalog_gender_unique" ON "marker_optimums" ("catalog_id","gender");
--> statement-breakpoint
CREATE INDEX "profile_calc_user_idx" ON "profile_calculations" ("user_id","calculated_at");
--> statement-breakpoint
CREATE INDEX "rec_content_kind_idx" ON "recommendation_content" ("kind");
