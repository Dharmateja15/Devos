# DevOS — Product Design Specification
**Version:** 1.0  
**Author:** Product Design  
**Date:** June 2026  
**Status:** Draft

---

## Design Philosophy

DevOS is a **Developer Operating System** — not a to-do app dressed up for learning. The visual language reflects this: dark, dense, and data-rich by default (like a terminal or IDE), with moments of celebration that feel earned rather than gamified for its own sake (Duolingo's rewards, Steam's achievements). The interface rewards consistency the way Spotify Wrapped rewards listening — by surfacing the work you've already done and making it feel significant.

**Core design principles:**

**Signal over noise.** Every element earns its place. No decorative progress bars, no empty encouragement copy. If a section has nothing to show yet, the empty state is an invitation to act, not a filler illustration.

**Density with breathing room.** Inspired by Linear and GitHub — compact information layouts with deliberate spacing. A power user should feel at home; a newcomer should not feel overwhelmed.

**Progress is the product.** XP, streaks, evidence, and completions are first-class UI elements — not buried in a settings page. Learners should feel the weight of what they've built.

**Legibility of state.** At any moment, a user should know exactly where they are in a journey, what's next, and what they've already done.

---

## Design System Tokens

### Color Palette

```
Background (Base)         #0D0F12    Near-black, not pure black
Surface (Cards/Panels)    #161B22    GitHub-inspired dark surface
Surface Elevated          #1C2128    Modals, dropdowns
Border                    #30363D    Subtle separators
Border Muted              #21262D    Very subtle dividers

Text Primary              #E6EDF3    Near-white, readable
Text Secondary            #8B949E    Muted labels
Text Disabled             #484F58    Inactive states

Accent Blue               #388BFD    Primary actions, links
Accent Green              #3FB950    Success, completions, streak active
Accent Purple             #A371F7    XP, gamification moments
Accent Orange             #D29922    Warning, paused state
Accent Red                #F85149    Errors, broken streaks

Journey Colors (user-assigned):
  Indigo                  #6366F1
  Cyan                    #06B6D4
  Emerald                 #10B981
  Amber                   #F59E0B
  Rose                    #F43F5E
  Violet                  #8B5CF6
```

### Typography

```
Display (headings, hero numbers)    JetBrains Mono — monospace, developer-native
Body                                Inter — clean, highly legible at small sizes
Label / Data / Caption              JetBrains Mono — reinforces the "OS" feel on data

Type Scale:
  display-xl   48px / 600 weight   Journey hero titles
  display-lg   32px / 600          Section headers
  heading-md   20px / 600          Card titles
  heading-sm   16px / 600          Component headers
  body-md      15px / 400          Default body
  body-sm      13px / 400          Secondary info
  label        12px / 500 / mono   Tags, badges, data labels
  micro        11px / 500 / mono   Meta, timestamps
```

### Spacing Grid

8px base unit. All spacing, padding, and margins are multiples of 8.

### Border Radius

```
Radius-none    0px     Code blocks, terminal-style elements
Radius-sm      4px     Badges, tags, small chips
Radius-md      8px     Cards, inputs
Radius-lg      12px    Modals, panels
Radius-xl      16px    Full-bleed panels
Radius-full    9999px  Pills, avatars
```

---

## 1. Dashboard Screen

### Purpose

The Dashboard is the **command center** — the first screen after login. It answers three questions at a glance: What am I working on? What's my momentum right now? What should I do next? It is not a home page; it is a live status report.

### Layout — Desktop (1280px+)

