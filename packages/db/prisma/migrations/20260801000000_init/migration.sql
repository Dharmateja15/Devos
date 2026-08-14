-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "events";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "evidence";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "gamification";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "identity";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "journey";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "learning";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "roadmap";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "social";

-- CreateEnum
CREATE TYPE "journey"."JourneyStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "journey"."Visibility" AS ENUM ('PRIVATE', 'PUBLIC', 'RECRUITER');

-- CreateEnum
CREATE TYPE "journey"."TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "journey"."TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "journey"."IndependenceSignal" AS ENUM ('AI_ASSISTED', 'GUIDED', 'INDEPENDENT');

-- CreateEnum
CREATE TYPE "journey"."ProjectStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "evidence"."EvidenceType" AS ENUM ('GITHUB_COMMIT', 'GITHUB_PR', 'GITHUB_REPO', 'CERTIFICATE', 'MANUAL', 'FILE_UPLOAD', 'EXTERNAL_URL', 'PROJECT_SUBMISSION');

-- CreateEnum
CREATE TYPE "evidence"."SyncStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "identity"."UserRole" AS ENUM ('LEARNER', 'RECRUITER', 'ADMIN');

-- CreateEnum
CREATE TYPE "identity"."AuthProvider" AS ENUM ('GITHUB', 'GOOGLE', 'EMAIL');

-- CreateEnum
CREATE TYPE "journey"."DailyLogType" AS ENUM ('NOTE', 'REFLECTION', 'CHALLENGE', 'WIN');

-- CreateEnum
CREATE TYPE "roadmap"."RoadmapSourceType" AS ENUM ('ROADMAP_SH', 'CSV', 'MARKDOWN', 'DOCUMENT_FALLBACK');

-- CreateEnum
CREATE TYPE "roadmap"."RoadmapNodeType" AS ENUM ('TOPIC', 'MILESTONE', 'SKILL', 'PROJECT', 'RESOURCE', 'DECISION', 'OPTIONAL_TOPIC');

-- CreateEnum
CREATE TYPE "roadmap"."MappingStatus" AS ENUM ('COMPLETED', 'KNOWN_UNVERIFIED', 'IN_PROGRESS', 'PARTIAL_MATCH', 'NEW', 'AMBIGUOUS', 'SKIPPED', 'USER_CONFIRMED');

