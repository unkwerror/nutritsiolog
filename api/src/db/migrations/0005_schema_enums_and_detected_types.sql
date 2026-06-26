-- 1. analysis_status enum → replaces varchar status in analyses
CREATE TYPE "public"."analysis_status" AS ENUM('pending', 'processing', 'done', 'failed');
ALTER TABLE "analyses"
    ALTER COLUMN "status" TYPE "public"."analysis_status"
    USING "status"::"public"."analysis_status";
ALTER TABLE "analyses"
    ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."analysis_status";

-- 2. out_of_range_direction enum → replaces varchar in markers
CREATE TYPE "public"."out_of_range_direction" AS ENUM('low', 'high');
ALTER TABLE "markers"
    ALTER COLUMN "out_of_range_direction" TYPE "public"."out_of_range_direction"
    USING CASE
        WHEN "out_of_range_direction" IN ('low', 'high')
        THEN "out_of_range_direction"::"public"."out_of_range_direction"
        ELSE NULL
    END;

-- 3. patient_gender → use existing gender enum
ALTER TABLE "analyses"
    ALTER COLUMN "patient_gender" TYPE "public"."gender"
    USING CASE
        WHEN "patient_gender" IN ('male', 'female')
        THEN "patient_gender"::"public"."gender"
        ELSE NULL
    END;

-- 4. Replace old analysis_type enum (unused in any column) with OCR-section-based values
DROP TYPE IF EXISTS "public"."analysis_type";
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

-- 5. Add detected_types column (replaces analysis_types text CSV)
ALTER TABLE "analyses" ADD COLUMN "detected_types" "public"."analysis_type"[];

-- 6. Drop old analysis_types text CSV column
ALTER TABLE "analyses" DROP COLUMN IF EXISTS "analysis_types";

-- 7. Unique index on markers(analysis_id, name, method) — NULLS NOT DISTINCT treats two NULLs as equal
CREATE UNIQUE INDEX "markers_analysis_id_name_method_unique"
    ON "markers" ("analysis_id", "name", "method") NULLS NOT DISTINCT;