```
┌─────────────────────────────────────────────────────────────────────┐
│  SIDEBAR (240px fixed)          │  MAIN CONTENT (flex grow)         │
│                                 │                                    │
│  ● DevOS                        │  ┌── Greeting Bar ──────────────┐  │
│  ──────────────────             │  │  Good morning, Karan.        │  │
│  Journeys          ▾            │  │  4-day streak  🔥  1,240 XP  │  │
│    AI Engineering  ●            │  └──────────────────────────────┘  │
│    Blockchain                   │                                    │
│    Cloud           ●            │  ┌── Active Journeys ───────────┐  │
│  ──────────────────             │  │  [Card] [Card] [Card]        │  │
│  Profile                        │  └──────────────────────────────┘  │
│  Settings                       │                                    │
│  GitHub            ✓            │  ┌── Today's Focus ─────────────┐  │
│                                 │  │  Next tasks across journeys  │  │
│  ──────────────────             │  │  (3–5 tasks max)             │  │
│  Total XP                       │  └──────────────────────────────┘  │
│  ████████░░  1,240              │                                    │
│  Level 7 → 8                    │  ┌── Recent Activity ───────────┐  │
│                                 │  │  Commit / task / evidence    │  │
│  Streak: 🔥 4 days              │  │  feed, last 7 days           │  │
│                                 │  └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Layout — Mobile (375px)

```
┌─────────────────────────────┐
│  ☰   DevOS        🔔  [K]   │  ← Top bar, hamburger nav
│─────────────────────────────│
│  🔥 4-day streak   1,240 XP │  ← Compact status strip
│─────────────────────────────│
│  Today's Focus              │
│  ┌───────────────────────┐  │
│  │ ● Complete Module 3   │  │
│  │   AI Engineering  →   │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ ● Push Solidity lab   │  │
│  │   Blockchain  →       │  │
│  └───────────────────────┘  │
│─────────────────────────────│
│  Journeys  (horizontal scroll) │
│  [AI Eng] [Blockchain] [+]  │
│─────────────────────────────│
│  Recent Activity            │
│  · Commit pushed — 2h ago   │
│  · Task done — yesterday    │
└─────────────────────────────┘
```

### Components

**Greeting Bar**
Personalized time-of-day greeting. On the right: current streak (fire icon + count) and total XP. If the streak is at risk (no activity yet today), the streak counter pulses orange with a subtle "Keep it going" label. No streak yet = no streak badge (never show a zero-day streak).

**Active Journey Cards**
Horizontal scrollable row of cards (3 visible on desktop, 1.5 on mobile). Each card:
- Journey color accent along the left border
- Title + category icon
- Progress bar (milestone completion %)
- Last active timestamp
- "Next task" label (single line, truncated)
- Clicking a card navigates to that Journey screen

**Today's Focus**
A curated list of 3–5 tasks across all journeys, surfaced by due date and priority. Not algorithmic in MVP — user manually pins tasks or tasks with today's due date appear. Each row: journey color dot · task title · journey name · checkbox to mark done. Completing a task here triggers an XP flash animation.

**Recent Activity Feed**
Chronological list of events from the past 7 days: tasks completed, GitHub commits linked, evidence added, achievements unlocked. Each entry has an icon indicating its type, a brief description, and a relative timestamp. Clicking an entry navigates to the relevant entity.

### User Interactions

- Click a Journey Card → navigate to Journey screen
- Check a task in Today's Focus → mark complete, XP animation fires, task disappears with a ✓ fade
- Click an activity item → navigate to the linked task, commit, or evidence
- Click the streak count → navigate to Gamification screen

### Empty State

First login, no journeys created:

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   Your OS is ready.                             │
│   Start by creating your first journey.         │
│                                                 │
│   Think of a journey as a track — AI, Cloud,    │
│   Blockchain, or anything you're learning.      │
│                                                 │
│   [  Create your first journey  ]               │
│                                                 │
└─────────────────────────────────────────────────┘
```

No tasks due today (but journeys exist):

```
Today's Focus is clear.
Add tasks to your journeys or check your milestones.
```

---

## 2. Journey Screen

### Purpose

The Journey screen is the **mission control for a single learning track**. It shows all milestones, tasks, projects, notes, and evidence within one journey. Think of it as the GitHub repository page for a learning track — full context, actionable at every level.

### Layout — Desktop

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back   AI Engineering                          [Edit] [Share]    │
│  ──────────────────────────────────────────────────────────────────  │
│  Status: Active  ·  Started: Jan 2026  ·  Target: Dec 2026          │
│  Progress: ████████░░░░  62%   XP Earned: 840   Streak: 🔥 4 days   │
│                                                                     │
│  ┌──── TAB BAR ─────────────────────────────────────────────────┐   │
│  │  Milestones  │  Projects  │  Notes  │  Reflections  │  Stats │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  MILESTONES TAB:                                                    │
│                                                                     │
│  ┌──── Milestone 1: Python Fundamentals  ✓ DONE ───────────────┐   │
│  │  3/3 tasks  ·  Completed Jan 15  ·  +120 XP                 │   │
│  │  [collapsed — click to expand]                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──── Milestone 2: ML Foundations  ● IN PROGRESS ─────────────┐   │
│  │  2/5 tasks complete  ·  Due Mar 1                            │   │
│  │                                                              │   │
│  │  ✓  Understand gradient descent    +10 XP  [evidence: 2]    │   │
│  │  ✓  Linear regression lab          +10 XP  [evidence: 1]    │   │
│  │  ○  Neural network basics           →                        │   │
│  │  ○  PyTorch intro                   →                        │   │
│  │  ○  Build a classifier              →                        │   │
│  │                                                              │   │
│  │  [+ Add task]                                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──── Milestone 3: LLMs & Transformers  ○ PENDING ────────────┐   │
│  │  0/4 tasks  ·  Locked until M2 complete                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [+ Add milestone]                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

**Right sidebar (on ≥1440px viewports):**
```
┌────────────────────┐
│  Journey Stats     │
│                    │
│  Completion  62%   │
│  XP Earned   840   │
│  Tasks Done  14    │
│  Streak      4d 🔥 │
│  Evidence    9     │
│                    │
│  GitHub Activity   │
│  ████░░░ 3 commits │
│  this week         │
└────────────────────┘
```

### Layout — Mobile

Bottom tab bar replaces the horizontal tab bar. Header collapses to: journey title + color dot + progress percentage. Milestones are full-width accordion panels. Stats sidebar becomes the "Stats" tab.

### Components

**Journey Header**
Color-coded left border accent. Title (editable inline). Status badge (Active / Paused / Completed). Started date and target date. A linear progress bar spanning the full width, filled proportionally to milestone completion. XP earned chip (purple) and streak chip (orange/green).

**Tab Bar**
Milestones (default) · Projects · Notes · Reflections · Stats. Tabs stay sticky on scroll.

**Milestone Panel**
Collapsible accordion. Status indicated by icon and color:
- ✓ green = Completed
- ● blue = In Progress
- ○ gray = Pending
- 🔒 muted = Locked (future milestone dependency)

