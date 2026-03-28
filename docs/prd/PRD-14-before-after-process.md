# PRD-14: Before/After Process Comparison

**Owner:** overnight agent
**Est:** 25 min
**Priority:** P2 — visual proof that recommendations work
**Status:** pending

---

## Why

"Here's your process now. Here's your process after automation." Side by side. This is the money shot for the demo — it proves our copilot doesn't just analyze, it designs a better process.

## Design

On the AI Analysis tab, after recommendations, show a comparison card:

```
┌─────────────────────────────────────────────────────────┐
│  Current Process              Optimized Process          │
│                                                          │
│  12 activities                7 activities (-42%)        │
│  70 avg steps/case            38 avg steps/case (-46%)   │
│  18h 53m avg duration         ~10h 12m estimated (-46%)  │
│  5 bottlenecks (high+)        2 bottlenecks (reduced)    │
│  847 copy-paste ops           ~85 copy-paste ops (-90%)  │
│                                                          │
│  [Current]  ████████████████████  100%                   │
│  [Optimized] ██████████░░░░░░░░░  54%                    │
└─────────────────────────────────────────────────────────┘
```

### Computation (frontend-only)
For "optimized" estimates, use the recommendations data:
- **Activities removed:** count recommendations with type="eliminate"
- **Time saved:** sum `estimated_time_saved_seconds` across all recommendations, multiply by case frequency
- **Copy-paste reduced:** for "automate" type recommendations targeting high-copy-paste activities, estimate 90% reduction
- **Bottlenecks reduced:** count recommendations targeting bottleneck activities

These are estimates, clearly labeled as "projected" — but they're computed from real analysis, not invented.

### UI
- Two-column comparison card
- Left column: current metrics (from pipeline stats)
- Right column: projected metrics (computed from recommendations)
- Percentage change badges (green for improvement)
- A simple horizontal bar comparing current vs optimized total duration

## Files
- `frontend/src/components/before-after.tsx` (NEW)
- `frontend/src/components/process-tabs.tsx` — add to AI Analysis tab

## Verification
- Comparison card shows on AI Analysis tab (after running analysis)
- Numbers are derived from real pipeline + copilot data
- Percentage reductions are reasonable (not >100%)
- `cd frontend && npm run build` passes
