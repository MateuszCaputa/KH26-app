# PRD-03: Comprehensive Tooltips for All Metrics and UI Elements

## Problem
Mentors couldn't understand what metrics mean. During a presentation, not knowing what a progress bar or number represents is unacceptable. Every non-obvious data point needs a tooltip explaining what it is and why it matters.

## Current State
- `InlineTooltip` component exists (imported in `process-tabs.tsx`)
- **Tab-level tooltips DONE** (Gus added tooltips to all tab buttons in TABS array)
- **Bottleneck table headers DONE** (Gus replaced table with expandable BottleneckRow component with BottleneckInsight)
- **Font visibility improved** (Gus bumped text sizes from 9-10px to 11-12px, zinc-500→zinc-400)
- Remaining gaps: progress bars in tables, severity badges, stat pills on dashboard, chart labels, filter controls, all other tab content metrics

## Requirements

### R1: Audit and Add Tooltips to ALL Ambiguous UI Elements

**Dashboard tab (`executive-dashboard.tsx`):**
| Element | Tooltip Text |
|---|---|
| "MONTHLY COST OF UNAUTOMATED MANUAL WORK" | "Total monthly cost of time wasted on tasks that could be automated, based on employee hourly rates and observed manual work patterns" |
| "walking out the door" | "This money is lost every month to inefficient manual processes — equivalent to paying employees to do work a machine could do" |
| "Automation Waste X%" | "Percentage of total observed work time spent on automatable tasks (copy-paste, waiting, manual data entry)" |
| "Avg Case Duration" | "Average time from start to finish for a single process execution across all observed cases" |
| "Potential Monthly Savings" | "Estimated monthly cost reduction if top automation recommendations are implemented" |
| Each automation win card | "Recommended automation target ranked by potential time and cost savings" |
| Win "SAVE PER MONTH" value | "Estimated monthly savings from automating this specific activity, based on frequency × time per occurrence × hourly rate" |
| "X recovered" hours | "Hours of employee time freed up per month if this automation is implemented" |
| "WHERE TIME ACTUALLY GOES" labels | Each category: Core Work = "Time spent on value-adding activities", Manual Data Transfer = "Time copying data between systems", Coordination = "Time in meetings, emails, chat", Waiting/Blocked = "Idle time between steps — employee waiting for system or approval" |
| "BIGGEST SINGLE BOTTLENECK" severity badge | "Severity rating: Critical = >1hr avg wait, High = 15min-1hr, Medium = 5-15min, Low = <5min" |
| Bottleneck "AVG WAIT" | "Average time employees wait at this step before proceeding" |
| Bottleneck "CASES AFFECTED" | "Number of process executions that encountered this bottleneck" |
| Bottleneck "TOTAL TIME LOST" | "Cumulative time lost across all cases hitting this bottleneck" |

**Overview tab (process-tabs.tsx overview section):**
| Element | Tooltip Text |
|---|---|
| Health Score | "Overall process health: combines automation potential, bottleneck severity, and process consistency. Higher = healthier" |
| Cost of Inaction | "What this process costs annually if nothing changes — based on current waste rates projected over 12 months" |
| "Activities" stat | "Distinct process steps identified in the data" |
| "Variants" stat | "Unique paths (sequences of steps) observed across all cases — fewer variants = more consistent process" |
| "Bottlenecks" stat | "Transition points where cases experience significant delays" |
| "Users" stat | "Distinct employees observed performing this process" |
| Performer Analysis progress bar | "Relative workload compared to the busiest user. Full bar = highest activity count among all users" |
| Application Usage bars | "Proportion of total observed time spent in this application" |
| Cross-App Data Transfer entries | "Manual copy-paste operations detected between these two applications — prime candidate for automated data integration" |

