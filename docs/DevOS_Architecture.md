# DevOS — System Architecture Document
**Version:** 1.0  
**Author:** Staff Software Architect  
**Date:** June 2026  
**Status:** Draft

---

## Table of Contents

1. [Domain-Driven Architecture](#1-domain-driven-architecture)
2. [Entity Relationships](#2-entity-relationships)
3. [PostgreSQL Schema](#3-postgresql-schema)
4. [API Architecture](#4-api-architecture)
5. [Folder Structure](#5-folder-structure)
6. [Authentication Design](#6-authentication-design)
7. [Event System](#7-event-system)
8. [Scalability Plan](#8-scalability-plan)
9. [Security Considerations](#9-security-considerations)
10. [MVP vs Future Features](#10-mvp-vs-future-features)

---

## 1. Domain-Driven Architecture

### Bounded Contexts

DevOS is decomposed into six bounded contexts. Each context owns its data and exposes well-defined interfaces.

```
┌──────────────────────────────────────────────────────────────────────┐
│                          DevOS Platform                              │
│                                                                      │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────────┐ │
│  │   Identity   │   │   Journey    │   │       Evidence           │ │
│  │   Context    │──▶│   Context    │──▶│       Context            │ │
│  │              │   │              │   │  (GitHub, Certs, Manual) │ │
│  └──────────────┘   └──────┬───────┘   └──────────────────────────┘ │
│                            │                                         │
│  ┌──────────────┐   ┌──────▼───────┐   ┌──────────────────────────┐ │
│  │  Gamification│◀──│  Progression │   │      Social &            │ │
│  │  Context     │   │  Context     │──▶│      Recruiter Context   │ │
│  │  (XP, Ach.)  │   │  (Tasks,     │   │  (Public Profiles,       │ │
│  └──────────────┘   │  Milestones) │   │   Recruiter Dashboards)  │ │
│                     └──────────────┘   └──────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### Context Responsibilities

**Identity Context**
Owns user accounts, OAuth tokens, sessions, and role assignments (learner, recruiter, admin).

**Journey Context**
The core domain. Owns Journey aggregates, which contain milestones, tasks, projects, notes, and reflections. The Journey is the central aggregate root.

**Evidence Context**
Owns all evidence artifacts — GitHub commits, certificates, uploaded files, and manual entries. Evidence is linked to tasks or projects via foreign keys but lives in its own schema.

**Progression Context**
Tracks learning state — completion percentages, streak counts, last active dates, and progress snapshots. This context publishes events that Gamification consumes.

**Gamification Context**
Owns XP ledgers, achievement definitions, badge awards, and leaderboards. Stateless relative to Journey — it reacts to domain events.

**Social & Recruiter Context**
Owns public profile configurations, share tokens, recruiter access grants, and analytics snapshots. Read-heavy; largely derived from other contexts.

---

## 2. Entity Relationships

### Aggregate Overview

```
User (root)
 ├── Journey (aggregate root)
 │    ├── Milestone
 │    │    └── Task
 │    │         └── Evidence (ref)
 │    ├── Project
 │    │    └── Evidence (ref)
 │    ├── Note
 │    ├── Reflection
 │    └── JourneySettings
 │
 ├── XP Ledger (append-only)
 ├── Achievement Award
 ├── Streak Record
 └── PublicProfile

Evidence (separate aggregate)
 ├── GitHubCommitEvidence
 ├── CertificateEvidence
 ├── ManualEvidence
 └── ProjectEvidence
```

### Relationship Matrix

| Entity | Belongs To | Has Many | Optional FK |
|---|---|---|---|
| Journey | User | Milestones, Projects, Notes, Reflections | Template |
| Milestone | Journey | Tasks | — |
| Task | Milestone | Evidence links | — |
| Project | Journey | Evidence links, Tasks | — |
| Note | Journey | — | Task, Milestone |
| Reflection | Journey | — | Milestone |
| Evidence | User | — | Task, Project |
| XPLedger | User | XPEntry | Journey |
| Achievement | — (global) | AchievementAward | — |
| AchievementAward | User | — | Journey |
| Streak | User | StreakEntry | Journey |
| PublicProfile | User | SharedLinks | — |

---

## 3. PostgreSQL Schema

### Conventions

- All primary keys: `UUID` (v7 ordered).
- All timestamps: `TIMESTAMPTZ`.
- Soft deletes via `deleted_at TIMESTAMPTZ NULL`.
- Row-level security (RLS) enabled on all user-data tables.
- Schema separation: `identity`, `journey`, `evidence`, `gamification`, `social`.

---

### Schema: `identity`

```sql
-- identity.users
CREATE TABLE identity.users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    display_name    TEXT NOT NULL,
    username        TEXT NOT NULL UNIQUE,
    avatar_url      TEXT,
    role            TEXT NOT NULL DEFAULT 'learner'
                        CHECK (role IN ('learner', 'recruiter', 'admin')),
    timezone        TEXT NOT NULL DEFAULT 'UTC',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

-- identity.oauth_accounts
CREATE TABLE identity.oauth_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL CHECK (provider IN ('github', 'google', 'email')),
    provider_id     TEXT NOT NULL,
    access_token    TEXT,           -- encrypted at rest
    refresh_token   TEXT,           -- encrypted at rest
    token_expires_at TIMESTAMPTZ,
    scopes          TEXT[],
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_id)
);

-- identity.sessions
CREATE TABLE identity.sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL UNIQUE,
    user_agent      TEXT,
    ip_address      INET,
    last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### Schema: `journey`

```sql
-- journey.journeys
CREATE TABLE journey.journeys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    slug            TEXT NOT NULL,
    description     TEXT,
    category        TEXT,           -- 'ai_engineering', 'blockchain', 'fitness', 'custom'
    icon            TEXT,
    color           TEXT,
    status          TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'paused', 'completed', 'archived')),
    visibility      TEXT NOT NULL DEFAULT 'private'
                        CHECK (visibility IN ('private', 'public', 'recruiter')),
    target_date     DATE,
    sort_order      INT NOT NULL DEFAULT 0,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (user_id, slug)
);

-- journey.milestones
CREATE TABLE journey.milestones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id      UUID NOT NULL REFERENCES journey.journeys(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
    target_date     DATE,
    completed_at    TIMESTAMPTZ,
    sort_order      INT NOT NULL DEFAULT 0,
    xp_reward       INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

-- journey.tasks
CREATE TABLE journey.tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id    UUID NOT NULL REFERENCES journey.milestones(id) ON DELETE CASCADE,
    journey_id      UUID NOT NULL REFERENCES journey.journeys(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    status          TEXT NOT NULL DEFAULT 'todo'
                        CHECK (status IN ('todo', 'in_progress', 'done', 'skipped')),
    priority        TEXT NOT NULL DEFAULT 'medium'
                        CHECK (priority IN ('low', 'medium', 'high')),
    due_date        DATE,
    completed_at    TIMESTAMPTZ,
    sort_order      INT NOT NULL DEFAULT 0,
    xp_reward       INT NOT NULL DEFAULT 10,
    tags            TEXT[],
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

-- journey.projects
CREATE TABLE journey.projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id      UUID NOT NULL REFERENCES journey.journeys(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    repo_url        TEXT,
    live_url        TEXT,
    thumbnail_url   TEXT,
    status          TEXT NOT NULL DEFAULT 'in_progress'
                        CHECK (status IN ('planned', 'in_progress', 'completed', 'archived')),
    tech_stack      TEXT[],
    started_at      DATE,
    completed_at    TIMESTAMPTZ,
    xp_reward       INT NOT NULL DEFAULT 50,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

-- journey.notes
CREATE TABLE journey.notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id      UUID NOT NULL REFERENCES journey.journeys(id) ON DELETE CASCADE,
    task_id         UUID REFERENCES journey.tasks(id) ON DELETE SET NULL,
    milestone_id    UUID REFERENCES journey.milestones(id) ON DELETE SET NULL,
    title           TEXT,
    content         TEXT NOT NULL,      -- Markdown
    content_type    TEXT NOT NULL DEFAULT 'markdown',
    tags            TEXT[],
    is_pinned       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

-- journey.reflections
CREATE TABLE journey.reflections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journey_id      UUID NOT NULL REFERENCES journey.journeys(id) ON DELETE CASCADE,
    milestone_id    UUID REFERENCES journey.milestones(id) ON DELETE SET NULL,
    prompt          TEXT,
    content         TEXT NOT NULL,
    mood            TEXT CHECK (mood IN ('great', 'good', 'okay', 'struggling', 'blocked')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### Schema: `evidence`

```sql
-- evidence.evidence_items
-- Single polymorphic table for all evidence types
CREATE TABLE evidence.evidence_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    task_id         UUID REFERENCES journey.tasks(id) ON DELETE SET NULL,
    project_id      UUID REFERENCES journey.projects(id) ON DELETE SET NULL,
    journey_id      UUID REFERENCES journey.journeys(id) ON DELETE SET NULL,
    evidence_type   TEXT NOT NULL
                        CHECK (evidence_type IN ('github_commit', 'github_pr', 'github_repo',
                                                  'certificate', 'manual', 'file_upload',
                                                  'external_url', 'project_submission')),
    title           TEXT NOT NULL,
    description     TEXT,
    url             TEXT,
    verified        BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at     TIMESTAMPTZ,
    metadata        JSONB NOT NULL DEFAULT '{}',
    -- GitHub-specific fields (populated when evidence_type starts with 'github_')
    github_sha      TEXT,
    github_repo     TEXT,
    github_author   TEXT,
    github_event_at TIMESTAMPTZ,
    -- Certificate-specific
    issuer          TEXT,
    issued_at       DATE,
    expires_at      DATE,
    credential_id   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

-- evidence.github_sync_logs
CREATE TABLE evidence.github_sync_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    status          TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    repos_synced    INT DEFAULT 0,
    commits_found   INT DEFAULT 0,
    evidence_created INT DEFAULT 0,
    error_message   TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);
```

---

### Schema: `gamification`

```sql
-- gamification.xp_ledger
-- Append-only; never update rows
CREATE TABLE gamification.xp_ledger (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    journey_id      UUID REFERENCES journey.journeys(id) ON DELETE SET NULL,
    source_type     TEXT NOT NULL,  -- 'task_complete', 'milestone_complete', 'streak_bonus', etc.
    source_id       UUID,           -- ID of the triggering entity
    xp_delta        INT NOT NULL,   -- positive or negative
    balance_after   INT NOT NULL,   -- denormalized running total for fast reads
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- gamification.streaks
CREATE TABLE gamification.streaks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    journey_id          UUID REFERENCES journey.journeys(id) ON DELETE CASCADE,
    current_streak      INT NOT NULL DEFAULT 0,
    longest_streak      INT NOT NULL DEFAULT 0,
    last_activity_date  DATE,
    grace_period_used   BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- gamification.achievements
CREATE TABLE gamification.achievements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT NOT NULL UNIQUE,   -- 'first_milestone', 'streak_7', etc.
    name            TEXT NOT NULL,
    description     TEXT NOT NULL,
    icon            TEXT,
    xp_reward       INT NOT NULL DEFAULT 0,
    category        TEXT,
    criteria        JSONB NOT NULL DEFAULT '{}',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- gamification.achievement_awards
CREATE TABLE gamification.achievement_awards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    achievement_id  UUID NOT NULL REFERENCES gamification.achievements(id),
    journey_id      UUID REFERENCES journey.journeys(id) ON DELETE SET NULL,
    awarded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, achievement_id)
);
```

---

### Schema: `social`

```sql
-- social.public_profiles
CREATE TABLE social.public_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE UNIQUE,
    is_public       BOOLEAN NOT NULL DEFAULT FALSE,
    headline        TEXT,
    bio             TEXT,
    social_links    JSONB NOT NULL DEFAULT '{}',
    skills          TEXT[],
    featured_journey_ids UUID[],
    view_count      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- social.recruiter_access_grants
CREATE TABLE social.recruiter_access_grants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learner_id      UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    recruiter_id    UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    share_token     TEXT UNIQUE,        -- for anonymous share links
    journey_ids     UUID[],             -- NULL means all public journeys
    expires_at      TIMESTAMPTZ,
    last_viewed_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### Key Indexes

```sql
-- Journey lookups
CREATE INDEX idx_journeys_user_id      ON journey.journeys(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_milestone_id    ON journey.tasks(milestone_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_journey_id      ON journey.tasks(journey_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_notes_journey_id      ON journey.notes(journey_id) WHERE deleted_at IS NULL;

-- Evidence lookups
CREATE INDEX idx_evidence_user_id      ON evidence.evidence_items(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_evidence_task_id      ON evidence.evidence_items(task_id);
CREATE INDEX idx_evidence_github_repo  ON evidence.evidence_items(github_repo) WHERE github_repo IS NOT NULL;

-- Gamification
CREATE INDEX idx_xp_ledger_user_id    ON gamification.xp_ledger(user_id);
CREATE INDEX idx_xp_ledger_journey_id ON gamification.xp_ledger(journey_id);
CREATE INDEX idx_streaks_user_id      ON gamification.streaks(user_id);

-- Full-text search on notes/tasks
CREATE INDEX idx_notes_fts ON journey.notes USING GIN (to_tsvector('english', title || ' ' || content));
CREATE INDEX idx_tasks_fts ON journey.tasks USING GIN (to_tsvector('english', title || ' ' || COALESCE(description, '')));
```

---

## 4. API Architecture

### Design Principles

- REST for CRUD operations; versioned under `/api/v1/`
- WebSocket for real-time notifications (streak alerts, XP updates)
- Webhook endpoints for GitHub integration
- All responses: `{ data, meta, errors }`
- Pagination: cursor-based (`after`, `limit`)

### Resource Map

```
/api/v1/

  Auth
    POST   /auth/register
    POST   /auth/login
    POST   /auth/logout
    POST   /auth/refresh
    GET    /auth/oauth/github          → redirect to GitHub
    GET    /auth/oauth/github/callback
    GET    /auth/me

  Journeys
    GET    /journeys                   → list user's journeys
    POST   /journeys                   → create journey
    GET    /journeys/:id
    PATCH  /journeys/:id
    DELETE /journeys/:id
    GET    /journeys/:id/stats         → XP, completion %, streak

  Milestones
    GET    /journeys/:id/milestones
    POST   /journeys/:id/milestones
    PATCH  /journeys/:id/milestones/:mid
    DELETE /journeys/:id/milestones/:mid

  Tasks
    GET    /milestones/:mid/tasks
    POST   /milestones/:mid/tasks
    PATCH  /tasks/:id
    POST   /tasks/:id/complete         → triggers XP + event
    DELETE /tasks/:id

  Projects
    GET    /journeys/:id/projects
    POST   /journeys/:id/projects
    PATCH  /projects/:id
    DELETE /projects/:id

  Notes
    GET    /journeys/:id/notes
    POST   /journeys/:id/notes
    PATCH  /notes/:id
    DELETE /notes/:id

  Reflections
    GET    /journeys/:id/reflections
    POST   /journeys/:id/reflections
    PATCH  /reflections/:id

  Evidence
    GET    /evidence                   → filter by task_id, project_id
    POST   /evidence
    PATCH  /evidence/:id
    DELETE /evidence/:id
    POST   /evidence/github/sync       → trigger GitHub sync
    GET    /evidence/github/sync/status

  Gamification
    GET    /me/xp                      → ledger summary + history
    GET    /me/achievements
    GET    /me/streaks

  Profile
    GET    /profile/:username          → public profile
    PATCH  /me/profile
    POST   /me/profile/share           → create share token

  Recruiter
    GET    /recruiter/view/:token      → view learner via share token

  Webhooks
    POST   /webhooks/github            → GitHub push events

  Import
    POST   /import/csv
    POST   /import/markdown
    POST   /import/excel
```

### Middleware Stack (per request)

```
Request
  → Rate Limiter (per IP + per user)
  → CORS
  → JWT Auth Guard (public routes excluded)
  → Role Guard
  → Input Validation (Zod)
  → Controller
  → Service Layer
  → Repository / ORM
  → PostgreSQL
```

---

## 5. Folder Structure

```
devos/
├── apps/
│   ├── api/                          # Backend (Node.js / Fastify or NestJS)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── auth.controller.ts
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   ├── auth.module.ts
│   │   │   │   │   └── strategies/    # JWT, GitHub OAuth
│   │   │   │   ├── journeys/
│   │   │   │   ├── milestones/
│   │   │   │   ├── tasks/
│   │   │   │   ├── projects/
│   │   │   │   ├── notes/
│   │   │   │   ├── reflections/
│   │   │   │   ├── evidence/
│   │   │   │   │   └── github/        # GitHub sync service
│   │   │   │   ├── gamification/
│   │   │   │   │   ├── xp/
│   │   │   │   │   ├── achievements/
│   │   │   │   │   └── streaks/
│   │   │   │   ├── profile/
│   │   │   │   ├── recruiter/
│   │   │   │   ├── import/
│   │   │   │   └── webhooks/
│   │   │   ├── common/
│   │   │   │   ├── decorators/
│   │   │   │   ├── guards/
│   │   │   │   ├── filters/           # Exception filters
│   │   │   │   ├── interceptors/
│   │   │   │   └── pipes/             # Validation
│   │   │   ├── events/                # Domain event definitions + bus
│   │   │   ├── database/
│   │   │   │   ├── migrations/
│   │   │   │   └── seeds/
│   │   │   ├── config/                # Typed env config
│   │   │   └── main.ts
│   │   ├── test/
│   │   └── package.json
│   │
│   └── web/                          # Frontend (Next.js)
│       ├── app/
│       │   ├── (auth)/                # Login, register
│       │   ├── (dashboard)/
│       │   │   ├── journeys/
│       │   │   ├── profile/
│       │   │   └── settings/
│       │   ├── p/[username]/          # Public profile
│       │   └── r/[token]/             # Recruiter view
│       ├── components/
│       │   ├── ui/                    # Design system primitives
│       │   ├── journey/
│       │   ├── milestones/
│       │   ├── gamification/
│       │   └── evidence/
│       ├── hooks/
│       ├── lib/
│       │   ├── api/                   # API client
│       │   └── utils/
│       └── package.json
│
├── packages/
│   ├── types/                         # Shared TypeScript types
│   ├── validators/                    # Shared Zod schemas
│   └── config/                        # Shared ESLint, tsconfig
│
├── infrastructure/
│   ├── docker/
│   │   ├── docker-compose.yml         # Local dev
│   │   └── docker-compose.prod.yml
│   ├── nginx/
│   ├── terraform/                     # IaC for cloud resources
│   └── scripts/
│       ├── db-migrate.sh
│       └── seed.sh
│
├── docs/
│   ├── architecture/
│   ├── api/                           # OpenAPI spec
│   └── decisions/                     # ADRs
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
└── turbo.json                         # Turborepo config (monorepo)
```

---

## 6. Authentication Design

### Token Strategy

DevOS uses a **dual-token** model:

| Token | Lifetime | Storage | Purpose |
|---|---|---|---|
| Access Token (JWT) | 15 minutes | Memory / HTTP header | API authorization |
| Refresh Token (opaque) | 30 days | `HttpOnly` Secure cookie | Renewing access tokens |

Refresh tokens are stored as bcrypt hashes in `identity.sessions`. On rotation, the old hash is invalidated immediately (refresh token rotation).

### Auth Flows

**Email/Password**
1. Register → hash password (Argon2id) → create user + session
2. Login → verify hash → issue access + refresh tokens

**GitHub OAuth**
1. Redirect to GitHub with scopes: `read:user`, `user:email`, `repo` (for evidence sync)
2. Exchange code → store encrypted access/refresh tokens in `oauth_accounts`
3. Issue DevOS JWT — the GitHub token is a separate stored credential, not the session token

**Refresh Flow**
1. Client sends refresh token cookie
2. Server hashes it, looks up session
3. Validates expiry and `user_id`
4. Issues new access token + rotated refresh token
5. Old session row updated with new hash

### Role Model

```
learner    → full access to own data, public profile control
recruiter  → view-only access via share tokens or public profiles
admin      → platform management, content moderation
```

Roles are enforced at the route guard level and at the PostgreSQL RLS level for defense in depth.

### GitHub Token Security

- Stored encrypted using AES-256-GCM with a KMS-managed key
- Decrypted at runtime only during GitHub API calls
- Scopes requested are minimal — never request write permissions

---

## 7. Event System

### Design: Transactional Outbox Pattern

All domain events are written to an `events.outbox` table **within the same database transaction** as the triggering mutation. A background worker polls and publishes them. This guarantees events are never lost even if the message broker is unavailable.

```sql
-- events.outbox
CREATE TABLE events.outbox (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type  TEXT NOT NULL,      -- 'task', 'milestone', 'journey'
    aggregate_id    UUID NOT NULL,
    event_type      TEXT NOT NULL,
    payload         JSONB NOT NULL,
    user_id         UUID NOT NULL,
    published       BOOLEAN NOT NULL DEFAULT FALSE,
    published_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outbox_unpublished ON events.outbox(created_at) WHERE published = FALSE;
```

### Core Domain Events

| Event | Trigger | Consumers |
|---|---|---|
| `task.completed` | Task status → done | Gamification (XP), Streak, Analytics |
| `task.created` | New task | Analytics |
| `milestone.completed` | All tasks done | Gamification (XP + Achievement), Analytics |
| `journey.created` | New journey | Analytics |
| `journey.completed` | Status → completed | Gamification (Achievement), Social |
| `evidence.linked` | Evidence attached to task | Gamification (XP), Analytics |
| `github.synced` | GitHub sync completed | Evidence context |
| `streak.broken` | Missed day | Gamification (reset), Notification |
| `streak.milestone` | 7/30/100 day streak | Gamification (Achievement + XP) |
| `achievement.awarded` | Achievement unlocked | Notification, Social |
| `user.registered` | New account | Onboarding flow |

### Event Flow

```
User action (API call)
  ↓
Service layer
  ↓
Database transaction {
  UPDATE journey.tasks SET status = 'done' ...
  INSERT INTO events.outbox (event_type='task.completed', ...) 
}  ← atomic commit
  ↓
Outbox worker (polls every 1s)
  ↓
Publish to message bus (Redis Streams in MVP; Kafka at scale)
  ↓
Consumers:
  ├── GamificationConsumer    → award XP, check achievements
  ├── StreakConsumer           → update streak
  ├── AnalyticsConsumer        → write to analytics store
  └── NotificationConsumer     → push/email alerts
```

---

## 8. Scalability Plan

### MVP Infrastructure (0–5k users)

```
Cloudflare (CDN + DDoS)
    │
    ▼
Single VPS / App Server
  ├── Next.js (frontend, SSR)
  ├── Fastify API
  ├── BullMQ workers (GitHub sync, events)
  │
  ▼
Managed PostgreSQL (single instance + read replica)
  ▼
Redis (sessions, queues, cache)
```

### Growth Phase (5k–100k users)

- Horizontally scale API behind a load balancer
- Add a dedicated read replica for analytics and recruiter queries
- Replace BullMQ with Redis Streams or managed Kafka
- Introduce a CDN for uploaded file assets (S3 + CloudFront)
- Extract GitHub sync into a dedicated worker service
- Add connection pooling (PgBouncer in transaction mode)

### Scale Phase (100k+ users)

- Introduce read replicas per bounded context
- Extract Gamification into a separate service (high write volume from event consumers)
- Consider TimescaleDB extension for XP ledger time-series queries
- Introduce a separate analytics database (ClickHouse or Redshift) for recruiter dashboards
- Rate limiting moved to Cloudflare Workers (edge-level)

### Caching Strategy

| Data | Cache | TTL |
|---|---|---|
| Public profiles | Redis | 5 min |
| Journey stats (XP totals, completion %) | Redis | 1 min |
| Achievement list (static) | In-process memory | indefinite |
| Recruiter dashboard snapshots | Redis | 10 min |
| User session validation | Redis | matches JWT TTL |

---

## 9. Security Considerations

### Data Protection

- Passwords: **Argon2id** (never bcrypt for new systems)
- OAuth tokens: **AES-256-GCM** at rest, KMS-managed keys
- Transport: **TLS 1.3** enforced everywhere
- Database: **PostgreSQL RLS** — every user-data table enforces `user_id = current_setting('app.user_id')`
- PII: `email`, `ip_address` encrypted at the column level using `pgcrypto`

### API Security

- **CSRF**: `SameSite=Strict` on cookies + custom header check for state-changing requests
- **Rate limiting**: 100 req/min per IP (unauthenticated), 500 req/min per user (authenticated)
- **Input validation**: Zod schemas on all endpoints; reject unknown fields
- **SQL injection**: Parameterized queries only; no raw string concatenation
- **XSS**: Content-Security-Policy headers; sanitize Markdown before rendering

### GitHub Integration

- Request **minimum scopes** — only `read:user`, `user:email`, `repo` (read-only commits)
- Validate all **webhook payloads** with HMAC-SHA256 signature verification
- Store tokens encrypted; decrypt only at call time; never log tokens
- Implement a **token health check** on sync — surface revoked token errors to user

### Recruiter Access

- Share tokens are **cryptographically random** (32 bytes, URL-safe base64)
- Tokens can be **revoked** by the learner at any time
- Optionally **expire** tokens (default: 30 days)
- Recruiter views are **read-only** — no mutation endpoints available via token auth
- All recruiter views are **logged** (timestamp, IP) and visible to the learner

### OWASP Top 10 Coverage

| Risk | Mitigation |
|---|---|
| Injection | Parameterized queries, Zod validation |
| Broken Auth | Dual-token, short-lived JWTs, refresh rotation |
| Sensitive Data Exposure | Encryption at rest and in transit |
| Broken Access Control | RLS + role guards |
| Security Misconfiguration | IaC, env validation on startup |
| XSS | CSP headers, Markdown sanitization |
| CSRF | SameSite cookies + custom header |
| SSRF | Allowlist for external URL evidence entries |
| Outdated Components | Automated dependency scanning (Dependabot) |
| Logging Failures | Structured logs; never log tokens/passwords |

---

## 10. MVP vs Future Features

### MVP Scope (Phase 1)

**Goal:** Validate core loop — create journey → add tasks → track progress → see XP.

| Feature | Included in MVP |
|---|---|
| User registration & login (email + GitHub OAuth) | ✅ |
| Create / manage journeys | ✅ |
| Milestones and tasks | ✅ |
| Notes | ✅ |
| Manual evidence entries | ✅ |
| XP ledger (basic) | ✅ |
| Streak tracking | ✅ |
| Public profile (read-only) | ✅ |
| GitHub commit sync (basic) | ✅ |
| Core achievements (10–15) | ✅ |
| CSV import | ✅ |
| Projects | ✅ |
| Reflections | ✅ |
| Recruiter dashboards | ❌ |
| AI Mentor | ❌ |
| Resume Generator | ❌ |
| Skill Graph | ❌ |
| Analytics Dashboard | ❌ |
| Excel / Markdown import | ❌ |
| Certificates as evidence | ❌ |
| Real-time notifications | ❌ |

### Phase 2 — Evidence & Social (3–6 months post-MVP)

- GitHub PR and repo-level evidence
- Certificate evidence (Credly, Coursera API integrations)
- Recruiter mode with share tokens and dashboard
- Markdown and Excel import
- Real-time WebSocket notifications
- Expanded achievements (50+)

### Phase 3 — Intelligence & Analytics (6–12 months)

- **AI Mentor**: Contextual nudges based on streak, blocked tasks, and reflection sentiment
- **Skill Graph**: Visual map of skills acquired across journeys, inferred from tasks and evidence
- **Resume Generator**: Export public profile + selected journeys into a formatted resume
- **Analytics Dashboard**: Learning velocity, time-per-task, peak productivity windows
- **Recruiter Analytics**: Engagement metrics visible to recruiter (with learner consent)

### Phase 4 — Platform (12+ months)

- Journey Templates marketplace (community-created learning paths)
- Team / cohort journeys (shared milestones)
- Learning path recommendations (AI-driven)
- API for third-party integrations
- Mobile apps (iOS / Android)

---

## Appendix: Technology Recommendations

| Concern | Recommended Choice | Rationale |
|---|---|---|
| Backend runtime | Node.js (TypeScript) | GitHub SDK maturity, async I/O for GitHub sync |
| API framework | NestJS | Module system maps cleanly to bounded contexts |
| ORM | Prisma (with raw SQL for analytics) | Type-safe, migration support |
| Frontend | Next.js 15 (App Router) | SSR for public profiles/SEO, RSC for dashboard |
| Auth library | Custom (passport-jwt + passport-github) | Full control over token lifecycle |
| Queue | BullMQ (Redis-backed) | MVP; simple, battle-tested |
| Cache | Redis | Sessions, rate limiting, caching |
| File storage | S3-compatible (Cloudflare R2) | Certificates, uploaded evidence |
| Monorepo | Turborepo | Shared types, fast builds |
| CI/CD | GitHub Actions | Native GitHub integration |
| Hosting (MVP) | Railway or Render | Managed Postgres + Redis, low ops overhead |
| Hosting (scale) | AWS (ECS + RDS + ElastiCache) | Mature, fine-grained control |

---

*End of DevOS Architecture Document v1.0*
