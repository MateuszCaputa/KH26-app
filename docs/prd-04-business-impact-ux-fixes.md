# PRD-04: Business Impact — Per-User Breakdown Placement & Wage Input Fix

## Problem
1. When clicking a user row in Per-User Breakdown, the detail panel appears at the BOTTOM of the entire user list. It should expand directly below that user's row (inline accordion).
2. The native browser number input spinners (up/down arrows) on the wage €/h field look ugly and inconsistent with the dark theme. Remove them — typing a number directly is sufficient.

## Current State
- `BusinessImpact` component has a `Per-User Breakdown` table
- Clicking a user row sets `expandedUser` state → renders detail section
- Detail section renders AFTER the full user list table (see screenshot #27: User C detail at bottom)
- Wage input uses `<input type="number">` which shows native OS spinner arrows (screenshot #28)

## Requirements

### R1: Inline User Detail (Accordion Below Row)
- When a user row is clicked, the detail panel (wasteful activities, bottlenecks, time breakdown) must appear as an **expanded row directly below the clicked user**
- Only one user can be expanded at a time
- Clicking the same user again collapses it
- Clicking a different user collapses the previous and expands the new one
- The expanded detail uses the full table width (colspan across all columns)
- Visual: subtle indentation or left-border accent to show it belongs to the user above

### R2: Remove Native Number Spinners on Wage Input
- Hide the native browser up/down arrows on `<input type="number">`
- Use CSS to remove spinners:
```css
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
}
```
- Alternatively, switch to `<input type="text" inputMode="numeric" pattern="[0-9]*">` for cleaner UX
- User can still type numbers freely, just no spinner arrows

## Implementation

### File: `frontend/src/components/business-impact.tsx`

**R1 — Inline accordion:**
Current structure (WRONG):
```
<table>
  {users.map(user => <tr>...user row...</tr>)}
</table>
{expandedUser && <div>...detail panel...</div>}  ← AT BOTTOM
```

New structure (CORRECT):
```
<table>
  {users.map(user => (
    <>
      <tr onClick={() => toggle(user)}>...user row...</tr>
      {expandedUser === user.id && (
        <tr><td colSpan={5}>...detail panel...</td></tr>  ← INLINE
      )}
    </>
  ))}
</table>
```

**R2 — Spinner removal:**
Add Tailwind utility or inline style to the wage `<input>`:
```tsx
<input
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  className="... [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
/>
```

## Acceptance Criteria
- [ ] Clicking a user row expands detail DIRECTLY below that row
- [ ] Only one user expanded at a time
- [ ] Re-clicking collapses
- [ ] Detail panel spans full table width
- [ ] No native number spinners visible on wage input (Chrome, Safari, Firefox)
- [ ] User can still type numbers in wage input
- [ ] No layout shift when expanding/collapsing user detail
