# DevOS — Master Implementation Plan (Version 1.2)

This document integrates the **Master Source of Truth (MST)**, **System Architecture Document**, **Product Design Specification**, and **Technical Build Plan**. Conflicts are resolved using the priority rules: **Master Source of Truth (1) > Architecture (2) > Product Spec (3) > Technical Build Plan (4) > Antigravity Plan (5)**.

---

## Key Reconciled Requirements

1.  **Scope Boundaries (MST & Build Plan):**
    *   **Included in MVP:** Authentication (Email/Password & GitHub OAuth), Dashboard, Journey Creation, Milestones, Tasks, Daily Logs (reflecting notes, challenges, wins, and mood), Notes, XP System, Streak System, Achievement System, Basic GitHub Connection (username connection, repository listing, and contribution count via public APIs), Public Profile, and CSV Import.
    *   **Excluded from MVP:** AI Mentor, Skill Graph, Resume Generator, Recruiter Dashboard, Full GitHub Sync (automated cron repos scan), Webhooks, and File Uploads.
    *   **Projects Inclusion:** In alignment with the MST's gamification rule ("Project Completion = +100 XP") and the Product Design Specification's "Project Screen", the database schema will include the `Project` entity, and basic CRUD + XP mapping will be supported in the MVP.
2.  **Database & Schema Design (Architecture):**
    *   **Schema Namespaces:** Prisma will use PostgreSQL schema isolation using the `multiSchema` preview feature across five schemas: `identity`, `journey`, `evidence`, `gamification`, `social`, and `events`.
    *   **Primary Keys & Timestamps:** All primary keys use `UUID` (ordered UUIDv7 generated in the app/DB). All timestamps are `TIMESTAMPTZ`.
    *   **Soft Deletes:** Enforced via `deleted_at TIMESTAMPTZ NULL` on user-data tables.
    *   **Outbox Pattern:** Implemented via `events.outbox` inside the database to handle asynchronous event processing (for XP computations, streaks, and achievements).
3.  **Authentication (Architecture & Build Plan):**
    *   **Hashing:** Argon2id (`argon2` package) will be used instead of bcrypt for password hashing.
    *   **Tokens:** A dual-token model: short-lived JWT access tokens (15 minutes) passed in the headers, and opaque refresh tokens (30 days) stored in `HttpOnly` Secure SameSite=Strict cookies. Refresh tokens are hashed and stored in `identity.sessions` for token rotation.
4.  **GitHub Connection (MST vs Build Plan):**
    *   Although the Build Plan recommended postponing GitHub features, the **MST overrides this**. The MVP will include: GitHub OAuth login, storing connected GitHub username, fetching public repositories, and listing public contribution count. Additionally, linking evidence of type `GITHUB_REPO` or `GITHUB_COMMIT` will perform basic validation against the public GitHub API, marking them `verified` and granting a +5 XP bonus.
5.  **Design System & UI Tokens (Product Spec):**
    *   Vanilla CSS layout using CSS custom variables matching the exact color palette (base `#0D0F12`, surface `#161B22`, purple accent `#A371F7` for XP, green accent `#3FB950` for completions).
    *   Fonts: **JetBrains Mono** for displaying numeric data and display headings, and **Inter** for default body text.
    *   Vanilla micro-animations: task completion transitions, inline XP floats (`+10 XP` animated overlay), and full-screen achievement unlock overlays.

---

## 1. Complete Database Schema (Prisma PostgreSQL)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["identity", "journey", "evidence", "gamification", "social", "events"]
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

enum JourneyStatus {
  ACTIVE
  PAUSED
  COMPLETED
  ARCHIVED
  @@schema("journey")
}

enum Visibility {
  PRIVATE
  PUBLIC
  RECRUITER
  @@schema("journey")
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  DONE
  SKIPPED
  @@schema("journey")
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  @@schema("journey")
}

