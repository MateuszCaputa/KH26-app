"""Tests for pipeline discovery module."""

import pytest
from backend.pipeline.ingest import ingest
from backend.pipeline.discovery import discover_activities, discover_process_map, build_nx_graph
from backend.models import Activity, ProcessMap

DATASET_DIR = "Process-to-Automation Copilot Challenge/Dataset"


@pytest.fixture(scope="module")
def event_log():
    return ingest(DATASET_DIR)


def test_discover_activities_returns_list(event_log):
    activities = discover_activities(event_log)
    assert isinstance(activities, list)
    assert len(activities) > 0
    assert all(isinstance(a, Activity) for a in activities)


def test_activities_sorted_by_frequency(event_log):
    activities = discover_activities(event_log)
    frequencies = [a.frequency for a in activities]
    assert frequencies == sorted(frequencies, reverse=True)


def test_activities_have_valid_durations(event_log):
    activities = discover_activities(event_log)
    for a in activities:
        assert a.avg_duration_seconds >= 0
        assert a.min_duration_seconds <= a.avg_duration_seconds
        assert a.avg_duration_seconds <= a.max_duration_seconds


def test_discover_process_map_returns_model(event_log):
    process_map = discover_process_map(event_log)
    assert isinstance(process_map, ProcessMap)
    assert len(process_map.nodes) > 0
    assert len(process_map.edges) > 0


def test_process_map_edges_reference_valid_nodes(event_log):
    process_map = discover_process_map(event_log)
    node_ids = {n.id for n in process_map.nodes}
    for edge in process_map.edges:
        assert edge.source in node_ids
        assert edge.target in node_ids


def test_build_nx_graph(event_log):
    process_map = discover_process_map(event_log)
    G = build_nx_graph(process_map)
    assert G.number_of_nodes() > 0
    assert G.number_of_edges() > 0
