"""BPMN 2.0 XML generator with XOR gateways derived from the process map graph."""

import re
import xml.etree.ElementTree as ET
from collections import defaultdict, deque
from xml.dom import minidom

from backend.models import PipelineOutput, Recommendation

BPMN_NS = "http://www.omg.org/spec/BPMN/20100524/MODEL"
BPMNDI_NS = "http://www.omg.org/spec/BPMN/20100524/DI"
DC_NS = "http://www.omg.org/spec/DD/20100524/DC"
DI_NS = "http://www.omg.org/spec/DD/20100524/DI"
BIOC_NS = "http://bpmn.io/schema/bpmn/biocolor/1.0"

TASK_W = 140
TASK_H = 60
COL_STEP = 200   # horizontal distance between column centres
ROW_STEP = 110   # vertical distance between rows (lanes)
GW_SIZE = 40
EVT_SIZE = 36
ORIGIN_X = 60
ORIGIN_Y = 100

MAX_NODES = 10   # max activities to include
MAX_SPLITS = 3   # max XOR-split gateways

COLOR_AUTOMATION = {"fill": "#dcfce7", "stroke": "#16a34a"}
COLOR_BOTTLENECK = {"fill": "#fff1f2", "stroke": "#e11d48"}
COLOR_COPY_PASTE = {"fill": "#eff6ff", "stroke": "#2563eb"}
COLOR_DEFAULT = {"fill": "#f8fafc", "stroke": "#64748b"}
COLOR_START = {"fill": "#dcfce7", "stroke": "#16a34a"}
COLOR_END = {"fill": "#fef2f2", "stroke": "#dc2626"}
COLOR_GATEWAY = {"fill": "#fefce8", "stroke": "#ca8a04"}


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def generate_bpmn(
    pipeline_output: PipelineOutput,
    recommendations: list[Recommendation] | None = None,
) -> str:
    """Generate BPMN 2.0 XML with XOR gateways from the process map graph."""
    color_map = _build_color_map(pipeline_output, recommendations or [])
    task_type_map = _build_task_type_map(pipeline_output, recommendations or [])
    activity_metrics = _build_activity_metrics(pipeline_output)

    pm = pipeline_output.process_map
    if pm and pm.edges and len(pm.nodes) >= 3:
        return _build_graph_bpmn(
            pipeline_output, color_map, task_type_map, activity_metrics
        )

    # Fallback: simple linear sequence
    sequence = _extract_sequence(pipeline_output)
    return _build_linear_bpmn(
        sequence, pipeline_output.process_id, color_map, task_type_map, activity_metrics
    )


# ---------------------------------------------------------------------------
# Graph-based BPMN (main path)
# ---------------------------------------------------------------------------