enum ProjectStatus {
  PLANNED
  IN_PROGRESS
  COMPLETED
  ARCHIVED
  @@schema("journey")
}

enum EvidenceType {
  GITHUB_COMMIT
  GITHUB_PR
  GITHUB_REPO
  CERTIFICATE
  MANUAL
  FILE_UPLOAD
  EXTERNAL_URL
  PROJECT_SUBMISSION
  @@schema("evidence")
}

enum SyncStatus {
  RUNNING
  COMPLETED
  FAILED
  @@schema("evidence")
}

enum UserRole {
  LEARNER
  RECRUITER
  ADMIN
  @@schema("identity")
}

enum AuthProvider {
  GITHUB
  GOOGLE
  EMAIL
  @@schema("identity")
}

enum DailyLogType {
  NOTE
  REFLECTION
  CHALLENGE
  WIN
  @@schema("journey")
}

model User {
  id           String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email        String      @unique
  displayName  String      @map("display_name")
  username     String      @unique
  avatarUrl    String?     @map("avatar_url")
  role         UserRole    @default(LEARNER)
  timezone     String      @default("UTC")
  createdAt    DateTime    @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime    @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt    DateTime?   @map("deleted_at") @db.Timestamptz

  // Authentication & Relations
  oauthAccounts  OAuthAccount[]
  sessions       Session[]
  journeys       Journey[]
  evidenceItems  EvidenceItem[]
  xpLedger       XpLedger[]
  streaks        Streak[]
  achievements   UserAchievement[]
  publicProfile  PublicProfile?
  streakHistory  StreakHistory[]

  @@map("users")
  @@schema("identity")
}

model OAuthAccount {
  id             String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId         String       @map("user_id") @db.Uuid
  provider       AuthProvider
  providerId     String       @map("provider_id")
  accessToken    String?      @map("access_token")  // Encrypted at rest
  refreshToken   String?      @map("refresh_token") // Encrypted at rest
  tokenExpiresAt DateTime?    @map("token_expires_at") @db.Timestamptz
  scopes         String[]
  createdAt      DateTime     @default(now()) @map("created_at") @db.Timestamptz

  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerId])
  @@map("oauth_accounts")
  @@schema("identity")
}

model Session {
  id               String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId           String   @map("user_id") @db.Uuid
  refreshTokenHash String   @unique @map("refresh_token_hash")
  userAgent        String?  @map("user_agent")
  ipAddress        String?  @map("ip_address") // Stores INET
  lastActiveAt     DateTime @default(now()) @map("last_active_at") @db.Timestamptz
  expiresAt        DateTime @map("expires_at") @db.Timestamptz
  createdAt        DateTime @default(now()) @map("created_at") @db.Timestamptz

  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
  @@schema("identity")
}

model Journey {
  id          String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId      String        @map("user_id") @db.Uuid
  title       String
  slug        String
  description String?
  category    String        // e.g., "ai_engineering", "blockchain", "fitness"
  icon        String?
  color       String?
  status      JourneyStatus @default(ACTIVE)
  visibility  Visibility    @default(PRIVATE)
  targetDate  DateTime?     @map("target_date") @db.Date
  sortOrder   Int           @default(0) @map("sort_order")
  metadata    Json          @default("{}")
  createdAt   DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime      @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt   DateTime?     @map("deleted_at") @db.Timestamptz

  user        User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  milestones  Milestone[]
  tasks       Task[]
  projects    Project[]
  notes       Note[]
  reflections Reflection[]
  evidence    EvidenceItem[]
  xpLedger    XpLedger[]
  streaks     Streak[]
  awards      UserAchievement[]

  @@unique([userId, slug])
  @@map("journeys")
  @@schema("journey")
}

