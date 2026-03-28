# PRD-12: Automation Readiness Matrix (Scatter Plot)

**Owner:** overnight agent
**Est:** 25 min
**Priority:** P1 — instant consulting credibility
**Status:** pending

---

## Why

Every management consultant uses a 2x2 matrix. Judges from business backgrounds instantly get it. This single visual communicates more than 10 recommendation cards.

## Design

A scatter plot on the AI Analysis tab (above or alongside recommendations):

```
  HIGH │         ★ Browsing Chrome
  VALUE│    ★ Use Outlook
  (time│  ★ Teams
  saved│                    ★ AI Searching
       │ ★ DevOps
  LOW  │____________________________
       LOW    EFFORT    HIGH
       (easy)         (complex)
```

### Axes
- **Y axis: Automation Value** = `estimated_time_saved_seconds × affected_cases_percentage / 100`
  (how much time would be saved if automated)
- **X axis: Automation Complexity** = inverse of score. Lower score = harder to automate.
  OR: `len(applications) + (1 if many_performers) + (1 if is_bottleneck)` — more apps/people/bottleneck = more complex

### Quadrants (labeled with light bg colors)
- **Top-Left: Quick Wins** (high value, low effort) — green tint — "Automate these first"
- **Top-Right: Strategic** (high value, high effort) — blue tint — "Plan these carefully"
- **Bottom-Left: Low Priority** (low value, low effort) — gray tint — "Nice to have"
- **Bottom-Right: Avoid** (low value, high effort) — red tint — "Not worth it"

### Implementation
Pure SVG, no chart library needed. Each recommendation becomes a dot:
- Dot size proportional to frequency
- Dot color by recommendation type (automate=green, eliminate=red, simplify=blue, etc.)
- Hover shows activity name + numbers
- Quadrant labels in light text

## Files
- `frontend/src/components/automation-matrix.tsx` (NEW)
- `frontend/src/components/process-tabs.tsx` — add to AI Analysis tab before recommendations

## Verification
- Scatter plot renders with dots in different quadrants
- Hover shows activity details
- Quadrant labels visible
- `cd frontend && npm run build` passes
