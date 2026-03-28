# PRD-13: User Performance Comparison

**Owner:** overnight agent
**Est:** 20 min
**Priority:** P1 — shows depth of analysis beyond process-level
**Status:** pending

---

## Why

Goes beyond process analysis into workforce intelligence. "User A takes 3x longer than User B for the same task" is a concrete, actionable insight. Shows the copilot doesn't just find process problems — it finds people-level optimization opportunities (training needs, best practice sharing).

## Design

New section on Overview tab (or expandable panel): "Performer Analysis"

### Data Source
Activities already have `performers: string[]` list. The raw pipeline data has per-user durations. We need to aggregate:
- Per user: total events, total duration, most-used apps, avg case duration
- Comparison: who's fastest/slowest for shared activities

### Backend
**File:** `backend/pipeline/pipeline.py` or `backend/pipeline/discovery.py`

Add to PipelineOutput:
```python
class PerformerStats(BaseModel):
    user: str
    total_events: int
    total_duration_seconds: float
    avg_activity_duration_seconds: float
    top_applications: list[str]
    activity_count: int

# Add to PipelineOutput:
performer_stats: list[PerformerStats] = []
```

Compute from raw DataFrame: group by `org:resource`, aggregate.

### Frontend
**File:** `frontend/src/components/process-tabs.tsx` — new CollapsibleSection on Overview

Show as a ranked table:
```
| User      | Events | Avg Duration | Top Apps        | Activities |
| User A    | 1,240  | 8.2s         | Chrome, Teams   | 45         |
| User B    | 980    | 12.1s        | Outlook, Chrome | 38         |
```

Highlight the fastest performer in green, slowest in amber.

Add a small bar chart showing relative workload per user.

### Privacy note
Data already has real usernames from KYP.ai CSV. For demo purposes this is fine — it's task mining data meant to be analyzed per user.

## Files
- `backend/models.py` — add PerformerStats model
- `backend/pipeline/discovery.py` or `pipeline.py` — compute stats
- `frontend/src/lib/types.ts` — add TypeScript interface
- `frontend/src/components/process-tabs.tsx` — add section

## Verification
- Overview tab shows Performer Analysis section
- Users listed with real metrics
- Sorted by some meaningful metric (events or duration)
- `cd frontend && npm run build` passes
