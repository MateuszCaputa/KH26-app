"""Automation recommender: score activities and generate actionable recommendations."""

from backend.models import Activity, Bottleneck, PipelineOutput, Recommendation
from backend.copilot.llm import call_llm

MAX_RECOMMENDATIONS = 10

AUTOMATION_TYPE_LABELS = {
    "automate": "Full automation (RPA/script)",
    "eliminate": "Eliminate (pure waste/rework)",
    "simplify": "Simplify (reduce steps)",
    "parallelize": "Parallelize (concurrent execution)",
    "reassign": "Reassign (delegate to system)",
}


def generate_recommendations(pipeline_output: PipelineOutput) -> list[Recommendation]:
    """Generate ranked automation recommendations from pipeline output."""
    bottleneck_severity_map = _build_bottleneck_map(pipeline_output.bottlenecks)
    frequency_median = _median_frequency(pipeline_output.activities)

    scored = []
    for activity in pipeline_output.activities:
        score = _score_activity(activity, bottleneck_severity_map, frequency_median)
        automation_type = _determine_automation_type(activity, bottleneck_severity_map)
        scored.append((score, activity, automation_type))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:MAX_RECOMMENDATIONS]

    impacts = _assign_impacts_by_rank(len(top))
    ai_reasonings = _generate_reasonings_with_llm(top, bottleneck_severity_map)

    priorities = _assign_priorities_by_rank(len(top))

    recommendations = []
    for rank, ((score, activity, automation_type), impact, priority) in enumerate(
        zip(top, impacts, priorities), start=1
    ):
        reasoning = ai_reasonings.get(rank) or _generate_reasoning(
            activity, automation_type, bottleneck_severity_map, score
        )
        time_saved = _estimate_time_saved(activity, automation_type)

        recommendations.append(Recommendation(
            id=rank,
            type=automation_type,
            target=activity.name,
            reasoning=reasoning,
            impact=impact,
            priority=priority,
            estimated_time_saved_seconds=time_saved,
            affected_cases_percentage=_estimate_affected_cases(activity, pipeline_output),
            automation_type=AUTOMATION_TYPE_LABELS.get(automation_type),
        ))

    return recommendations


def _generate_reasonings_with_llm(
    top: list[tuple],
    bottleneck_map: dict[str, float],
) -> dict[int, str]:
    """Call LLM once to generate reasoning for all top recommendations.

    Returns a dict mapping rank (1-based) -> reasoning string.
    Returns empty dict if LLM is unavailable or call fails.
    """
    import json as _json

    activities_desc = []
    for rank, (score, activity, automation_type) in enumerate(top, start=1):
        is_bottleneck = bottleneck_map.get(activity.name, 0.0) > 0.5
        activities_desc.append(
            f"{rank}. Activity: \"{activity.name}\"\n"
            f"   Type: {automation_type}\n"
            f"   Frequency: {activity.frequency} occurrences\n"
            f"   Avg duration: {activity.avg_duration_seconds:.0f}s\n"
            f"   Copy-paste count: {activity.copy_paste_count}\n"
            f"   Is bottleneck: {is_bottleneck}\n"
            f"   Automation score: {score:.0f}/100"
        )

    prompt = f"""You are a process automation consultant analyzing Task Mining data from KYP.ai.
Below are the top automation candidates discovered in a business process.
For each activity write ONE concise sentence (max 40 words) explaining WHY it should be automated
and WHAT specific benefit automation would bring. Be specific, vary the reasoning — do not repeat the same template.

Activities:
{chr(10).join(activities_desc)}

Respond with a JSON object mapping the rank number (as string) to the reasoning sentence.
Example format: {{"1": "reasoning...", "2": "reasoning...", ...}}
Return only valid JSON, no markdown, no extra text."""

    response = call_llm(prompt, max_tokens=1024)
    if not response:
        return {}

    try:
        # Strip markdown code fences if present
        cleaned = response.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = _json.loads(cleaned)
        return {int(k): v for k, v in data.items() if v}
    except Exception:
        return {}


def _build_bottleneck_map(bottlenecks: list[Bottleneck]) -> dict[str, float]:
    """Map activity name → max normalized severity score (0-1)."""
    severity_values = {"critical": 1.0, "high": 0.75, "medium": 0.4, "low": 0.1}
    result: dict[str, float] = {}

    for b in bottlenecks:
        value = severity_values.get(b.severity, 0.0)
        for name in (b.from_activity, b.to_activity):
            result[name] = max(result.get(name, 0.0), value)

    return result


def _median_frequency(activities: list[Activity]) -> float:
    if not activities:
        return 1.0
    freqs = sorted(a.frequency for a in activities)
    mid = len(freqs) // 2
    return float(freqs[mid])


