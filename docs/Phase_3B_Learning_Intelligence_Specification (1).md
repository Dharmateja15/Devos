# DevOS — Phase 3B: Learning Intelligence Specification

**Version:** 1.0 (Draft for Review)
**Status:** DESIGN SPECIFICATION — not yet reconciled into the authoritative document set
**Date:** August 2026
**Priority Position:** Below Source of Truth (v1.1), Master Implementation Plan (v1.3), Architecture (v1.1), Product Design Specification (v1.1), and Technical Build Plan (v1.1). This document extends those documents; it does not override them. Any apparent conflict is resolved in favor of the existing five documents unless and until the project owner explicitly re-prioritizes this document during reconciliation.
**Intended Audience:** Project owner (review), then Gemini/Antigravity (reconciliation into the authoritative DevOS document set).

> This document does not modify application source code, run migrations, or alter any of the five existing authoritative documents. It is a standalone design artifact.

---

## 1. Purpose

DevOS already defines Roadmap Intelligence — the system that imports an external roadmap, reconciles it against a user's existing progress, and determines a current position (Source of Truth v1.1, "Roadmap Intelligence Concept"). Roadmap Intelligence answers *where the roadmap says the learner should be*.

Phase 3B defines the layer that sits just beneath that: **Learning Intelligence**. Learning Intelligence answers two related but distinct questions that Roadmap Intelligence alone cannot answer:

1. *What should this learner actually do next*, given not just the roadmap but their demonstrated knowledge, evidence, independence, and freshness?
2. *What has this learner actually demonstrated over time*, independent of any single roadmap or snapshot?

This document specifies the concepts, states, relationships, and behavioral rules needed to answer both questions, while explicitly preserving everything already defined in the Source of Truth, Architecture, Product Design Specification, Technical Build Plan, and Master Implementation Plan.

Nothing in this document introduces new application code, new database migrations, or a replacement for any existing entity. Where this document extends an existing concept (e.g., Learner Knowledge State, Task Type), it says so explicitly and flags the extension as unresolved pending reconciliation (see Section 22 (Design Invariants) and Section 25 (Explicitly Unresolved Decisions)).

---

## 2. DevOS Product Philosophy (Carried Forward)

Phase 3B does not change DevOS's identity. It reinforces it. Per the Source of Truth, DevOS is a personal growth operating system, a learning journey platform, a proof-of-work system, a public accountability platform, and a long-term developer progression tracker — not a portfolio site, task manager, spreadsheet, or note-taking app.

Learning Intelligence exists to serve the five product pillars already established: **Learning, Motivation, Accountability, Verification, Showcase.** A Learning Intelligence feature that does not serve at least one of these pillars should not be built, regardless of how technically interesting it is.

Four ordering principles govern every decision in this document:

- **Evidence > Claims**
- **Quality > Quantity**
- **History > Snapshots**
- **User Autonomy > Rigid Curriculum**

---

## 3. Learning Intelligence vs. Capability Record

DevOS has two connected but distinct purposes that must not be conflated in implementation:

