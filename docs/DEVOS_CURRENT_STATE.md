# DevOS — Current State

Date: 2026-08-16  
Authority: Current Repository Codebase (`d:\Devos`)

---

## 1. Product Definition

DevOS is an developer learning, journey tracking, proof-of-work evidence, and career progression OS. It enables developers to structure their skill acquisition through structured journeys, complete actionable milestones and tasks, earn XP and track learning streaks, upload proof-of-work evidence, import learning roadmaps (via Markdown, CSV, and interactive tree views), and visualize personal capability freshness and skill gaps.

---

## 2. Current Architecture

DevOS is implemented as a monorepo containing:
- **`apps/web`**: Next.js 16.3.0 App Router frontend with React 19, Tailwind CSS, Sentry telemetry, and custom React Error Boundaries.
- **`apps/api`**: NestJS 11 backend service providing HTTP REST APIs, Passport JWT RS256 authentication, GitHub OAuth, Redis state management, Sentry error tracking, Throttler rate limiting, and Helmet security headers.
- **`packages/db`**: Prisma ORM 5.0.0 client managing a PostgreSQL 16 database across 8 domain schemas (`identity`, `roadmap`, `journey`, `evidence`, `gamification`, `social`, `events`, `learning`).
- **`packages/types`**: Shared TypeScript domain contracts, DTOs, and interface definitions.
- **`packages/validators`**: Shared input validation schemas.

---

## 3. Technology Stack

- **Node.js**: v20 / packageManager `npm@11.13.0` (Target runtime: Node.js 20.x)
- **TypeScript**: v5.7.3 / v5.0.0
- **Turborepo**: v2.10.9
- **NestJS**: v11.0.1 (`@nestjs/core`, `@nestjs/common`)
- **Next.js**: v16.3.0 (App Router, Turbopack)
- **React**: v19.2.8 (`@sentry/react` v8.55.2)
- **Prisma**: v5.0.0 (`@prisma/client` v5.0.0)
- **PostgreSQL**: v16 (Multi-schema enabled)
- **Redis**: v7 (`ioredis` v6.0.0)
- **Sentry**: v8.55.2 (`@sentry/node` in API, `@sentry/react` in Web)

---

## 4. Current Deployment State

- **Frontend Testing Deployment**: Vercel (`https://devos-omega.vercel.app`)
- **Backend Testing Deployment**: Render (Singapore region, `devos-api` Web Service)
- **PostgreSQL Testing Provider**: Neon (Managed PostgreSQL)
- **Redis Infrastructure State**: Unprovisioned on Render (`REDIS_URL` currently missing in Render `devos-api` environment variables; Render logs indicate connection attempts failing until Redis instance is provisioned and linked)
- **Historical Provider Reference**: Railway was referenced in initial June 2026 design documents as an alternative hosting candidate. Railway is an original planning reference only and is NOT the current testing deployment provider.


---

## 5. Authentication & Authorization

- **Auth Schemes**: Dual authentication via local credentials (`email` + `passwordHash` using Argon2/Bcrypt) and GitHub OAuth 2.0 (`/api/v1/auth/github`).
- **JWT Signing**: Asymmetric RS256 signing via `@nestjs/jwt` with `JWT_PRIVATE_KEY` (signing) and `JWT_PUBLIC_KEY` (verification).
- **Session Management**: Session tokens stored in `identity.sessions` table and delivered to clients via HTTP-only, SameSite cookies.
- **Guard Architecture**: `JwtAuthGuard` enforced across protected controller endpoints with `@CurrentUser()` parameter decorator.

---

## 6. Core Learning System

- **Journeys**: High-level learning paths created by users (`journey.journeys`).
- **Milestones**: Sequential sub-goals under a journey (`journey.milestones`).
- **Tasks**: Actionable learning items under milestones (`journey.tasks`) with status tracking (`TODO`, `IN_PROGRESS`, `COMPLETED`, `SKIPPED`).
- **Task Notes**: Rich-text / Markdown notes attached to individual tasks (`journey.task_notes`).

---

## 7. Gamification System