Each task row within a milestone: checkbox · title · XP reward chip · evidence count badge. Clicking a task row opens the Task Detail drawer (not a new page on desktop, a full page on mobile).

**Add Milestone / Add Task**
Ghost buttons at the bottom of each section. Clicking opens an inline input row (Linear-style inline creation — no modal, no navigation away).

### User Interactions

- Click milestone header → expand/collapse
- Click task row → open Task Detail drawer (desktop) or Task screen (mobile)
- Check task checkbox → mark complete, fire XP animation on the Journey header
- Drag task rows → reorder within milestone (drag handle on hover)
- Click the [Share] button → open Share Modal with toggle for public visibility and recruiter link generation
- Switch tabs → seamlessly load Projects, Notes, etc.

### Empty State

No milestones yet:

```
No milestones yet.

A milestone is a chapter in this journey —
"Complete Python basics", "Build first API", "Deploy to cloud."

[ Add your first milestone ]
```

---

## 3. Task Screen / Drawer

### Purpose

The Task screen is the **atomic unit of work** in DevOS. It's where a learner records what they did, links evidence (commits, files, URLs), and adds notes. It should feel like a focused work log — not a ticket tracker.

### Layout — Desktop (Right Drawer, 480px wide)

```
┌────────────────────────────────────────────┐
│  ✕  Close                    [Edit title]  │
│────────────────────────────────────────────│
│  Neural network basics                     │
│  AI Engineering  ›  ML Foundations         │
│                                            │
│  STATUS    ○ Todo  →  ● In Progress  →  ✓  │
│  PRIORITY  ● Medium          DUE  Mar 1    │
│  XP        +10                             │
│────────────────────────────────────────────│
│  DESCRIPTION                               │
│  Understand the architecture of a basic    │
│  feedforward neural network...             │
│  [Edit]                                    │
│────────────────────────────────────────────│
│  EVIDENCE   [ + Add evidence ]             │
│                                            │
│  ┌─────────────────────────────────────┐   │
│  │ ⌥ GitHub  · feat: nn-basics.py      │   │
│  │   abc1234  · pushed 2h ago     →    │   │
│  └─────────────────────────────────────┘   │
│                                            │
│  [ + Link GitHub commit ]                  │
│  [ + Add certificate   ]                   │
│  [ + Manual entry      ]                   │
│  [ + Upload file       ]                   │
│────────────────────────────────────────────│
│  NOTES                                     │
│  [ Write a note about this task... ]       │
│                                            │
│  · Activation functions matter a lot here  │
│    added — yesterday                       │
│────────────────────────────────────────────│
│  [ Mark as done ]                          │
└────────────────────────────────────────────┘
```

### Layout — Mobile (Full Screen)

Same content, stacked vertically. "Mark as done" becomes a sticky bottom CTA bar. Breadcrumb nav at top. Back arrow returns to Journey.

### Components

**Breadcrumb Trail**
Journey Name › Milestone Name (tappable, navigate back)

**Status Stepper**
Horizontal segmented control with three states: Todo → In Progress → Done. Clicking advances the state. Cannot go backwards (to prevent accidental un-completion) — an "Undo" toast appears for 5 seconds after marking done.

**Priority + Due Date Row**
Inline editable chips. Click priority → dropdown (Low / Medium / High). Click due date → date picker popover.

**Evidence Section**
Each piece of evidence is a compact card:
- GitHub: repo icon, short commit message, SHA fragment, relative time, link out icon
- Certificate: badge icon, issuer name, date
- Manual: pencil icon, title, date
- File upload: paperclip icon, filename, size

The "+ Add evidence" button opens an Evidence Picker Sheet with tabs for each evidence type.

**Notes Micro-editor**
A plain-text + Markdown-aware input. Notes are timestamped and stack in reverse chronological order below. No rich editor — just a textarea that renders Markdown on save. This keeps the task screen fast and focused.

**Mark as Done CTA**
Primary green button. On click: status changes, XP award modal fires (see XP Progression System section), task collapses in the milestone with a ✓.

### User Interactions

- Change status → updates in real time, syncs to Journey progress bar
- Add evidence → opens Evidence Picker (contextual sheet)
- Link GitHub commit → search field pre-filled with journey-related repos; results show commit message + SHA
- Add note → inline, no save button needed (auto-saves on blur)
- Mark as done → XP award animation, Undo toast for 5 seconds

### Empty State

No evidence linked:

```
No evidence yet.

Link a commit, upload a certificate,
or add a manual note to prove your work.
```

---

## 4. Project Screen

### Purpose

Projects are **portfolio artifacts** — finished or in-progress pieces of work that demonstrate applied skill. Unlike tasks (which are linear steps), a project is a showcase unit. The Project screen is designed to look and feel like a portfolio card that the user is building in real time.

