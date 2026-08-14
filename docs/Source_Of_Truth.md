# DevOS — Source of Truth (SoT) v1.1

## Purpose

This document is the highest-priority specification for DevOS.

All future architecture, implementation, UX, API, database, and feature decisions must follow this document.

Priority Order:

1. Source of Truth (this document)
2. Master Implementation Plan
3. Architecture Document
4. Product Design Specification
5. Technical Build Plan
6. AI-generated implementation suggestions

If any conflict exists, this document wins.

---

# Version History

* **v1.0 (June 2026):** Initial baseline specification.
* **v1.1 (August 2026):** Architecture reconciliation for **Roadmap Intelligence**. Evolved import model from static CSV task generation to external roadmap reconciliation, current-position determination, progressive task materialization, and continuous learning recalculation.

---

# Product Identity

## Product Name

DevOS (Developer Operating System)

## Product Type

A multi-journey learning operating system.

DevOS is NOT:

* A portfolio website
* A task manager
* An Excel tracker
* A note-taking application

DevOS IS:

* A personal growth operating system
* A learning journey platform
* A proof-of-work system
* A public accountability platform
* A long-term developer progression tracker

---

# Core Mission

Help users:

* Learn consistently
* Track progress
* Build projects
* Maintain streaks
* Earn achievements
* Verify work through evidence
* Showcase growth publicly

The platform should reward consistency over intensity.

---

# Product Philosophy

Every feature must satisfy at least one of:

* Learning
* Motivation
* Accountability
* Verification
* Showcase

If a feature does not support one of these goals, it should not be added.

---

# Core Concept

A user can create unlimited journeys.

Examples:

* AI Engineering
* Blockchain
* Cybersecurity
* Cloud Computing
* Fitness
* Language Learning

The platform must never assume only one journey exists.

## Roadmap Intelligence Concept

DevOS evolves from:
"Import roadmap → generate tasks"
into:
"Understand an external roadmap → reconcile it with the user's existing knowledge and work → determine where the user actually is → continue from that point → continuously update the next learning step."

DevOS should NEVER force a user to restart an imported roadmap from Day 1 when they have already completed or demonstrated part of it.

Primary roadmap source: **roadmap.sh** (structured external roadmap source via source-adapter architecture).
Supported fallback sources: CSV, Markdown, generic documents (PDF/DOCX treated as fallback document ingestion, NOT primary roadmap experience).

### Dynamic Learning Loop
The system must NOT behave like:
Roadmap → Task 1 → Task 2 → Task 3 → Task 4

Instead, the loop continuously adapts:
Roadmap → learner state → current position → appropriate next task → evidence → mastery signal → learner state update → current position recalculation → next task recalculation.

A completed task does not automatically advance the learner to the next concept. The next action may instead be: `LEARN`, `BUILD`, `PRACTICE`, `REVIEW`, `RECALL`, `MASTERY_CHECK`, `REINFORCEMENT`, or `PROJECT`.
Scheduled review/reinforcement tasks verify retention for `MASTERED` concepts over time.
Human Agency: Users can skip/postpone mastery checks or request them if they feel confident.

---

# Core Hierarchy

User
→ Journey
→ RoadmapSnapshot
→ RoadmapNode
→ RoadmapMapping
→ DevOS entities (Milestone / Task / Project / Skill / Evidence)
→ XP
→ Achievement

Supporting systems:

* Projects
* Notes
* Reflections
* Daily Logs
* Public Profiles
* GitHub Connections
* Reconciliation Engine

### Critical Domain Distinction

A **Roadmap Node** is NOT a DevOS **Task**.
* A **Roadmap Node** represents: *"What an external roadmap recommends."*
* A **DevOS Task** represents: *"What this specific user needs to do."*
* A **Roadmap Mapping** connects the external roadmap node to the user's DevOS state.

### Completion ≠ Mastery
A completed task does NOT automatically mean that the learner understands the underlying concept. DevOS distinguishes between:
1. Work completion (task marked done)
2. Evidence of work
3. Concept understanding/mastery
4. Ability to perform independently

The following are NOT equivalent:
"Task completed" ≠ "Evidence exists" ≠ "I understand the concept" ≠ "I can perform independently".

