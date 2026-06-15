# DevOS — Technical Build Plan
**Version:** 1.0  
**Prepared for:** Antigravity (Solo Developer, AI-Assisted)  
**Date:** June 2026  
**Stack:** TypeScript · NestJS · Next.js 15 · PostgreSQL · Redis · Prisma · Turborepo

---

## How to Read This Document

This plan is written for one developer building with AI assistance (Claude, Cursor, or equivalent). Every section answers one of four questions: **What to build. In what order. How hard is it. What to skip for now.**

Complexity ratings use this scale:

| Rating | Meaning | Solo dev time (AI-assisted) |
|---|---|---|
| XS | Boilerplate or near-boilerplate | < 2 hours |
| S | Straightforward, well-understood pattern | 2–4 hours |
| M | Requires thought, some custom logic | 4–8 hours |
| L | Complex domain logic or integration | 1–2 days |
| XL | Multi-day effort, high surface area | 3–5 days |

---

## Part 1 — MVP Scope Definition

### What MVP Must Prove

DevOS MVP has one job: demonstrate the core learning loop. A user creates a journey, adds milestones and tasks, completes tasks, earns XP, and can see their progress. Everything else is Phase 2+.

### MVP Feature Set (Hard Boundary)

**In MVP:**
- User registration and login (email + GitHub OAuth)
- Create, edit, and delete journeys
- Milestones and tasks within journeys
- Mark tasks complete (with XP award)
- Notes on tasks and journeys
- Manual evidence entries (no GitHub sync yet)
- Basic XP ledger and level display
- Streak tracking (daily activity)
- Core achievements (10 achievements)
- Public profile (read-only, toggled on/off)
- CSV import of tasks
- Basic dashboard (active journeys + today's tasks + recent activity)

**Explicitly NOT in MVP:**
- GitHub commit sync (Phase 2)
- Recruiter mode / share links (Phase 2)
- Certificate evidence (Phase 2)
- Projects screen (Phase 2)
- Skill graph (Phase 3)
- AI Mentor (Phase 3)
- Resume generator (Phase 3)
- Real-time WebSocket notifications (Phase 2)
- Excel / Markdown import (Phase 2)
- Reflections (deprioritised — notes covers this)
- Analytics dashboard (Phase 2)
- File upload evidence (Phase 2)

### Why These Boundaries

GitHub sync requires OAuth token storage, background workers, webhook handling, and rate-limit management — a full sub-system. It adds zero value until users have journeys with tasks to link commits to. Build the container first, then fill it.

The Recruiter screen needs real data to demo. An empty portfolio impresses nobody. Ship after users have had 4–6 weeks to fill their journeys.

The Skill Graph requires enough task-tag data to be meaningful. Premature optimisation.

---

## Part 2 — Development Phases

### Phase 0 — Foundation (Week 1–2)
*Goal: Nothing works, but everything is wired up correctly.*

Set up the monorepo, databases, CI/CD pipeline, environment config, and auth skeleton. No features ship to users in this phase. This phase is done when: a request hits the API, touches the database, and returns a response.

### Phase 1 — Core Domain (Week 3–6)
*Goal: The learning loop works end-to-end.*

Journeys, milestones, tasks. Create → track → complete. XP ledger. Streaks. The dashboard. This is the "does DevOS exist" phase. Done when a user can sign up, create a journey, complete a task, and see their XP go up.

### Phase 2 — Evidence & Polish (Week 7–9)
*Goal: The product feels finished enough to share.*

Manual evidence on tasks. Notes. Core achievements. Public profile. CSV import. Basic dashboard polish. Done when it's something you'd send a friend a link to without embarrassment.

### Phase 3 — Hardening & Launch (Week 10–12)
*Goal: Production-ready. Monitored. Deployed.*

Error handling, rate limiting, loading states, empty states, mobile responsiveness, performance, deployment pipeline. Done when it could handle 100 real users without falling over.

---

## Part 3 — Database Setup Order

Build the database in dependency order. A table should never be created before the tables it references.

### Step 1 — Schemas and Extensions (XS)

```
Enable: uuid-ossp, pgcrypto, pg_trgm (for search)
Create schemas: identity, journey, evidence, gamification, social, events
```

Nothing depends on this. Do it first, do it once.

### Step 2 — identity.users (XS)

The root entity. Every other table references it. No foreign keys from this table to anywhere else in the domain.

Fields: id, email, display_name, username, avatar_url, role, timezone, created_at, updated_at, deleted_at.

### Step 3 — identity.oauth_accounts (S)

Depends on: users. Stores GitHub (and future Google) OAuth tokens. Encrypted token fields — set up the encryption helper function before inserting data.

### Step 4 — identity.sessions (XS)

Depends on: users. Refresh token store. Simple table — id, user_id, refresh_token_hash, expires_at, last_active_at.

### Step 5 — journey.journeys (S)

Depends on: users. The central aggregate. Add the `deleted_at` column and the partial index (`WHERE deleted_at IS NULL`) immediately — soft deletes must be in place before any data is written.

### Step 6 — journey.milestones (XS)

Depends on: journeys. Ordered by `sort_order`. No complex logic in the schema itself.

### Step 7 — journey.tasks (S)

Depends on: milestones AND journeys (denormalised FK for fast journey-level queries). The `status` CHECK constraint and `xp_reward` default belong here, not in application code.

### Step 8 — journey.notes (XS)

Depends on: journeys, tasks (nullable), milestones (nullable). All foreign keys are nullable — a note can exist at the journey level with no task or milestone association.

### Step 9 — evidence.evidence_items (M)

Depends on: users, tasks (nullable), journeys (nullable). The polymorphic `evidence_type` column with a CHECK constraint. The GitHub-specific columns (github_sha, github_repo, etc.) are nullable and ignored in MVP — they exist in schema from day one to avoid a migration later.

### Step 10 — gamification.xp_ledger (S)

Depends on: users, journeys (nullable). Append-only. Add a database-level trigger or application-level guard to prevent UPDATE on this table. The `balance_after` denormalised column must be maintained correctly from day one.

### Step 11 — gamification.streaks (XS)

Depends on: users, journeys (nullable). One row per user (or per journey in future). Simple upsert pattern.

### Step 12 — gamification.achievements (XS)

No foreign keys — global definition table. Seed this with the 10 MVP achievements immediately after creating the table. Achievement definitions are code, not user data.

### Step 13 — gamification.achievement_awards (XS)

Depends on: users, achievements, journeys (nullable). The `UNIQUE (user_id, achievement_id)` constraint is the idempotency guard — the application can safely attempt to award the same achievement twice without duplicating.

### Step 14 — social.public_profiles (XS)

Depends on: users. One-to-one with users (UNIQUE constraint on user_id). Created lazily when a user first visits their profile settings.

### Step 15 — events.outbox (S)

Depends on: nothing (stores user_id as raw UUID, no FK — outbox must never block on FK constraint failures). Add the partial index on `published = FALSE` immediately.

### Full Migration Order Summary

```
Phase 0:
  001_create_schemas_and_extensions
  002_identity_users
  003_identity_oauth_accounts
  004_identity_sessions

Phase 1:
  005_journey_journeys
  006_journey_milestones
  007_journey_tasks
  008_journey_notes
  009_evidence_evidence_items
  010_gamification_xp_ledger
  011_gamification_streaks
  012_gamification_achievements
  013_gamification_achievement_awards
  014_events_outbox

Phase 2:
  015_social_public_profiles
  016_indexes_fts (full-text search indexes)
  017_rls_policies (Row Level Security)
```

**Defer to Phase 2:**
- social.recruiter_access_grants
- evidence.github_sync_logs
- RLS policies (add after core functionality works, before public launch)

---

## Part 4 — API Implementation Order

### Guiding Principle

Build each module completely (routes + service + validation + error handling) before moving to the next. Half-built modules create debugging debt. The order follows data dependency — you cannot implement Tasks before Journeys exist.

---

### Module 1 — Project Scaffold (Phase 0) — XS

**What:** Turborepo monorepo with `apps/api` (NestJS) and `apps/web` (Next.js 15). Shared `packages/types` and `packages/validators`.

**Deliverables:**
- `turbo.json` with build/dev/test pipelines
- `apps/api` boots, returns 200 on `GET /health`
- `apps/web` boots, renders a blank page
- Prisma connected to local PostgreSQL
- `.env` schema validated on startup (use `@nestjs/config` with Joi or Zod)
- Docker Compose: PostgreSQL + Redis

**AI prompt strategy:** Generate the Turborepo scaffold with NestJS and Next.js in one shot. The boilerplate is well-known — let AI handle 90% of it. Review the Prisma connection and env validation manually.

**Complexity:** S

---

### Module 2 — Auth (Phase 0) — L

**What:** Email/password registration + login. GitHub OAuth. JWT access tokens. Refresh token rotation. Session management.

**Endpoints:**
```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
GET  /api/v1/auth/oauth/github
GET  /api/v1/auth/oauth/github/callback
GET  /api/v1/auth/me
```

**Implementation notes:**
- Use `@nestjs/passport` with `passport-local` (email) and `passport-github2`
- JWT signed with RS256 (asymmetric) — not HS256. Generates a key pair on first boot, stored in env.
- Refresh tokens: 32-byte random, stored as bcrypt hash in `identity.sessions`
- HttpOnly Secure SameSite=Strict cookie for refresh token
- Access token: 15 min, in Authorization header
- GitHub OAuth: after callback, upsert `identity.oauth_accounts`, then issue DevOS JWT

**What NOT to build yet:** Token encryption for GitHub OAuth tokens (defer to Phase 2 when GitHub sync is built). For MVP, just store the access token in plaintext in dev — add encryption before production.

**Complexity:** L (auth is always L — many edge cases, security-critical)

**AI prompt strategy:** Generate the NestJS auth module structure in one shot. Then write the JWT strategy, local strategy, and GitHub strategy separately. Test each with curl before wiring the frontend.

---

### Module 3 — Journeys CRUD (Phase 1) — M

**What:** Full CRUD for journeys. Belongs to the authenticated user.

**Endpoints:**
```
GET    /api/v1/journeys
POST   /api/v1/journeys
GET    /api/v1/journeys/:id
PATCH  /api/v1/journeys/:id
DELETE /api/v1/journeys/:id        (soft delete)
GET    /api/v1/journeys/:id/stats  (XP, completion %, streak)
```

**Implementation notes:**
- All list endpoints: cursor-based pagination (`after` + `limit`, default 20)
- Soft delete: set `deleted_at`, never actually DELETE from table
- `/stats` endpoint: computed from tasks and XP ledger — no stored stats table in MVP
- Validate: `title` required, `color` must be one of the allowed palette values, `slug` auto-generated from title (unique per user)

**Complexity:** M

---

### Module 4 — Milestones CRUD (Phase 1) — S

**What:** CRUD for milestones, scoped to a journey.

**Endpoints:**
```
GET    /api/v1/journeys/:journeyId/milestones
POST   /api/v1/journeys/:journeyId/milestones
PATCH  /api/v1/journeys/:journeyId/milestones/:id
DELETE /api/v1/journeys/:journeyId/milestones/:id
PATCH  /api/v1/journeys/:journeyId/milestones/reorder   (bulk sort_order update)
```

**Implementation notes:**
- Reorder endpoint: accepts `[{ id, sort_order }]` array, runs in a transaction
- Milestone completion is derived (all tasks done), not stored — compute it in the stats query
- Authorization guard: verify journey belongs to the requesting user on every operation

**Complexity:** S

---

### Module 5 — Tasks CRUD + Completion (Phase 1) — M

**What:** CRUD for tasks, plus the completion action that triggers XP and streak logic.

**Endpoints:**
```
GET    /api/v1/milestones/:milestoneId/tasks
POST   /api/v1/milestones/:milestoneId/tasks
PATCH  /api/v1/tasks/:id
DELETE /api/v1/tasks/:id
POST   /api/v1/tasks/:id/complete
POST   /api/v1/tasks/:id/uncomplete      (undo, within 5-min window only)
PATCH  /api/v1/milestones/:milestoneId/tasks/reorder
```

**Implementation notes:**
- `POST /complete` is the most important endpoint in the system. It must:
  1. Set `status = 'done'`, set `completed_at`
  2. Write to `xp_ledger` (append-only, compute new balance)
  3. Write a `task.completed` event to `events.outbox` in the same transaction
  4. Return the updated task + new XP balance + any new achievements
- `POST /uncomplete` only allowed within 5 minutes of completion (use `completed_at` timestamp check). This supports the "Undo" UX from the design spec.
- The completion endpoint must be idempotent — completing an already-done task returns 200 with the current state, not an error.

**Complexity:** M (the completion transaction is the tricky part)

---

### Module 6 — XP & Gamification (Phase 1) — M

**What:** XP ledger reads, streak computation, achievement checking.

**Endpoints:**
```
GET /api/v1/me/xp                  (summary: total, level, this week, this month, recent entries)
GET /api/v1/me/streaks
GET /api/v1/me/achievements
```

**Implementation notes:**
- XP summary: query `xp_ledger` for totals and recent entries. The `balance_after` column on the latest row IS the current total — no SUM() needed.
- Level computation: pure function — given total XP, return level. Lives in `packages/utils`, tested independently.
- Streak logic: on each `task.completed` event consumed from the outbox, check if `last_activity_date` was yesterday. If yes: increment `current_streak`. If today: no change (already counted). If more than 1 day ago: reset to 1. Update `longest_streak` if needed.
- Achievement checker: a service that receives events and evaluates a rule list. For MVP, 10 hardcoded rules are fine — no dynamic rule engine. Achievement checks run after XP is awarded, in the same request-response cycle for MVP (move to async consumer in Phase 2).

**MVP Achievement Rules (10):**
```
first_task           Complete your first task
first_milestone      Complete your first milestone  
streak_3             3-day streak
streak_7             7-day streak
tasks_10             Complete 10 tasks
tasks_50             Complete 50 tasks
first_journey        Create your first journey
first_evidence       Add your first evidence entry
first_note           Add your first note
journey_complete     Complete an entire journey
```

**Complexity:** M

---

### Module 7 — Notes (Phase 1) — S

**Endpoints:**
```
GET    /api/v1/journeys/:id/notes
POST   /api/v1/journeys/:id/notes
PATCH  /api/v1/notes/:id
DELETE /api/v1/notes/:id
```

**Implementation notes:**
- `content` field: plain text or Markdown. Store raw — do not sanitize on write, sanitize on read.
- Notes are the simplest module in the system. Build it after tasks to give the streak and XP logic a workout.

**Complexity:** S

---

### Module 8 — Evidence (Phase 2) — M

**What:** Manual evidence entries on tasks and journeys.

**Endpoints:**
```
GET    /api/v1/evidence?taskId=&projectId=
POST   /api/v1/evidence
PATCH  /api/v1/evidence/:id
DELETE /api/v1/evidence/:id
```

**Implementation notes:**
- MVP evidence types: `manual` and `external_url` only. The table schema already has columns for GitHub and certificates — just don't expose those types in the API validator yet.
- Adding evidence to a task with `evidence_type = manual` awards +5 bonus XP (write to ledger, emit event).

**Complexity:** M

---

### Module 9 — Public Profile (Phase 2) — S

**Endpoints:**
```
GET   /api/v1/profile/:username      (public, no auth required)
PATCH /api/v1/me/profile
```

**Implementation notes:**
- GET is unauthenticated — make it cacheable (Redis, 5 min TTL)
- Response shape: user info + pinned journeys (with milestone counts, project counts, evidence counts) + achievement showcase + activity summary
- The public profile is read-only. No mutations via this endpoint.

**Complexity:** S

---

### Module 10 — CSV Import (Phase 2) — M

**Endpoint:**
```
POST /api/v1/import/csv
```

**What it imports:** A CSV of tasks with columns: `title`, `milestone`, `priority`, `due_date`, `tags`. Milestone is created if it doesn't exist.

**Implementation notes:**
- Use `papaparse` (Node.js) for CSV parsing
- Validate each row before any writes — return a preview of what will be imported
- Two-step UX: upload → preview (show what will be created) → confirm → execute
- Run all inserts in a single transaction. If any row fails validation, reject the whole import.
- Max 500 rows per import in MVP.

**Complexity:** M

---

### Module 11 — Outbox Worker (Phase 1) — M

**What:** Background process that polls `events.outbox`, processes unpublished events, and dispatches to in-process consumers.

**Implementation notes:**
- In MVP: no external message broker (no Kafka, no Redis Streams). The outbox worker is a NestJS `@Cron` job running every 2 seconds.
- It queries `SELECT * FROM events.outbox WHERE published = FALSE ORDER BY created_at LIMIT 50`
- For each event: dispatch to the registered consumer handler, then mark `published = TRUE`
- Consumer handlers in MVP: `StreakConsumer`, `AchievementConsumer`, `AnalyticsNoopConsumer` (placeholder)
- Wrap each consumer in try/catch — a consumer failure must not un-publish the event. Log failures; dead-letter handling is Phase 2.

**Complexity:** M

---

### API Build Order Summary

```
Week 1–2  (Phase 0):
  [ ] 1. Project scaffold + monorepo
  [ ] 2. Database migrations (Phase 0 set)
  [ ] 3. Auth module (register, login, GitHub OAuth, JWT, refresh)

Week 3–4  (Phase 1 — Core):
  [ ] 4. Journeys CRUD
  [ ] 5. Milestones CRUD
  [ ] 6. Tasks CRUD + completion endpoint
  [ ] 7. Outbox worker (cron-based)
  [ ] 8. XP module (ledger + levels)
  [ ] 9. Streak service
  [ ] 10. Achievement checker

Week 5–6  (Phase 1 — Completion):
  [ ] 11. Notes module
  [ ] 12. Dashboard stats endpoint
  [ ] 13. Activity feed endpoint
  [ ] 14. Journey stats endpoint

Week 7–8  (Phase 2):
  [ ] 15. Evidence module (manual + URL types only)
  [ ] 16. Public profile module
  [ ] 17. CSV import module
  [ ] 18. Database migrations (Phase 2 set + RLS)
  [ ] 19. Redis caching layer (profile + stats endpoints)
  [ ] 20. Rate limiting middleware
```

---

## Part 5 — Frontend Implementation Order

### Guiding Principle

Build screens in the same order a user would encounter them: auth → dashboard → journey → task. Do not build the public profile before the private core exists — there's nothing to show on it yet.

---

### Frontend Phase 0 — Shell (Week 2–3) — S

**What:** Next.js 15 App Router project. Global layout. Auth context. API client. Design tokens (CSS variables from the design spec).

**Deliverables:**
- `app/layout.tsx` with font loading (JetBrains Mono + Inter from Google Fonts)
- CSS variables for the full color palette and spacing system
- `lib/api.ts` — typed fetch wrapper around the API (one function: `apiCall(method, path, body)`)
- Auth context: stores access token in memory, refresh token in HttpOnly cookie, exposes `user` and `isAuthenticated`
- Route protection: middleware that redirects unauthenticated users to `/login`
- `(auth)/login` and `(auth)/register` pages — functional but unstyled is fine at this stage

**AI prompt strategy:** Generate the entire Next.js 15 App Router shell in one prompt, including the auth context and API client. These are patterns Claude knows well.

**Complexity:** S

---

### Frontend Phase 1 — Auth Screens (Week 2–3) — S

**Screens:** `/login`, `/register`

**Design:** Dark background (#0D0F12). Centered card. DevOS wordmark top. Email + password fields (Inter body font). "Continue with GitHub" button. Error states inline beneath fields (not alert banners). No modal, no redirect to external page for GitHub — redirect happens server-side.

**Components:**
- `<AuthCard>` — shared wrapper
- `<FormField>` — label + input + inline error message
- `<GitHubOAuthButton>` — icon + text, full-width

**Complexity:** S

---

### Frontend Phase 2 — Dashboard (Week 4–5) — M

**Screen:** `/(dashboard)/page.tsx`

**Layout:** Sidebar + main content. Sidebar: nav links, XP bar, streak counter. Main: greeting bar, journey cards row, today's focus list, recent activity feed.

**Components to build (in order):**
1. `<Sidebar>` — nav + XP bar + streak (build this first; it's on every screen)
2. `<JourneyCard>` — color accent, title, progress bar, last-active
3. `<TodaysFocus>` — task list with checkboxes, triggers complete API call
4. `<ActivityFeed>` — chronological list of events
5. `<GreetingBar>` — name, streak chip, XP chip

**State management:** React Query (TanStack Query) for all server data. Optimistic updates on task completion (check the box immediately, revert on API error).

**Complexity:** M

---

### Frontend Phase 3 — Journey Screen (Week 5–6) — L

**Screen:** `/(dashboard)/journeys/[id]/page.tsx`

**This is the most complex frontend screen in MVP.** It has tabs, accordion milestones, inline task creation, drag-to-reorder, and the task completion XP animation.

**Build order within this screen:**
1. Journey header (title, status badge, progress bar, XP chip)
2. Tab bar (Milestones / Notes / Stats)
3. Milestone accordion (expand/collapse)
4. Task row within milestone (status, title, XP reward, evidence count)
5. Inline task creation (+ Add task → input row appears, Enter to save)
6. Inline milestone creation
7. Task completion (checkbox → API call → XP float animation)
8. Reorder (drag handles — use `@dnd-kit/core`, the most reliable DnD library for React)
9. Notes tab
10. Stats tab (simple numbers, no charts in MVP)

**XP float animation:** On task complete, render a `+10 XP` element at a fixed position near the checkbox, animate it upward 24px with opacity fade over 600ms using CSS `@keyframes`. No animation library needed.

**Complexity:** L

---

### Frontend Phase 4 — Task Drawer (Week 6–7) — M

**Component:** `<TaskDrawer>` — slides in from the right on desktop, full screen on mobile.

**Build order:**
1. Drawer shell (open/close animation, overlay, close on Esc)
2. Breadcrumb + title
3. Status stepper
4. Priority + due date chips (inline editable)
5. Description (click to edit, Markdown render at rest — use `react-markdown`)
6. Evidence section (list existing, "+ Add evidence" opens picker sheet)
7. Evidence picker sheet (manual entry form only in MVP)
8. Notes micro-editor (textarea, auto-save on blur)
9. "Mark as done" CTA + Undo toast

**Undo toast:** On "Mark as done", show a toast with an Undo button for 5 seconds. Use a `setTimeout` that fires the complete API call after 5 seconds. If Undo is clicked, cancel the timeout and call `uncomplete`.

**Complexity:** M

---

### Frontend Phase 5 — Gamification Screens (Week 7–8) — M

**Screens:**
- `/(dashboard)/achievements/page.tsx` — achievement grid
- `/(dashboard)/xp/page.tsx` — XP history

**Achievement grid:** Map over achievement list, render earned (full color) vs locked (desaturated, "?" icon). Hover tooltip with description and date earned.

**Achievement unlock overlay:** A global component (`<AchievementOverlay>`) rendered at the root layout level. Triggered by an event emitted from the task completion flow. Uses a React portal to render above all other content.

**XP history:** Table of recent XP entries (source, delta, balance, timestamp). Summary stats at top (total, level, this week). Level progress bar.

**Complexity:** M

---

### Frontend Phase 6 — Public Profile (Week 8–9) — M

**Screen:** `/p/[username]/page.tsx`

**This is a Server Component in Next.js 15.** Fetched server-side, fully SEO-friendly. No client state needed.

**Build order:**
1. Profile layout (left rail + main content)
2. Left rail: avatar, name, stats chips, social links
3. Pinned journey cards
4. Achievement showcase (first 5 + expand)
5. Activity graph (GitHub-style heatmap — build as a client component within the server page)

**Activity graph:** A 52-week grid of `<div>` elements, colored by intensity. Data: array of `{ date, count }` from the API. CSS grid layout. Tooltip on hover showing date + activity count.

**Complexity:** M

---

### Frontend Phase 7 — Settings (Week 9) — S

**Screen:** `/(dashboard)/settings/page.tsx`

**Sections:**
- Account (display name, username, avatar upload placeholder)
- Profile (public/private toggle, headline, bio, social links)
- GitHub (connect/disconnect — shows connection status)
- Danger zone (delete account — Phase 2)

**Complexity:** S

---

### Frontend Phase 8 — CSV Import UI (Week 9) — M

**Screen:** `/(dashboard)/import/page.tsx`

**Three-step flow:**
1. Upload CSV (drag-and-drop zone + file input)
2. Preview (table showing what will be created — milestones and tasks grouped)
3. Confirm + progress (shows import running, then success/error summary)

**Complexity:** M

---

### Frontend Build Order Summary

```
Week 2–3  (Phase 0):
  [ ] 1. Next.js shell + design tokens + API client + auth context
  [ ] 2. Login + Register screens

Week 4–5  (Phase 1):
  [ ] 3. Sidebar component
  [ ] 4. Dashboard screen
  [ ] 5. Journey list screen (just the list, not detail yet)

Week 5–6  (Phase 1):
  [ ] 6. Journey detail screen (milestones + tasks tabs)
  [ ] 7. Task Drawer

Week 7  (Phase 1):
  [ ] 8. XP float animation + Level-up overlay
  [ ] 9. Achievement unlock overlay

Week 7–8  (Phase 2):
  [ ] 10. Achievements screen
  [ ] 11. XP history screen

Week 8–9  (Phase 2):
  [ ] 12. Public profile screen
  [ ] 13. Settings screen
  [ ] 14. CSV import screen

Week 10–12  (Phase 3):
  [ ] 15. Mobile responsive pass (all screens)
  [ ] 16. Empty states (all screens)
  [ ] 17. Error boundaries + global error UI
  [ ] 18. Loading states refinement
```

---

## Part 6 — Module Dependencies

Understanding what blocks what prevents wasted work.

```
Auth ──────────────────────────────────────────────────────────────────
  BLOCKS: Everything. Nothing works without auth.

identity.users
  BLOCKS: All other database tables (everything FK → users)

Journey CRUD
  BLOCKS: Milestones, Tasks, Notes, Evidence, XP (journey_id FK)

Milestones CRUD
  BLOCKS: Tasks

Tasks CRUD
  BLOCKS: Task Drawer UI, XP module (xp_reward), Outbox events

Outbox Worker
  BLOCKS: Streak service, Achievement checker
  (they consume events; without the worker, no events are dispatched)

XP Ledger (write path, in task completion)
  BLOCKS: XP history screen, Level display, Achievement rules that check XP

Achievement Definitions (seed data)
  BLOCKS: Achievement checker, Achievement grid UI

Streak Service
  BLOCKS: Streak display on Dashboard and Journey screen

Evidence Module
  BLOCKS: Evidence count badges on tasks, Evidence-linked XP bonus (+5 XP)
  DOES NOT BLOCK: Core task completion or XP

Public Profile API
  BLOCKS: Public profile screen
  REQUIRES: Journeys, XP, Achievements all working

CSV Import
  REQUIRES: Journeys, Milestones, Tasks all working
  BLOCKS: nothing (standalone feature)
```

### Critical Path (Shortest Path to Working Product)

```
Auth → Journeys → Milestones → Tasks → Task Completion → XP Ledger → Dashboard
```

This is 7 modules. Everything else adds value on top of a working loop.

---

## Part 7 — Estimated Complexity by Module

### Backend

| Module | Complexity | Est. Time (AI-assisted) | Notes |
|---|---|---|---|
| Monorepo scaffold | S | 3h | Well-known pattern, AI handles 90% |
| Database migrations (Phase 0) | S | 2h | Mechanical, careful ordering |
| Auth (email + GitHub OAuth + JWT) | L | 2 days | Security-critical, test carefully |
| Journeys CRUD | M | 6h | Standard CRUD + soft delete |
| Milestones CRUD | S | 3h | Similar pattern to Journeys |
| Tasks CRUD + completion | M | 8h | Completion transaction is the hard part |
| Outbox worker (cron) | M | 5h | Pattern is clear; test edge cases |
| XP ledger + level computation | M | 6h | Append-only pattern + level formula |
| Streak service | S | 4h | Date arithmetic, test edge cases |
| Achievement checker | M | 6h | 10 hardcoded rules + idempotency |
| Notes | S | 2h | Simplest module in the system |
| Dashboard stats endpoint | S | 3h | Aggregation queries |
| Activity feed endpoint | S | 3h | Ordered event query |
| Evidence (manual + URL) | M | 5h | Polymorphic table + XP bonus |
| Public profile endpoint | S | 4h | Read-only aggregate + caching |
| CSV import | M | 6h | Parse + preview + transactional insert |
| Rate limiting | S | 2h | NestJS ThrottlerModule |
| RLS policies | M | 4h | Careful testing required |
| **Total backend** | | **~11 days** | |

### Frontend

| Screen / Component | Complexity | Est. Time (AI-assisted) | Notes |
|---|---|---|---|
| Shell + design tokens + API client | S | 4h | |
| Auth screens | S | 3h | |
| Sidebar | S | 3h | Reused on every screen |
| Dashboard | M | 8h | Multiple components |
| Journey detail screen | L | 2 days | Most complex screen |
| Task Drawer | M | 8h | Inline editing, drawer animation |
| XP animations (float + level-up overlay) | M | 5h | CSS keyframes + React portal |
| Achievement overlay + grid | M | 6h | |
| Public profile + activity graph | M | 8h | Heatmap is the hard part |
| Settings | S | 3h | |
| CSV import UI | M | 5h | Three-step flow |
| Mobile responsive pass | L | 2 days | All screens |
| Empty states (all screens) | M | 6h | Many screens to cover |
| Error boundaries + global error UI | S | 3h | |
| **Total frontend** | | **~14 days** | |

### Total Estimated Build Time

```
Backend:          ~11 working days
Frontend:         ~14 working days
Integration/QA:   ~5 working days
Deployment:       ~3 working days
Buffer (20%):     ~7 working days

Total:            ~40 working days (~8 calendar weeks, solo)
```

With AI assistance, the raw implementation time is significantly compressed. The estimate above assumes an experienced developer using Claude or Cursor to generate boilerplate, scaffold modules, write Prisma schemas, and generate component shells. Manual time is spent on: reviewing output, handling edge cases, writing tests for critical paths, and debugging integrations.

---

## Part 8 — What to Postpone

The following features are **designed and architecturally accommodated** (the schema columns exist, the API contracts are defined) but should not be built until after MVP users are active.

### Postpone to Post-MVP (Phase 2 — Month 3+)

**GitHub commit sync**
Reason: Requires OAuth token encryption, a background sync worker, webhook handling, GitHub API rate-limit management, and error recovery logic. Estimated 5–7 days of work. The schema has all the columns. Build it after users have 4 weeks of journey data.

**Recruiter mode + share links**
Reason: Zero value if the learner's portfolio is empty. Build after users have meaningful journey completions. Estimated 3–4 days.

**Certificates as evidence**
Reason: Requires external API integrations (Credly, Coursera) or manual upload + file storage (S3/R2). The `evidence_items` table already has `issuer`, `credential_id`, and `expires_at` columns. Estimated 2–3 days per integration.

**File upload evidence**
Reason: Requires S3/R2 setup, presigned URLs, and file validation. Not worth the operational overhead for MVP.

**Real-time WebSocket notifications**
Reason: Toast notifications via polling (or even just page refresh) are sufficient for MVP. WebSockets add significant complexity (connection management, reconnection, auth over WS). Estimated 3–4 days.

**Reflections**
Reason: Notes covers the journaling use case adequately for MVP. Reflections add a mood field and a prompt system — meaningful but not core to the learning loop.

**Analytics dashboard**
Reason: No users, no analytics. Build this when there's data worth analysing.

**Excel / Markdown import**
Reason: CSV is sufficient for data portability in MVP. Excel and Markdown import are one more surface to maintain.

**Projects screen**
Reason: Projects are a portfolio feature. Build after the learning loop (journeys + tasks) has proven value. The `journey.projects` table can be created but the API and frontend are deferred.

### Postpone to Phase 3 (Month 5+)

**Skill graph**
Requires enough task-tag data to be meaningful (minimum 20–30 tagged tasks). Also requires a force-directed graph library and a non-trivial graph layout engine. Beautiful but not urgent.

**AI Mentor**
Requires the full event history (streaks, task completions, reflection sentiment) to generate useful suggestions. Building it before there's real user data produces useless suggestions.

**Resume generator**
Depends on: public profile complete, multiple journeys with projects, skill graph. All Phase 3 prerequisites.

**Row-Level Security (RLS) on all tables**
Add in Phase 2 pre-launch, not during active development. RLS makes debugging significantly harder during development. Add it in a dedicated hardening sprint before opening to real users.

---

## Part 9 — What to Build First (Antigravity Priority Order)

This is the opinionated answer to "given one developer and a deadline, where do the first 10 days go?"

### Day 1–2: Foundation That Never Gets Rebuilt

Set up the monorepo correctly once. A bad monorepo setup creates friction for the entire project.

- Turborepo with `apps/api`, `apps/web`, `packages/types`, `packages/validators`
- Docker Compose with PostgreSQL 16 and Redis 7
- Prisma connected, health check endpoint returning 200
- Environment config with validation (app refuses to boot with missing env vars)
- GitHub Actions CI: lint + type-check + test on every push
- Deployment target chosen and configured (Railway recommended for solo dev — managed Postgres + Redis, zero-ops, one-click deploys)

**Why first:** Every hour saved on monorepo issues later is an hour on features.

### Day 3–5: Auth (The Unlocking Module)

Nothing else can be built without auth. Do it properly once.

- Email registration + login (Argon2id passwords)
- GitHub OAuth (this doubles as the GitHub connection for later sync)
- JWT access token + refresh token rotation
- `GET /auth/me` endpoint
- Login and register screens (functional, not polished)
- Protected route middleware

**Why first:** Auth is the keystone. Every subsequent module assumes it exists.

### Day 6–8: The Core Loop (Journeys → Tasks → Complete)

The minimum viable product inside the MVP.

- Journeys CRUD (API + frontend list + create)
- Milestones CRUD (API + accordion UI)
- Tasks CRUD + completion endpoint (API)
- Task completion in the UI (checkbox → API call)
- XP ledger write path (award XP on completion)
- Basic XP display in sidebar (number only, no bar yet)

After Day 8, a user can sign up, create a journey, add a task, and complete it. This is the moment DevOS exists as a product.

### Day 9–10: Make the Loop Feel Alive

Without feedback, completing tasks feels hollow.

- XP float animation ("+10 XP" at the checkbox position)
- Streak service (track daily activity)
- Streak display on Dashboard
- 3 core achievements (first_task, first_milestone, streak_3) + unlock overlay
- Basic Dashboard (journey cards + today's focus)

After Day 10, the product has a pulse. Completing tasks feels rewarding. This is the demo-able moment.

---

### Days 11–30: Fill Out the MVP

With the core loop working and rewarding, build the remaining MVP screens in dependency order:

```
Day 11–13    Journey detail screen (full tab bar, inline create, reorder)
Day 14–15    Task Drawer (evidence, notes, status stepper)
Day 16–17    Full achievement system (all 10 + grid screen)
Day 18–19    XP history screen + Level-up overlay
Day 20–21    Notes module (API + UI)
Day 22–23    Evidence module (manual + URL only)
Day 24–25    Public profile (API + screen + activity graph)
Day 26–27    Settings screen + GitHub connect UI
Day 28–29    CSV import (API + three-step UI)
Day 30        Dashboard polish + empty states
```

---

## Part 10 — Full Project Roadmap: Day 1 to Production

### Week 1–2: Foundation + Auth
**Goal:** The app boots, a user can register and log in.

| Day | Task | Deliverable |
|---|---|---|
| 1 | Monorepo setup (Turborepo + NestJS + Next.js) | Both apps boot locally |
| 1 | Docker Compose (PostgreSQL + Redis) | Databases running locally |
| 2 | Phase 0 database migrations | All schemas + tables created |
| 2 | Prisma schema + client generation | Type-safe DB access |
| 2 | GitHub Actions CI pipeline | Lint + typecheck on push |
| 3 | Auth module: email registration + login | POST /auth/register + /login |
| 4 | Auth module: JWT + refresh tokens | Access + refresh token flow |
| 4 | Auth module: session management | identity.sessions table in use |
| 5 | Auth module: GitHub OAuth | /oauth/github + callback |
| 5 | Auth: GET /me endpoint | Returns current user |
| 6 | Frontend: shell + design tokens + API client | CSS vars + typed fetch |
| 6 | Frontend: auth context | useAuth() hook |
| 7 | Frontend: login + register screens | Functional auth UI |
| 7 | Frontend: protected route middleware | Redirect to /login |

**Week 2 checkpoint:** User can register, log in with email or GitHub, and be redirected to the dashboard (which is empty).

---

### Week 3–4: Core Domain Loop
**Goal:** Create a journey, add tasks, complete them, see XP.

| Day | Task | Deliverable |
|---|---|---|
| 8 | Journeys API (CRUD + stats) | Full journeys module |
| 9 | Milestones API (CRUD + reorder) | Full milestones module |
| 10 | Tasks API (CRUD) | Task read/write |
| 11 | Task completion endpoint (transaction + XP write + outbox) | POST /tasks/:id/complete |
| 11 | Outbox worker (cron, in-process) | Events dispatched |
| 12 | XP ledger + level computation | XP awarded on completion |
| 12 | Streak service | Daily streak tracked |
| 13 | Achievement seed data + checker (3 core achievements) | first_task, first_milestone, streak_3 |
| 14 | Frontend: Sidebar (nav + XP bar + streak) | Persistent sidebar |

**Week 4 checkpoint:** Full backend loop is live. Task completion awards XP. Streaks tracked. Sidebar shows XP.

---

### Week 5–6: Frontend Core Screens
**Goal:** The product is usable end-to-end in a browser.

| Day | Task | Deliverable |
|---|---|---|
| 15 | Frontend: Dashboard screen (journey cards + today's focus) | Dashboard live |
| 16 | Frontend: Activity feed (recent events) | Activity feed live |
| 17 | Frontend: Journey detail — header + milestone accordion | Journey screen skeleton |
| 18 | Frontend: Tasks within milestones — task rows + completion | Task completion in UI |
| 18 | Frontend: XP float animation | Visual XP feedback |
| 19 | Frontend: Inline task creation (+ Add task row) | Create tasks without modal |
| 19 | Frontend: Inline milestone creation | Create milestones inline |
| 20 | Frontend: Task Drawer (status, priority, due date) | Task detail drawer |
| 21 | Frontend: Notes tab on Journey | Notes visible per journey |

**Week 6 checkpoint:** A user can navigate the full app in a browser. Create journey → add milestone → add tasks → complete tasks → see XP → see streak. This is the first internal demo milestone.

---

### Week 7–8: Evidence, Achievements, Polish
**Goal:** The product earns trust (evidence) and feels rewarding (full achievement system).

| Day | Task | Deliverable |
|---|---|---|
| 22 | Notes API (CRUD) | Full notes module |
| 22 | Frontend: Notes micro-editor on Task Drawer | Notes on tasks |
| 23 | Evidence API (manual + URL types) | POST/GET/DELETE evidence |
| 23 | Frontend: Evidence section on Task Drawer | Link manual evidence to tasks |
| 24 | Full achievement system: all 10 achievements + checker | Achievement checker complete |
| 24 | Frontend: Achievement unlock overlay | Full-screen achievement modal |
| 25 | Frontend: Achievements grid screen | /achievements |
| 25 | Frontend: XP history screen + Level-up overlay | /xp |
| 26 | Streak service edge cases: grace period logic | Streak resilient to single missed day |
| 26 | Achievement: journey_complete, tasks_50 rules | Remaining achievements |
| 27 | Frontend: Journey detail — Stats tab | Per-journey stats |
| 28 | Frontend: Drag-to-reorder tasks and milestones | @dnd-kit integration |

**Week 8 checkpoint:** The complete gamification system works. All 10 achievements fire. Evidence can be linked. The product is rewarding to use.

---

### Week 9: Public-Facing Features
**Goal:** Users can share their work with the world.

| Day | Task | Deliverable |
|---|---|---|
| 29 | Public profile API (GET /profile/:username, cached) | Public profile endpoint |
| 30 | Activity graph data endpoint (52-week heatmap data) | Heatmap API |
| 30 | Frontend: Public profile screen (server component) | /p/[username] live |
| 31 | Frontend: Activity graph heatmap component | Heatmap visual |
| 31 | Frontend: Settings screen (account + profile + GitHub) | Settings live |
| 32 | CSV import API (parse + preview + execute) | POST /import/csv |
| 33 | Frontend: CSV import three-step UI | Import screen live |

**Week 9 checkpoint:** The public profile exists. Users can share a link. Data can be imported from CSV.

---

### Week 10–12: Hardening and Production
**Goal:** The product is safe, stable, and monitored. Ready for 100 real users.

| Day | Task | Deliverable |
|---|---|---|
| 34 | Rate limiting (all API endpoints) | ThrottlerModule configured |
| 34 | Input sanitization audit (all endpoints) | No unsanitized writes |
| 35 | RLS policies (all user-data tables) | Row-level security active |
| 35 | Error boundary components (all major screens) | Graceful error UI |
| 36 | Empty states (all screens) | No blank screen scenarios |
| 37 | Mobile responsive pass — auth screens + dashboard | Mobile-usable |
| 38 | Mobile responsive pass — journey + task drawer | Mobile-usable |
| 39 | Performance: React Query caching audit | No redundant API calls |
| 39 | Performance: database query audit (EXPLAIN ANALYZE on critical paths) | No N+1 queries |
| 40 | Deployment: Railway production environment | API + web deployed |
| 40 | Deployment: environment variables + secrets configured | Secrets in Railway |
| 41 | Deployment: custom domain + TLS | devos.app live |
| 41 | Monitoring: Sentry error tracking (API + web) | Errors visible |
| 42 | Monitoring: uptime check (BetterUptime or Railway built-in) | Alerts on downtime |
| 43 | Smoke test: full user flow end-to-end on production | Manual QA pass |
| 44 | Beta invite: first 10 users | Real users in the product |

**Week 12 checkpoint: DevOS is live in production.**

---

### Post-Launch Roadmap (Month 3–6)

```
Month 3:
  · GitHub commit sync (evidence from real commits)
  · Recruiter share links
  · Webhook handling (GitHub push events)
  · Certificate evidence (manual upload)

Month 4:
  · Projects screen
  · File upload evidence (S3/R2)
  · Recruiter dashboard
  · Expanded achievement set (25+)

Month 5:
  · Skill graph (Phase 3)
  · Real-time notifications (WebSockets)
  · Analytics dashboard

Month 6:
  · AI Mentor (contextual learning suggestions)
  · Resume generator
  · Journey template marketplace
```

---

## Appendix A — Tooling Decisions for Solo Dev

| Tool | Choice | Why |
|---|---|---|
| Backend framework | NestJS | Module system matches bounded contexts; great AI generation quality |
| ORM | Prisma | Type-safe queries; excellent AI prompt support; migrations are readable |
| Frontend | Next.js 15 App Router | Server Components for public profile SEO; familiar for most devs |
| Data fetching | TanStack Query | Caching, optimistic updates, background refetch out of the box |
| Drag and drop | @dnd-kit/core | More reliable than react-beautiful-dnd (unmaintained) |
| Markdown render | react-markdown | Zero config, safe by default |
| CSV parsing | papaparse | Best-in-class, works in Node and browser |
| Auth library | passport (NestJS) | Battle-tested, extensive strategy ecosystem |
| Password hashing | argon2 (Node.js) | Argon2id is the current gold standard |
| Animation | CSS keyframes + Framer Motion (sparingly) | Framer Motion only for the achievement overlay; avoid for simple transitions |
| Hosting | Railway | Managed Postgres + Redis, preview deployments, GitHub integration, low ops |
| Error tracking | Sentry | Free tier sufficient for early MVP |
| CI/CD | GitHub Actions | Free for public repos; easy to extend |

## Appendix B — AI-Assisted Development Tips

**For NestJS modules:** Prompt: *"Generate a complete NestJS module for [entity] with controller, service, DTOs (create + update + response), and Prisma integration. Include input validation with class-validator, soft delete handling, and cursor-based pagination."* One prompt per module.

**For Prisma schemas:** Prompt: *"Given this PostgreSQL schema [paste schema], generate the Prisma model with all relations and appropriate field types."* Always review the generated relations — AI sometimes gets the cardinality wrong.

**For Next.js screens:** Prompt: *"Generate a Next.js 15 App Router page for [screen name]. Use TanStack Query for data fetching. Components should use CSS variables from the design system. No Tailwind."* Then prompt separately for each complex component.

**For database migrations:** Write migrations by hand based on the schema spec. AI-generated migrations often have subtle ordering errors. This is 30 minutes of careful work that prevents hours of debugging.

**For the XP transaction:** This is the one piece of logic to write yourself (not generate). The atomic write of task completion + XP ledger + outbox event is the heart of the system. Understand it line by line.

**For testing:** Focus test coverage on three areas: the task completion transaction, the streak date arithmetic, and the achievement idempotency check. These three have the most edge cases and the most consequences when wrong.

---

*End of DevOS Technical Build Plan v1.0*
