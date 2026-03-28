# PRD-01: Dashboard Navigation & Cross-Tab Linking

## Problem
Dashboard cards (Top Automation Wins, Where Time Goes, Biggest Bottleneck) are static. Clicking them does nothing. Users expect clicking a card to navigate to the relevant tab with more detail. Mentors flagged this as a gap.

## Current State
- `ExecutiveDashboard` renders cards: Top 3 Automation Wins, Time Breakdown donut, Biggest Single Bottleneck
- Tab switching is via `setActiveTab(tabId)` in `ProcessTabs`
- No click handlers on dashboard cards
- Cards in the top row (stat cards: Automation Waste, Avg Case Duration, Potential Monthly Savings) also don't navigate

## Requirements

### R1: Dashboard Cards → Tab Navigation
Each dashboard section must be clickable and navigate to the most relevant tab:

| Dashboard Section | Target Tab | Rationale |
|---|---|---|
| "MONTHLY COST OF UNAUTOMATED MANUAL WORK" header stats | `impact` (Business Impact) | Detailed cost breakdown |
| Stat pill "Automation Waste 76%" | `overview` (Overview) | Category breakdown of waste |
| Stat pill "Avg Case Duration" | `variants` (Process Paths) | Per-variant durations |
| Stat pill "Potential Monthly Savings" | `impact` (Business Impact) | ROI details |
| Top Automation Wins cards (#1, #2, #3) | `ai` (AI Analysis) | Full recommendation + blueprint |
| "WHERE TIME ACTUALLY GOES" donut | `overview` (Overview) | Activity breakdown |
| "BIGGEST SINGLE BOTTLENECK" card | `bottlenecks` (Bottlenecks) | Full bottleneck table |

### R2: Visual Affordance
- Each clickable card must show `cursor-pointer` on hover
- Subtle hover effect: slight border glow or brightness increase (consistent with dark theme)
- Small arrow icon or "View details →" text in the bottom-right corner of each card

### R3: Collapsible Summary Cards on Dashboard
- Each dashboard section should be collapsible (accordion-style)
- Default state: expanded (showing current content)
- When collapsed: show only the section title + 1-line summary (e.g., "3 automation wins found", "76% waste", "21s avg wait")
- Use existing `CollapsibleSection` component pattern

## Implementation

### File: `frontend/src/components/executive-dashboard.tsx`
- Accept new prop: `onNavigate: (tab: TabId) => void`
- Wrap each section in a clickable container that calls `onNavigate(targetTab)`
- Add hover styles via Tailwind: `hover:ring-1 hover:ring-amber-500/30 cursor-pointer transition-all`
- Add "View details →" footer text to each card

### File: `frontend/src/components/process-tabs.tsx`
- Pass `onNavigate={setActiveTab}` to `<ExecutiveDashboard>`
- The 4 `StatCard` components at the top of ProcessTabs should also be clickable:
  - Activities stat → `overview`
  - Variants stat → `variants`
  - Bottlenecks stat → `bottlenecks`
  - Users stat → `journey`

## Acceptance Criteria
- [ ] Every dashboard card/section has a click handler that switches to the correct tab
- [ ] Hover state is visually clear (cursor + glow)
- [ ] "View details →" text appears on each section
- [ ] StatCards at top of page also navigate
- [ ] No broken navigation (all tab IDs match `TabId` type)