def _build_graph_bpmn(
    pipeline_output: PipelineOutput,
    color_map: dict,
    task_type_map: dict,
    activity_metrics: dict,
) -> str:
    pm = pipeline_output.process_id
    process_id = pipeline_output.process_id

    label_map = {n.id: n.label for n in pipeline_output.process_map.nodes}
    freq_map = {n.id: (n.frequency or 0) for n in pipeline_output.process_map.nodes}

    # --- 1. Filter to clean top-N nodes ---
    clean_ids = [n.id for n in pipeline_output.process_map.nodes
                 if _is_clean_name(label_map.get(n.id, n.id))]
    top_ids = set(sorted(clean_ids, key=lambda x: freq_map.get(x, 0), reverse=True)[:MAX_NODES])

    # --- 2. Build DAG (remove self-loops and back-edges) ---
    out_adj: dict[str, list[tuple[str, int]]] = defaultdict(list)
    in_adj: dict[str, list[tuple[str, int]]] = defaultdict(list)

    for e in pipeline_output.process_map.edges:
        if (e.source in top_ids and e.target in top_ids and e.source != e.target):
            out_adj[e.source].append((e.target, int(e.weight or 1)))
            in_adj[e.target].append((e.source, int(e.weight or 1)))

    used = {n for n in top_ids if out_adj[n] or in_adj[n]}
    if len(used) < 2:
        return _build_linear_bpmn(
            _extract_sequence(pipeline_output), process_id, color_map, task_type_map, activity_metrics
        )

    dag_edges = _remove_back_edges(used, out_adj)

    out_dag: dict[str, list[tuple[str, int]]] = defaultdict(list)
    in_dag: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for src, tgt, w in dag_edges:
        out_dag[src].append((tgt, w))
        in_dag[tgt].append((src, w))

    # --- 3. Source / sink nodes ---
    sources = sorted([n for n in used if not in_dag[n]], key=lambda n: -freq_map.get(n, 0))
    sinks = sorted([n for n in used if not out_dag[n]], key=lambda n: freq_map.get(n, 0))
    if not sources:
        sources = [max(used, key=lambda n: freq_map.get(n, 0))]
    if not sinks:
        sinks = [min(used, key=lambda n: freq_map.get(n, 0))]

    # --- 4. Identify split / join nodes ---
    split_nodes = sorted(
        [n for n in used if len(out_dag[n]) > 1],
        key=lambda n: -freq_map.get(n, 0),
    )[:MAX_SPLITS]
    join_nodes = [n for n in used if len(in_dag[n]) > 1]

    split_gw: dict[str, str] = {n: f"gw_s_{_sid(n)}" for n in split_nodes}
    join_gw: dict[str, str] = {n: f"gw_j_{_sid(n)}" for n in join_nodes}

    # --- 5. Build BPMN flow list ---
    START = "ev_start"
    END = "ev_end"
    flows: list[tuple[str, str]] = []

    # start → first source
    flows.append((START, join_gw.get(sources[0], sources[0])))

    # Internal edges (routed through gateways)
    added_task_to_split: set[str] = set()
    added_join_to_task: set[str] = set()

    for src, tgt, _w in dag_edges:
        actual_src = split_gw[src] if src in split_gw else src
        actual_tgt = join_gw[tgt] if tgt in join_gw else tgt

        if src in split_gw and src not in added_task_to_split:
            flows.append((src, split_gw[src]))
            added_task_to_split.add(src)
        if tgt in join_gw and tgt not in added_join_to_task:
            flows.append((join_gw[tgt], tgt))
            added_join_to_task.add(tgt)

        flows.append((actual_src, actual_tgt))

    # last sink → end
    last_sink = sinks[0]
    flows.append((split_gw.get(last_sink, last_sink), END))

    # Remove duplicate flows
    seen_flows: set[tuple[str, str]] = set()
    unique_flows: list[tuple[str, str]] = []
    for f in flows:
        if f not in seen_flows and f[0] != f[1]:
            seen_flows.add(f)
            unique_flows.append(f)
    flows = unique_flows

    # --- 6. Collect all BPMN element IDs and types ---
    element_type: dict[str, str] = {START: "startEvent", END: "endEvent"}
    for n in used:
        lbl = label_map.get(n, n)
        element_type[n] = task_type_map.get(lbl, "userTask")
    for gw_id in list(split_gw.values()) + list(join_gw.values()):
        element_type[gw_id] = "exclusiveGateway"

    # --- 7. Layout ---
    positions = _compute_layout(element_type, flows, START, END, freq_map, split_gw, join_gw)

    # --- 8. Assemble XML ---
    return _assemble_xml(
        process_id, element_type, flows, positions,
        label_map, color_map, activity_metrics, START, END,
    )


# ---------------------------------------------------------------------------
# DAG helpers
# ---------------------------------------------------------------------------

def _remove_back_edges(
    nodes: set[str],
    out_adj: dict[str, list[tuple[str, int]]],
) -> list[tuple[str, int, int]]:
    """Return edges with back-edges removed (DFS coloring)."""
    WHITE, GRAY, BLACK = 0, 1, 2
    color: dict[str, int] = {n: WHITE for n in nodes}
    result: list[tuple[str, int, int]] = []

    def dfs(u: str) -> None:
        color[u] = GRAY
        for v, w in sorted(out_adj[u], key=lambda x: -x[1]):
            if v not in color:
                continue
            if color[v] == GRAY:
                continue  # back-edge — skip
            result.append((u, v, w))
            if color[v] == WHITE:
                dfs(v)
        color[u] = BLACK

    for n in nodes:
        if color[n] == WHITE:
            dfs(n)

    return result


