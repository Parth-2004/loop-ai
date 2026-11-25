def select_connections(connections, connection_ids):
    """Select explicit targets; None means all connections, while [] means none."""
    if connection_ids is None:
        return list(connections)
    selected = set(connection_ids)
    return [connection for connection in connections if connection.id in selected]