### Layout — Desktop

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← AI Engineering                                                   │
│                                                                     │
│  ┌────────── PROJECT HEADER ──────────────────────────────────────┐ │
│  │  [Project thumbnail / GitHub social preview image]             │ │
│  │                                                                │ │
│  │  Sentiment Classifier API                          ● Active   │ │
│  │  Built a FastAPI service that classifies text...               │ │
│  │                                                                │ │
│  │  [GitHub →]  [Live Demo →]  [Edit]                             │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌── LEFT COLUMN (65%) ──────────────┐  ┌── RIGHT (35%) ─────────┐ │
│  │                                   │  │                        │ │
│  │  TECH STACK                        │  │  STATS                 │ │
│  │  [FastAPI] [Python] [HuggingFace] │  │  Started   Jan 20      │ │
│  │  [Docker]  [Redis]                │  │  Completed Feb 10      │ │
│  │                                   │  │  XP Earned  +50        │ │
│  │  DESCRIPTION (Markdown)           │  │                        │ │
│  │  Full project write-up...         │  │  EVIDENCE              │ │
│  │                                   │  │  · 8 commits linked    │ │
│  │  LINKED TASKS                     │  │  · 1 certificate       │ │
│  │  ✓ Design API schema              │  │                        │ │
│  │  ✓ Implement classifier endpoint  │  │  LINKED JOURNEY        │ │
│  │  ○ Write tests                    │  │  AI Engineering  →     │ │
│  │                                   │  │                        │ │
│  │  EVIDENCE                         │  └────────────────────────┘ │
│  │  [commit cards]                   │                             │
│  └───────────────────────────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘
```

### Layout — Mobile

Single column. Thumbnail at top. Header info below. Tabs: Overview / Tasks / Evidence. Tech stack chips wrap.

### Components

**Project Thumbnail**
Auto-generated from GitHub social preview image if a repo is linked. Falls back to a gradient placeholder using the journey's color. User can upload a custom thumbnail.

**Tech Stack Chips**
Inline editable. Each chip is a tag with an optional icon (inferred from known stack names — Python, Docker, React, etc.). Click "+" to add, click × on a chip to remove.

**Markdown Description**
Click to edit, renders as rich Markdown at rest. Supports code blocks, bold, headers, and links.

**Linked Tasks Panel**
Tasks from the same journey can be linked to this project. Linked tasks show their completion status. This creates a two-way relationship: tasks show which project they belong to, projects show which tasks contributed.

**Evidence Panel**
Identical to the task evidence panel in design. GitHub commits linked here are aggregated into a commit count chip in the project header.

### User Interactions

- Click "Mark Complete" → status changes to Completed, +50 XP fires, project card glows briefly on Journey screen
- Click GitHub link → open repo in new tab
- Add tech stack tag → inline typeahead, suggests known stacks
- Link a task → search field for tasks in the same journey

### Empty State

No projects yet in the journey:

```
No projects yet.

A project is something you built — an API, a dashboard,
a script, a prototype. Add one to make your work visible.

[ Add a project ]
```

---

## 5. Recruiter Screen

### Purpose

The Recruiter screen is a **read-only, curated view of a learner's journeys**, accessed via a share link. It's designed to answer one question for a recruiter: "What has this person actually learned and built, and can I trust the evidence?" It is not a resume. It is a verified portfolio dashboard.

### Access Flow

1. Learner clicks [Share] on a Journey or from their Public Profile
2. Chooses: "Public link" or "Private recruiter link" (expires in X days)
3. Recruiter receives a link, opens it — no login required
4. Recruiter sees the Recruiter Screen

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  [DevOS wordmark — subtle, top left]                                │
│                                                                     │
│  ┌───── CANDIDATE HEADER ─────────────────────────────────────────┐ │
│  │  [Avatar]   Karan V.                                           │ │
│  │             @karanv  ·  Chennai, IN                            │ │
│  │             3 active journeys  ·  1,240 XP  ·  🔥 4-day streak │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───── SKILL SNAPSHOT ────────────────────────────────────────────┐ │
│  │  Python ████████░░  AI/ML ██████░░░░  Cloud ███░░░░░░           │ │
│  │  (inferred from task tags and evidence)                        │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───── SHARED JOURNEYS ───────────────────────────────────────────┐ │
│  │                                                                │ │
│  │  AI Engineering                          62% complete          │ │
│  │  ────────────────────────────────────────                      │ │
│  │  Milestones: 2 of 5 complete                                   │ │
│  │  Projects:   Sentiment Classifier API  [GitHub →]              │ │
│  │              Recommendation Engine    [GitHub →]               │ │
│  │  Evidence:   14 verified GitHub commits · 2 certificates       │ │
│  │  Last active: 2 days ago                                       │ │
│  │                                                                │ │
│  │  [View full journey timeline ▾]                                │ │
│  │                                                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───── EVIDENCE VERIFICATION ─────────────────────────────────────┐ │
│  │  Every GitHub commit, certificate, and project linked here     │ │
│  │  was verified by the learner's connected GitHub account.       │ │
│  │  Commits link directly to source.                              │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  This profile was shared by the candidate on Jun 15, 2026.         │
│  Expires: Jul 15, 2026                 [Request full access →]     │
└─────────────────────────────────────────────────────────────────────┘
```

### Components

**Candidate Header**
Avatar, name, username, location (if set). High-signal summary stats: XP, active journeys, streak. Clean, professional — no gamification imagery here. This is a recruiter context; the tone shifts to a portfolio register.

**Skill Snapshot**
Horizontal bar chart showing skill depth, inferred from task tags and evidence volume. Labels are category-level (Python, AI/ML, Cloud) not marketing buzzwords. Bars show relative depth, not absolute scores.