# ---------------------------------------------------------------------------
# Layout
# ---------------------------------------------------------------------------

def _compute_layout(
    element_type: dict[str, str],
    flows: list[tuple[str, str]],
    start_id: str,
    end_id: str,
    freq_map: dict[str, int],
    split_gw: dict[str, str],
    join_gw: dict[str, str],
) -> dict[str, tuple[float, float, float, float]]:
    """Returns {id: (x, y, width, height)} for every element."""

    out_flow: dict[str, list[str]] = defaultdict(list)
    in_flow: dict[str, list[str]] = defaultdict(list)
    for src, tgt in flows:
        out_flow[src].append(tgt)
        in_flow[tgt].append(src)

    # --- Assign column levels (longest path from start) ---
    col: dict[str, int] = {start_id: 0}
    queue: deque[str] = deque([start_id])
    while queue:
        nid = queue.popleft()
        for tgt in out_flow[nid]:
            new_c = col[nid] + 1
            if col.get(tgt, -1) < new_c:
                col[tgt] = new_c
                queue.append(tgt)

    for eid in element_type:
        if eid not in col:
            col[eid] = max(col.values(), default=0) + 1

    max_col = max(col.values(), default=0)

    # --- Find main path (follow highest-freq edges) ---
    gw_ids = set(split_gw.values()) | set(join_gw.values())
    main_path = _find_main_path(start_id, end_id, out_flow, freq_map, gw_ids)
    main_set = set(main_path)

    # --- Assign rows within each column ---
    col_groups: dict[int, list[str]] = defaultdict(list)
    for eid, c in col.items():
        col_groups[c].append(eid)

    row: dict[str, int] = {}
    for c, elems in col_groups.items():
        ordered = sorted(
            elems,
            key=lambda e: (0 if e in main_set else 1, -freq_map.get(e, 0)),
        )
        for i, eid in enumerate(ordered):
            row[eid] = i

    # --- Convert to (x, y, w, h) ---
    def dims(eid: str) -> tuple[float, float]:
        et = element_type.get(eid, "userTask")
        if et in ("startEvent", "endEvent"):
            return EVT_SIZE, EVT_SIZE
        if et == "exclusiveGateway":
            return GW_SIZE, GW_SIZE
        return TASK_W, TASK_H

    positions: dict[str, tuple[float, float, float, float]] = {}
    for eid in element_type:
        c = col.get(eid, 0)
        r = row.get(eid, 0)
        w, h = dims(eid)
        x = ORIGIN_X + c * COL_STEP
        y = ORIGIN_Y + r * ROW_STEP
        positions[eid] = (x, y, w, h)

    return positions


def _find_main_path(
    start: str,
    end: str,
    out_flow: dict[str, list[str]],
    freq_map: dict[str, int],
    gw_ids: set[str],
) -> list[str]:
    """Greedy main path: always follow highest-frequency successor."""
    path = [start]
    visited: set[str] = {start}
    cur = start
    for _ in range(50):
        succs = [s for s in out_flow.get(cur, []) if s not in visited]
        if not succs:
            break
        # Prefer non-gateway successors first; among ties pick highest freq
        succs.sort(key=lambda s: (1 if s in gw_ids else 0, -freq_map.get(s, 0)))
        nxt = succs[0]
        path.append(nxt)
        visited.add(nxt)
        cur = nxt
        if cur == end:
            break
    return path


# ---------------------------------------------------------------------------
# XML assembly
# ---------------------------------------------------------------------------

