"""Generate automation blueprints for each recommendation."""

import json

from backend.models import (
    PipelineOutput,
    Recommendation,
    AutomationBlueprint,
    AutomationStep,
)
from backend.copilot.llm import call_llm


def generate_blueprints(
    recommendations: list[Recommendation],
    pipeline_output: PipelineOutput,
) -> list[AutomationBlueprint]:
    """Generate an automation blueprint for each recommendation."""
    activity_map = {a.name.lower(): a for a in pipeline_output.activities}
    blueprints: list[AutomationBlueprint] = []

    for i, rec in enumerate(recommendations):
        act = activity_map.get(rec.target.lower())
        blueprint = _generate_single(i + 1, rec, act, pipeline_output)
        blueprints.append(blueprint)

    return blueprints


def _generate_single(
    idx: int,
    rec: Recommendation,
    act: "Activity | None",
    pipeline: PipelineOutput,
) -> AutomationBlueprint:
    """Generate blueprint via LLM or fall back to template."""
    apps = act.applications if act else []
    copy_paste = act.copy_paste_count if act else 0
    duration = act.avg_duration_seconds if act else 0

    context = (
        f"Activity: {rec.target}\n"
        f"Recommendation type: {rec.type}\n"
        f"Reasoning: {rec.reasoning}\n"
        f"Apps used: {', '.join(apps) if apps else 'unknown'}\n"
        f"Copy-paste operations: {copy_paste}\n"
        f"Avg duration: {duration:.1f}s\n"
        f"Impact: {rec.impact}\n"
    )

    system = (
        "Generate an automation blueprint as JSON with fields: "
        "name (string), automation_type (string), trigger_description (string), "
        "steps (array of {action, description, target_app}), "
        "technology_stack (array of strings), complexity (low/medium/high), "
        "estimated_dev_hours (number), prerequisites (array of strings). "
        "Be specific and practical. Return only valid JSON, no markdown."
    )

    raw = call_llm(prompt=context, system=system, max_tokens=512)

    if raw:
        try:
            data = json.loads(raw.strip().removeprefix("```json").removesuffix("```").strip())
            steps = [
                AutomationStep(
                    action=s.get("action", "step"),
                    description=s.get("description", ""),
                    target_app=s.get("target_app"),
                )
                for s in data.get("steps", [])
            ]
            return AutomationBlueprint(
                blueprint_id=f"AUTO-{idx:03d}",
                name=data.get("name", f"Automate {rec.target}"),
                target_activity=rec.target,
                automation_type=data.get("automation_type", "RPA Bot"),
                trigger_description=data.get("trigger_description", "Activity start"),
                steps=steps if steps else _template_steps(rec, apps),
                technology_stack=data.get("technology_stack", _default_tech(rec)),
                complexity=data.get("complexity", "medium"),
                estimated_dev_hours=float(data.get("estimated_dev_hours", 8)),
                prerequisites=data.get("prerequisites", []),
            )
        except (json.JSONDecodeError, KeyError, TypeError):
            pass

    return _template_blueprint(idx, rec, apps, copy_paste, duration)


def _template_blueprint(
    idx: int,
    rec: Recommendation,
    apps: list[str],
    copy_paste: int,
    duration: float,
) -> AutomationBlueprint:
    """Rule-based fallback when LLM is unavailable."""
    return AutomationBlueprint(
        blueprint_id=f"AUTO-{idx:03d}",
        name=f"{rec.type.title()} — {rec.target}",
        target_activity=rec.target,
        automation_type=_auto_type(rec),
        trigger_description=_trigger_desc(rec, apps),
        steps=_template_steps(rec, apps),
        technology_stack=_default_tech(rec),
        complexity="high" if copy_paste > 50 or duration > 60 else "medium" if copy_paste > 10 else "low",
        estimated_dev_hours=16.0 if copy_paste > 50 else 8.0 if copy_paste > 10 else 4.0,
        prerequisites=_default_prereqs(rec, apps),
    )


def _auto_type(rec: Recommendation) -> str:
    types = {
        "automate": "RPA Bot",
        "eliminate": "Process Redesign",
        "simplify": "Workflow Optimization",
        "parallelize": "Parallel Execution Engine",
        "reassign": "Task Routing Rule",
    }
    return types.get(rec.type, "Automation")


def _trigger_desc(rec: Recommendation, apps: list[str]) -> str:
    if rec.type == "automate" and len(apps) >= 2:
        return f"Triggered when user switches from {apps[0]} to {apps[1]}"
    if rec.type == "eliminate":
        return f"Remove {rec.target} from workflow; redirect to next step"
    return f"Activity '{rec.target}' is detected in process execution"


def _template_steps(rec: Recommendation, apps: list[str]) -> list[AutomationStep]:
    if rec.type == "automate":
        steps = [
            AutomationStep(action="detect_trigger", description=f"Monitor for {rec.target} activity start"),
            AutomationStep(action="capture_data", description="Extract input data from source application", target_app=apps[0] if apps else None),
            AutomationStep(action="transform_data", description="Apply business rules and data mapping"),
            AutomationStep(action="execute_action", description="Perform automated action in target application", target_app=apps[1] if len(apps) > 1 else None),
            AutomationStep(action="validate_result", description="Verify output matches expected result"),
        ]
    elif rec.type == "eliminate":
        steps = [
            AutomationStep(action="identify_bypass", description=f"Route process to skip {rec.target}"),
            AutomationStep(action="redirect_flow", description="Connect preceding step directly to following step"),
            AutomationStep(action="validate_output", description="Ensure no data loss from removed step"),
        ]
    else:
        steps = [
            AutomationStep(action="analyze_current", description=f"Map current {rec.target} execution"),
            AutomationStep(action="optimize", description="Apply optimization strategy"),
            AutomationStep(action="validate", description="Verify improvement metrics"),
        ]
    return steps


def _default_tech(rec: Recommendation) -> list[str]:
    if rec.type == "automate":
        return ["UiPath", "Python Selenium", "Windows Automation API"]
    if rec.type == "eliminate":
        return ["Process Orchestrator", "Workflow Engine"]
    return ["Python", "Process Automation Framework"]


def _default_prereqs(rec: Recommendation, apps: list[str]) -> list[str]:
    prereqs = ["Process owner approval"]
    if apps:
        prereqs.append(f"API/UI access to {', '.join(apps[:2])}")
    if rec.type == "automate":
        prereqs.append("RPA platform license")
    return prereqs


# Re-export for type checking
from backend.models import Activity as Activity  # noqa: F401, E402