**Shared Journey Cards**
For each shared journey: title, completion %, milestone count, project list with GitHub links, evidence summary. An expandable "View timeline" panel shows milestones in chronological order with completed dates.

**Evidence Verification Note**
A factual, understated note explaining that linked GitHub commits are cryptographically traceable to the account. Not promotional — just honest.

**Expiry and Attribution Footer**
Share date, expiry date, and a "Request full access" CTA that sends a notification to the learner.

### Mobile Design

Identical layout, stacked vertically. Skill bars scroll horizontally. Journey cards are full-width. No sidebar.

### What Recruiters Cannot See

- Tasks marked private
- Unlinked notes or personal reflections
- Journeys not included in the share
- Real email address

---

## 6. Public Profile Screen

### Purpose

The Public Profile is the learner's **permanent public presence** on DevOS — equivalent to a GitHub profile page. It shows who they are, what they're learning, what they've built, and what they've earned. It is SEO-indexed and shareable as a link.

### Layout — Desktop

```
┌─────────────────────────────────────────────────────────────────────┐
│  ┌── LEFT RAIL (280px) ──────────────────────────────────────────┐  │
│  │  [Avatar — 96px]                                              │  │
│  │  Karan V.                                                     │  │
│  │  @karanv                                                      │  │
│  │  Chennai, IN                                                  │  │
│  │                                                               │  │
│  │  Building at the intersection of AI and systems.              │  │
│  │                                                               │  │
│  │  ─────────────────────────────                                │  │
│  │  Total XP     1,240                                           │  │
│  │  Level        7                                               │  │
│  │  Streak       🔥 4 days                                       │  │
│  │  Journeys     3                                               │  │
│  │  Achievements 12                                              │  │
│  │  ─────────────────────────────                                │  │
│  │  [GitHub]  [LinkedIn]  [Website]                              │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌── MAIN CONTENT ──────────────────────────────────────────────┐   │
│  │                                                              │   │
│  │  PINNED JOURNEYS                                             │   │
│  │  ┌──────────────┐  ┌──────────────┐                         │   │
│  │  │ AI Eng  62%  │  │ Cloud  30%   │                         │   │
│  │  └──────────────┘  └──────────────┘                         │   │
│  │                                                              │   │
│  │  PROJECTS                                                    │   │
│  │  ┌────────────────────────────────────────────────────────┐  │   │
│  │  │  Sentiment Classifier API              [GitHub →]      │  │   │
│  │  │  FastAPI · Python · HuggingFace                        │  │   │
│  │  │  Built as part of AI Engineering journey               │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  │                                                              │   │
│  │  ACHIEVEMENT SHOWCASE                                        │   │
│  │  [badge] [badge] [badge] [badge] [badge]  (+7 more)         │   │
│  │                                                              │   │
│  │  ACTIVITY GRAPH                                              │   │
│  │  GitHub-style contribution heatmap (task completions)        │   │
│  │  Jan ─────────────────────────────── Jun                    │   │
│  │  [░][░][▒][▒][▓][▓][▓][░][░][▒][▒][▒][▓][▓]...            │   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Layout — Mobile

Left rail becomes a compact top header band (avatar, name, XP, social links). Everything else stacks vertically. Activity graph is scrollable horizontally.

### Components

**Left Rail**
Static identity panel. Avatar, display name, username (handles @mentions for future social features), location (optional), headline bio (1–2 lines). Stats grid. Social links (icon-only buttons).

**Pinned Journeys**
User selects up to 4 journeys to pin. Cards show title, category, completion %. Clicking navigates to a read-only Journey view. Non-public journeys are never shown.

**Projects Gallery**
Cards for all completed projects across public journeys. Each card: thumbnail, title, tech stack chips, journey attribution, GitHub/Live links.

**Achievement Showcase**
First 5 achievements displayed as full badges. Remaining shown as a "+ N more" chip that expands an achievement grid on click.

**Activity Graph**
52-week heatmap (GitHub Contributions-style) where each cell represents one day. Cell color intensity maps to number of tasks completed + evidence added that day. Hover shows: "Jun 10 — 3 tasks completed, 2 commits linked."

### User Interactions (for the profile owner)

- Toggle "Make profile public" in settings to enable/disable indexing
- Drag-sort pinned journeys
- Choose which achievements appear in the showcase

### Empty State (for visitors)

```
@karanv is building their public profile.
Nothing to show yet.
```

---

## 7. Achievement System

### Design Philosophy

Achievements should feel **earned, not farmed**. Inspired by Steam achievements — each one has a name, an icon, and a brief description that reads like a story beat rather than a checklist item. Getting an achievement should feel like a moment, not a notification.

### Achievement Categories

| Category | Color | Examples |
|---|---|---|
| **Milestones** | Blue | First Step, Halfway There, Journey Complete |
| **Consistency** | Orange | 7-Day Streak, 30-Day Streak, 100-Day Streak |
| **Evidence** | Green | First Commit, 10 Commits Linked, Certified |
| **Volume** | Purple | 10 Tasks, 50 Tasks, 100 Tasks |
| **Projects** | Cyan | Shipped It, Portfolio Builder |
| **Social** | Pink | Public Profile, First Share |
| **Special** | Gold | Night Owl (tasks after midnight), Speed Runner (task done same day as created) |

### Achievement Award Flow

**Trigger:** System detects qualifying event (via event consumer)  
**Display:** Full-screen overlay animation fires — similar to Duolingo's "Lesson complete" or Steam's achievement toast

```
┌─────────────────────────────────────────────────┐
│                                                 │
│          🏆                                     │
│                                                 │
│     Achievement Unlocked                        │
│                                                 │
│     ┌────────────────────────────────────────┐  │
│     │                                        │  │
│     │   [  BADGE ICON — 96px  ]              │  │
│     │                                        │  │
│     │   First Step                           │  │
│     │   Completed your first milestone.      │  │
│     │                                        │  │
│     │   + 50 XP                              │  │
│     └────────────────────────────────────────┘  │
│                                                 │
│     [ Continue ]                                │
│                                                 │
└─────────────────────────────────────────────────┘
```

The overlay appears on top of whatever screen the user is on. It uses a particle burst animation (subtle, not distracting). The badge icon is large. The achievement name is in display-lg monospace. A sub-label gives context ("Completed your first milestone"). XP awarded is shown in accent purple. Single CTA: Continue.

After dismissing: the achievement appears in the achievement log and on the public profile showcase.

### Achievement Badge Design

Each badge is a hexagonal icon with:
- A category-specific background color
- A minimal icon representing the achievement (not emoji — custom icons)
- A locked state (dark, desaturated, icon replaced with ?) for unearned achievements
- A "% of users have this" label visible on hover (Steam-style rarity)

### Achievement Grid (Profile / Achievements Tab)

```
┌───────────────────────────────────────────────────────────────────┐
│  Achievements   12 earned  ·  23 total                            │
│                                                                   │
│  Filter:  [All ▾]  [Earned]  [Locked]                             │
│                                                                   │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐    │
│  │  🏆  │  │  🔥  │  │  ⌥   │  │  📦  │  │  ?   │  │  ?   │    │
│  │First │  │ 7Day │  │10Com │  │Ship  │  │Locked│  │Locked│    │
│  │Step  │  │Streak│  │mits  │  │It    │  │      │  │      │    │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘    │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