def _assemble_xml(
    process_id: str,
    element_type: dict[str, str],
    flows: list[tuple[str, str]],
    positions: dict[str, tuple[float, float, float, float]],
    label_map: dict[str, str],
    color_map: dict[str, dict],
    activity_metrics: dict[str, str],
    start_id: str,
    end_id: str,
) -> str:
    ET.register_namespace("bpmn", BPMN_NS)
    ET.register_namespace("bpmndi", BPMNDI_NS)
    ET.register_namespace("dc", DC_NS)
    ET.register_namespace("di", DI_NS)
    ET.register_namespace("bioc", BIOC_NS)

    defs = ET.Element(f"{{{BPMN_NS}}}definitions")
    defs.set("id", f"def_{process_id}")
    defs.set("targetNamespace", "http://bpmn.io/schema/bpmn")
    defs.set("xmlns:bioc", BIOC_NS)

    proc = ET.SubElement(defs, f"{{{BPMN_NS}}}process")
    proc.set("id", f"proc_{process_id}")
    proc.set("isExecutable", "true")

    # Elements
    for eid, etype in element_type.items():
        el = ET.SubElement(proc, f"{{{BPMN_NS}}}{etype}")
        el.set("id", eid)
        if etype == "startEvent":
            el.set("name", "Start")
        elif etype == "endEvent":
            el.set("name", "End")
        elif etype == "exclusiveGateway":
            el.set("name", "")
        else:
            raw_label = label_map.get(eid, eid)
            label = raw_label[:40]
            metric = activity_metrics.get(raw_label, "")
            if metric:
                label = f"{label}\n[{metric}]"
            el.set("name", label)

    # Sequence flows
    for i, (src, tgt) in enumerate(flows, start=1):
        sf = ET.SubElement(proc, f"{{{BPMN_NS}}}sequenceFlow")
        sf.set("id", f"sf_{i}")
        sf.set("sourceRef", src)
        sf.set("targetRef", tgt)

    # DI
    diag = ET.SubElement(defs, f"{{{BPMNDI_NS}}}BPMNDiagram")
    diag.set("id", "diag_1")
    plane = ET.SubElement(diag, f"{{{BPMNDI_NS}}}BPMNPlane")
    plane.set("id", "plane_1")
    plane.set("bpmnElement", f"proc_{process_id}")

    for eid, (x, y, w, h) in positions.items():
        etype = element_type.get(eid, "userTask")
        raw_label = label_map.get(eid, eid)
        if etype == "exclusiveGateway":
            colors = COLOR_GATEWAY
        elif etype == "startEvent":
            colors = COLOR_START
        elif etype == "endEvent":
            colors = COLOR_END
        else:
            colors = color_map.get(raw_label, COLOR_DEFAULT)
        _add_shape(plane, eid, x, y, w, h, colors,
                   is_marker=(etype == "exclusiveGateway"))

    for i, (src, tgt) in enumerate(flows, start=1):
        if src in positions and tgt in positions:
            sx, sy, sw, sh = positions[src]
            tx, ty, tw, th = positions[tgt]
            _add_edge(plane, f"sf_{i}", src, tgt,
                      (sx, sy), sw, sh, (tx, ty), tw, th)

    return _pretty_print(ET.tostring(defs, encoding="unicode"))


# ---------------------------------------------------------------------------
# Fallback: linear sequence (unchanged behaviour when no graph data)
# ---------------------------------------------------------------------------

def _extract_sequence(pipeline_output: PipelineOutput) -> list[str]:
    MAX_TASKS = 12
    pm = pipeline_output.process_map
    if pm and pm.edges:
        seq = _topological_sequence(pipeline_output)
        if len(seq) >= 3:
            return seq[:MAX_TASKS]
    if pipeline_output.variants:
        best = max(pipeline_output.variants, key=lambda v: v.case_count)
        seen: set[str] = set()
        clean = [s for s in best.sequence if s not in seen and not seen.add(s) and _is_clean_name(s)]  # type: ignore[func-returns-value]
        if len(clean) >= 3:
            return clean[:MAX_TASKS]
    if pipeline_output.activities:
        by_freq = sorted(pipeline_output.activities, key=lambda a: a.frequency, reverse=True)
        clean = [a.name for a in by_freq if _is_clean_name(a.name)]
        if len(clean) >= 3:
            return clean[:MAX_TASKS]
    return ["Start Process", "Process Step", "Complete"]


