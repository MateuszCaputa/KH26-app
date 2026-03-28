# BPMN 2.0 Generation Specification (from CSV Event Logs)

## Purpose

This document defines how to convert CSV-based event logs into a **semantically correct BPMN 2.0 process model**.

The goal is NOT to generate a simple linear workflow or UI activity map, but a **true business process model** that includes:
- decision logic (gateways)
- parallelism
- loops and rework
- waiting and handoffs
- actors (lanes/pools)
- business-level tasks

---

## Core Principle

The CSV file is **process evidence**, not a ready-made workflow.

The model must be **inferred** from:
- multiple process instances (`case_id`)
- variations between cases
- repeated patterns
- timing and transitions

---

## Input Format: CSV Event Log

Assume:
- each row = one event
- multiple rows with the same `case_id` belong to one process instance
- event order must be reconstructed using timestamps

### Expected Columns (if available)

| Column           | Meaning |
|------------------|--------|
| case_id          | unique process instance ID |
| activity         | event or action name |
| timestamp_start  | event start time |
| timestamp_end    | event end time |
| user / actor     | who performed the action |
| application      | system/app used |
| status           | business outcome/state |
| object_id        | work item identifier |

If columns differ:
- infer mapping automatically
- report confidence of mapping

---

## Mandatory Preprocessing

### Step 1 — Column Mapping

Identify:
- case_id
- activity name
- timestamps
- actor (optional)
- application (optional)
- status/outcome (optional)

If ambiguous:
- propose mapping
- mark confidence

---

### Step 2 — Event Normalization

- merge duplicate/similar activities
- remove noise
- group technical events into business-level actions

#### Example:

| Raw Events | Business Task |
|-----------|--------------|
| Use Outlook + Teams + Chrome | Communicate with stakeholder |
| Excel + View Files | Update tracking data |

Do NOT treat app names alone as final BPMN tasks unless unavoidable.

---

### Step 3 — Trace Reconstruction

For each `case_id`:
- sort events chronologically
- build ordered sequence (trace)

Then:
- extract most common variants
- identify where traces diverge
- identify where they converge

---

### Step 4 — Variant Analysis

From all cases:
- detect alternative paths
- detect repeated loops
- detect optional steps
- detect ordering differences

This is the foundation for gateways.

---

## BPMN Generation Rules

### 1. Start and End Events

- each process must have at least one Start Event
- each process must have at least one End Event

---

### 2. Tasks

Tasks must represent **business meaning**, not raw UI actions.

Bad:
- "Use Chrome"
- "Use Outlook"

Good:
- "Review request"
- "Update progress"
- "Communicate with team"

---

### 3. Exclusive Gateways (XOR)

Create XOR gateway when:
- one step leads to different alternative paths
- paths are mutually exclusive
- traces show divergence

Example:
- after "Review request":
  - path A: "Approve"
  - path B: "Request clarification"

Gateway label:
→ question form (e.g. "Request complete?")

---

### 4. Parallel Gateways (AND)

Create only if:
- tasks can occur in any order across cases
- tasks overlap in time
- multiple actors work independently

Do NOT invent parallelism without evidence.

---

### 5. Inclusive Gateways (OR)

Use only if:
- multiple optional paths may occur together

If uncertain → prefer XOR + annotation.

---

### 6. Loops

If activities repeat:
- model loop
- or loopback gateway

Example:
- clarify → update → clarify again

---

### 7. Events (Important)

Detect and model:

| Situation | BPMN Element |
|----------|-------------|
| waiting for response | intermediate event |
| approval delay | event |
| meeting / call | event or task (depending on role) |
| external trigger | message event |

Do NOT model waiting as generic task if evidence shows delay.

---

### 8. Lanes / Pools

If actor data exists:
- create lanes (e.g. User, Manager, System)

If weak evidence:
- single pool + annotation

---

### 9. Context Switching Rule

Switching between apps:
- is NOT a BPMN gateway
- is NOT a decision

It is:
- signal of inefficiency
- signal of manual work
- insight for annotation only

---

### 10. Gateway Creation Constraint (VERY IMPORTANT)

A gateway may be created ONLY if:
- supported by multiple cases OR
- supported by clear variant differences

Never create gateways from:
- single anomalies
- single row transitions

---

## Handling Low-Quality Data

If CSV contains mostly:
- app names
- window titles
- timestamps

Then:

### DO NOT:
- generate fake logic
- force gateways

### DO:
1. create a business-process hypothesis
2. group technical actions
3. mark uncertainty
4. add annotations

---

## Output Structure (MANDATORY)

### SECTION A — Process Summary

- process goal
- main actors
- main path (happy path)
- alternative paths
- bottlenecks / inefficiencies

---

### SECTION B — BPMN Structure

For each element:

- id
- type (task / gateway / event)
- label
- rationale
- confidence (high / medium / low)

---

### SECTION C — BPMN 2.0 XML

Must be:
- valid BPMN 2.0
- include gateways (if detected)
- include proper sequence flows
- include start/end events
- include lanes if applicable
- include textAnnotations for uncertainty

---

### SECTION D — Data Quality Report

Include:
- detected column mapping
- missing columns
- what prevented better gateway detection
- assumptions made

---

## Strict Mode

DO NOT:
- generate only linear flow unless data proves it
- use app names as final tasks blindly
- create fake gateways without evidence
- ignore uncertainty

ALWAYS:
- explain assumptions
- mark confidence
- prefer imperfect but explicit logic over oversimplification

---

## Heuristics for Desktop Activity Logs

Use these patterns:

- Teams / Outlook / Chrome switching → communication loop
- Excel + files → data update task
- Calls → collaboration or issue resolution
- repeated revisits → rework loop
- long duration → bottleneck or waiting

---

## Final Instruction

If data is incomplete:

> Generate the most likely BPMN structure,
> mark uncertain elements,
> and explicitly state what additional data is needed
> to produce a fully accurate BPMN 2.0 model.