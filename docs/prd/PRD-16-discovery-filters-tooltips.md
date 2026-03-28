# PRD-16: Hidden Insights, Tooltips & Filters

**Owner:** overnight agent (pipeline + frontend + api)
**Est:** 60 min
**Priority:** P0 — transforms raw numbers into an intuitive story; demo judges will notice the depth
**Status:** pending

---

## Why

Three separate problems compound into one "the app feels shallow" impression:

1. **Sub-sequence patterns are invisible.** The current process map and variants show macro-level steps. There are micro-patterns buried inside each step (repeated short actions, quick multi-app hops) that are real automation candidates — but nobody can see them. These are the "easter eggs" that make analysts go "wait, how did it catch that?"

2. **The data contains a natural category split** (`Process step` values include high-level categories like "Communication" alongside work steps). Splitting the view by these categories reveals a hidden bottleneck: communication overhead is measurable, disproportionate for certain users, and actionable (route automation, async-first workflows). This is invisible in the current aggregate view.

3. **Numbers lack context.** Deviation percentages, durations, bottleneck scores — all appear as raw numbers. There's no hover explanation. Judges and users can't tell if 340% deviation is alarming or normal without hovering for a tooltip.

4. **Filtering is limited.** The most powerful filter — by individual user — is missing. A single outlier user can distort every aggregate metric. Filtering to one user immediately shows whether a bottleneck is systemic or person-specific.

---

## Feature 1: Sub-Sequence Micro-Pattern Detection ("Easter Eggs")

### What it is

Within each process step (e.g. "Working on kyp-backend"), users perform repeated sub-patterns:
- Short bursts: open app → type → copy → switch → paste → switch back (in under 90 seconds)
- Interrupted sequences: start a step, leave, come back, resume (detected by gap > threshold mid-step)
- Rapid toggles: 3+ app switches within a single process step without completing work

These are smaller than the variants we surface today and reveal a layer of friction that variants miss entirely.

### Backend — `backend/pipeline/micro_patterns.py` (NEW)

```python
class MicroPattern(BaseModel):
    pattern_id: str
    pattern_type: str          # "rapid_toggle", "interrupted_sequence", "copy_paste_burst"
    activity: str              # which process step this appears in
    sequence: list[str]        # app/action sequence (e.g. ["Chrome", "Clipboard", "Outlook"])
    occurrence_count: int
    affected_users: int
    avg_duration_ms: float
    automation_potential: str  # "high", "medium", "low"
    description: str           # human-readable: "Chrome → Outlook paste loop repeated 3x per session"
```

Function `detect_micro_patterns(sessions: list[Session]) -> list[MicroPattern]`:
1. For each session, within each process step, group interactions into 90-second windows
2. Detect `rapid_toggle`: 3+ distinct app switches in one window with no text entry
3. Detect `copy_paste_burst`: Copy/Paste/Cut No. > 2 within same window, across different apps
4. Detect `interrupted_sequence`: gap > 5 min within a single step (user left mid-task)
5. Deduplicate by sequence fingerprint, aggregate counts across users
6. Return sorted by occurrence_count desc

Add to `PipelineOutput`:
```python
micro_patterns: list[MicroPattern] = []
```

Wire into `backend/pipeline/pipeline.py` after bottleneck detection.

### Frontend — new "Micro-Patterns" tab or section

Add a collapsed "Hidden Patterns" section at the bottom of the Process Map tab (or as a sub-tab).

Each pattern card shows:
- Pattern type badge (color-coded: red = rapid toggle, amber = copy-paste burst, blue = interrupted)
- The app sequence as a mini flow: `Chrome → Clipboard → Outlook`
- Occurrence count + affected users count
- Automation potential badge
- Description sentence

Header: **"Easter Eggs — patterns smaller than your variants"** (or "Sub-step Micro-Patterns").

---

## Feature 2: Process Category Split (The Hidden Bottleneck)

### What it is

The `Process step` column in the raw data contains two kinds of values:
- **Work steps**: "Working on kyp-backend", "Invoice review", etc.
- **Category steps**: "Communication", "Meeting", "Admin", etc.