def _topological_sequence(pipeline_output: PipelineOutput) -> list[str]:
    pm = pipeline_output.process_map
    node_labels = {n.id: n.label for n in pm.nodes}
    outgoing: dict[str, list[tuple[str, int]]] = defaultdict(list)
    in_degree: dict[str, int] = defaultdict(int)
    for edge in pm.edges:
        outgoing[edge.source].append((edge.target, edge.weight))
        in_degree[edge.target] += 1
    roots = [nid for nid in node_labels if in_degree[nid] == 0]
    if not roots:
        roots = [max(node_labels, key=lambda n: len(outgoing[n]))]
    queue: deque[str] = deque(roots)
    visited: set[str] = set()
    result: list[str] = []
    while queue:
        nid = queue.popleft()
        if nid in visited:
            continue
        visited.add(nid)
        label = node_labels.get(nid, nid)
        if _is_clean_name(label):
            result.append(label)
        for child_id, _ in sorted(outgoing[nid], key=lambda x: x[1], reverse=True):
            if child_id not in visited:
                queue.append(child_id)
    return result


def _build_linear_bpmn(
    sequence: list[str],
    process_id: str,
    color_map: dict,
    task_type_map: dict,
    activity_metrics: dict,
) -> str:
    """Simple linear BPMN: Start → task1 → … → End."""
    MAX_TASKS = 12
    TASK_WIDTH = 160
    TASK_HEIGHT = 72
    H_GAP_LIN = 60
    MAX_PER_ROW = 4
    START_X, START_Y = 60, 80

    ET.register_namespace("bpmn", BPMN_NS)
    ET.register_namespace("bpmndi", BPMNDI_NS)
    ET.register_namespace("dc", DC_NS)
    ET.register_namespace("di", DI_NS)
    ET.register_namespace("bioc", BIOC_NS)

    defs = ET.Element(f"{{{BPMN_NS}}}definitions")
    defs.set("id", f"def_{process_id}")
    defs.set("targetNamespace", "http://bpmn.io/schema/bpmn")
    defs.set("xmlns:bioc", BIOC_NS)

    proc = ET.SubElement(defs, f"{{{BPMN_NS}}}process")
    proc.set("id", f"proc_{process_id}")
    proc.set("isExecutable", "true")

    start_el = ET.SubElement(proc, f"{{{BPMN_NS}}}startEvent")
    start_el.set("id", "ev_start")
    start_el.set("name", "Start")

    task_ids: list[tuple[str, str]] = []
    for name in sequence[:MAX_TASKS]:
        tid = _sanitize_id(name)
        ttype = task_type_map.get(name, "userTask")
        el = ET.SubElement(proc, f"{{{BPMN_NS}}}{ttype}")
        el.set("id", tid)
        label = name[:45]
        metric = activity_metrics.get(name)
        if metric:
            label = f"{label}\n[{metric}]"
        el.set("name", label)
        task_ids.append((tid, name))

    end_el = ET.SubElement(proc, f"{{{BPMN_NS}}}endEvent")
    end_el.set("id", "ev_end")
    end_el.set("name", "End")

    all_ids = ["ev_start"] + [tid for tid, _ in task_ids] + ["ev_end"]
    for i in range(len(all_ids) - 1):
        sf = ET.SubElement(proc, f"{{{BPMN_NS}}}sequenceFlow")
        sf.set("id", f"sf_{i + 1}")
        sf.set("sourceRef", all_ids[i])
        sf.set("targetRef", all_ids[i + 1])

    # DI
    diag = ET.SubElement(defs, f"{{{BPMNDI_NS}}}BPMNDiagram")
    diag.set("id", "diag_1")
    plane = ET.SubElement(diag, f"{{{BPMNDI_NS}}}BPMNPlane")
    plane.set("id", "plane_1")
    plane.set("bpmnElement", f"proc_{process_id}")

    def grid_xy(idx: int) -> tuple[float, float]:
        row = idx // MAX_PER_ROW
        col = idx % MAX_PER_ROW
        x = START_X + EVT_SIZE + H_GAP_LIN + col * (TASK_WIDTH + H_GAP_LIN)
        y = START_Y + row * (TASK_HEIGHT + 90)
        return x, y

    fx, fy = grid_xy(0)
    _add_shape(plane, "ev_start", fx - H_GAP_LIN - EVT_SIZE,
               fy + (TASK_HEIGHT - EVT_SIZE) / 2, EVT_SIZE, EVT_SIZE, COLOR_START)

    for i, (tid, name) in enumerate(task_ids):
        tx, ty = grid_xy(i)
        _add_shape(plane, tid, tx, ty, TASK_WIDTH, TASK_HEIGHT, color_map.get(name, COLOR_DEFAULT))

    n = len(task_ids)
    ex, ey = grid_xy(n)
    _add_shape(plane, "ev_end", ex, ey + (TASK_HEIGHT - EVT_SIZE) / 2, EVT_SIZE, EVT_SIZE, COLOR_END)

    positions_lin: dict[str, tuple[float, float, float, float]] = {
        "ev_start": (fx - H_GAP_LIN - EVT_SIZE, fy + (TASK_HEIGHT - EVT_SIZE) / 2, EVT_SIZE, EVT_SIZE),
        "ev_end": (ex, ey + (TASK_HEIGHT - EVT_SIZE) / 2, EVT_SIZE, EVT_SIZE),
    }
    for i, (tid, _) in enumerate(task_ids):
        tx, ty = grid_xy(i)
        positions_lin[tid] = (tx, ty, TASK_WIDTH, TASK_HEIGHT)

    for i in range(len(all_ids) - 1):
        s, t = all_ids[i], all_ids[i + 1]
        sx, sy, sw, sh = positions_lin[s]
        tx, ty, tw, th = positions_lin[t]
        _add_edge(plane, f"sf_{i + 1}", s, t, (sx, sy), sw, sh, (tx, ty), tw, th)

    return _pretty_print(ET.tostring(defs, encoding="unicode"))


