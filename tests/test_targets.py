from types import SimpleNamespace

from app.services.targets import select_connections


def test_none_defaults_to_all_connections():
    connections = [SimpleNamespace(id=1), SimpleNamespace(id=2)]

    assert select_connections(connections, None) == connections


def test_empty_selection_stays_empty():
    connections = [SimpleNamespace(id=1), SimpleNamespace(id=2)]

    assert select_connections(connections, []) == []


def test_selection_only_includes_requested_connections_in_query_order():
    connections = [SimpleNamespace(id=1), SimpleNamespace(id=2), SimpleNamespace(id=3)]

    assert select_connections(connections, [3, 1]) == [connections[0], connections[2]]
