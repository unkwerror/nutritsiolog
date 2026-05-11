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
	"value" real,
	"unit" varchar(50),
	"reference_min" real,
	"reference_max" real,
	"reference_raw" varchar(255),
	"is_out_of_range" boolean DEFAULT false NOT NULL,
	"out_of_range_direction" varchar(10),
	"comment" text,
	"method" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "first_name" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" varchar(25);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "consent_pd" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "markers" ADD CONSTRAINT "markers_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_phone_unique" UNIQUE("phone");