Hovering an earned badge shows a tooltip: achievement name, description, date earned, rarity.
Hovering a locked badge shows: "Keep going — X more [tasks/commits/days] to unlock."

---

## 8. XP Progression System

### Design Philosophy

XP should feel like **compound interest on learning** — it accumulates steadily, but milestones and streaks create moments of acceleration. Inspired by Duolingo's reward loops and Steam's level system. The key UX principle: XP feedback must be **immediate and visible** at the point of action, not buried in a profile page.

### XP Award Table (MVP)

| Action | XP |
|---|---|
| Complete a task | +10 |
| Complete a task with evidence | +15 |
| Complete a milestone | +50 |
| Complete a project | +100 |
| 7-day streak | +75 bonus |
| 30-day streak | +300 bonus |
| Unlock an achievement | Varies (25–500) |
| Link a GitHub commit | +5 |
| Add a certificate | +20 |
| Daily login (first action of the day) | +5 |

### Level Thresholds

Levels use an exponential curve so early levels feel fast and later levels feel significant.

```
Level 1     0 XP       Newcomer
Level 2     100 XP
Level 3     250 XP
Level 4     500 XP
Level 5     900 XP
Level 6     1,500 XP
Level 7     2,500 XP
Level 8     4,000 XP
Level 9     6,000 XP
Level 10    9,000 XP   Senior Learner
...
Level 20    60,000 XP  Expert
Level 30    200,000 XP Master
```

Level names are developer-native: Newcomer → Apprentice → Practitioner → Engineer → Architect → Principal → Distinguished → Fellow → Legend

### XP UI Components

**Inline XP Flash**
At the moment of action (e.g., checking a task done), a small "+10 XP" label appears at the cursor/finger position and floats upward over 600ms before fading out. Color: accent purple. This is the primary feedback mechanism.

**XP Bar (Sidebar)**
Always visible in the sidebar: current XP / XP to next level, rendered as a progress bar. Level number displayed above. Fills with a smooth animation when XP is added.

**Level-Up Overlay**
Fires when a level threshold is crossed:

```
┌─────────────────────────────────────────────┐
│                                             │
│           LEVEL UP                          │
│                                             │
│   Level 6  ──────────────→  Level 7         │
│                                             │
│        Architect                            │
│                                             │
│   +300 XP this week  ·  1,240 total         │
│                                             │
│   [ Keep building ]                         │
│                                             │
└─────────────────────────────────────────────┘
```

Same overlay design as achievement unlock. Uses a horizontal level-up bar animation (fills from 0 to 100% at the new level). Level name displayed beneath. Monospace font for level number.

**XP History (Gamification Tab)**

