# DevOS — Source of Truth (SoT) v1.0

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

---

# Core Hierarchy

User
→ Journey
→ Milestone
→ Task
→ Evidence
→ XP
→ Achievement

Supporting systems:

* Projects
* Notes
* Reflections
* Daily Logs
* Public Profiles
* GitHub Connections

---

# Core Entities

## User

Platform account owner.

## Journey

A long-term learning track.

Examples:

* AI Engineering
* Blockchain

## Milestone

A significant learning checkpoint.

Examples:

* Python Fundamentals
* Smart Contracts

## Task

Atomic learning unit.

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
* Dashboard
* Journey CRUD
* Milestone CRUD
* Task CRUD
* Daily Logs
* Notes
* Projects
* XP Ledger
* Streak Engine
* Achievement Engine
* Basic GitHub Connection
* Public Profiles
* CSV Import

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

---

# Non-Negotiable Rules

Do not remove journeys.

Do not reduce DevOS into a task manager.

Do not remove gamification.

Do not remove evidence.

Do not remove public profiles.

Do not generate fake proof-of-work data.

Do not redesign the platform without updating this document.

This document is the authoritative source for all future DevOS decisions.
