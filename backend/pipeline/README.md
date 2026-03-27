# Pipeline Module

**Owner:** pipeline-owner
**Purpose:** Ingest event log CSVs and produce structured process analysis (PipelineOutput).

## What To Build (Priority Order)

### P0 — Must have for demo
1. **CSV Ingestion** — Parse uploaded CSV into pm4py EventLog format. Handle columns: `case_id`, `activity`, `timestamp`, `user`, `department`, `cost`. File: `ingest.py`
2. **Process Discovery** — Use pm4py alpha miner or heuristics miner to discover the process model. Extract activities, frequencies, transitions. File: `discovery.py`
3. **Variant Analysis** — Identify unique process variants (sequences of activities per case). Sort by frequency. File: `variants.py`
4. **Bottleneck Detection** — Calculate wait times between consecutive activities. Flag transitions with high avg wait time. Assign severity (low/medium/high/critical). File: `bottlenecks.py`

### P1 — Nice to have
5. **Process Map Generation** — Build a graph (nodes=activities, edges=transitions with weights). Use networkx. File: `process_map.py`
6. **Statistics** — Total cases, events, activities, variants, avg/median case duration. File: `statistics.py`

### P2 — Stretch goals
7. **Performer Analysis** — Which users do which activities, handoff patterns. File: `performers.py`
8. **Cycle Detection** — Find loops in the process (e.g., rework cycles). File: `cycles.py`

## Output Contract

Your module produces a `PipelineOutput` (defined in `backend/models.py`). Every function should contribute data toward filling this model. See `contracts/pipeline_output.json` for the full schema.

## Key Libraries
- `pm4py` — process mining (discovery, conformance, variant analysis)
- `pandas` — data manipulation
- `networkx` — graph construction and analysis

## Testing
- `pytest backend/pipeline/tests/ -x`
- Use `data/sample_event_log.csv` for all tests
- Test edge cases: empty CSV, single-case log, missing columns