```
┌───────────────────────────────────────────────────────────┐
│  XP History                                               │
│                                                           │
│  Total: 1,240 XP  ·  Level 7                              │
│  ████████████████████░░░░░░░░░░  1240 / 2500              │
│                                                           │
│  This week       +185 XP                                  │
│  Last week       +310 XP                                  │
│  This month      +840 XP                                  │
│                                                           │
│  Recent                                                   │
│  ──────────────────────────────────────────               │
│  +15  Completed task with evidence    2h ago              │
│  +10  Completed task                  yesterday           │
│  +75  7-day streak bonus              Jun 12              │
│  +50  Milestone complete              Jun 10              │
│  +15  Completed task with evidence    Jun 10              │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## 9. GitHub Integration UX

### Design Philosophy

GitHub integration should feel **ambient and automatic** — not a manual import wizard. Once connected, commits start appearing as evidence options; the user links them to tasks at their discretion. The UX is inspired by GitHub's own commit log — familiar and scannable.

### Connection Flow

**Step 1: Connect GitHub (Settings screen)**

```
┌────────────────────────────────────────────────────────────┐
│  GitHub Integration                                        │
│                                                            │
│  Connect your GitHub account to automatically surface      │
│  commits as evidence for your tasks and projects.          │
│                                                            │
│  Permissions requested:                                    │
│  · Read your public and private repositories               │
│  · Read your commit history                                │
│  · Read your email address                                 │
│                                                            │
│  DevOS will never write to your repositories.              │
│                                                            │
│  [ Connect GitHub ]                                        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

After OAuth, the sidebar shows a green GitHub checkmark. An initial sync runs in the background (status indicator in the sidebar during sync: "Syncing GitHub activity...").

### Commit Surfacing UX

**Evidence Picker — GitHub Tab**

When a user clicks "+ Link GitHub commit" on a task or project:

```
┌────────────────────────────────────────────────────────────┐
│  Link GitHub Evidence                                      │
│  ─────────────────────────────────────────────────────     │
│  [ Search commits, repos, or PRs...           ]            │
│                                                            │
│  Suggested for this task                                   │
│  (based on date proximity and repo name)                   │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  karanv/sentiment-api                                │  │
│  │  feat: add softmax classifier endpoint               │  │
│  │  a3c1f8d  ·  Jun 14, 2026  ·  +42 −5 lines          │  │
│  │                                                [Link] │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  karanv/sentiment-api                                │  │
│  │  fix: normalize input before tokenization            │  │
│  │  b5e2c1a  ·  Jun 14, 2026  ·  +8 −3 lines           │  │
│  │                                                [Link] │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ─── All recent commits ────────────────────────────────   │
│  [Load more commits]                                       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Suggestion logic (MVP):** Commits from the past 7 days, across all synced repos, sorted by recency. No AI needed in MVP — proximity and recency are sufficient heuristics.

### GitHub Activity on Journey Screen

Below the milestone list, a **Commit Activity** mini-panel shows:

```
┌────────────────────────────────────────────────────────────┐
│  GitHub Activity  ·  AI Engineering journey                │
│  ─────────────────────────────────────────────────────     │
│  14 commits linked  ·  3 repos  ·  Last: 2h ago            │
│                                                            │
│  ░░░▒▒▓▓▓░░▒▓▓▓▓▓░░░░░░▒▒▓▓░                              │
│  (mini commit heatmap — 30 days)                           │
│                                                            │
│  [ View all linked commits ]                               │
└────────────────────────────────────────────────────────────┘
```

### Sync Status Indicator

In the sidebar, next to the GitHub label:

- ✓ green dot = Synced (with relative time: "Synced 2h ago")
- ↻ spinning = Syncing now
- ⚠ amber = Sync failed (hover shows reason: token expired, rate limited)
- Clicking the indicator triggers a manual re-sync

### Empty State (GitHub not connected)

On the Task evidence section:

```
Connect GitHub to link commits as evidence.
Every commit you link becomes verified proof of your work.

[ Connect GitHub → ]
```

On the Journey screen commit panel:

```
No commits linked yet.
Connect GitHub or manually link commits to your tasks.
```

---

## 10. Skill Graph UX

### Design Philosophy

The Skill Graph is DevOS's **most ambitious visualization** — a living map of what a user knows, inferred from their tasks, evidence, and projects. Inspired by GitHub's contribution graph and knowledge graph UIs. It should feel like looking at a map of your own mind, not a marketing radar chart.

### How Skills Are Inferred

Skill nodes are derived from:
- Task tags (user-defined and system-suggested)
- Project tech stack chips
- Evidence types (GitHub repos named after technologies, certificate subjects)
- Journey categories

In Phase 3 (AI-assisted), the AI Mentor layer will parse task descriptions and notes to infer skills more granularly.

### Skill Graph Layout

```
┌────────────────────────────────────────────────────────────────────┐
│  Skill Graph                    [Filter: All journeys ▾]  [Export] │
│  ──────────────────────────────────────────────────────────────    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                                                              │  │
│  │          Python ●━━━━━━━━━━━━━━━● FastAPI                   │  │
│  │             ║                        │                       │  │
│  │             ║                        │                       │  │
│  │          ML/AI ●━━━━━━━━━━━━━━━━━● Docker                   │  │
│  │           ╱  ╲                        │                      │  │
│  │          ╱    ╲                       │                      │  │
│  │  HuggingFace ● ● PyTorch          Redis ●                    │  │
│  │                                                              │  │
│  │  (Node size = depth/evidence count)                          │  │
│  │  (Edge = co-occurrence in same project/task)                 │  │
│  │  (Color = journey the skill originated from)                 │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌── SKILL DETAIL (sidebar, shown on node click) ──────────────┐   │
│  │  Python                                                      │   │
│  │  ─────────────────────────────────────────────────────       │   │
│  │  Depth: Advanced (based on 28 tasks + 14 commits)            │   │
│  │  Journeys: AI Engineering, Cloud                             │   │
│  │  First seen: Jan 2026                                        │   │
│  │  Related skills: ML/AI, FastAPI, Docker                      │   │
│  │                                                              │   │
│  │  Evidence                                                    │   │
│  │  · 14 GitHub commits                                         │   │
│  │  · 2 certificates                                            │   │
│  │  · 3 projects                                                │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

