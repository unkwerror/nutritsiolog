CREATE TYPE "public"."gender" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TABLE "analyses" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "analyses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"lab_name" varchar(255),
	"lab_address" text,
	"lab_phone" varchar(25),
	"patient_full_name" varchar(255),
	"patient_gender" varchar(10),
	"patient_birth_date" varchar(20),
	"patient_age" integer,
	"order_id" varchar(100),
	"sample_taken_at" varchar(50),
	"report_date" varchar(50),
	"file_key" varchar(500) NOT NULL,
	"file_original_name" varchar(255),
	"file_mime_type" varchar(100),
	"file_size" integer,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "markers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "markers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"analysis_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(50),
	"section" varchar(100),
	"value" numeric(12, 4),
	"unit" varchar(50),
	"reference_min" numeric(12, 4),
	"reference_max" numeric(12, 4),
	"reference_raw" varchar(255),
	"is_out_of_range" boolean DEFAULT false NOT NULL,
	"out_of_range_direction" varchar(10),
	"comment" text,
	"method" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"middle_name" varchar(100),
	"gender" "gender",
	"date_of_birth" date,
	"timezone" varchar(50) DEFAULT 'Europe/Moscow' NOT NULL,
	"phone" varchar(25),
	"email" varchar(255),
	"email_verified_at" timestamp,
	"phone_verified_at" timestamp,
	"password" varchar(255) NOT NULL,
	"consent_pd" boolean DEFAULT false NOT NULL,
	"consent_medical_data" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "markers" ADD CONSTRAINT "markers_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analyses_user_id_is_archived_idx" ON "analyses" USING btree ("user_id","is_archived");--> statement-breakpoint
CREATE INDEX "markers_analysis_id_idx" ON "markers" USING btree ("analysis_id");--> statement-breakpoint
CREATE UNIQUE INDEX "markers_analysis_id_name_unique" ON "markers" USING btree ("analysis_id","name");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_phone_idx" ON "users" USING btree ("phone");