**Business Impact tab (`business-impact.tsx`):**
| Element | Tooltip Text |
|---|---|
| "Lost/day" column | "Total productive time lost per day for this user across all waste categories (waiting + copy-paste + context switching)" |
| "Monthly cost" column | "Monthly cost of this user's wasted time = Lost/day × working days × hourly rate" |
| "Top waste" column | "The waste category consuming the most time for this user" |
| "Relative waste" progress bar | "This user's waste relative to the most wasteful user. Full bar = highest waste in the team" |
| Wage configuration area | "Set hourly rates to calculate accurate cost projections. Rates should include benefits and overhead (loaded cost)" |

**Bottlenecks tab:**
| Element | Tooltip Text |
|---|---|
| "Avg wait" column | "Mean waiting time between the 'from' and 'to' activities across all observed cases" |
| "Max wait" column | "Longest observed wait time — indicates worst-case scenario" |
| "Cases" column | "Number of process executions where this transition occurred" |
| Severity badge | Same as dashboard: "Critical = >1hr avg wait, High = 15min-1hr, Medium = 5-15min, Low = <5min" |

**Process Paths tab:**
| Element | Tooltip Text |
|---|---|
| Variant percentage | "Percentage of all cases that followed this exact sequence of steps" |
| Case count | "Number of process executions following this path" |
| "deviation" count | "Steps in this variant that differ from the most common (happy) path — more deviations = more process inconsistency" |
| Loop notation "×N" | "This sequence of steps was repeated N times — may indicate rework or correction loops" |
| Amber-highlighted steps | "This step deviates from the happy path (most common variant)" |

**AI Analysis tab:**
| Element | Tooltip Text |
|---|---|
| Automation Matrix axes | X: "Complexity score: higher = more apps, users, and bottlenecks involved", Y: "Impact score: higher = more time saved across more cases" |
| Matrix bubble size | "Bubble size represents how frequently this activity occurs" |
| Recommendation type badges | automate: "Replace with software (RPA/script)", eliminate: "Remove entirely — pure waste", simplify: "Reduce steps or complexity", parallelize: "Run steps concurrently instead of sequentially", reassign: "Move to a more efficient team/system" |
| "Time saved" | "Estimated time reduction per case if this recommendation is implemented" |
| "Affected cases" | "Percentage of total cases that would benefit from this change" |

**User Journey tab:**
| Element | Tooltip Text |
|---|---|
| Timeline block width | "Block width proportional to time spent on this activity" |
| Color legend | Green: "Core work — value-adding activity", Orange: "Manual data transfer — copy-paste between systems", Blue: "Coordination — meetings, emails, communication", Red: "Bottleneck — waiting or blocked" |

### R2: Tooltip Implementation Pattern
- Use existing `InlineTooltip` component for inline text tooltips
- For table column headers: add `title` attribute or wrap header text in `InlineTooltip`
- For progress bars: wrap in a container with tooltip showing the actual value + explanation
- For chart elements: use hover state (already exists in some charts)
- Tooltip style: consistent with dark theme, max-width 300px, slight delay (200ms)

## Implementation

### Files to modify:
1. `executive-dashboard.tsx` — Add tooltips to all dashboard metrics
2. `process-tabs.tsx` — Overview tab sections, bottleneck table headers, variant cards, AI analysis labels
3. `business-impact.tsx` — Table headers, progress bars, wage config area
4. `user-journey-timeline.tsx` — Timeline blocks, color legend
5. `automation-matrix.tsx` — Axis labels, bubble tooltips
6. `filter-bar.tsx` — Filter control labels if not self-explanatory

### Tooltip component usage:
```tsx
<InlineTooltip text="Explanation here">
  <span>Metric Label</span>
</InlineTooltip>
```

For table headers:
```tsx
<th>
  <InlineTooltip text="Mean waiting time between activities">
    Avg wait
  </InlineTooltip>
</th>
```

## Acceptance Criteria
- [ ] Every metric on Dashboard has a tooltip
- [ ] Every column header in every table has a tooltip
- [ ] Every progress bar has a tooltip explaining the value
- [ ] Every severity badge has a tooltip
- [ ] Every chart axis/legend has a tooltip
- [ ] Every stat card has a tooltip
- [ ] Tooltips are concise (1-2 sentences max)
- [ ] No tooltip covers important content when shown
- [ ] Consistent styling across all tabs
