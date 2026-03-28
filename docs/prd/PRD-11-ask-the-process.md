# PRD-11: "Ask the Process" — Natural Language Query

**Owner:** overnight agent
**Est:** 30 min
**Priority:** P0 — WOW factor, nobody else will have this
**Status:** pending

---

## Why

This is the "holy shit" demo moment. A judge types a question, gets an answer from the data. It looks like the AI actually understands the process. In reality it's just Gemini with our pipeline stats as context — but the effect is magical.

## Design

### UI
Add a text input bar at the top of the AI Analysis tab (or as a floating bar across all tabs):

```
┌──────────────────────────────────────────────────────────────┐
│ 🔍 Ask about this process...                          [Ask] │
└──────────────────────────────────────────────────────────────┘
```

Below it, show the answer in a chat-like bubble:

```
Q: "Which activities waste the most time?"
A: "The top 3 time-consuming activities are Browsing in Chrome (1,118 occurrences × 7s = 2.2 hrs total),
    Use Outlook Application (441 × 8s = 58 min), and Develop kyp-frontend (242 × 36s = 2.4 hrs).
    The Outlook activity also has 169 copy-paste operations, making it a strong RPA candidate."
```

### Backend
**File:** `backend/api/main.py` — new endpoint:
```
POST /api/process/{id}/ask
Body: { "question": "which activities have the most copy-paste?" }
Response: { "answer": "..." }
```

**Implementation:**
1. Load PipelineOutput + CopilotOutput for the process_id
2. Build a context string with key stats:
   - Top 10 activities (name, frequency, duration, copy-paste, apps)
   - Top 5 bottlenecks (transition, wait time, severity)
   - Top 5 recommendations (target, type, reasoning)
   - Statistics summary
3. Send to Gemini: `system: "You are a process mining analyst. Answer questions about this process using ONLY the data provided. Be specific with numbers." + context + user question`
4. Return the response

**Fallback:** If no Gemini API key, return a template answer: "AI query requires Gemini API key. The data shows {total_activities} activities across {total_cases} cases."

### Frontend
**File:** `frontend/src/components/ask-process.tsx` (NEW)

- Input with submit button
- Loading state with typing animation dots
- Answer displayed in styled card
- Keep last 3 Q&A pairs visible (mini chat history)
- Works on AI Analysis tab

## Files
- `backend/api/main.py` — new `/ask` endpoint
- `backend/copilot/llm.py` — reuse existing `call_llm()`
- `frontend/src/components/ask-process.tsx` (NEW)
- `frontend/src/components/process-tabs.tsx` — add to AI Analysis tab
- `frontend/src/lib/api.ts` — add `askProcess()` function
- `frontend/src/lib/types.ts` — add AskResponse interface

## Verification
- Type a question, get a relevant answer with real numbers
- Works without API key (shows fallback)
- Loading state shows while waiting
- `cd frontend && npm run build` passes