- **XP Ledger**: Transactional audit log (`gamification.xp_ledger`) recording XP grants with `sourceType` (`TASK_COMPLETION`, `MILESTONE_COMPLETION`, `STREAK_BONUS`, `EVIDENCE_SUBMISSION`) and `sourceId`.
- **Level Calculation**: Dynamic level mapping based on total cumulative XP (`apps/web/src/lib/utils/level-calculator.ts`).
- **Streaks**: Daily activity streak tracking (`gamification.streaks`) with auto-increment on daily task completion and streak freeze protection.
- **Achievements**: Unlockable platform badges (`gamification.achievements` and `gamification.user_achievements`).

---

## 8. Evidence System

- **Evidence Items**: Proof-of-work items (`evidence.evidence_items`) supporting types `GITHUB_COMMIT`, `GITHUB_PR`, `GITHUB_REPO`, `CERTIFICATE`, `MANUAL`, `FILE_UPLOAD`, `EXTERNAL_URL`, `PROJECT_SUBMISSION`.
- **GitHub Integration**: Integration adapter fetching commit and PR metadata directly from GitHub API (`GitHubClientAdapter`).

---

## 9. Public Profile

- **Profile Settings**: Public profile toggle (`isPublic`) and bio/custom link customization in user settings (`apps/api/src/profile`).
- **Showcase View**: Public page (`/p/[username]`) displaying user bio, active level, XP total, current streak, unlocked achievements, proof-of-work evidence, and activity heatmap.

---

## 10. Settings

- **User Preferences**: Profile customization, timezone selection, email notifications, and security settings managed via `/api/v1/settings`.

---

## 11. Roadmap System

- **Roadmap Definitions**: Structured skill trees (`roadmap.roadmaps`, `roadmap.roadmap_nodes`, `roadmap.roadmap_node_relations`).
- **Parsers & Adapters**: Markdown roadmap parser, CSV roadmap parser, and roadmap.sh JSON transformer adapters.
- **Interactive UI**: Interactive node graph, goal impact modal, and node detail drawer (`apps/web/src/components/roadmap`).

---

## 12. Intelligence System

- **Capabilities**: Automated user capability extraction (`learning.user_capabilities`).
- **Freshness**: Decay and capability freshness scoring based on time elapsed since last task completion or evidence update.
- **Recommendations**: Targeted learning recommendations and conflict resolution service.
- **Project Gap Analysis**: Automated gap analysis matching current user capability graph against roadmap node requirements.

---

## 13. CSV Import System Architecture

### Backend (`apps/api/src/journeys/import-csv.service.ts`)
- **`POST /api/v1/journeys/import/preview`**: Validates uploaded CSV rows, parses milestones and tasks, generates a preview token, and stores state in Redis (`import:csv:preview:<token>`) with a 900 seconds (15 minutes) TTL. State transitions: `READY` -> `EXECUTING` -> `COMMITTED`.
- **`POST /api/v1/journeys/import/execute`**: Executes atomic Lua script (`acquireImportPreviewExecution`) to acquire exclusive lock, preventing race conditions. Performs same-journey row locking and database transaction import.

### Frontend (`apps/web/src/app/import/page.tsx`)
- Multi-step wizard UI: File Upload -> Validation & Preview -> Execution -> Summary & Redirect.
- Error state handling with line-level validation feedback and automatic preview token expiry cleanup.

---

## 14. Security Hardening (Phase 1A)

- **Helmet**: Production headers configured in `main.ts` (Content-Security-Policy, HSTS, X-Frame-Options, X-Content-Type-Options).
- **ValidationPipe**: Configured with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
- **Throttling**: `@nestjs/throttler` default limit (100 req / 60s) with route-specific overrides.
- **JWT Hardening**: RS256 asymmetric signing with environment RSA keys.

---

## 15. Database Hardening (Phase 1B)