Aggregated together, the communication overhead is hidden inside the total duration numbers. Split out, it becomes a clear bottleneck: e.g. "User X spends 42% of their recorded time on Communication steps vs. 18% average." This is the category-split easter egg in the data.

### Backend — `backend/pipeline/category_analysis.py` (NEW)

```python
COMMUNICATION_KEYWORDS = ["communication", "meeting", "teams", "slack", "email", "outlook", "call"]
WORK_KEYWORDS = ["working on", "review", "processing", "development", "coding"]

class CategorySplit(BaseModel):
    category: str                    # "Communication", "Core Work", "Admin", "Other"
    total_duration_ms: float
    percentage_of_total: float
    step_count: int
    top_activities: list[str]        # top 3 process steps in this category
    avg_per_user_ms: float
    outlier_users: list[str]         # users > 1.5x average for this category

class CategoryBreakdown(BaseModel):
    categories: list[CategorySplit]
    communication_bottleneck: bool   # True if Communication > 30% of total time
    bottleneck_description: str | None  # "Communication overhead is 38% of total time — 2.1x above benchmark"
```

Function `analyze_categories(sessions: list[Session]) -> CategoryBreakdown`:
1. For each session step, classify by `process_name` or `process_step` string matching COMMUNICATION_KEYWORDS
2. Aggregate duration by category and by user
3. Flag `communication_bottleneck` if communication >= 30% of total
4. Identify outlier users (> 1.5× average communication share)
5. Return CategoryBreakdown

Add to `PipelineOutput`:
```python
category_breakdown: CategoryBreakdown | None = None
```

### Frontend — Category Split panel

Add a "Category Split" section in the Statistics or Overview tab.

- Donut chart: share of total time by category (Communication, Core Work, Admin, Other)
- If `communication_bottleneck == true`: show a red/amber alert banner:
  > **"Communication bottleneck detected — 38% of time is non-core work. This is actionable."**
- Expandable "User breakdown" table: user ID | communication % | core work % | deviation from avg
- Tooltip on the donut segments: "X hours across Y users, top activity: Teams calls"
- Outlier users highlighted in amber in the table with tooltip: "This user spends 2.1× the team average on communication steps"

This is the "easter egg reveal" moment in the demo — start with the aggregate view, then expand user breakdown to show the outlier.

---

## Feature 3: Tooltips on Every Number

### What needs tooltips (frontend only, no backend changes)

Every number that appears without obvious units or context must have a hover tooltip. Min spec:

| Element | Tooltip content |
|---|---|
| Deviation % on a variant | "This variant deviates from the happy path in N steps. Higher % = more steps that differ from the most common flow." |
| Duration numbers (ms, s, min) | "Total time spent on this step across all cases. Includes both active interaction and passive wait time." |
| Bottleneck severity score | "Score 0–100. Calculated from wait time before this step × frequency. 80+ = critical, 50–79 = moderate." |
| Copy-paste count | "Number of copy/paste/cut operations in this step. High counts across apps = strong RPA candidate." |
| Case count on variants | "Number of unique user sessions that followed this exact sequence of steps." |
| Automation potential badge | "Based on: repetition rate, copy-paste density, app-switching frequency, and average step duration." |
| Health score | "Composite score: 100 = perfect flow, 0 = highly fragmented. Weighted: 40% wait time, 30% variants, 30% bottlenecks." |
| Context switch count | "Times the user switched between different applications within this step. Each switch = 23 sec avg re-focus cost." |
| Active vs passive time | "Active = user was interacting (clicks, keystrokes). Passive = application was open but user wasn't interacting." |
| ROI hours/month | "Estimated hours saved monthly if this step is fully automated. Assumes 100% success rate. Conservative estimate." |

### Implementation

Use a `<Tooltip>` wrapper component (shadcn/ui already has one). Create a `TOOLTIPS` constant map in `frontend/src/lib/tooltips.ts`:

```ts
export const TOOLTIPS = {
  deviation_pct: "This variant deviates...",
  bottleneck_severity: "Score 0–100...",
  // ...
} as const
```

