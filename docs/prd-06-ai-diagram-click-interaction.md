# PRD-06: AI Analysis — Diagram Node Click → Scroll to Recommendation

## Problem
In AI Analysis tab, clicking a circle/node in the Automation Matrix scatter plot does nothing. It should highlight and scroll to the specific recommendation that the node represents.

## Current State
- `AutomationMatrix` component renders an SVG scatter plot
- Each bubble represents a recommendation (positioned by complexity × impact)
- Recommendations are listed below the matrix as `RecommendationCard` components
- No click interaction connects the two
- **Note:** Gus intentionally removed ROI Calculator and BeforeAfter sections from AI tab — do NOT re-add them

## Requirements

### R1: Click Node → Highlight & Scroll to Recommendation
- Clicking a bubble in the Automation Matrix:
  1. Scrolls the page to the corresponding `RecommendationCard` below
  2. Highlights that card with a temporary glow/pulse animation (2-3 seconds)
  3. The bubble itself shows a selected state (thicker border or brighter fill)

### R2: Hover Enhancement
- Hovering a bubble shows a tooltip with: recommendation target name, type, impact level
- This may already partially exist — enhance if needed

### R3: Reverse Link
- Each `RecommendationCard` should have a small "Show on matrix" link/icon
- Clicking it scrolls up to the matrix and highlights the corresponding bubble

## Implementation

### File: `frontend/src/components/automation-matrix.tsx`
- Add `onClick` handler to each bubble SVG element
- On click: call `onBubbleClick(recommendationIndex: number)` callback prop
- Add selected state styling (ring/glow on the clicked bubble)

### File: `frontend/src/components/process-tabs.tsx` (AI tab section)
- Add refs to each `RecommendationCard` using `useRef` array
- When `onBubbleClick(index)` fires:
  - `recommendationRefs[index].current.scrollIntoView({ behavior: 'smooth', block: 'center' })`
  - Set `highlightedRecommendation` state to index
  - Clear highlight after 3 seconds with `setTimeout`
- Pass `isHighlighted` prop to `RecommendationCard`

### File: `frontend/src/components/recommendation-card.tsx`
- Accept `isHighlighted: boolean` prop
- When highlighted: add `ring-2 ring-amber-400 animate-pulse` classes (or custom glow)
- Add "Show on matrix ↑" button that calls `onShowOnMatrix()` prop
  - Scrolls to matrix, highlights the bubble

## Acceptance Criteria
- [ ] Clicking a bubble in Automation Matrix scrolls to the matching recommendation
- [ ] Recommendation card pulses/glows for ~3 seconds when scrolled to
- [ ] Bubble shows selected state when clicked
- [ ] "Show on matrix" link on each card scrolls back up and highlights bubble
- [ ] Smooth scroll animation
- [ ] Only one item highlighted at a time