5 approved performance B-tree indexes added to [`packages/db/prisma/schema.prisma`](file:///d:/Devos/packages/db/prisma/schema.prisma) and committed in migration `20260816000000_add_database_performance_indexes`:
1. `Milestone`: `@@index([journeyId])`
2. `Task`: `@@index([milestoneId])`
3. `Task`: `@@index([journeyId])`
4. `EvidenceItem`: `@@index([userId, journeyId])`
5. `XpLedger`: `@@index([userId, sourceType, sourceId])`

---

## 16. Observability (Phase 1C)

- **API Telemetry**: `SentryExceptionFilter` intercepting unhandled 5xx server errors and reporting to Sentry when `SENTRY_DSN` is configured.
- **Sensitive Data Scrubbing**: Automated redaction of `password`, `jwt`, `token`, `authorization`, `cookie`, `apiKey`, and `secret`.
- **Frontend Telemetry**: Sentry initialization (`apps/web/src/lib/sentry.ts`) and React error boundaries (`apps/web/src/app/error.tsx` and `global-error.tsx`).
- **Health Checks**: `GET /health` (Liveness) and `GET /health/readiness` (PostgreSQL + Redis dependency check).

---

## 17. CI/CD Safety (Phase 1D)

- **CI Workflow**: Updated [`.github/workflows/ci.yml`](file:///d:/Devos/.github/workflows/ci.yml) with an ephemeral `postgres:16` service container.
- **Prisma Migration Deploy Validation**: Automatically runs `npx prisma migrate deploy` against the ephemeral CI database to validate migration SQL integrity before running `npm run db:generate`, `npm run typecheck`, `npm run lint`, `npm test`, and `npx turbo run build`.

---

## 18. Database Schema & Migration History

### PostgreSQL Schemas:
`identity`, `roadmap`, `journey`, `evidence`, `gamification`, `social`, `events`, `learning`

### Committed Migration SQL History:
1. `20260801000000_init`: Initial multi-schema table creation.
2. `20260816000000_add_database_performance_indexes`: Production B-tree indexes creation.
3. `migration_lock.toml`: Lock file confirming `postgresql` provider.

---

## 19. Current Test Baseline

Executed on 2026-08-16:
- **API Unit/Integration Test Suites**: 34 passed, 34 total (323 tests passed)
- **Web Unit/Integration Test Suites**: 11 passed, 11 total (97 tests passed)
- **Total Workspace Test Count**: **420 passed, 420 total**
- **Typecheck**: PASS (0 errors across 5 workspace packages)
- **Production Build**: PASS (100% build success across all 5 workspace packages)
- **Lint**: Run per workspace; strict `@typescript-eslint` rules present in API codebase.

---

## 20. Current Repository Status

All core modules (Auth, Journeys, Milestones, Tasks, Gamification, XP, Streaks, Achievements, Evidence, Public Profile, Settings, Roadmap, Intelligence, CSV Import, Security Hardening 1A, Database Indexes 1B, Observability 1C, CI/CD Hardening 1D) are **COMPLETE and VERIFIED**.

---

## 21. Known Limitations

- Production Sentry telemetry requires configuring valid `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` in live host environment settings.
- PaaS reverse-proxy topology verification is required prior to configuring Express `trust proxy` in API `main.ts`.

---

## 22. Deferred Features

- Production PaaS auto-deployment pipeline (CD automation).
- External Uptime Monitoring integration (e.g. BetterUptime hook).
- Standalone multi-stage production Dockerfiles for Kubernetes / ECS.

---

## 23. Deployment Status

- **TEST DEPLOYMENT**: Active (Web on Vercel, API on Render).
- **PRODUCTION / BETA RELEASE**: PENDING host environment variable configuration and production database migration execution (`npx prisma migrate deploy`).

---

## 24. Development Governance

### Architect / Technical Lead:
**ChatGPT**

**Responsibilities**:
- Architecture definition & specification
- Scope management & phase sequencing
- Acceptance criteria setting
- Source-of-truth reconciliation
- Implementation prompt authoring

### Execution Agent:
**Antigravity**

**Responsibilities**:
- Repository inspection & empirical fact verification
- Implementation of exact approved specifications
- Execution of test, typecheck, build, and lint verification
- Comprehensive technical reporting

**Antigravity MUST NOT**:
- Invent new product phases independently
- Replace source-of-truth architecture
- Reinterpret historical roadmap as current state
- Choose deployment providers without Architect instruction
- Declare product phases completed without empirical test verification
