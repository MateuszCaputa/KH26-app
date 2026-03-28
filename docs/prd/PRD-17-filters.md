# PRD-17: Filters with User Filtering Priority

**Owner:** team member
**Est:** 45 min
**Priority:** P0 — mentor specifically asked for this, especially filter by user
**Status:** pending

---

## Why

Mentor emphasized filtering, especially by user (performer). Currently the dashboard shows aggregated data with no way to drill down. Being able to filter by user turns the dashboard from "process overview" into "investigation tool" — judges can explore the data live during demo.

## Design

### Filter Bar

Add a filter bar below the tab navigation, above tab content. Sticky so it stays visible while scrolling.

```
┌─────────────────────────────────────────────────────────────────┐
│  User: [All Users ▾]   App: [All Apps ▾]   Min Freq: [___]     │
│                                                     [Clear All] │
└─────────────────────────────────────────────────────────────────┘
```

### Filters

#### 1. User/Performer filter (highest priority per mentor)
- Dropdown/select populated from `pipeline.activities[].performers` (deduplicated, sorted)
- Multi-select: pick one or more users
- When active: filter activities table to only show activities where that user is a performer
- Also filter variants to only show variants that include activities by that user
- Also filter bottlenecks to only show transitions involving those activities

#### 2. Application filter
- Dropdown populated from `pipeline.application_usage[].application` (sorted)
- Multi-select
- Filter activities to those using selected applications

#### 3. Minimum frequency filter
- Number input with small +/- buttons
- Default: 0 (show all)
- Filters activities table to only show activities with frequency >= threshold
- Useful to hide noise and focus on significant activities

### Implementation

**State management:** Add filter state to ProcessTabs component:
```typescript
const [filterUsers, setFilterUsers] = useState<string[]>([]);
const [filterApps, setFilterApps] = useState<string[]>([]);
const [minFrequency, setMinFrequency] = useState(0);
```

**Filtering logic:** Apply filters to `sortedActivities`, `sortedBottlenecks`, `variants` before rendering. The filtering is frontend-only — no backend changes needed.

```typescript
const filteredActivities = sortedActivities.filter((a) => {
  if (filterUsers.length > 0 && !a.performers.some((p) => filterUsers.includes(p))) return false;
  if (filterApps.length > 0 && !a.applications.some((app) => filterApps.includes(app))) return false;
  if (a.frequency < minFrequency) return false;
  return true;
});
```

**Dropdown component:** Use a simple `<select multiple>` styled with zinc theme, or build a custom multi-select with checkboxes in a dropdown panel. Keep it simple — hackathon demo, not production.

### Filter persistence across tabs
Filters should persist when switching between tabs (same component state). A "Clear All" button resets everything.

### Active filter indicator
When any filter is active, show a small badge count next to the filter bar: "3 filters active" and highlight which filters are set.

## Files
- `frontend/src/components/filter-bar.tsx` (NEW) — filter controls
- `frontend/src/components/process-tabs.tsx` — add filter state, apply to data, render FilterBar

## Verification
- Filter bar appears below tabs
- Selecting a user filters activities table to that user's activities
- Selecting an app filters similarly
- Min frequency slider works
- Filters persist across tab switches
- "Clear All" resets everything
- Bottlenecks and Variants tabs also respect filters
- `cd frontend && npm run build` passes
