# Copilot Module

**Owner:** copilot-owner
**Purpose:** AI agent that analyzes PipelineOutput, recommends automation targets, and generates BPMN workflow definitions.

## What To Build (Priority Order)

### P0 — Must have for demo
1. **Process Analyzer** — Takes PipelineOutput, uses an LLM to generate a natural language summary of the process: what it does, how many variants, key patterns. File: `analyzer.py`
2. **Bottleneck Explainer** — Takes bottleneck data, uses LLM to explain WHY each bottleneck matters and what causes it. File: `explainer.py`
3. **Automation Recommender** — Analyzes activities and bottlenecks. Recommends which steps to automate/eliminate/simplify/parallelize. Each recommendation has: type, reasoning, impact, priority. File: `recommender.py`
4. **BPMN Generator** — Generates valid BPMN 2.0 XML from the discovered process. The BPMN should represent the optimized process (after applying recommendations). File: `bpmn_generator.py`

### P1 — Nice to have
5. **Decision Rules** — Extract decision points from variant analysis and generate formal IF/THEN rules. File: `decision_rules.py`
6. **Process Variables** — Identify variables needed for the workflow engine (form fields, data inputs). File: `variables.py`

### P2 — Stretch goals
7. **Cost Analysis** — Estimate time/cost saved per recommendation. File: `cost_analysis.py`
8. **What-If Simulation** — Show before/after metrics if recommendations are applied. File: `simulation.py`

## Input Contract

Your module consumes `PipelineOutput` (defined in `backend/models.py`). During development, mock this using sample data — don't wait for the pipeline module.

## Output Contract

Your module produces `CopilotOutput` (defined in `backend/models.py`). See `contracts/copilot_output.json` for the full schema.

## LLM Integration

We will determine the exact LLM provider after the task pack drops at 6pm. For now, design your functions to accept a generic `analyze(prompt: str) -> str` interface. The LLM call will be wired up later.

Structure prompts clearly:
```python
def build_analysis_prompt(pipeline_output: PipelineOutput) -> str:
    """Build a prompt for the LLM to analyze the process."""
    ...
```

## Key Libraries
- `pydantic` — data models
- LLM client (TBD — likely google-generativeai for free Gemini)
- `xml.etree.ElementTree` or a BPMN library for XML generation

## Testing
- `pytest backend/copilot/tests/ -x`
- Mock the LLM calls in tests (don't hit real APIs)
- Test BPMN output is valid XML
- Test recommendations cover all bottleneck types