def _score_activity(
    activity: Activity,
    bottleneck_map: dict[str, float],
    frequency_median: float,
) -> float:
    """Score an activity for automation potential (0–100)."""
    score = 0.0

    # Copy-paste = manual data transfer = prime RPA candidate
    if activity.copy_paste_count > 10:
        score += 35
    elif activity.copy_paste_count > 3:
        score += 20
    elif activity.copy_paste_count > 0:
        score += 10

    # Long duration = high manual effort
    avg_sec = activity.avg_duration_seconds
    if avg_sec > 600:
        score += 25
    elif avg_sec > 120:
        score += 15
    elif avg_sec > 30:
        score += 5

    # High frequency = repetitive = good automation ROI
    if frequency_median > 0:
        freq_ratio = activity.frequency / frequency_median
        if freq_ratio > 3:
            score += 20
        elif freq_ratio > 1.5:
            score += 10
        elif freq_ratio > 1:
            score += 5

    # Bottleneck involvement = process friction
    severity_score = bottleneck_map.get(activity.name, 0.0)
    score += severity_score * 25

    # Context switches = cross-app manual work
    if activity.context_switch_count > 20:
        score += 15
    elif activity.context_switch_count > 5:
        score += 8

    # Manual interactions = manual effort
    if activity.manual_interaction_count > 50:
        score += 10
    elif activity.manual_interaction_count > 10:
        score += 5

    return min(score, 100.0)


def _determine_automation_type(
    activity: Activity,
    bottleneck_map: dict[str, float],
) -> str:
    """Determine the most appropriate automation type."""
    is_bottleneck = bottleneck_map.get(activity.name, 0.0) > 0.5
    heavy_copy_paste = activity.copy_paste_count > 200
    moderate_copy_paste = activity.copy_paste_count > 30
    is_long = activity.avg_duration_seconds > 15
    is_very_frequent = activity.frequency > 300
    is_frequent = activity.frequency > 50
    many_performers = len(activity.performers) > 2
    multi_app = len(activity.applications) > 1

    # RPA: heavy copy-paste = clear data transfer automation target
    if heavy_copy_paste:
        return "automate"
    # Eliminate: bottleneck with short steps = rework/waste
    if is_bottleneck and not is_long:
        return "eliminate"
    # Parallelize: bottleneck with long duration = run concurrently
    if is_bottleneck and is_long:
        return "parallelize"
    # Reassign: many people doing same frequent task = delegate to system
    if many_performers and is_frequent:
        return "reassign"
    # Simplify: long tasks with moderate copy-paste = complex manual work
    if is_long and moderate_copy_paste:
        return "simplify"
    # Automate: moderate copy-paste with multiple apps = data transfer
    if moderate_copy_paste and multi_app:
        return "automate"
    # Eliminate: very frequent short tasks
    if is_very_frequent and not is_long:
        return "eliminate"
    # Simplify: long duration tasks
    if is_long:
        return "simplify"
    # Automate: remaining moderate copy-paste
    if moderate_copy_paste:
        return "automate"
    # Reassign: many performers
    if many_performers:
        return "reassign"
    return "simplify"


def _generate_reasoning(
    activity: Activity,
    automation_type: str,
    bottleneck_map: dict[str, float],
    score: float,
) -> str:
    """Generate rule-based reasoning text for a recommendation."""
    reasons = []

    if activity.copy_paste_count > 0:
        reasons.append(
            f"This step involves {activity.copy_paste_count} copy-paste operations, "
            "indicating manual data transfer between systems — a classic RPA target."
        )

    if activity.avg_duration_seconds > 300:
        minutes = activity.avg_duration_seconds / 60
        reasons.append(
            f"Average duration of {minutes:.1f} minutes represents significant manual effort "
            "that could be eliminated through automation."
        )

    if activity.frequency > 20:
        reasons.append(
            f"High occurrence frequency ({activity.frequency} times) means automation ROI "
            "compounds quickly — even small time savings multiply across all cases."
        )

    severity = bottleneck_map.get(activity.name, 0.0)
    if severity > 0.5:
        reasons.append(
            "This step is a bottleneck in the process flow, causing downstream delays "
            "that affect overall throughput."
        )

    if not reasons:
        reasons.append(
            f"This step has automation potential (score: {score:.0f}/100) based on "
            "its frequency, duration, and position in the process flow."
        )

    return " ".join(reasons)


def _assign_impacts_by_rank(n: int) -> list[str]:
    """Assign impact levels by rank position: top third=high, middle=medium, bottom=low."""
    if n == 0:
        return []
    high_count = max(1, round(n * 0.3))
    low_count = max(1, round(n * 0.3))
    medium_count = n - high_count - low_count
    if medium_count < 0:
        medium_count = 0
        low_count = n - high_count
    return ["high"] * high_count + ["medium"] * medium_count + ["low"] * low_count


def _assign_priorities_by_rank(n: int) -> list[int]:
    """Assign priorities 1-5 by rank position so there's always a spread."""
    if n == 0:
        return []
    priorities = []
    for i in range(n):
        bucket = int(i / n * 5) + 1
        priorities.append(min(bucket, 5))
    return priorities


def _estimate_time_saved(activity: Activity, automation_type: str) -> float:
    """Estimate seconds saved per case if this step is automated."""
    base = activity.avg_duration_seconds
    savings_ratio = {
        "automate": 0.9,
        "eliminate": 1.0,
        "simplify": 0.5,
        "parallelize": 0.4,
        "reassign": 0.7,
    }
    return base * savings_ratio.get(automation_type, 0.5)


def _estimate_affected_cases(activity: Activity, pipeline_output: PipelineOutput) -> float:
    """Estimate what % of cases include this activity using variant data."""
    total_cases = pipeline_output.statistics.total_cases
    if total_cases == 0:
        return 0.0
    # Sum case_count from all variants that contain this activity in their sequence
    affected = sum(
        v.case_count for v in pipeline_output.variants
        if activity.name in v.sequence
    )
    return round(min(100.0, (affected / total_cases) * 100), 1)
