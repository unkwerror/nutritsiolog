--> statement-breakpoint
CREATE TYPE "public"."analysis_status" AS ENUM('pending', 'processing', 'done', 'failed');
--> statement-breakpoint
ALTER TABLE "analyses" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "analyses"
    ALTER COLUMN "status" TYPE "public"."analysis_status"
    USING "status"::"public"."analysis_status";
--> statement-breakpoint
ALTER TABLE "analyses"
    ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."analysis_status";
--> statement-breakpoint
CREATE TYPE "public"."out_of_range_direction" AS ENUM('low', 'high');
--> statement-breakpoint
ALTER TABLE "markers"
    ALTER COLUMN "out_of_range_direction" TYPE "public"."out_of_range_direction"
    USING CASE
        WHEN "out_of_range_direction" IN ('low', 'high')
        THEN "out_of_range_direction"::"public"."out_of_range_direction"
        ELSE NULL
    END;
--> statement-breakpoint
ALTER TABLE "analyses"
    ALTER COLUMN "patient_gender" TYPE "public"."gender"
    USING CASE
        WHEN "patient_gender" IN ('male', 'female')
        THEN "patient_gender"::"public"."gender"
        ELSE NULL
    END;
--> statement-breakpoint
DROP TYPE IF EXISTS "public"."analysis_type";
--> statement-breakpoint
CREATE TYPE "public"."analysis_type" AS ENUM(
    'cbc',
    'biochemistry',
    'thyroid',
    'hormones',
    'vitamins',
    'coagulation',
    'urinalysis',
    'lipid',
    'immunology',
    'other'
);
--> statement-breakpoint
ALTER TABLE "analyses" ADD COLUMN "detected_types" "public"."analysis_type"[];
--> statement-breakpoint
ALTER TABLE "analyses" DROP COLUMN IF EXISTS "analysis_types";
--> statement-breakpoint
DELETE FROM "markers"
WHERE id NOT IN (
    SELECT MAX(id)
    FROM "markers"
    GROUP BY analysis_id, name, method
);
--> statement-breakpoint
CREATE UNIQUE INDEX "markers_analysis_id_name_method_unique"
    ON "markers" ("analysis_id", "name", "method") NULLS NOT DISTINCT;