Apply `<Tooltip content={TOOLTIPS.deviation_pct}><span>{value}%</span></Tooltip>` pattern everywhere.

---

## Feature 4: Filters — Especially by User

### Filter panel (frontend + minimal API support)

Add a persistent filter bar above the main content area. Filters are applied client-side where possible, server-side only for re-running analysis.

**Required filters:**

| Filter | Type | Notes |
|---|---|---|
| **User** | Multi-select dropdown | Most important. Lists all user UUIDs from pipeline output. Selecting one user re-scopes all charts, variants, and bottlenecks to that user only. Show anonymized labels: "User A", "User B", etc. (preserve original IDs in data) |
| **Date range** | Date range picker | Filter sessions by start date. Shows only steps that started within range. |
| **Application** | Multi-select | Filter to show only steps involving selected apps. |
| **Activity type** | Toggle: Active / Passive / Both | Hide passive-only steps when toggling to "Active only" |
| **Process category** | Multi-select | Communication / Core Work / Admin / Other (from Feature 2) |
| **Min duration** | Slider (0 → max_duration) | Filter out very short steps (< N seconds) to reduce noise |

### User filter is the highest priority

When a user filter is active:
- All aggregate stats (total duration, avg step time, bottleneck scores) recalculate for that user only
- Variant tab shows only that user's sequences
- Add a banner: **"Filtered to User A — showing 1 of 12 users"** with an "× Clear filter" button
- Bottleneck tab shows whether this user's bottlenecks match the global pattern (add comparison line)

### Implementation

Store filter state in a `useFilters()` hook. Pass `filteredSessions` down to all chart components. No re-fetch needed — filter in-memory from the full pipeline output that's already loaded.

Add `users: list[str]` to `PipelineOutput` if not already present (derive from session data in pipeline).

---

## Files

### Backend (pipeline)
- `backend/pipeline/micro_patterns.py` (NEW)
- `backend/pipeline/category_analysis.py` (NEW)
- `backend/pipeline/pipeline.py` — wire both new analyzers
- `backend/models.py` — add `MicroPattern`, `CategorySplit`, `CategoryBreakdown`; extend `PipelineOutput`

### Frontend
- `frontend/src/lib/tooltips.ts` (NEW) — tooltip text constants
- `frontend/src/components/tooltip-wrapper.tsx` (NEW) — thin wrapper around shadcn Tooltip
- `frontend/src/hooks/use-filters.ts` (NEW) — filter state management
- `frontend/src/components/filter-bar.tsx` (NEW) — filter UI panel
- `frontend/src/components/micro-pattern-card.tsx` (NEW)
- `frontend/src/components/category-split-panel.tsx` (NEW)
- `frontend/src/components/variant-card.tsx` — add deviation % tooltip
- `frontend/src/components/bottleneck-card.tsx` — add severity tooltip
- `frontend/src/components/process-tabs.tsx` — integrate filter bar, micro-patterns section, category panel

---

## Verification

- Micro-patterns: run pipeline → "Hidden Patterns" section shows at least 1 pattern card
- Category split: Communication category detected; if > 30% → alert banner appears
- All tooltips: hover over deviation %, bottleneck score, duration → tooltip appears
- User filter: select one user → all charts re-scope, banner shows "Filtered to User X"
- Filter clear: "× Clear filter" resets to full dataset
- `npm run build` passes

## Demo Script Lines

**Micro-patterns:** "But we go deeper than variants. Inside each step, there are sub-second patterns the process map can't show. Watch — we detect a Chrome-to-Outlook paste loop happening 47 times per day. That's not a variant — that's a habit. And habits are what RPA was built for."

**Category split:** "Here's something the data was hiding. When we split by process category — look at this. Communication is 38% of total recorded time. And this one user? 61%. That's not a bottleneck you can automate around — that's a workflow redesign conversation. We found it because the data was there, you just had to know where to look."

**Filters:** "And everything you've seen — filter it to a single user. Now you're not looking at team averages, you're looking at one person's actual working day. Is their bottleneck the same as everyone else's? Find out in one click."