model Milestone {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  journeyId   String    @map("journey_id") @db.Uuid
  title       String
  description String?
  status      TaskStatus @default(TODO) 
  targetDate  DateTime?  @map("target_date") @db.Date
  completedAt DateTime?  @map("completed_at") @db.Timestamptz
  sortOrder   Int        @default(0) @map("sort_order")
  xpReward    Int        @default(50) @map("xp_reward")
  createdAt   DateTime   @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime   @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt   DateTime?  @map("deleted_at") @db.Timestamptz

  journey     Journey   @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  tasks       Task[]
  notes       Note[]
  reflections Reflection[]

  @@map("milestones")
  @@schema("journey")
}

model Task {
  id          String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  milestoneId String       @map("milestone_id") @db.Uuid
  journeyId   String       @map("journey_id") @db.Uuid
  title       String
  description String?
  status      TaskStatus   @default(TODO)
  priority    TaskPriority @default(MEDIUM)
  dueDate     DateTime?    @map("due_date") @db.Date
  completedAt DateTime?    @map("completed_at") @db.Timestamptz
  sortOrder   Int          @default(0) @map("sort_order")
  xpReward    Int          @default(10) @map("xp_reward")
  tags        String[]
  createdAt   DateTime     @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime     @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt   DateTime?    @map("deleted_at") @db.Timestamptz

  milestone   Milestone    @relation(fields: [milestoneId], references: [id], onDelete: Cascade)
  journey     Journey      @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  notes       Note[]
  evidence    EvidenceItem[]
  skills      TaskSkill[]

  @@map("tasks")
  @@schema("journey")
}

model Skill {
  id          String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name        String      @unique
  description String?
  createdAt   DateTime    @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime    @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  tasks       TaskSkill[]

  @@map("skills")
  @@schema("journey")
}

