# Project Status — KrakHack 2026 Process Copilot

**Last updated:** 2026-03-27 ~22:00 (T+4h into hackathon)
**Demo:** 2026-03-28 17:30 (~19.5h remaining)

---

## What Works End-to-End

Upload CSV → Pipeline discovers process → Copilot analyzes & recommends → Frontend displays all tabs.

Tested with real KYP.ai Task Mining data. Full pipeline runs in ~30-60s on 3 CSV files.

## Module Status

### Pipeline (backend/pipeline/) — DONE
- CSV ingestion with chunked reading, Business ID fallback to UUID sessions
- Process discovery: activities, frequencies, durations, performers, apps
- Variant analysis: sequences, case counts, percentages
- Bottleneck detection: wait times between steps, severity classification
- Process map: graph with nodes/edges
- Application usage: active/passive time per app
- `max_files` param for demo mode (loads smallest files first)
- **14 tests** (5 need real dataset in expected path)

### Copilot (backend/copilot/) — DONE
- Process analyzer: generates natural language summary
- Automation recommender: scores activities by copy-paste, frequency, bottleneck severity → ranked recommendations
- BPMN generator: produces BPMN 2.0 XML with diagram layout
- Reference comparison: compares discovered process vs provided model (67).bpmn
- LLM integration: Anthropic API with graceful fallback (works without API key)
- **14 tests passing**

### API (backend/api/) — DONE
- Upload CSV, run pipeline, run copilot, get results, get BPMN
- `/api/run-local` endpoint for demo mode (processes local Dataset folder)
- In-memory store (data lost on server restart)
- CORS configured for localhost:3000
- **5 tests passing**

### Frontend (frontend/) — FUNCTIONAL, NEEDS POLISH
- Home page: demo button + drag-and-drop upload
- Process view: 5 tabs (Overview, Bottlenecks, Variants, AI Analysis, BPMN)
- Duration/date formatting centralized
- Activity/bottleneck lists capped with "show more"
- BPMN viewer: bpmn-js renders, CSS imported, white background
- **Builds clean, no test failures**

## Known Issues

### HIGH Priority (Demo Blockers)
1. **BPMN diagram quality** — Generated BPMN is a linear chain (Start→A→B→C→End), not a real process graph. Activity names include garbage (URLs, system processes). The name filter was deployed but old cached results still show. Need to re-run analysis AND potentially use the reference BPMN model.
2. **Data path mismatch** — Dataset lives at `Dataset/` locally but some code references `Process-to-Automation Copilot Challenge/Dataset/`. Causes test failures and potential runtime issues.
3. **AI Analysis tab** — Pipeline guy working on this. Status unknown.
4. **In-memory store** — Server restart loses all data. Acceptable for demo but risky.

### MEDIUM Priority (Polish)
5. **Recommendations all say "automate"** — Copilot recommender scoring produces same type for most activities. Needs tuning for variety.
6. **No process graph visualization** — Overview tab has activities table but no visual flowchart of the process (the process_map data exists but isn't rendered).
7. **Module boundary violations** — Copilot guy modified API files. Merged but future changes need coordination.

### LOW Priority (Nice to Have)
8. **Live alert mode** — Mentor suggested treating logs as live stream with real-time alerts. Would be WOW factor but significant work.
9. **Reference BPMN comparison** — Backend generates it, frontend doesn't display it prominently.
10. **Recommendation explainability** — Mentor emphasized "explainable" — current reasoning text is template-based, not LLM-enhanced.

## What the Mentor Wants to See

From the mentor conversation (Maciej Krzywda):
1. **Closed loop**: detect problem → interpret → recommend → generate artifact ✅ We have all 4
2. **Explainable recommendations** — with justification ✅ We have reasoning text
3. **Generated artifacts** — BPMN, rules, pseudo-RPA ⚠️ BPMN quality needs work
4. **Live alerts from log stream** ❌ Not implemented
5. **Small specialized models > one big LLM** ✅ Our recommender is heuristic-based, not LLM

## Next Tasks (Priority Order)

| # | Task | Est. | Impact | Owner |
|---|------|------|--------|-------|
| 1 | Fix data path — symlink Dataset/ → expected location, re-run clean analysis | 10 min | Unblocks everything | Mateusz |
| 2 | BPMN quality — render reference model (67).bpmn as "discovered process", show generated as "optimized" | 30 min | Demo WOW — the artifact the mentor asked for | Mateusz |
| 3 | Process graph visualization — render process_map nodes/edges as visual flowchart on Overview tab | 45 min | Visual impact, currently just a table | Mateusz |
| 4 | Recommendation variety — tune copilot recommender to mix types (simplify, eliminate, parallelize, not just automate) | 20 min | Makes AI Analysis tab more convincing | Pipeline/Copilot guy |
| 5 | AI Analysis tab — verify it works end-to-end, fix any issues | 15 min | Pipeline guy working on this | Pipeline guy |
| 6 | Demo script — write the exact narrative and click sequence for jury presentation | 30 min | Do at T-2h before demo (15:30) | All |
| 7 | (Stretch) Live alert mode — fake streaming animation on overview, treat log as live feed | 1h+ | Mentor's WOW suggestion, only if time | Anyone |
| 8 | (Stretch) LLM-enhanced summaries — wire Gemini API for richer analysis text | 30 min | Makes AI output less template-y | Copilot guy |

## Tech Stack

- Backend: Python 3.13, FastAPI, pm4py, pandas, networkx, pydantic
- Frontend: Next.js 16, shadcn/ui, Tailwind, bpmn-js, TypeScript
- LLM: Anthropic API (optional, graceful fallback)
- No database, no deployment — localhost demo only

## Test Summary

| Module | Pass | Fail | Error | Notes |
|--------|------|------|-------|-------|
| API | 5 | 0 | 0 | All good |
| Copilot | 14 | 0 | 0 | All good |
| Pipeline (models) | 2 | 0 | 0 | All good |
| Pipeline (data) | 0 | 5 | 15 | Need dataset at expected path |
| Frontend | builds | — | — | No test suite |
| **Total** | **22** | **5** | **15** | Data path issue only |