# ---------------------------------------------------------------------------
# Color / type / metrics helpers (unchanged)
# ---------------------------------------------------------------------------

def _build_color_map(
    pipeline_output: PipelineOutput,
    recommendations: list[Recommendation],
) -> dict[str, dict[str, str]]:
    automation_targets = {
        rec.target.lower()
        for rec in recommendations
        if rec.type == "automate" or rec.automation_type
    }
    bottleneck_activities: set[str] = set()
    for b in pipeline_output.bottlenecks:
        if b.severity in ("critical", "high"):
            bottleneck_activities.add(b.from_activity.lower())
            bottleneck_activities.add(b.to_activity.lower())
    copy_paste_activities = {
        act.name.lower()
        for act in pipeline_output.activities
        if act.copy_paste_count and act.copy_paste_count > 2
    }
    color_map: dict[str, dict[str, str]] = {}
    for act in pipeline_output.activities:
        name_lower = act.name.lower()
        if name_lower in automation_targets:
            color_map[act.name] = COLOR_AUTOMATION
        elif name_lower in bottleneck_activities:
            color_map[act.name] = COLOR_BOTTLENECK
        elif name_lower in copy_paste_activities:
            color_map[act.name] = COLOR_COPY_PASTE
        else:
            color_map[act.name] = COLOR_DEFAULT
    return color_map


def _build_task_type_map(
    pipeline_output: PipelineOutput,
    recommendations: list[Recommendation],
) -> dict[str, str]:
    automation_targets = {
        rec.target.lower()
        for rec in recommendations
        if rec.type == "automate" or rec.automation_type
    }
    task_types: dict[str, str] = {}
    for act in pipeline_output.activities:
        if act.name.lower() in automation_targets:
            task_types[act.name] = "serviceTask"
        elif act.copy_paste_count and act.copy_paste_count > 2:
            task_types[act.name] = "manualTask"
        else:
            task_types[act.name] = "userTask"
    return task_types


def _build_activity_metrics(pipeline_output: PipelineOutput) -> dict[str, str]:
    metrics: dict[str, str] = {}
    for act in pipeline_output.activities:
        parts = []
        if act.avg_duration_seconds > 0:
            dur = act.avg_duration_seconds
            if dur < 60:
                parts.append(f"{dur:.0f}s avg")
            elif dur < 3600:
                parts.append(f"{dur / 60:.0f}m avg")
            else:
                parts.append(f"{dur / 3600:.1f}h avg")
        parts.append(f"×{act.frequency}")
        if act.copy_paste_count > 0:
            parts.append(f"CP:{act.copy_paste_count}")
        metrics[act.name] = " · ".join(parts)
    return metrics


# ---------------------------------------------------------------------------
# Shape / edge DI helpers
# ---------------------------------------------------------------------------

