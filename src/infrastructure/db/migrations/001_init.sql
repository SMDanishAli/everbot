CREATE TABLE IF NOT EXISTS robot_inventory (
  type TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('ACTIVE', 'STANDBY')),
  available INTEGER NOT NULL CHECK (available >= 0),
  PRIMARY KEY (type, source)
);

-- Allocation history: one row per completed allocation run, for audit/reporting.
CREATE TABLE IF NOT EXISTS allocation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hours_requested INTEGER NOT NULL,
  strategy_name TEXT NOT NULL,
  assigned_robots_json TEXT NOT NULL,   -- serialized [{type, source}, ...]
  total_hours_provided INTEGER NOT NULL,
  total_cost INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_allocation_history_created_at
  ON allocation_history (created_at);