| | Learning Intelligence | Capability Record |
|---|---|---|
| Question answered | "What should I learn or do next?" | "What have I actually demonstrated over time?" |
| Time orientation | Forward-looking, adaptive | Backward-looking, cumulative |
| Volatility | Recalculates frequently as state changes | Append-only; historically stable |
| Primary consumer | The learner, in-session (Today's Focus, dynamic task selection) | The learner over years, and eventually public/recruiter views |
| Failure mode to avoid | Rigid curriculum, ignoring learner autonomy | Distorted or overwritten history |

Both draw on the **same underlying evidence and state**, but they must expose it through different lenses. The Learning Intelligence engine (task recommendation, mastery checks, adaptive loop) must never rewrite or delete history that the Capability Record depends on. A recommendation engine recalculates *what to suggest*; it must never retroactively edit *what happened*.

**Capability Record is a conceptual read/presentation model over DevOS's existing historical data — not a new entity, table, bounded context, or source of truth.** It is not persisted separately and it does not duplicate history. Its underlying truth comes entirely from existing/approved data: Tasks, Evidence, Independence Signals, Learner Knowledge State, Projects, GitHub-related evidence, Achievements, and XP/history where relevant. "Capability Record" names a *way of reading and presenting* that data — a trustworthy, long-term view of demonstrated capability — not a new place where data lives.

This distinction extends the Architecture document's existing **Learning Intelligence Context** (owns the adaptive loop, mastery assessment, AI Gateway) by clarifying its boundary against this read-oriented lens, which eventually feeds Public Profiles and (post-MVP) recruiter views. The Capability Record does **not** introduce a new bounded context, does **not** require a new database entity or `CapabilityRecord` table, and must never become a competing source of truth alongside the data it projects from. The eventual Public Profile and recruiter-facing views should be built by *projecting* from existing Task/Evidence/Independence/Achievement/XP data, not by maintaining a separate capability database.

---

## 4. User Autonomy (Non-Negotiable)

This principle is already implied throughout the Source of Truth ("Human Agency: Users can skip/postpone mastery checks or request them if they feel confident") and the Product Design Specification's Adaptive Learning & Mastery Flows. Phase 3B makes it an explicit, load-bearing design rule:

**DevOS recommendations are guidance, not gates.**

The learner must always be able to:

- Follow a recommended task, or choose a different one for the same concept
- Jump to any roadmap module, node, or concept
- Skip, defer, or schedule any topic
- Return to a previously skipped or deferred topic
- Choose which learning activity to perform (learn, build, practice, review, recall, mastery check, reinforcement, project)
- Choose how much verification they want, including none
- Decline a mastery check entirely and simply continue

A prerequisite or concept relationship (Section 8) may **inform** a recommendation or explain *why* something is suggested first. It must **never** block navigation or access. This is stated as Design Invariant #8 and #17 in Section 22, and it is the single most important behavioral constraint in this specification — every other section is written to be consistent with it.

---

## 5. Roadmap Node + Concept Model

The existing Architecture and Source of Truth already establish the critical distinction: a **RoadmapNode** is *"what an external roadmap recommends,"* and a **Task** is *"what this specific user needs to do."* Phase 3B introduces one additional layer between them: the **Concept**.

```
RoadmapNode ("Docker")
 ├── Concept: Containers
 ├── Concept: Images
 ├── Concept: Dockerfiles
 ├── Concept: Volumes
 ├── Concept: Networking
 └── Concept: Compose
```

- A **RoadmapNode** remains exactly as defined in the Architecture document — a structural element of an imported external roadmap snapshot.
- A **Concept** represents an individual unit of knowledge that may exist *within* a RoadmapNode, independent of any particular roadmap, and reusable across roadmaps and journeys.
- A RoadmapNode may map to one or many Concepts. A Concept may be referenced by many RoadmapNodes across different roadmaps (this is what canonical concept identity, Section 7, exists to support).

**Critical clarification:** the RoadmapNode is *not* the complete learner knowledge unit. Learner state (Section 9) may exist at the Concept level (primary, more granular) or be aggregated up to the RoadmapNode level (secondary, for roadmap-level views such as progress bars and reconciliation summaries). This does not change the existing Task or RoadmapMapping entities — a Task can still map to a RoadmapNode via RoadmapMapping exactly as today; Concepts are an additional, optional layer of granularity underneath that relationship, primarily used by the Learning Intelligence engine rather than the Roadmap Intelligence reconciliation engine.

---

## 6. Progressive Concept Materialization

Consistent with the Source of Truth's existing "progressive task materialization" principle, Concepts must **not** be fully generated at roadmap import time. Roadmap import remains lightweight, exactly as already specified.

**Materialization priority order:**

1. Reuse existing DevOS concepts already in the system
2. Use explicit roadmap metadata, when the source adapter provides structured sub-topics
3. Apply deterministic extraction/normalization (e.g., heading structure, known keyword lists)
4. Match against canonical concepts/aliases (Section 7)
5. Fall back to AI decomposition only when the above are insufficient

Once materialized, a Concept is persisted and reused — never silently regenerated. This follows the same **Generate Once → Store → Reuse Many** rule the Source of Truth already applies to mastery question banks and explanations, extended here to concept decomposition itself.

Concept materialization must be non-blocking: a learner must be able to navigate a roadmap node before its full concept breakdown exists. Materialization can happen lazily, on first meaningful interaction with that node (e.g., when the learner opens it or a task under it), not eagerly at import.

---

## 7. Canonical Concept Identity

Because roadmaps from different sources describe the same underlying knowledge with different words ("JWT Authentication" vs. "JWT Auth" vs. "JSON Web Token Authentication"), Phase 3B introduces cautious canonical concept matching.

**Matching priority order:**

1. Exact canonical identity (already-linked concept ID)
2. Normalized name match (case/whitespace/punctuation-insensitive)
3. Known alias or synonym
4. Structured metadata match (e.g., shared external taxonomy ID, if a source provides one)
5. Semantic/AI matching — last resort only

**Governing rule, directly inherited from the existing Reconciliation Engine's confidence philosophy:** *ambiguous matches must never automatically merge.* When uncertain, DevOS preserves separate Concept records rather than risk corrupting learner knowledge state by merging two concepts that are not actually the same.

The original roadmap wording is always retained — as a source label, alias, or attribution — even when a Concept is matched to a canonical identity. This preserves historical/source context per Section 22, Invariant #16.

This is a **distinct confidence model** from the Roadmap Intelligence Reconciliation Engine's node-to-user-state confidence thresholds (95–100% / 80–94% / 50–79% / <50%, defined in the Architecture document). Canonical concept matching answers *"are these two concept labels the same underlying concept?"* — a different question from *"has this user already completed this roadmap node?"* The two confidence systems must not be implemented as the same mechanism, though both follow the same underlying philosophy: semantic similarity is a recommendation, never proof.

---

## 8. Concept Relationships

Concepts may be connected by advisory relationships. Types include:

| Relationship | Meaning |
|---|---|
| `PREREQUISITE` | Probably useful to know first |
| `RELATED` | Adjacent, non-sequential connection |
| `BUILDS_ON` | Natural extension of another concept |
| `PART_OF` | Sub-concept of a broader concept |
| `ALTERNATIVE` | Different approach to a similar goal |

Each relationship carries a confidence/strength value, e.g.:

```
REST → FastAPI
relationship = PREREQUISITE
confidence = 0.72
```

This means *"REST is probably useful before FastAPI,"* not *"REST must be completed before FastAPI."* Per Section 4, relationships may shape recommendation ordering and may prompt DevOS to explain a suggested bridge concept — they must never lock access to a concept, task, or roadmap node. This directly extends Design Invariant #8 (Section 22): prerequisite relationship ≠ hard gate.

---

## 9. Learner Knowledge State

The existing Source of Truth and Architecture documents define a five-value Learner Knowledge State enum, and it **remains unchanged and authoritative**:

```
UNKNOWN → SELF_REPORTED → ASSESSED → MASTERED → NEEDS_REVIEW
```

This enum is preserved verbatim as the primary Knowledge State. Phase 3B does **not** replace it, and does not introduce any additional learner-state enum. Instead, Phase 3B adds the principle that DevOS uses a **multidimensional learner model**: the five-value state above sits alongside several independent supporting dimensions, conceptually:

```
Concept
  ├── Knowledge State        (the existing five-value enum — primary)
  ├── Evidence                (Section 10)
  ├── Independence             (Section 11)
  ├── Freshness                (Section 12)
  ├── Verification              (mastery checks, Section 13)
  └── Confidence/context, where appropriate (e.g., canonical-match confidence, Section 7)
```

**These dimensions must not be collapsed into one giant numerical score during MVP.** They stay as separate, independently-readable facts. For example, the following is a valid and expected combination:

```
Knowledge State = MASTERED
Independence    = AI_ASSISTED
Freshness       = STALE
```

`MASTERED` therefore describes the learner's demonstrated knowledge state within DevOS's evidence model — strong evidence of demonstrated understanding — not a claim of permanent, objective expertise. No single dimension alone determines the learner's overall standing on a concept; each is read independently by the recommendation logic and by any presentation layer (see Section 3).

---

## 10. Evidence Model

Building on the existing Evidence entity (GitHub Repository, GitHub Commit, Certificate, External URL, Manual Evidence), Phase 3B adds a **simple, non-final weighting model** reflecting that not all evidence proves the same thing with the same strength:

| Evidence type | Initial strength (guidance only) |
|---|---|
| Self-report | Very weak |
| Task completion (no evidence attached) | Low |
| Manual evidence | Moderate |
| External evidence (URL, linked artifact) | Moderate |
| Traditional quiz | Moderate–strong |
| Explanation | Strong |
| Scenario/reasoning | Strong |
| Independent practical task | Very strong |
| Transfer task (applying a concept in a new context) | Very strong |

These are **qualitative guidance categories for MVP, not numerical coefficients.** Phase 3B deliberately does **not** assign values such as `0.13`, `0.27`, `0.42`, etc. to these categories, does not define a mathematical mastery score, and does not introduce machine-learning or statistical knowledge tracing. No `evidence_weight` column is added to the existing Evidence entity — the Architecture document's `evidence.evidence_items` schema is unchanged.

For MVP, Learning Intelligence combines evidence, independence, freshness, verification, consistency, and relevance through **simple, understandable, deterministic rules** (e.g., ordinal comparisons and threshold checks against the qualitative categories above), not a weighted formula. Evidence strength should be read as modulated by independence (Section 11), freshness (Section 12), consistency (repeated demonstration), and relevance (does the evidence actually touch the concept, or just something adjacent) — but "modulated" here means the deterministic rules consider these factors qualitatively, not that they are combined into one score. The exact numerical/statistical weighting formula, if one is ever introduced, remains explicitly unresolved and deferred to a future version — see Section 25.

This model is additive to the existing Evidence entity; it does not change the Evidence schema's stored fields (evidence_type, verified, metadata, etc., as defined in the Architecture document). Weighting is a Learning Intelligence Context concern applied on top of stored Evidence, not a new persisted column set defined by this document.

---

## 11. Independence Model

Directly inherited from the Source of Truth and Product Design Specification, unchanged:

- `AI_ASSISTED` — heavy reliance on AI
- `GUIDED` — partial assistance
- `INDEPENDENT` — demonstrable standalone capability

AI-assisted work is legitimate work and must never be treated as invalid (Source of Truth, "AI Safety & Data Integrity Rules"; this is reinforced, not altered, here). The added nuance in Phase 3B: `AI_ASSISTED` completion alone should not, by itself, establish strong independent mastery — but it also is not a penalty. It simply means the Independence dimension of the concept's state stays lower until a later independent demonstration (an independent task, explanation, or scenario) strengthens it. This is consistent with the Product Design Specification's existing flow: selecting `AI_ASSISTED` on completion keeps the knowledge state as `NEEDS_REVIEW` and schedules a future Reinforcement task.

---

## 12. Freshness

Freshness is a **dimension independent from knowledge state**, not a replacement for it. Time passing must never automatically demote a concept from `MASTERED` to a lower knowledge state. Instead:

```
Knowledge:   MASTERED
Freshness:   STALE
```

is a valid, meaningful combined state meaning *"previously demonstrated strong knowledge, not recently exercised."* This should generally trigger a lightweight recall/review/reinforcement suggestion — never forced relearning from scratch. Freshness calculation should be deterministic in the MVP (e.g., a fixed staleness window per concept or evidence type); adaptive/statistical freshness models are an explicit future extension (Section 24), not required now. This directly supports Design Invariant #9: stale ≠ forgotten.

---

## 13. Mastery Checks

Mastery checks remain exactly as scoped in the Source of Truth and Product Design Specification: lightweight, selective, 3–5 conceptual items (MCQ, debugging, explanation), triggered selectively — never mandatory, never blocking.

Phase 3B adds two operational rules not previously specified. These rules govern **Mastery Check Activity Modes** — a concept distinct from Task Type, defined precisely in Section 14.

**Mandatory starting mode:** When a learner explicitly enters a mastery-check flow, `TRADITIONAL_QUIZ` is the mandatory starting mode. From there, the learner may choose to add any of the four remaining modes — `EXPLANATION`, `DEBUGGING`, `SCENARIO`, `TRANSFER` — in any combination: zero additional modes, one, several, or all four. DevOS must never force all five modes on every check.

**Attempt limit:** A mastery-check flow uses a **maximum of three attempts**, not more. After three attempts, or at any point the learner feels the check isn't worth continuing, the learner must be able to skip the check, continue learning, defer the concept, or schedule it for later review. DevOS must never trap a learner in a repeating mastery-check loop. This is a new, specific operational constraint that extends (does not conflict with) the existing "Mastery Assessment" definition in the Source of Truth, which specified the diagnostic format but not an attempt ceiling.

Passing a check strengthens the Knowledge and Verification dimensions (state moves toward `MASTERED`/`ASSESSED`, consistent with the existing enum). Failing is never punitive — it queues a `REVIEW` or `PRACTICE` task, exactly as already specified in the Product Design Specification.

---

## 14. Dynamic Task Selection: Task Type vs. Mastery Check Activity Mode

The existing Source of Truth already establishes that a completed task does not automatically advance the learner, and that the next action may be one of a single, high-level **Task Type** enum. That enum **remains unchanged and authoritative, and there is only one Task Type enum in DevOS**:

```
LEARN | BUILD | PRACTICE | REVIEW | RECALL | MASTERY_CHECK | REINFORCEMENT | PROJECT
```

A separate, previously-floated nine-value list is **not** a second Task Type enum. It is resolved here as follows: five of those values — `TRADITIONAL_QUIZ`, `EXPLANATION`, `DEBUGGING`, `SCENARIO`, `TRANSFER` — are **Mastery Check Activity Modes**, i.e. sub-options available only *within* a task whose Task Type is `MASTERY_CHECK`. They are not standalone Task Types and never appear as a task's top-level type. The relationship is strictly hierarchical:

```
Task Type:
    MASTERY_CHECK

  Mastery Check Activity Modes (Section 13):
      TRADITIONAL_QUIZ   (mandatory starting mode)
      EXPLANATION
      DEBUGGING
      SCENARIO
      TRANSFER
```

(`PRACTICE`, `REVIEW`, and `REINFORCEMENT` from the earlier nine-value list are already covered by the existing Task Type enum and do not need a separate mode concept; `IMPLEMENTATION` maps naturally onto the existing `BUILD` Task Type and is not introduced as new vocabulary.)

This resolves the ambiguity that existed in the previous draft: DevOS has **exactly one** Task Type enum (the Source of Truth's eight values), and mastery verification detail lives one level below it, as Activity Modes, governed by the rules in Section 13 (`TRADITIONAL_QUIZ` mandatory first, remaining modes optional and learner-chosen, three-attempt ceiling, always skippable). Task selection itself remains adaptive, driven by the learner's multidimensional state (Section 9), not a fixed linear sequence through roadmap nodes.

---

## 15. Skip / Defer / Schedule

`SKIP`, `DEFER`, and `SCHEDULE` are **learner actions/intents and adaptive scheduling states layered over existing learning entities** — they are not a new persisted status enum and they do not replace the existing Task lifecycle. The Architecture document's `journey.tasks.status` column (`todo`, `in_progress`, `done`, `skipped`) remains exactly as defined and is not altered by this document.

Conceptually, a skip/defer/schedule action sits *alongside* a task's existing status, as adaptive metadata the Learning Intelligence engine uses to decide what to recommend next — not as a replacement value for `status` itself:

```
Task:
    status = TODO                       (existing, unchanged Task.status)

Learner action:
    DEFER

Scheduling metadata:
    scheduled_for = <future date/time>

Later:
    task becomes eligible for recommendation again
```

- **Skipping** must never destroy history and must never be interpreted as a lack of ability. A skipped topic remains revisitable, and the existing `skipped` value already available on `Task.status` can represent it directly — no new status value is required for a Task.
- **Deferring** is not failure. It simply means "not now," expressed as scheduling metadata (e.g., a `scheduled_for` timestamp) rather than a status change.
- **Scheduling** means the learner wants DevOS to resurface the topic at a later time; it is the same adaptive-scheduling mechanism as deferring, applied intentionally rather than reactively.

These actions must always: preserve history, preserve evidence, never erase progress, never permanently block the concept, and allow the learner to return later. They also reaffirm the fundamental autonomy rule from Section 4: the learner can navigate directly to any available roadmap node, module, concept, or task regardless of recommendation order, and prerequisite relationships (Section 8) may influence recommendations but never become hard access gates.

This operationalizes Design Invariants #10 and #11 (Section 22) and is a direct extension of the Source of Truth's "Human Agency" principle. **No universal replacement status enum (e.g., a single `ACTIVE | SKIPPED | DEFERRED | SCHEDULED | COMPLETED` field on Task) is introduced by this document** — skip/defer/schedule are conceptual learner intent and scheduling metadata only.

---

## 16. Review and Reinforcement

`MASTERED` does not mean "never revisit." When freshness becomes stale (Section 12) or confidence weakens, DevOS may recommend a quick recall, short quiz, small practical task, reinforcement, or transfer task — scaled to the smallest intervention that re-establishes confidence. Phase 3B explicitly does **not** require building a full spaced-repetition platform for MVP; a simple deterministic schedule (e.g., "resurface N weeks after last independent demonstration") is sufficient and can evolve later (Section 24).

---

## 17. AI Gateway

Unchanged from the existing Architecture document: AI sits behind an **AI Gateway** abstraction that decouples Learning Intelligence logic from any specific provider (Groq, Hugging Face, Gemini, or others). Provider selection remains an explicitly unresolved decision (Section 25). The Learning Intelligence Context is the sole owner of this abstraction, as already specified.

---

## 18. AI Minimization and Cost Strategy

Core systems remain deterministic-first, exactly as the Source of Truth mandates: XP, streaks, roadmap graph, prerequisite logic, task status, and review scheduling all operate without any AI dependency. AI is used selectively, for:

- Concept decomposition when deterministic extraction is insufficient (Section 6)
- Semantic reconciliation and canonical concept matching, as a last resort (Section 7)
- Mastery question generation
- Explanations/debriefs
- Task adaptation where deterministic rules are insufficient

**Generate Once → Reuse Many** governs all AI-generated content: concept explanations and mastery question banks are persisted and reused, and only regenerated when content is missing, invalid, materially outdated, or explicitly refreshed by the learner. This is essential given the project is architected around free-tier/rate-limited AI APIs (per the Master Implementation Plan and Technical Build Plan). The system must remain fully useful with zero AI budget.

Explicitly avoided at all times: generating entire roadmaps or concept graphs with AI upfront, regenerating identical content, calling an LLM for anything deterministic, or making an LLM part of critical navigation.

---

## 19. Public / Private / Recruiter Views

DevOS maintains **one underlying technical history** and exposes controlled, non-exaggerating views over it:

| View | Shows |
|---|---|
| **Private** | Failed mastery checks, weak concepts, personal notes, deferred topics, internal learner-state detail, private reflections, AI-assistance history where relevant |
| **Public** | Demonstrated capabilities, selected projects, selected evidence, GitHub work, learning timeline, selected achievements, concepts/technologies learned, continuous history |
| **Recruiter/Share** (post-MVP, per existing Phase 2 roadmap) | User-selected capabilities, role-specific evidence, selected projects, relevant GitHub work, evidence-backed capability summaries |

**Hard constraint:** no view may ever claim more than the underlying evidence supports (Design Invariant #15, Section 22). This governs the Capability Record (Section 3) specifically — Learning Intelligence's internal recommendation state (e.g., a tentative `SELF_REPORTED` claim) must not leak into a public-facing claim of mastery.

This section describes view *principles* only. It does not change the existing Public Profile entity or its MVP scope (already defined as read-only, showing journeys/progress/XP/streaks/achievements/projects/verified evidence in the Source of Truth). Recruiter views remain explicitly out of MVP scope, unchanged from the existing Future Roadmap (Phase 2).

---

## 20. Longitudinal Capability Record

DevOS must preserve historical evolution over years, not just current snapshot state. The intended long-term shape (illustrative, not a commitment to specific features):

```
Year 1: Started learning fundamentals (e.g., Python, ML, Security)
Year 2: Built backend/cloud/security projects
Year 3: Developed deeper specialization
Year 4: Demonstrated advanced capabilities
```

The purpose is never to maximize activity counts. It is to demonstrate continuous learning, real work, demonstrated capability, and long-term growth — quality of evidence over quantity of activity (Design Invariant #14). This principle should inform how the eventual Analytics Dashboard and Skill Graph (already scoped for Phase 3, per the Source of Truth's Future Roadmap) are designed when they are built — it does not add new scope to Phase 3B itself.

---

## 21. Portfolio Evolution

The conceptual long-term flow from raw learning activity to professional signal:

```
Concept → Task → Evidence → Independent Demonstration → Project → Capability → Public Profile → Role-Specific Recruiter View
```

**Explicitly out of scope for Phase 3B:** resume generation and advanced career intelligence, both already listed under Phase 4 in the Source of Truth's Future Roadmap. Phase 3B's job is to make the underlying data trustworthy (evidence-backed, independence-aware, non-fabricated) so that career automation, if built later, has something honest to stand on.

---

## 22. Design Invariants

The following invariants apply to all future Learning Intelligence design and implementation work. Items 1–13 and 15 are carried forward directly from the Source of Truth's existing AI Safety & Data Integrity Rules and Non-Negotiable Rules; items 14, 16, and 17 are made explicit here for the first time as direct extensions of that same philosophy.

1. Completion ≠ Mastery
2. Evidence ≠ Mastery
3. AI-assisted work ≠ invalid work
4. AI-assisted work ≠ automatic independent mastery
5. RoadmapNode ≠ Task
6. Concept ≠ RoadmapNode
7. Semantic similarity ≠ proof
8. Prerequisite relationship ≠ hard gate
9. Stale ≠ forgotten
10. Skip ≠ failure
11. Defer ≠ failure
12. Self-report ≠ strong proof
13. AI availability ≠ system availability
14. Quantity of activity ≠ quality of capability
15. Public claim ≤ underlying evidence
16. Historical evidence must not be destroyed by later roadmap changes
17. User autonomy must not be replaced by algorithmic control

---

## 23. MVP Boundary

Phase 3B's MVP surface must remain implementable by a solo, AI-assisted developer, consistent with the Master Implementation Plan and Technical Build Plan. In scope for MVP-level complexity:

- Understandable, finite states (the existing five-value Learner Knowledge State enum, plus Independence and Freshness as separate simple dimensions)
- Deterministic rules for freshness, scheduling, and status transitions
- A simple, non-mathematical evidence weighting hierarchy (Section 10)
- Lightweight mastery checks with a three-attempt ceiling
- Progressive concept materialization (lazy, cached)
- Simple confidence values on concept relationships (a stored float, not a trained model)
- The existing AI Gateway abstraction and Generate-Once-Reuse-Many caching

Not required for MVP (see Section 24 for the fuller future list): concept-graph visualization, advanced statistical mastery scoring, spaced-repetition scheduling beyond a simple deterministic window, and any recruiter/career-automation surface.

---

## 24. Future Extensions

Explicitly deferred beyond Phase 3B, to be revisited only when the MVP foundation is stable:

- Advanced knowledge tracing (e.g., Bayesian knowledge tracing or similar statistical models)
- Sophisticated statistical/ML scoring models replacing the simple weighted evidence hierarchy
- Full semantic concept graphs
- Advanced spaced-repetition scheduling
- Richer career intelligence and role-matching
- Automated resume generation
- Advanced recruiter analytics

---

## 25. Explicitly Unresolved Decisions

The following are intentionally **not** decided by this document, consistent with the Source of Truth's existing "Unresolved Design Decisions" section, which this list extends rather than replaces:

- Exact roadmap-reconciliation confidence calculation formula (carried over, still unresolved)
- Exact canonical-concept-matching confidence calculation formula (new to Phase 3B, same category of decision)
- Exact mastery scoring/evidence-weighting formula, if one is ever introduced (Section 10's table is qualitative guidance only, not a formula, and no numerical coefficients are defined by this document)
- Exact database schema representation for multidimensional Learner State, Concepts, and Concept Relationships
- Exact AI provider/model selection
- Exact caching technology for the AI Gateway
- Exact missing-prerequisite handling behavior (carried over, still unresolved)

---

## 26. Implementation Guidance for Later Reconciliation

When this document is reconciled into the authoritative set (by the project owner and/or Gemini/Antigravity), the following order of operations is recommended:

1. Implement Task Type and Mastery Check Activity Mode as described in Section 14 — a single Task Type enum (unchanged from the Source of Truth) plus a separate, subordinate Activity Mode concept used only within `MASTERY_CHECK` tasks. Do not introduce a second Task Type enum during implementation.
2. Decide whether Concept and ConceptRelationship become first-class schema tables now or remain a conceptual/JSONB-backed model for MVP, consistent with the Architecture document's existing convention of deferring uncertain schema shapes (it already defers exact Learner Mastery representation).
3. Confirm that the existing five-value Learner Knowledge State enum is retained verbatim, and that "multidimensional state" (Section 9) is implemented as *additional* fields/tables alongside it, not a replacement enum.
4. Extend, rather than duplicate, the Reconciliation Engine's confidence-threshold pattern when implementing canonical concept matching (Section 7), to keep the two confidence systems architecturally consistent even though they answer different questions.
5. Treat this document's Section 22 (Design Invariants) as acceptance-criteria language suitable for direct use in test names or code review checklists.

---

## Potential Documentation Conflicts

This section is updated following the five approved design decisions incorporated in this revision. Two conflicts flagged in the prior draft are now resolved; the remaining items are genuine schema gaps that stay open pending future reconciliation, not contradictions.

1. **Learner Knowledge State — RESOLVED.** An earlier draft of this document considered whether "multidimensional state" implied a different state list. It is now explicitly settled: the Source of Truth's and Architecture document's existing five-value enum (`UNKNOWN`, `SELF_REPORTED`, `ASSESSED`, `MASTERED`, `NEEDS_REVIEW`) is the sole, unchanged, authoritative Knowledge State (Section 9). "Multidimensional" refers only to independent supporting dimensions (Evidence, Independence, Freshness, Verification, Confidence/context) tracked *alongside* this enum, never combined into a replacement enum or a single collapsed score. No further sign-off is needed on this point.

2. **Task Type vs. Mastery Check Activity Mode — RESOLVED.** DevOS has exactly one Task Type enum, unchanged from the Source of Truth (`LEARN`, `BUILD`, `PRACTICE`, `REVIEW`, `RECALL`, `MASTERY_CHECK`, `REINFORCEMENT`, `PROJECT`). The previously-floated `TRADITIONAL_QUIZ` / `EXPLANATION` / `DEBUGGING` / `SCENARIO` / `TRANSFER` list is not a second Task Type enum — it is the set of **Mastery Check Activity Modes**, available only within a `MASTERY_CHECK` task, with `TRADITIONAL_QUIZ` mandatory as the starting mode and the rest optional (Section 14). This is now settled and requires no further reconciliation.

3. **New Concept entity is not yet reflected in the persisted schema.** The Architecture document's Core Hierarchy and PostgreSQL schema (`journey` schema) do not currently include a `Concept` or `ConceptRelationship` table. This document introduces both conceptually (Sections 5, 7, 8) but does not add SQL, per the explicit constraint against modifying existing documents or inventing unresolved implementation details. This is an intentional gap, not an oversight — it is listed in Section 25 as unresolved and in Section 26 as a required reconciliation step.

4. **Evidence weighting remains intentionally unscored in the existing Evidence schema.** The Architecture document's `evidence.evidence_items` table has no weight/strength column, and this document does not propose one. Section 10's weighting table is a qualitative guidance ordering only — no numerical coefficients, no scoring formula, no ML/statistical model — applied at read/recommendation time by the Learning Intelligence Context, never persisted as a new column. If a persisted weighting field is ever wanted, that would be a future schema change requiring its own reconciliation; it is not implied or started here.

5. **Capability Record is confirmed to introduce no new entity.** This document does not propose a `CapabilityRecord` table, schema, or bounded context (Section 3). It is a read/presentation model over existing Task, Evidence, Independence, Learner Knowledge State, Project, GitHub-evidence, Achievement, and XP data. No conflict with the Architecture document's existing schema exists here, and none is introduced.

6. **No conflict found** between this document and the Product Design Specification's existing Adaptive Learning & Mastery Flows (Section 4 of that document) or the Technical Build Plan's Module 13 scope — both were used as direct source material and are consistent with everything in this document, including the three-attempt mastery-check ceiling, which extends but does not contradict either.

---

# PHASE 3B SPECIFICATION REVISION REPORT

**A. Files modified**
`docs/Phase_3B_Learning_Intelligence_Specification.md` — the only file touched. No other file was created, renamed, or deleted.

**B. Decisions incorporated**
1. **Capability Record clarified as a read/presentation model, not an entity** (Section 3): explicitly not a bounded context, not a mandatory table, not a new source of truth, and not a duplicate of history. It projects from existing Task, Evidence, Independence, Learner Knowledge State, Project, GitHub-evidence, Achievement, and XP data.
2. **Learner State keeps the five existing states** (Section 9): the five-value enum is confirmed as the sole, unchanged Knowledge State; "multidimensional" now explicitly means separate, non-collapsed supporting dimensions (Evidence, Independence, Freshness, Verification, Confidence/context), with the `MASTERED` + `AI_ASSISTED` + `STALE` example retained as an illustration of independence between dimensions.
3. **Task Type vs. Mastery Activity Mode resolved** (Section 14, cross-referenced from Section 13): one Task Type enum only (unchanged, eight values from the Source of Truth); `TRADITIONAL_QUIZ`, `EXPLANATION`, `DEBUGGING`, `SCENARIO`, `TRANSFER` are now explicitly Mastery Check Activity Modes nested under the `MASTERY_CHECK` Task Type, not a second enum. `TRADITIONAL_QUIZ` remains the mandatory starting mode; the rest are optional in any combination; the three-attempt ceiling and always-skippable rule are unchanged.
4. **Skip/Defer/Schedule clarified as learner intent, not a status enum** (Section 15): rewritten to state plainly that these are actions/adaptive-scheduling metadata layered over the existing, unchanged `journey.tasks.status` column, not a replacement `ACTIVE | SKIPPED | DEFERRED | SCHEDULED | COMPLETED` field. Autonomy and non-blocking-prerequisite language preserved and reaffirmed.
5. **Evidence weighting kept strictly qualitative** (Sections 10 and 25): explicit statement that no numerical coefficients, mastery-scoring formula, or ML/statistical knowledge tracing are introduced, and no `evidence_weight` column is added to the existing Evidence schema. MVP combination logic is described as simple deterministic rules over qualitative categories, not a weighted formula.

**C. Conflicts removed**
Two of the five previously-flagged conflicts in "Potential Documentation Conflicts" are now resolved and marked as such: the Learner Knowledge State enum question (item 1) and the Task Type enum overlap (item 2). A new item was added confirming Capability Record introduces no schema conflict. The two remaining items (Concept/ConceptRelationship not yet in the persisted schema; Evidence weighting intentionally unscored) are not contradictions — they are acknowledged, deliberate scope gaps pending future schema reconciliation, unchanged in substance from the prior draft but reworded for clarity.

Stray internal cross-references to non-existent section numbers (leftover "Section 30/31/32" pointers from the original draft's numbering) were also corrected to point at the correct sections (22 and 25).

**D. Remaining unresolved decisions**
Unchanged in kind, per Section 25: exact roadmap-reconciliation confidence formula, exact canonical-concept-matching confidence formula, exact mastery scoring/evidence-weighting formula (if one is ever introduced — currently qualitative only), exact database schema representation for Learner State dimensions/Concepts/Concept Relationships, exact AI provider/model selection, exact AI Gateway caching technology, exact missing-prerequisite handling behavior. (The prior draft's "final Task Type enum" and "final evidence weighting coefficients" items are removed from this list — both are now resolved: one Task Type enum exists, and evidence weighting is confirmed qualitative-only with no coefficients planned.)

**E. Confirmation**
No application source code, Prisma schema, database migrations, package/dependency files, or any of the five authoritative DevOS documents were modified. No new architectural complexity was introduced — this revision only removed ambiguity in existing language. This documentation-only revision is complete; no implementation was started.