-- CreateEnum
CREATE TYPE "learning"."LearnerState" AS ENUM ('UNKNOWN', 'SELF_REPORTED', 'ASSESSED', 'MASTERED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "roadmap"."RoadmapStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "roadmap"."RoadmapPriority" AS ENUM ('PRIMARY', 'SECONDARY', 'LOW');

-- CreateTable
CREATE TABLE "identity"."users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT,
    "avatar_url" TEXT,
    "role" "identity"."UserRole" NOT NULL DEFAULT 'LEARNER',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."oauth_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" "identity"."AuthProvider" NOT NULL,
    "provider_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMPTZ,
    "scopes" TEXT[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "last_active_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "roadmap"."roadmap_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "roadmap_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source_type" "roadmap"."RoadmapSourceType" NOT NULL,
    "source_url" TEXT,
    "source_name" TEXT NOT NULL,
    "source_version" TEXT,
    "imported_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "roadmap_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap"."roadmap_nodes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "snapshot_id" UUID NOT NULL,
    "external_node_id" TEXT NOT NULL,
    "parent_node_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "node_type" "roadmap"."RoadmapNodeType" NOT NULL DEFAULT 'TOPIC',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "dependencies" TEXT[],
    "resource_urls" TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "roadmap_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap"."roadmap_mappings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "roadmap_node_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "journey_id" UUID,
    "task_id" UUID,
    "project_id" UUID,
    "skill_id" UUID,
    "mapping_status" "roadmap"."MappingStatus" NOT NULL DEFAULT 'NEW',
    "confidence_score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "matching_reason" TEXT,
    "user_confirmation" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roadmap_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey"."journeys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "status" "journey"."JourneyStatus" NOT NULL DEFAULT 'ACTIVE',
    "visibility" "journey"."Visibility" NOT NULL DEFAULT 'PRIVATE',
    "target_date" DATE,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "journeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey"."milestones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "journey_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "journey"."TaskStatus" NOT NULL DEFAULT 'TODO',
    "target_date" DATE,
    "completed_at" TIMESTAMPTZ,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "xp_reward" INTEGER NOT NULL DEFAULT 50,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey"."tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "milestone_id" UUID NOT NULL,
    "journey_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "journey"."TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "journey"."TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "independence_signal" "journey"."IndependenceSignal",
    "due_date" DATE,
    "completed_at" TIMESTAMPTZ,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "xp_reward" INTEGER NOT NULL DEFAULT 10,
    "tags" TEXT[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey"."skills" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey"."task_skills" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey"."projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "journey_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "repo_url" TEXT,
    "live_url" TEXT,
    "thumbnail_url" TEXT,
    "status" "journey"."ProjectStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "tech_stack" TEXT[],
    "started_at" DATE,
    "completed_at" TIMESTAMPTZ,
    "xp_reward" INTEGER NOT NULL DEFAULT 100,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey"."notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "journey_id" UUID NOT NULL,
    "task_id" UUID,
    "milestone_id" UUID,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "content_type" TEXT NOT NULL DEFAULT 'markdown',
    "tags" TEXT[],
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey"."daily_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "journey_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "journey"."DailyLogType" NOT NULL DEFAULT 'NOTE',
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence"."evidence_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "journey_id" UUID,
    "task_id" UUID,
    "project_id" UUID,
    "evidence_type" "evidence"."EvidenceType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,
    "github_sha" TEXT,
    "github_repo" TEXT,
    "github_author" TEXT,
    "github_event_at" TIMESTAMPTZ,
    "issuer" TEXT,
    "issued_at" DATE,
    "expires_at" DATE,
    "credential_id" TEXT,

    CONSTRAINT "evidence_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gamification"."xp_ledger" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "journey_id" UUID,
    "source_type" TEXT NOT NULL,
    "source_id" UUID,
    "xp_delta" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gamification"."streaks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "journey_id" UUID,
    "current_streak" INTEGER NOT NULL DEFAULT 0,
    "longest_streak" INTEGER NOT NULL DEFAULT 0,
    "last_activity_date" DATE,
    "grace_period_used" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "streaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gamification"."achievements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "xp_reward" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "criteria" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gamification"."achievement_awards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "achievement_id" UUID NOT NULL,
    "journey_id" UUID,
    "awarded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievement_awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gamification"."streak_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "streak_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social"."public_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "headline" TEXT,
    "bio" TEXT,
    "social_links" JSONB NOT NULL DEFAULT '{}',
    "featured_journey_ids" UUID[],
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "total_xp" INTEGER NOT NULL DEFAULT 0,
    "streak_count" INTEGER NOT NULL DEFAULT 0,
    "completed_journeys_count" INTEGER NOT NULL DEFAULT 0,
    "total_tasks_completed" INTEGER NOT NULL DEFAULT 0,
    "verified_evidence_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events"."outbox" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "user_id" UUID NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."concepts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concepts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning"."learner_concept_states" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "concept_id" UUID NOT NULL,
    "state" "learning"."LearnerState" NOT NULL DEFAULT 'UNKNOWN',
    "last_evaluated_at" TIMESTAMPTZ,
    "next_review_at" TIMESTAMPTZ,
    "user_intent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learner_concept_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "identity"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "identity"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_provider_id_key" ON "identity"."oauth_accounts"("provider", "provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "identity"."sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "roadmaps_user_id_status_idx" ON "roadmap"."roadmaps"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "journeys_user_id_slug_key" ON "journey"."journeys"("user_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_key" ON "journey"."skills"("name");

-- CreateIndex
CREATE UNIQUE INDEX "task_skills_task_id_skill_id_key" ON "journey"."task_skills"("task_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_code_key" ON "gamification"."achievements"("code");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_awards_user_id_achievement_id_key" ON "gamification"."achievement_awards"("user_id", "achievement_id");

-- CreateIndex
CREATE UNIQUE INDEX "streak_history_user_id_date_key" ON "gamification"."streak_history"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "public_profiles_user_id_key" ON "social"."public_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "concepts_title_key" ON "learning"."concepts"("title");

-- CreateIndex
CREATE UNIQUE INDEX "learner_concept_states_user_id_concept_id_key" ON "learning"."learner_concept_states"("user_id", "concept_id");

-- AddForeignKey
ALTER TABLE "identity"."oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap"."roadmaps" ADD CONSTRAINT "roadmaps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap"."roadmap_snapshots" ADD CONSTRAINT "roadmap_snapshots_roadmap_id_fkey" FOREIGN KEY ("roadmap_id") REFERENCES "roadmap"."roadmaps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap"."roadmap_snapshots" ADD CONSTRAINT "roadmap_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap"."roadmap_nodes" ADD CONSTRAINT "roadmap_nodes_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "roadmap"."roadmap_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap"."roadmap_nodes" ADD CONSTRAINT "roadmap_nodes_parent_node_id_fkey" FOREIGN KEY ("parent_node_id") REFERENCES "roadmap"."roadmap_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap"."roadmap_mappings" ADD CONSTRAINT "roadmap_mappings_roadmap_node_id_fkey" FOREIGN KEY ("roadmap_node_id") REFERENCES "roadmap"."roadmap_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap"."roadmap_mappings" ADD CONSTRAINT "roadmap_mappings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap"."roadmap_mappings" ADD CONSTRAINT "roadmap_mappings_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journey"."journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap"."roadmap_mappings" ADD CONSTRAINT "roadmap_mappings_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "journey"."tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap"."roadmap_mappings" ADD CONSTRAINT "roadmap_mappings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "journey"."projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap"."roadmap_mappings" ADD CONSTRAINT "roadmap_mappings_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "journey"."skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey"."journeys" ADD CONSTRAINT "journeys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey"."milestones" ADD CONSTRAINT "milestones_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journey"."journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey"."tasks" ADD CONSTRAINT "tasks_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "journey"."milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey"."tasks" ADD CONSTRAINT "tasks_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journey"."journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey"."task_skills" ADD CONSTRAINT "task_skills_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "journey"."tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey"."task_skills" ADD CONSTRAINT "task_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "journey"."skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey"."projects" ADD CONSTRAINT "projects_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journey"."journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey"."notes" ADD CONSTRAINT "notes_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journey"."journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey"."notes" ADD CONSTRAINT "notes_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "journey"."tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey"."notes" ADD CONSTRAINT "notes_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "journey"."milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journey"."daily_logs" ADD CONSTRAINT "daily_logs_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journey"."journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."evidence_items" ADD CONSTRAINT "evidence_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."evidence_items" ADD CONSTRAINT "evidence_items_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journey"."journeys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."evidence_items" ADD CONSTRAINT "evidence_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "journey"."tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence"."evidence_items" ADD CONSTRAINT "evidence_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "journey"."projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification"."xp_ledger" ADD CONSTRAINT "xp_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification"."xp_ledger" ADD CONSTRAINT "xp_ledger_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journey"."journeys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification"."streaks" ADD CONSTRAINT "streaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification"."streaks" ADD CONSTRAINT "streaks_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journey"."journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification"."achievement_awards" ADD CONSTRAINT "achievement_awards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification"."achievement_awards" ADD CONSTRAINT "achievement_awards_achievement_id_fkey" FOREIGN KEY ("achievement_id") REFERENCES "gamification"."achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification"."achievement_awards" ADD CONSTRAINT "achievement_awards_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "journey"."journeys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gamification"."streak_history" ADD CONSTRAINT "streak_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social"."public_profiles" ADD CONSTRAINT "public_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."learner_concept_states" ADD CONSTRAINT "learner_concept_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning"."learner_concept_states" ADD CONSTRAINT "learner_concept_states_concept_id_fkey" FOREIGN KEY ("concept_id") REFERENCES "learning"."concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

