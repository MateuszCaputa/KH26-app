# PRD-08: User Journey — Multi-User Comparison & Cross-Tab Navigation

## Problem
1. User Journey only shows one user at a time. Should allow selecting multiple users and comparing their journeys side-by-side.
2. User journey insights should be linked to other tabs — if I see a user has a problematic pattern, I should be able to jump to the relevant bottleneck or activity.
3. Navigation across the site should be intelligent — clicking a user name anywhere should offer to view their journey.

## Current State
- `UserJourneyTimeline` has a single-user dropdown
- Renders one timeline at a time
- No cross-linking to other tabs
- Other tabs (Business Impact, Overview Performer Analysis) show user names but don't link to User Journey

## Requirements

### R1: Multi-User Selection & Comparison
- Replace single-user dropdown with **multi-select** (same pattern as Overview filter bar)
- When 1 user selected: show single timeline (current behavior)
- When 2+ users selected: show **stacked timelines** (one per user, aligned vertically)
  - Each timeline labeled with user name
  - Timelines aligned by time axis so you can visually compare
  - Shared activities between users highlighted with matching colors
  - A "Similarity score" shown between compared users (reuse Jaccard logic from PRD-05)

### R2: Activity Click → Cross-Tab Navigation
When clicking an activity block in the user journey timeline:
- Show a context menu / popover with options:
  - "View in Overview" → switches to Overview tab, filters by this activity
  - "View Bottlenecks" → switches to Bottlenecks tab, filters by transitions involving this activity
  - "View in Process Paths" → switches to Process Paths, highlights variants containing this activity
- The clicked activity's name is used to set the appropriate filter on the target tab

### R3: User Name Links Across All Tabs
In any tab where a user name appears (Business Impact table, Overview Performer Analysis, Process Paths clusters), the user name should be clickable:
- Click → navigate to User Journey tab with that user pre-selected
- Visual: underline on hover, cursor-pointer

**Specific locations:**
| Tab | Component | Where user name appears |
|---|---|---|
| Business Impact | Per-User Breakdown table | "User A", "User B" etc. in first column |
| Overview | Performer Analysis table | User names in performer list |
| Process Paths | User Clusters (from PRD-05) | User names in cluster cards |
| Bottlenecks | (via filter) | User filter dropdown items |
| Dashboard | (if users mentioned in wins) | Automation win descriptions |

### R4: Smart Navigation Consistency
- When navigating from another tab to User Journey, the user(s) should be pre-selected
- When navigating from User Journey to another tab, filters should reflect the user context
- Use a shared navigation function:
```tsx
function navigateToTab(tab: TabId, context?: { users?: string[], activity?: string }) {
  setActiveTab(tab);
  if (context?.users) setFilters(f => ({...f, users: context.users}));
  if (context?.activity) setFilters(f => ({...f, search: context.activity}));
}
```

## Implementation

### File: `frontend/src/components/user-journey-timeline.tsx`
- Change `selectedUser: string` prop to `selectedUsers: string[]`
- Render multiple timelines when multiple users selected
- Add similarity score display between compared users
- Add click handler on activity blocks → `onActivityClick(activityName: string)` callback
- Highlight shared activities across timelines

### File: `frontend/src/components/process-tabs.tsx`
- Add `navigateToTab(tab, context)` helper function
- Pass to `UserJourneyTimeline` as callback
- Update journey tab state to support multiple selected users
- Add click handlers on user names in:
  - Business Impact table
  - Overview Performer Analysis
  - Process Paths clusters
- Each click calls `navigateToTab('journey', { users: [userName] })`

### File: `frontend/src/components/business-impact.tsx`
- Accept `onUserClick: (userId: string) => void` prop
- Make user names in the breakdown table clickable

## Acceptance Criteria
- [ ] User Journey allows selecting multiple users
- [ ] 2+ users shows stacked, aligned timelines
- [ ] Similarity score displayed between compared users
- [ ] Shared activities highlighted across timelines
- [ ] Clicking activity block shows navigation options to other tabs
- [ ] User names clickable in Business Impact → navigates to User Journey
- [ ] User names clickable in Overview Performer Analysis → navigates to User Journey
- [ ] Navigation preserves context (filters set appropriately on target tab)
- [ ] Back-and-forth navigation works without losing state
