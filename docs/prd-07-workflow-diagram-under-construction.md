# PRD-07: Workflow Diagram — Mark as "Under Construction"

## Problem
Workflow Diagram feature is being dropped. Tab should remain but show "UNDER CONSTRUCTION" prominently.

## Current State
- **Gus already removed the `bpmn` tab from the TABS array** — it no longer appears in navigation
- However, the `BpmnTabContent` rendering code still exists in process-tabs.tsx (dead code for `activeTab === 'bpmn'`)
- The BPMN viewer components (`BpmnViewer`, `BpmnTabContent`) still exist as files
- Mentor said the tab should REMAIN visible but show "Under Construction"

## Requirements

### R1: Re-add Tab to Navigation with "Under Construction" Label
- Add `bpmn` back to TABS array with label "Workflow Diagram" and tooltip "Under construction — being redesigned"
- Replace tab content with centered "UNDER CONSTRUCTION" message
- Keep the tab in the same position (after AI Analysis, before Live Monitor)

### R2: Replace Tab Content
- Remove all BPMN rendering logic from the `bpmn` tab case
- Show centered placeholder message

## Implementation

### File: `frontend/src/components/process-tabs.tsx`
1. Add back to TABS array:
```tsx
{ id: 'bpmn', label: 'Workflow Diagram', tooltip: 'Under construction — this feature is being redesigned' },
```
Place it after `ai` and before `live`.

2. Replace the `activeTab === 'bpmn'` content block with:
```tsx
{activeTab === 'bpmn' && (
  <div className="flex flex-col items-center justify-center py-24 text-center">
    <div className="text-6xl mb-4">🚧</div>
    <h2 className="text-2xl font-bold text-white mb-2">UNDER CONSTRUCTION</h2>
    <p className="text-zinc-400">This feature is being redesigned and will be available soon.</p>
  </div>
)}
```

Do NOT remove `BpmnViewer` imports or component files — keep them for future use. Just don't render them.

## Acceptance Criteria
- [ ] Workflow Diagram tab shows "UNDER CONSTRUCTION" centered text
- [ ] No BPMN viewer or controls are visible
- [ ] Tab still appears in navigation
- [ ] No console errors from removed rendering