model TaskSkill {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  taskId    String   @map("task_id") @db.Uuid
  skillId   String   @map("skill_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  skill     Skill    @relation(fields: [skillId], references: [id], onDelete: Cascade)

  @@unique([taskId, skillId])
  @@map("task_skills")
  @@schema("journey")
}

model Project {
  id           String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  journeyId    String        @map("journey_id") @db.Uuid
  title        String
  description  String?
  repoUrl      String?       @map("repo_url")
  liveUrl      String?       @map("live_url")
  thumbnailUrl String?       @map("thumbnail_url")
  status       ProjectStatus @default(IN_PROGRESS)
  techStack    String[]      @map("tech_stack")
  startedAt    DateTime?     @map("started_at") @db.Date
  completedAt  DateTime?     @map("completed_at") @db.Timestamptz
  xpReward     Int           @default(100) @map("xp_reward")
  metadata     Json          @default("{}")
  createdAt    DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime      @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt    DateTime?     @map("deleted_at") @db.Timestamptz

  journey      Journey       @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  evidence     EvidenceItem[]

  @@map("projects")
  @@schema("journey")
}

model Note {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  journeyId   String    @map("journey_id") @db.Uuid
  taskId      String?   @map("task_id") @db.Uuid
  milestoneId String?   @map("milestone_id") @db.Uuid
  title       String?
  content     String    @db.Text
  contentType String    @default("markdown") @map("content_type")
  tags        String[]
  isPinned    Boolean   @default(false) @map("is_pinned")
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt   DateTime? @map("deleted_at") @db.Timestamptz

  journey     Journey    @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  task        Task?      @relation(fields: [taskId], references: [id], onDelete: SetNull)
  milestone   Milestone? @relation(fields: [milestoneId], references: [id], onDelete: SetNull)

  @@map("notes")
  @@schema("journey")
}

model Reflection {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  journeyId   String    @map("journey_id") @db.Uuid
  milestoneId String?   @map("milestone_id") @db.Uuid
  prompt      String?
  content     String    @db.Text
  mood        String?   
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  journey     Journey    @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  milestone   Milestone? @relation(fields: [milestoneId], references: [id], onDelete: SetNull)

  @@map("reflections")
  @@schema("journey")
}

model DailyLog {
  id          String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  journeyId   String       @map("journey_id") @db.Uuid
  title       String
  content     String       @db.Text 
  type        DailyLogType @default(NOTE)
  date        DateTime     @default(now()) @db.Date
  createdAt   DateTime     @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime     @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  journey     Journey      @relation(fields: [journeyId], references: [id], onDelete: Cascade)

  @@map("daily_logs")
  @@schema("journey")
}

model EvidenceItem {
  id            String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId        String       @map("user_id") @db.Uuid
  journeyId     String?      @map("journey_id") @db.Uuid
  taskId        String?      @map("task_id") @db.Uuid
  projectId     String?      @map("project_id") @db.Uuid
  evidenceType  EvidenceType @map("evidence_type")
  title         String
  description   String?
  url           String
  verified      Boolean      @default(false)
  verifiedAt    DateTime?    @map("verified_at") @db.Timestamptz
  metadata      Json         @default("{}")
  createdAt     DateTime     @default(now()) @map("created_at") @db.Timestamptz
  updatedAt     DateTime     @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt     DateTime?    @map("deleted_at") @db.Timestamptz

  // GitHub references
  githubSha     String?      @map("github_sha")
  githubRepo    String?      @map("github_repo")
  githubAuthor  String?      @map("github_author")
  githubEventAt DateTime?    @map("github_event_at") @db.Timestamptz

  // Certificate references
  issuer        String?
  issuedAt      DateTime?    @map("issued_at") @db.Date
  expiresAt     DateTime?    @map("expires_at") @db.Date
  credentialId  String?      @map("credential_id")

  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  journey       Journey?     @relation(fields: [journeyId], references: [id], onDelete: SetNull)
  task          Task?        @relation(fields: [taskId], references: [id], onDelete: SetNull)
  project       Project?     @relation(fields: [projectId], references: [id], onDelete: SetNull)

  @@map("evidence_items")
  @@schema("evidence")
}

model XpLedger {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId       String    @map("user_id") @db.Uuid
  journeyId    String?   @map("journey_id") @db.Uuid
  sourceType   String    @map("source_type") 
  sourceId     String?   @map("source_id") @db.Uuid
  xpDelta      Int       @map("xp_delta")
  balanceAfter Int       @map("balance_after")
  note         String?
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz

  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  journey      Journey?  @relation(fields: [journeyId], references: [id], onDelete: SetNull)

  @@map("xp_ledger")
  @@schema("gamification")
}

model Streak {
  id               String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId           String    @map("user_id") @db.Uuid
  journeyId        String?   @map("journey_id") @db.Uuid
  currentStreak    Int       @default(0) @map("current_streak")
  longestStreak    Int       @default(0) @map("longest_streak")
  lastActivityDate DateTime? @map("last_activity_date") @db.Date
  gracePeriodUsed  Boolean   @default(false) @map("grace_period_used")
  updatedAt        DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  journey          Journey?  @relation(fields: [journeyId], references: [id], onDelete: Cascade)

  @@map("streaks")
  @@schema("gamification")
}

model Achievement {
  id          String            @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  code        String            @unique
  name        String
  description String
  icon        String?
  xpReward    Int               @default(0) @map("xp_reward")
  category    String?
  criteria    Json              @default("{}")
  isActive    Boolean           @default(true) @map("is_active")
  createdAt   DateTime          @default(now()) @map("created_at") @db.Timestamptz
  awards      UserAchievement[]

  @@map("achievements")
  @@schema("gamification")
}

model UserAchievement {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId        String   @map("user_id") @db.Uuid
  achievementId String   @map("achievement_id") @db.Uuid
  journeyId     String?  @map("journey_id") @db.Uuid
  awardedAt     DateTime @default(now()) @map("awarded_at") @db.Timestamptz

  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  achievement   Achievement @relation(fields: [achievementId], references: [id], onDelete: Cascade)
  journey       Journey? @relation(fields: [journeyId], references: [id], onDelete: SetNull)

  @@unique([userId, achievementId])
  @@map("achievement_awards")
  @@schema("gamification")
}

model StreakHistory {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  date      DateTime @db.Date 
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
  @@map("streak_history")
  @@schema("gamification")
}

model PublicProfile {
  id                     String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId                 String   @unique @map("user_id") @db.Uuid
  isPublic               Boolean  @default(false) @map("is_public")
  headline               String?
  bio                    String?
  socialLinks            Json     @default("{}") @map("social_links")
  featuredJourneyIds     String[] @map("featured_journey_ids") @db.Uuid
  viewCount              Int      @default(0) @map("view_count")
  
  // Recruiter-friendly stats
  totalXp                Int      @default(0) @map("total_xp")
  streakCount            Int      @default(0) @map("streak_count")
  completedJourneysCount Int      @default(0) @map("completed_journeys_count")
  totalTasksCompleted    Int      @default(0) @map("total_tasks_completed")
  verifiedEvidenceCount  Int      @default(0) @map("verified_evidence_count")

  createdAt              DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt              DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  user                   User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("public_profiles")
  @@schema("social")
}

model OutboxEvent {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  aggregateType String   @map("aggregate_type") 
  aggregateId   String   @map("aggregate_id") @db.Uuid
  eventType     String   @map("event_type")     
  payload       Json
  userId        String   @map("user_id") @db.Uuid
  published     Boolean  @default(false)
  publishedAt   DateTime? @map("published_at") @db.Timestamptz
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz

  @@map("outbox")
  @@schema("events")
}
```

---

## 2. Core Entities

*   **User:** Root aggregate owner. Maintains username, display name, email, role, and overall level mappings.
*   **Journey:** Aggregation root of a learning track (e.g. AI Engineering). Supports status (`ACTIVE`, `PAUSED`, `COMPLETED`, `ARCHIVED`), visibility controls (`PRIVATE`, `PUBLIC`, `RECRUITER`), and customized meta mapping.
*   **Milestone:** Scoped checkpoint within a Journey. Contains groups of tasks.
*   **Task:** Atomic, actionable learning unit. Has priorities (`LOW`, `MEDIUM`, `HIGH`) and completion states. Completing it awards XP.
*   **Skill:** Repositories of knowledge tags (e.g., Python, React).
*   **TaskSkill:** Join table mapping skills specifically to tasks.
*   **Project:** Finished showcase piece. Completing it awards +100 XP.
*   **Daily Log:** Reflective logging entry capturing: title, markdown reflection content, Wins, Challenges, log type (`DailyLogType`), and date. Creates activity indicators.
*   **Note:** Plaintext or markdown journal entry attached to journeys, milestones, or tasks.
*   **EvidenceItem:** Poly-morphic proof of learning. Integrates Manual entries, url anchors, certificates, and GitHub links.
*   **XpLedger:** Append-only ledger auditing all user transactions. Uses `balance_after` to cache progress dynamically.
*   **Streak:** Tracks active user days, longest streaks, and holds a grace period toggle.
*   **Achievement:** Gamified reward badges seeded as master definitions.
*   **UserAchievement:** Tracks unlocked badges mapped to users.
*   **StreakHistory:** Date indices marking active days. Prevent duplicate streak updates.
*   **PublicProfile:** Pinned journeys, views count, social links, and key recruiter-friendly metrics.
*   **OutboxEvent:** Transactional queue recording mutations for background tasks.

---

## 3. API Architecture (NestJS)

NestJS REST API following bounded modules. Uses standard validation policies and Passport JWT guards.

*   **Prefix:** `/api/v1`
*   **Validation:** Global validation filters mapping Zod models or `class-validator` attributes.
*   **Responses:** Encapsulated inside `{ success: boolean, data?: T, message?: string, error?: string }` layouts.
*   **Outbox Event Worker:** Runs a background task polling `events.outbox` to process event hooks (streaks calculation, achievements matching) using in-memory handlers in MVP to bypass separate worker services.

### Core Endpoints

#### Auth Module
*   `POST /api/v1/auth/register` - Registers a user, hashes password via Argon2id.
*   `POST /api/v1/auth/login` - Validates credentials, issues JWT and rotatable refresh token cookie.
*   `POST /api/v1/auth/logout` - Revokes refresh session and clears cookie.
*   `POST /api/v1/auth/refresh` - Checks refresh cookie validity, rotates tokens.
*   `GET /api/v1/auth/me` - Resolves details of the logged-in session.
*   `GET /api/v1/auth/oauth/github` - Triggers GitHub OAuth integration redirect.
*   `GET /api/v1/auth/oauth/github/callback` - Resolves OAuth code, registers user, exchanges token.

#### Journey Module
*   `POST /api/v1/journeys` - Create a learning path.
*   `GET /api/v1/journeys` - Lists current user journeys (paginated).
*   `GET /api/v1/journeys/:id` - Fetch details of a single journey.
*   `PATCH /api/v1/journeys/:id` - Edit status or category properties.
*   `DELETE /api/v1/journeys/:id` - Perform soft delete mapping (`deletedAt = now`).
*   `GET /api/v1/journeys/:id/stats` - Pull aggregated XP metrics and completion status.

#### Milestones & Tasks Module
*   `POST /api/v1/journeys/:journeyId/milestones` - Add a milestone checkpoint.
*   `PATCH /api/v1/journeys/:journeyId/milestones/:id` - Edit milestone or change state.
*   `DELETE /api/v1/journeys/:journeyId/milestones/:id` - Soft delete milestone.
*   `PATCH /api/v1/journeys/:journeyId/milestones/reorder` - Update sorting values in batch transaction.
*   `POST /api/v1/milestones/:milestoneId/tasks` - Append task to milestone.
*   `PATCH /api/v1/tasks/:id` - Edit task priority, title, description, or due date.
*   `POST /api/v1/tasks/:id/complete` - Idempotently marks a task as DONE. Commits completion, logs XP, writes to Outbox in one atomic transaction.
*   `POST /api/v1/tasks/:id/uncomplete` - Undo completion state if done within a 5-minute threshold.
*   `DELETE /api/v1/tasks/:id` - Soft delete task.

#### Projects Module
*   `POST /api/v1/journeys/:journeyId/projects` - Create a new project.
*   `GET /api/v1/journeys/:journeyId/projects` - Lists projects.
*   `PATCH /api/v1/projects/:id` - Update status (e.g. COMPLETED triggers +100 XP transaction).

#### Daily Logs Module
*   `POST /api/v1/journeys/:journeyId/logs` - Append daily reflection notes, Wins, Challenges, and mood.
*   `GET /api/v1/journeys/:journeyId/logs` - Pull log listings.

#### Notes Module
*   `POST /api/v1/journeys/:journeyId/notes` - Create personal Markdown notes.
*   `GET /api/v1/journeys/:journeyId/notes` - Fetch journey notes.
*   `PATCH /api/v1/notes/:id` - Edit note content.

#### Evidence Module
*   `POST /api/v1/evidence` - Attach evidence (e.g. URL, Manual description). Completing task evidence adds +5 XP.
*   `GET /api/v1/evidence` - Lists evidence filtered by task or project parameters.

#### CSV Import Module
*   `POST /api/v1/import/csv` - Validates and imports task roadmaps dynamically. Creates milestones when new labels are caught. Enclosed in a rollback transaction.

#### Public Profiles Module
*   `GET /api/v1/profile/:username` - Public endpoint returning username, display name, pinned journeys, activity heatmaps, and achievements.

---

## 4. Folder Structure (Monorepo)

```
devos/
├── apps/
│   ├── api/                          # NestJS Backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/             # Passport, JWT, Argon2id, GitHub OAuth
│   │   │   │   ├── journeys/         # Journeys, Milestones CRUD
│   │   │   │   ├── tasks/            # Tasks CRUD, completes
│   │   │   │   ├── projects/         # Projects CRUD, completions (+100 XP)
│   │   │   │   ├── logs/             # Daily Logs
│   │   │   │   ├── notes/            # Notes CRUD
│   │   │   │   ├── evidence/         # Manual & URL evidence logic
│   │   │   │   ├── gamification/     # XP ledger, streaks date calculations, achievements evaluations
│   │   │   │   ├── profile/          # Profiles public view endpoint
│   │   │   │   ├── import/           # papaparse CSV importer
│   │   │   │   └── outbox/           # Polling cron processing events
│   │   │   ├── database/             # Shared Prisma Client integration
│   │   │   └── main.ts
│   │   └── package.json
│   └── web/                          # Next.js 15 Frontend (App Router)
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx        # Injects JetBrains Mono + Inter fonts, styling base
│       │   │   ├── global.css        # Core custom layout variables (dark mode theme, no Tailwind)
│       │   │   ├── (auth)/           # Authentication views (login, signup)
│       │   │   ├── (dashboard)/      # Protected workspaces (Dashboard, settings, CSV upload)
│       │   │   ├── p/[username]/     # Server-rendered SEO-friendly Public Profile view
│       │   │   └── page.tsx          # Landing / Gateway route selector
│       │   ├── components/           # Custom reusable blocks (Accordion, XP tracker, Streak widget)
│       │   └── lib/                  # TanStack Query configurations and API fetch client
│       └── package.json
├── packages/
│   ├── types/                        # Common DTO interfaces
│   ├── validators/                   # Common Zod Schemas
│   └── db/                           # Prisma Schema, seeding commands
├── package.json                      # Workspace dependencies manager
├── turbo.json                        # Build task execution caching
└── README.md
```

---

## 5. Authentication Design

*   **Encryption Scheme:** Passwords are encrypted using **Argon2id** (`argon2` module).
*   **Dual-Token Handling:**
    *   **Access Token:** Asymmetric signed JWT (15-minute lifespan). Contained within the request authorization header.
    *   **Refresh Token:** Opaque randomized string (30 days lifespan). Read/write strictly via HttpOnly, Secure, SameSite=Strict cookies.
*   **Token Rotation & Session Revocation:** Old session keys are hashed and recorded inside `identity.sessions`. On rotation calls, the old hash is deleted, and a new session instance is created. Logouts purge the session entry and clear cookies immediately.

---

## 6. GitHub Integration Design

1.  **OAuth Connection:** Requests minimum permissions: `read:user`, `user:email`, `repo` (to fetch repos and commit SHAs without requesting write permissions).
2.  **Tokens Storage:** OAuth credentials are stored in `identity.oauth_accounts`, encrypted at rest using **AES-256-GCM** using a private KMS key.
3.  **Basic Repository Fetching:** The backend provides a service calling `https://api.github.com/users/{username}/repos` to populate evidence linking selectors.
4.  **Activity Counting:** Pulls public commit totals from GitHub's events feed `https://api.github.com/users/{username}/events` to render basic activity summaries.
5.  **Evidence Verification Check:** When linking evidence representing `GITHUB_REPO` or `GITHUB_COMMIT`, the API queries the connected public endpoint. Matches verify the record (`verified: true`) and award a +5 XP bonus to the user.

---

## 7. Daily Logs Design

*   **Reflection Content:** Rich-text logging accepting Markdown text, rendering code sections and bullet points dynamically on the UI.
*   **Structured Metadata:** Saves date stamps, mood ratings (`great`, `good`, `okay`, `struggling`, `blocked`), wins, and blockers.
*   **Streak Integration:** Submitting a Daily Log is tracked as an active day, inserting index milestones to prevent streak resets.

---

## 8. XP and Achievement Design

### XP Mechanics
*   **Task Completed:** +10 XP
*   **Evidence Linked:** +5 XP
*   **Evidence Verified:** +10 XP
*   **Daily Log Logged:** +5 XP
*   **Project Completed:** +100 XP
*   **Milestone Completed:** +50 XP
*   **Level Ups:** Exponential scale: `Level 1` = 0 XP, `Level 2` = 100 XP, `Level 3` = 250 XP, `Level 4` = 500 XP, etc. (names: Newcomer → Apprentice → Practitioner → Engineer → Architect → Principal → Distinguished → Fellow → Legend).

### Streaks Engine
1.  Activity triggers (task completions or daily logs) insert index entries in `StreakHistory`.
2.  Calculates day differentials:
    *   If yesterday has an active record: `currentStreak` increments by 1.
    *   If active today: no changes made.
    *   Otherwise: resets `currentStreak` to 1.
3.  Streak milestones award XP bonuses (+75 XP for 7-day streaks, +300 XP for 30-day streaks).

### Outbox & Achievement Matching
Every transaction commits records and logs to the transactional outbox (`events.outbox`) in one database transaction. The worker cron executes handlers to check rules:
*   `FIRST_TASK` - Triggered on task completions when count equals 1.
*   `STREAK_3` / `STREAK_7` - Triggered when `streakCount` reaches thresholds.
*   `FIRST_JOURNEY` - Awarded when user creates their first journey.
*   `JOURNEY_COMPLETE` - Evaluated when all milestones and tasks in a journey are resolved.

---

## 9. Module Implementation Order

### Phase 0 — Scaffold & Auth (Days 1–5)
1.  **Monorepo Setup:** Configure Turborepo workspace, typescript rules, shared configs.
2.  **Database Migration (Phase 0):** Establish postgres docker containers, setup Prisma schemas (`identity`), create migrations.
3.  **Argon2id Auth Engine:** Deploy Passport handlers, signup/login controllers, dual-token rotation pipelines, and encrypted OAuth records.
4.  **Frontend Auth:** Deploy Next.js context layers, login/signup forms, path route checkers.

### Phase 1 — Bounded Core Domain (Days 6–15)
5.  **Journey and Milestone endpoints:** CRUD logic for journeys and milestones, including soft deletes.
6.  **Task completion transaction:** Deploy `POST /tasks/:id/complete` committing task states, XP ledger entries, and outbox records in one atomic transaction.
7.  **Outbox Polling Cron:** Set up the background cron worker polling outbox queues.
8.  **Streak and XP services:** Deploy day calculations and ledger balances.
9.  **Achievements seeds:** Seed initial achievement parameters in DB, deploy achievements matching criteria.
10. **Notes & Reflections:** Deploy notes CRUD modules and Daily Logs reflections.
11. **Core Views:** Build Dashboard widgets, Sidebar panels, Greeting states, Journey accordion details.

### Phase 2 — Evidence, Imports & Poland (Days 16–25)
12. **Evidence CRUD:** Link manual/URL evidence entries, wire task drawer integrations.
13. **GitHub Connections:** Integrate OAuth callbacks, repository fetching, event trackers, and auto-verifications.
14. **Public Profile & Heatmaps:** Implement server components rendering profiles, load horizontal activity graphs.
15. **CSV Batch Importers:** Deploy CSV parses, validating maps, transaction execution blocks.
16. **Caching & Hardening:** Activate Redis caching on public pages, hook rate limiting checks.

### Phase 3 — Hardening & Release (Days 26–30)
17. **RLS Activations:** Activate Row-Level Security policies.
18. **Mobile passes:** Polish css grids, tap targets, responsive drawer shells.
19. **Errors & Loading states:** Deploy boundaries handlers, skeletons, toast alerts.
20. **Deployments:** Build container files, deploy to target (Railway), set custom TLS, map Sentry telemetry.