### Graph Interaction Model

**Zoom and pan** — standard force-directed graph navigation. Mouse wheel to zoom, click-drag to pan.

**Node states:**
- Default: circle, colored by journey, sized by evidence count
- Hover: label appears prominently, connected edges highlight, unconnected edges dim
- Selected: detail sidebar opens on the right
- Unverified (no evidence): dashed border, slightly smaller

**Edge meaning:**
- Thick edge = skills co-occurred in many tasks/projects together
- Thin edge = occasional co-occurrence

**Filters:**
- Filter by journey (show only skills from one learning track)
- Filter by evidence type (show only GitHub-backed skills, or all)
- Filter by recency (skills active in last 30/90/365 days)

**Growth mode:**
A toggle that animates the graph growing over time — a time-lapse of skill acquisition from account creation to today. This is a "Spotify Wrapped" moment for learners — see your knowledge base form.

### Skill Depth Model

Each skill node has a depth level, derived from evidence volume:

```
● Beginner      1–3 tasks or evidence items
● Developing    4–10 tasks
● Practitioner  11–25 tasks + some projects
● Advanced      26–50 tasks + projects + commits
● Expert        50+ tasks + projects + commits + certificates
```

Depth is shown as a fill percentage of the node circle (like a liquid filling a container), giving an at-a-glance sense of mastery without a misleading numeric score.

### Mobile Design

The force-directed graph is replaced with a **categorized list view** on mobile — skill names grouped by journey, with a horizontal depth bar beneath each. A "View as graph" button opens the graph in a full-screen modal with pinch-to-zoom.

### Empty State (early in journey)

```
Your skill graph is taking shape.

Complete tasks and link evidence to start
mapping your knowledge.

Right now you have 3 skill tags.
Keep going — graphs get interesting at 10+.
```

---

## Interaction Patterns — Global

### Navigation Structure

**Desktop:** Fixed left sidebar (240px). Top bar absent. Page title rendered inline in content.

**Mobile:** Bottom navigation bar with 4 tabs: Home (Dashboard), Journeys, Profile, More (Settings, GitHub, Achievements).

### Loading States

No skeleton screens with pulsing rectangles. Instead: content renders in order of importance, top to bottom. Below-the-fold content loads progressively. Data-heavy components (Activity Graph, Skill Graph) show a minimal spinner only.

### Toast Notifications

Appear bottom-center on desktop, bottom of screen on mobile. Auto-dismiss at 4 seconds. Types: success (green), info (blue), warning (amber), error (red). Maximum 2 toasts stacked at once.

```
┌────────────────────────────────────────┐
│  ✓  Task marked complete   [ Undo ]    │
└────────────────────────────────────────┘
```

### Undo Pattern

Any destructive or irreversible-feeling action (mark complete, delete task, archive journey) shows an Undo toast for 5 seconds. After 5 seconds, the action commits. This reduces confirmation dialogs without creating irreversible accidents.

### Keyboard Shortcuts (Desktop)

```
G J        → Go to Journeys
G P        → Go to Profile
G G        → Go to GitHub settings
N J        → New Journey
N T        → New Task (within active journey)
/          → Global search
Esc        → Close drawer / modal
```

---

## Responsive Breakpoints

```
Mobile      375px – 767px
Tablet      768px – 1023px
Desktop     1024px – 1279px
Wide        1280px – 1535px
Ultra       1536px+
```

Tablet layout: sidebar collapses to icon-only rail (48px). Main content expands. Tab bars switch to icon + label. No right sidebar — stats panels become expandable drawers.

---

## Accessibility Baseline

- Color contrast: AA minimum on all text (AAA on body text)
- All interactive elements: visible focus ring (2px solid Accent Blue, 2px offset)
- Reduced motion: all animations respect `prefers-reduced-motion`
- Screen reader: ARIA labels on icon-only controls; live regions for XP flash and toast
- Keyboard navigable: full app operable without a mouse
- Tap targets: minimum 44×44px on mobile

---

## Animation Principles

**XP flash:** +XP label floats up 24px over 600ms, ease-out, fades on exit. Purple, monospace.

**Achievement overlay:** Slides up from bottom over 400ms, backdrop fades in. Badge icon scales from 0.5 to 1.0 with a spring easing. Particle burst at badge center (12 particles, radial, 300ms).

**Level-up bar:** XP bar fills from current % to 100%, pauses 200ms, resets to 0%, then fills to new level %. Smooth, satisfying.

**Streak pulse:** On Dashboard, streak counter pulses (scale 1 → 1.05 → 1) if user has not yet done anything today. One pulse every 8 seconds.

**Task completion:** Checkbox animates ✓ draw-on (SVG path draw), row fades to 60% opacity and slides left 4px over 300ms.

**Journey progress bar:** Fills with an ease-in-out animation over 800ms whenever the screen loads or a task is completed.

All animations: respect `prefers-reduced-motion` — reduce to instant state changes with no motion.

---

*End of DevOS Product Design Specification v1.0*