AI-assisted and vibe-coded work is legitimate work. DevOS does not punish AI usage, but AI assistance must not automatically imply mastery. Evidence alone does not automatically prove mastery without an independence signal.

---

# Core Entities

## User

Platform account owner.

## Journey

A long-term learning track.

Examples:

* AI Engineering
* Blockchain

## RoadmapSnapshot

A immutable snapshot representation of an external roadmap version at a specific point in time.

Contains: id, user, source type, source URL, source name, source version/hash, imported timestamp, updated timestamp, metadata.

## RoadmapNode

An individual structural element within an external roadmap snapshot.

Contains: id, snapshot id, external node id, parent node id, title, description, node type (topic, milestone, skill, project, resource, decision, optional topic), sort order, dependencies, resource URLs, metadata.

## RoadmapMapping

The bridge entity connecting an external RoadmapNode with the user's DevOS state.

Contains: id, roadmap node id, user id, journey id, task id (nullable), project id (nullable), skill id (nullable), mapping status (`COMPLETED`, `KNOWN_UNVERIFIED`, `IN_PROGRESS`, `PARTIAL_MATCH`, `NEW`, `AMBIGUOUS`, `SKIPPED`, `USER_CONFIRMED`), confidence score, matching reason, user confirmation flag, timestamps.

## Milestone

A significant learning checkpoint within a Journey.

Examples:

* Python Fundamentals
* Smart Contracts

## Task

Atomic learning unit (what the user actually needs to do).

Examples:

* Learn Variables
* Build REST API

## Project

A completed practical output.

Examples:

* Portfolio Website
* FastAPI Service

Projects provide stronger evidence than tasks.

## Daily Log

Daily journal entry.

Supports:

* Notes
* Reflections
* Challenges
* Wins

Daily logs contribute to streak calculations.

## Evidence

Proof that work happened.

Supported types:

* GitHub Repository
* GitHub Commit
* Certificate
* External URL
* Manual Evidence

Evidence is more valuable than self-reported completion.

## Skill

Knowledge domain.

Examples:

* Python
* FastAPI
* Docker
* PostgreSQL
* Blockchain

Tasks may map to multiple skills.

## Learner Knowledge State
DevOS tracks mastery using distinct conceptual states:
* `UNKNOWN`: No data.
* `SELF_REPORTED`: User claims they know it.
* `ASSESSED`: Lightweight mastery check passed.
* `MASTERED`: Consistent verified independence.
* `NEEDS_REVIEW`: Scheduled for reinforcement.

## Independence Signal
To distinguish AI-assisted work from independent capability, DevOS tracks the independence signal:
* `AI_ASSISTED`: Heavy reliance on AI.
* `GUIDED`: Partial assistance.
* `INDEPENDENT`: Demonstrable standalone capability.

## Mastery Assessment
A lightweight diagnostic tool (3–5 conceptual items: MCQ, debugging, explanation) triggered selectively based on task completion, AI-assistance level, or user report. Users have agency to skip or request checks.

## XP Ledger

Append-only experience history.

XP must never be stored only as a single number.

Every XP change must be traceable.

## Achievement

Gamified reward.

Examples:

* First Task
* 7 Day Streak
* First Project
* Journey Complete

---

# MVP Scope

The MVP includes:

* Authentication
* Dashboard & Today's Focus
* Journey CRUD
* Milestone CRUD
* Task CRUD
* Roadmap Intelligence (roadmap.sh primary structured adapter, CSV/Markdown adapters, document fallback, RoadmapSnapshot/Node/Mapping persistence, Reconciliation Engine, progressive task materialization, Day 2 current position continuation)
* Daily Logs
* Notes
* Projects
* XP Ledger
* Streak Engine
* Achievement Engine
* Basic GitHub Connection
* Public Profiles

---

# MVP Exclusions

The following are NOT part of MVP:

* AI Mentor
* Skill Graph Visualization
* Resume Generator
* Recruiter Dashboard
* Full GitHub Sync
* GitHub Webhooks
* File Upload System
* Mobile Application

---

# GitHub Rules

GitHub is a verification layer.

MVP includes:

* GitHub OAuth
* GitHub username
* Repository list
* Public contribution count

Future versions may include:

