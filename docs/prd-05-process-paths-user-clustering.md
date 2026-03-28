# PRD-05: Process Paths — User Activity Clustering & Blueprint View

## Problem
1. No way to understand if two users do similar work (e.g., both Java developers vs. different roles). Mentors want activity-based clustering in Process Paths.
2. Process Paths tab lacks a visual process map/blueprint — the blueprint from AI Analysis should be accessible here too.

## Current State
- Process Paths tab shows top 10 `Variant` objects with compressed sequences
- `VariantFilterBar` allows filtering by users and min case count
- No clustering or similarity analysis exists
- Blueprint/process diagram only exists in AI Analysis tab and Workflow Diagram tab
- Activities have `performers: string[]` and `applications: string[]` fields

## Requirements

### R1: User Activity Clustering
Add a "User Similarity" section at the top of Process Paths tab:

**Clustering logic (frontend-computed, no backend needed):**
1. For each user, build an activity profile: `{ activityName: frequency }` (from `activity.performers`)
2. Compute pairwise similarity between users using Jaccard index on activity sets:
   - `similarity(A, B) = |activities(A) ∩ activities(B)| / |activities(A) ∪ activities(B)|`
3. Group users into clusters where similarity > 0.6 (threshold)
4. Label clusters by their most common shared activities (e.g., "Development group: IntelliJ, Code, Git" vs. "Communication group: Teams, Outlook, Email")

**UI:**
- Section title: "User Clusters — Who Does Similar Work?"
- Each cluster shown as a card:
  - Cluster label (auto-generated from top shared apps/activities)
  - List of users in cluster
  - Shared activities listed
  - Similarity score shown as percentage
- Users not fitting any cluster shown as "Unclustered"

### R2: User Comparison Mode
When 2+ users are selected in the variant filter bar:
- Show a **comparison panel** above the variants list:
  - Side-by-side: User A's top activities vs. User B's top activities
  - Shared activities highlighted
  - Unique activities per user marked
  - Similarity score between selected users
  - Common process paths they both follow (variants where both users appear)

### R3: Process Blueprint in Process Paths Tab
Add a collapsible section "Process Blueprint" at the bottom of Process Paths:
- If AI analysis has run (`copilot` data available): show the same process flow diagram as in AI Analysis
- If AI analysis has NOT run: show a simplified auto-generated flow from the top variant's sequence
  - Linear flow: step1 → step2 → step3 → ... rendered as connected boxes
  - Use the same visual style as the BPMN viewer (colored nodes for bottlenecks/automation targets)
- This section does NOT require users to run AI analysis — a basic flow is always available

**Without AI (always available):**
- Take top variant sequence
- Render as horizontal/vertical flow of connected step boxes
- Color steps: normal = gray, bottleneck transitions = red border, high copy-paste = blue border

**With AI (after analysis):**
- Show the same enriched diagram from AI Analysis tab
- Include recommendation overlays (green = automate, red = bottleneck, etc.)

## Implementation

### File: `frontend/src/components/process-tabs.tsx` (variants tab section)

**R1 — Clustering:**
```tsx
// Compute user activity profiles
const userProfiles = useMemo(() => {
  const profiles: Record<string, Set<string>> = {};
  for (const act of pipeline.activities) {
    for (const perf of act.performers) {
      if (!profiles[perf]) profiles[perf] = new Set();
      profiles[perf].add(act.name);
    }
  }
  return profiles;
}, [pipeline.activities]);

// Compute clusters using Jaccard similarity
```

Render cluster cards above variant list.

**R2 — Comparison:**
When `filters.users.length >= 2`, render comparison panel showing shared vs. unique activities.

**R3 — Blueprint:**
- Accept `copilot` prop in variants section
- If copilot available: render process diagram from copilot recommendations
- If not: render simple flow from `pipeline.variants[0].sequence`
- Use inline SVG similar to `BpmnViewer` approach (simple boxes + arrows)

## Acceptance Criteria
- [ ] "User Clusters" section appears at top of Process Paths showing auto-detected groups
- [ ] Clusters are labeled by shared activities/apps
- [ ] Selecting 2+ users shows comparison panel with similarity analysis
- [ ] Shared activities highlighted, unique activities marked
- [ ] Process blueprint section always shows a flow diagram
- [ ] Blueprint enriched with AI data when available
- [ ] Blueprint respects current user filter (highlights paths for selected users)
