-- CreateEnum
CREATE TYPE "roadmap"."RoadmapStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "roadmap"."RoadmapPriority" AS ENUM ('PRIMARY', 'SECONDARY', 'LOW');

-- CreateTable
CREATE TABLE "roadmap"."roadmaps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "status" "roadmap"."RoadmapStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" "roadmap"."RoadmapPriority" NOT NULL DEFAULT 'PRIMARY',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "roadmaps_pkey" PRIMARY KEY ("id")
);

-- Step 1: Add nullable roadmap_id column to roadmap_snapshots
ALTER TABLE "roadmap"."roadmap_snapshots" ADD COLUMN "roadmap_id" UUID;

-- Step 2A (Case 1 & Case 2): Create parent Roadmap for distinct (user_id, normalized source_url)
INSERT INTO "roadmap"."roadmaps" ("id", "user_id", "title", "status", "priority", "created_at", "updated_at", "metadata")
SELECT
    gen_random_uuid(),
    s."user_id",
    MIN(s."source_name"),
    'ACTIVE'::"roadmap"."RoadmapStatus",
    'PRIMARY'::"roadmap"."RoadmapPriority",
    MIN(s."imported_at"),
    MAX(s."updated_at"),
    jsonb_build_object('sourceUrl', RTRIM(LOWER(TRIM(s."source_url")), '/'))
FROM "roadmap"."roadmap_snapshots" s
WHERE s."source_url" IS NOT NULL AND TRIM(s."source_url") != '' AND s."roadmap_id" IS NULL
GROUP BY s."user_id", RTRIM(LOWER(TRIM(s."source_url")), '/');

-- Link snapshots for Case 1 & 2
UPDATE "roadmap"."roadmap_snapshots" s
SET "roadmap_id" = r."id"
FROM "roadmap"."roadmaps" r
WHERE s."user_id" = r."user_id"
  AND s."source_url" IS NOT NULL
  AND TRIM(s."source_url") != ''
  AND (r."metadata"->>'sourceUrl') = RTRIM(LOWER(TRIM(s."source_url")), '/')
  AND s."roadmap_id" IS NULL;

-- Step 2B (Case 3): Create parent Roadmap for unambiguous snapshots with NULL source_url (only 1 snapshot per user/type/name)
INSERT INTO "roadmap"."roadmaps" ("id", "user_id", "title", "status", "priority", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    s."user_id",
    s."source_name",
    'ACTIVE'::"roadmap"."RoadmapStatus",
    'PRIMARY'::"roadmap"."RoadmapPriority",
    s."imported_at",
    s."updated_at"
FROM "roadmap"."roadmap_snapshots" s
WHERE (s."source_url" IS NULL OR TRIM(s."source_url") = '') AND s."roadmap_id" IS NULL
  AND (
      SELECT COUNT(*)
      FROM "roadmap"."roadmap_snapshots" s2
      WHERE s2."user_id" = s."user_id"
        AND (s2."source_url" IS NULL OR TRIM(s2."source_url") = '')
        AND s2."source_type" = s."source_type"
        AND LOWER(TRIM(s2."source_name")) = LOWER(TRIM(s."source_name"))
  ) = 1;

UPDATE "roadmap"."roadmap_snapshots" s
SET "roadmap_id" = r."id"
FROM "roadmap"."roadmaps" r
WHERE s."user_id" = r."user_id"
  AND (s."source_url" IS NULL OR TRIM(s."source_url") = '')
  AND LOWER(TRIM(s."source_name")) = LOWER(TRIM(r."title"))
  AND s."roadmap_id" IS NULL;

-- Step 2C (Case 4): Ambiguous historical identity (multiple snapshots with NULL source_url and same name) -> Create SEPARATE parent Roadmap for EACH snapshot
INSERT INTO "roadmap"."roadmaps" ("id", "user_id", "title", "status", "priority", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    s."user_id",
    s."source_name",
    'ACTIVE'::"roadmap"."RoadmapStatus",
    'PRIMARY'::"roadmap"."RoadmapPriority",
    s."imported_at",
    s."updated_at"
FROM "roadmap"."roadmap_snapshots" s
WHERE s."roadmap_id" IS NULL;

UPDATE "roadmap"."roadmap_snapshots" s
SET "roadmap_id" = (
    SELECT r."id" FROM "roadmap"."roadmaps" r
    WHERE r."user_id" = s."user_id" AND r."title" = s."source_name" AND r."created_at" = s."imported_at"
    LIMIT 1
)
WHERE s."roadmap_id" IS NULL;

-- Step 3: Verify no NULL roadmap_id remains before applying NOT NULL constraint
-- (In SQL migration, if any NULL roadmap_id remains, the following ALTER TABLE will raise an explicit DB exception)
ALTER TABLE "roadmap"."roadmap_snapshots" ALTER COLUMN "roadmap_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "roadmaps_user_id_status_idx" ON "roadmap"."roadmaps"("user_id", "status");

-- AddForeignKey
ALTER TABLE "roadmap"."roadmaps" ADD CONSTRAINT "roadmaps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap"."roadmap_snapshots" ADD CONSTRAINT "roadmap_snapshots_roadmap_id_fkey" FOREIGN KEY ("roadmap_id") REFERENCES "roadmap"."roadmaps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
