# PRD-02: Overview Tab — Log Limits, User Split Comparison, Global Filter Propagation

## Problem
1. Sections like "Cross-App Data Transfers" dump ALL entries — can be overwhelming. Should cap at ~10 with "Show more".
2. When multiple users are selected in the filter, sections just show combined/filtered data. Mentors want a **visual split** so you can compare the selected users side-by-side (like Performer Analysis already does).
3. It's unclear whether all sections update when users are filtered — they must.

## Current State
- `OverviewFilterBar` has multi-select for users and apps
- `useFilters` hook computes `filteredActivities`, `filteredBottlenecks`, `filteredVariants`, `filteredPerformers`
- Cross-App Data Transfers renders all `copy_paste_flows` without limit
- Top Activities table shows all filtered activities
- No split/comparison view exists in Overview tab sections
- Performer Analysis table already shows per-user rows (closest to "split" view)

## Requirements

### R1: Cap Lists at 10 Items with "Show More"
Sections that can have many rows must cap at 10 visible items by default:

| Section | Currently | Change |
|---|---|---|
| Cross-App Data Transfers | All flows shown | Show top 10 by frequency, "Show all N transfers" button |
| Top Activities Table | All filtered activities | Show top 10, "Show all N activities" button |
| Application Usage | All apps | Show top 10, "Show all N applications" button |
| Performer Analysis | All performers | Already manageable (12 users), keep as-is |

Implementation: Use a `showAll` state toggle per section. Default `false` → slice first 10. Button toggles to show all.

### R2: User Split/Comparison View
When **2+ users are selected** in the Overview filter bar, each data section should show a **per-user breakdown** so users can be compared:

**How it works:**
- A toggle appears in the filter bar: "Compare users" (only visible when 2+ users selected)
- When toggled ON, each section renders **side-by-side columns** (or stacked sub-sections) per selected user:

| Section | Split Behavior |
|---|---|
| Category Breakdown | Show category distribution per user side-by-side |
| Top Activities | Split table: one sub-table per user showing their top activities |
| Application Usage | Grouped bar chart: each app shows bars per user |
| Cross-App Data Transfers | Show transfers per user separately |
| Data Flow Insight | Per-user flow counts |

**Layout:**
- For 2 users: 2-column grid
- For 3+ users: scrollable horizontal cards or stacked sections with user name headers
- Each sub-section has the user name as a header with a colored indicator (consistent color per user across all sections)

### R3: All Sections Must Respond to Filters
Verify and ensure these sections properly filter by selected users:
- Category Breakdown: filter activities by performer
- Data Flow Insight: filter copy_paste_flows by user
- Business ID Insight: filter by user
- Application Usage: filter by user's apps
- Cross-App Data Transfers: filter by user

Currently `filteredActivities` from `useFilters` handles some of this, but `copy_paste_flows` and `application_usage` may not be filtered. Ensure the hook or component-level filtering covers all sections.

## Implementation

### File: `frontend/src/hooks/use-filters.ts`
- Add `filteredCopyPasteFlows` computed value (filter by selected users)
- Add `filteredApplicationUsage` computed value (filter by selected users)

### File: `frontend/src/components/process-tabs.tsx` (Overview tab section)
- Add `showAllTransfers`, `showAllActivities`, `showAllApps` state variables
- Slice arrays to 10 when not showing all
- Add "Show all N items" buttons
- Add "Compare users" toggle when `filters.users.length >= 2`
- When compare mode is on, render split layout for each section

### New helper: Inline in process-tabs.tsx or small utility
- `splitByUser(items, getUserFn)` — groups items by user for comparison rendering

## Acceptance Criteria
- [ ] Cross-App Data Transfers shows max 10 by default with "Show all" button
- [ ] Top Activities shows max 10 by default with "Show all" button
- [ ] Application Usage shows max 10 by default with "Show all" button
- [ ] When 2+ users selected, "Compare users" toggle appears
- [ ] Compare mode shows per-user breakdown in each section
- [ ] ALL sections update when user filter changes (no stale data)
- [ ] Deselecting all users returns to aggregate view
