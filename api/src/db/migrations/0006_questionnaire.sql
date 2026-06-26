CREATE TABLE IF NOT EXISTS "questionnaire_responses" (
    "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    "user_id" uuid NOT NULL REFERENCES "users"("id"),
    "answers" jsonb NOT NULL,
    "tags" jsonb NOT NULL DEFAULT '[]',
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "questionnaire_user_id_idx" ON "questionnaire_responses" ("user_id");
