# PRD-16: Tooltips on Everything

**Owner:** team member
**Est:** 30 min
**Priority:** P0 — mentor specifically asked for this
**Status:** pending

---

## Why

Mentor feedback: hovering over any number should explain what it means. Currently tooltips exist on section headers and stat card labels, but NOT on individual data values like "1,118" frequency, "7s" duration, "55" copy-paste count, deviation counts, health sub-scores, etc.

## Tasks

### 16A. Activity table values

**File:** `frontend/src/components/process-tabs.tsx` — Top Activities table body

Wrap data values with title attributes or InlineTooltip:
- Frequency number: `"This activity occurred {n} times across all cases"`
- Duration: `"Average time per occurrence of this activity"`
- Copy-paste count: `"{n} copy and paste operations detected — manual data transfer between applications"`
- Ctx Switches: `"{n} times users switched between applications during this activity"`
- Application badges: `"This activity was performed using {app}"`

### 16B. Bottleneck table values

**File:** `frontend/src/components/process-tabs.tsx` — Bottlenecks tab

- Avg Wait value: `"Average delay of {duration} between these two activities"`
- Max Wait value: `"Longest observed delay was {duration} — worst case scenario"`
- Case count: `"This delay occurred in {n} out of {total} cases ({pct}%)"`
- Severity badge: already has tooltip? If not: `"Severity based on wait time: critical >1h, high >10m, medium >2m"`

### 16C. Variant card values

**File:** `frontend/src/components/process-tabs.tsx` — VariantCard

- Percentage: `"This variant represents {pct}% of all observed process executions"`
- Case count: `"{n} cases followed this exact path"`
- Duration: `"Average total time for cases following this variant"`
- Step count: `"Total number of distinct steps in this variant"`
- Deviation count: `"{n} steps in this variant differ from the most common path"`
- Loop ×N badges: `"This pattern of {steps} repeated {n} times consecutively"`

### 16D. Health score sub-scores

**File:** `frontend/src/components/health-score.tsx`

- Standardization score: `"Based on variant count — fewer variants = more standardized process (score: {n}/100)"`
- Bottlenecks score: `"Based on critical/high severity bottleneck count (score: {n}/100)"`
- Automation score: `"Based on copy-paste operation ratio — lower = healthier (score: {n}/100)"`

### 16E. ROI calculator values

**File:** `frontend/src/components/roi-calculator.tsx`

- Annual savings: `"Projected savings if all recommended automations are implemented"`
- Per-recommendation savings: `"Based on {time_saved}s saved × {cases} affected cases × hourly rate"`

### 16F. Stat cards

- Cases: already has tooltip
- Events: already has tooltip
- Top Bottleneck value: `"{from} → {to}: average wait of {duration}, severity {level}"`
- Automation Candidates value: `"{n} activities detected with >10 copy-paste operations — strong RPA candidates"`

### Implementation Note

For simple value tooltips, use native `title` attribute (it's fine for numbers — the delay is acceptable and avoids portal complexity). Reserve the `InlineTooltip` component for column headers where the popup needs to be more visible.

## Verification
- Hover over ANY number in the dashboard — should see explanatory text
- No hydration errors
- `cd frontend && npm run build` passes