* Commit synchronization
* Repository analysis
* Activity intelligence
* Skill extraction

DevOS must never generate fake GitHub activity.

If GitHub is unavailable:

Show disconnected state.

Do not fabricate data.

---

# Gamification Rules

Task Completed:
+10 XP

Evidence Added:
+5 XP

Daily Log:
+5 XP

Milestone Completed:
+50 XP

Project Completed:
+100 XP

Achievements may grant bonus XP.

---

# Streak Rules

Valid streak activity includes:

* Completing tasks
* Creating daily logs
* Completing projects

The streak system should encourage daily consistency.

---

# Public Profiles

Users may expose a public profile.

Public profile should display:

* Journeys
* Progress
* XP
* Current Streak
* Longest Streak
* Achievements
* Projects
* Verified Evidence

Public profiles are read-only.

---

# Future Roadmap

## Phase 2

* Evidence Expansion
* Full GitHub Sync
* Recruiter Mode
* Certificate Management

## Phase 3

* Analytics Dashboard
* Skill Graph
* Monthly Wrapped
* Advanced Progress Insights

## Phase 4

* AI Mentor
* Resume Generator
* AI Recommendations
* Learning Assistant

---

# Design Principles

Design Inspiration:

* GitHub
* Linear
* Notion
* Duolingo
* Steam
* Stripe

Avoid:

* Generic admin dashboards
* Bootstrap-style interfaces
* Enterprise CRM appearance

The platform should feel:

* Modern
* Fast
* Developer-focused
* Motivating
* Minimal

---

# Technical Principles

Architecture must prioritize:

* Simplicity
* Maintainability
* Scalability
* Auditability

Avoid unnecessary complexity.

Every important action should be traceable.

XP must be auditable.

Evidence must be verifiable.

### Deterministic-First Foundation
Core systems (XP, Streaks, Roadmap Graph, Prerequisite logic, Task Status, Review scheduling) are deterministic and rule-based. AI is NOT required for core progress tracking.

### AI Minimization & Graceful Degradation
* **AI Minimization**: AI is used selectively (semantic reconciliation, ambiguous matching, personalized mastery question generation, task adaptation). 
* **Generate Once, Reuse Many**: Concept explanations and mastery question banks are cached and reused to minimize frequent LLM calls.
* **Graceful Degradation**: Core DevOS functionality (authentication, journeys, tasks, XP, profiles, evidence, dashboards) must remain fully functional when AI is unavailable, rate-limited, or latent.

---

# AI Safety & Data Integrity Rules

The reconciliation system may use AI/semantic matching to suggest relationships between external roadmap nodes and user history. However:

* AI must NOT directly fabricate completed tasks, skills, evidence, GitHub activity, or project completions.
* AI must never fabricate mastery/evidence.
* AI confidence scoring is a recommendation mechanism ONLY. Evidence and explicit user confirmation are strictly more authoritative than semantic similarity.
* Critical Invariant: **Importing a roadmap must never destroy, duplicate, or falsely complete existing user progress.**

### Unresolved Design Decisions (Explicitly Deferred)

1. **Confidence Calculation Formula:** Score thresholds (95–100%, 80–94%, 50–79%, <50%) are finalized, but the underlying mathematical, vector embedding, or LLM score calculation function remains an explicitly unresolved design decision.
2. **Missing Prerequisite Handling:** The automated system behavior when a user demonstrates mastery of a later node but lacks evidence for an upstream prerequisite remains an explicitly unresolved design decision.

---

3. **AI Provider/Model Selection:** Provider choice is abstracted away by the AI Gateway and remains unresolved.
4. **Cache Technology:** Implementation-specific caching technology is deferred.
5. **Mastery Representation:** Specific database schema representation for Learner Mastery is conceptually defined but implementation is deferred.

---

# Non-Negotiable Rules

Do not remove journeys.

Do not reduce DevOS into a task manager.

Do not collapse RoadmapNode and Task into the same entity.

Do not force users to restart imported roadmaps from Day 1 when partial progress exists.

Do not remove gamification.

Do not remove evidence.

Do not remove public profiles.

Do not generate fake proof-of-work data.

Do not redesign the platform without updating this document.

This document is the authoritative source for all future DevOS decisions.