def _add_shape(
    plane: ET.Element,
    eid: str,
    x: float,
    y: float,
    w: float,
    h: float,
    colors: dict[str, str] | None = None,
    is_marker: bool = False,
) -> None:
    shape = ET.SubElement(plane, f"{{{BPMNDI_NS}}}BPMNShape")
    shape.set("id", f"s_{eid}")
    shape.set("bpmnElement", eid)
    if is_marker:
        shape.set("isMarkerVisible", "true")
    if colors:
        shape.set("bioc:fill", colors["fill"])
        shape.set("bioc:stroke", colors["stroke"])
    bounds = ET.SubElement(shape, f"{{{DC_NS}}}Bounds")
    bounds.set("x", str(round(x)))
    bounds.set("y", str(round(y)))
    bounds.set("width", str(round(w)))
    bounds.set("height", str(round(h)))


def _add_edge(
    plane: ET.Element,
    flow_id: str,
    src_id: str,
    tgt_id: str,
    src_pos: tuple[float, float],
    src_w: float,
    src_h: float,
    tgt_pos: tuple[float, float],
    tgt_w: float,
    tgt_h: float,
) -> None:
    edge = ET.SubElement(plane, f"{{{BPMNDI_NS}}}BPMNEdge")
    edge.set("id", f"e_{flow_id}")
    edge.set("bpmnElement", flow_id)
    for wx, wy in _waypoints(src_pos, src_w, src_h, tgt_pos, tgt_w, tgt_h):
        wp = ET.SubElement(edge, f"{{{DI_NS}}}waypoint")
        wp.set("x", str(round(wx)))
        wp.set("y", str(round(wy)))


def _waypoints(
    sp: tuple[float, float], sw: float, sh: float,
    tp: tuple[float, float], tw: float, th: float,
) -> list[tuple[float, float]]:
    src_cx = sp[0] + sw / 2
    src_cy = sp[1] + sh / 2
    tgt_cx = tp[0] + tw / 2
    tgt_cy = tp[1] + th / 2
    src_right = sp[0] + sw
    tgt_left = tp[0]
    src_bottom = sp[1] + sh
    tgt_top = tp[1]

    # Same row, target to the right → straight
    if abs(src_cy - tgt_cy) < 5 and tgt_left >= src_right - 2:
        return [(src_right, src_cy), (tgt_left, tgt_cy)]

    # Target below → exit from bottom, enter from top
    if tgt_cy > src_cy + 5:
        mid_y = src_bottom + (tgt_top - src_bottom) / 2
        return [
            (src_cx, src_bottom),
            (src_cx, mid_y),
            (tgt_cx, mid_y),
            (tgt_cx, tgt_top),
        ]

    # Target above → exit from top, enter from bottom
    if tgt_cy < src_cy - 5:
        mid_y = tgt_top + (sp[1] - tgt_top) / 2
        return [
            (src_cx, sp[1]),
            (src_cx, mid_y),
            (tgt_cx, mid_y),
            (tgt_cx, tgt_top + th),
        ]

    return [(src_right, src_cy), (tgt_left, tgt_cy)]


# ---------------------------------------------------------------------------
# ID helpers
# ---------------------------------------------------------------------------

def _is_clean_name(name: str) -> bool:
    if len(name) > 45:
        return False
    if "://" in name or "http" in name.lower():
        return False
    if "?" in name and "=" in name:
        return False
    if name.count("/") > 1:
        return False
    if any(c in name for c in ["&", "=", "#"]):
        return False
    if re.match(r"^[0-9a-f]{8,}$", name.lower()):
        return False
    return True


def _sanitize_id(name: str, prefix: str = "task") -> str:
    s = re.sub(r"[^a-zA-Z0-9_-]", "_", name)
    s = re.sub(r"_+", "_", s).strip("_")
    return f"{prefix}_{s}"[:64]


def _sid(name: str) -> str:
    """Short sanitized ID (no prefix, max 24 chars)."""
    s = re.sub(r"[^a-zA-Z0-9]", "_", name)
    s = re.sub(r"_+", "_", s).strip("_")
    return s[:24]


def _pretty_print(xml_str: str) -> str:
    try:
        return minidom.parseString(xml_str.encode("utf-8")).toprettyxml(indent="  ", encoding=None)
    except Exception:
        return xml_str
