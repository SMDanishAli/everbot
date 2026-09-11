-- Allocation history: one row per completed allocation run, for audit/reporting.
CREATE TABLE IF NOT EXISTS allocation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  allocation_id INTEGER NOT NULL,
  hours_requested INTEGER NOT NULL,
  strategy_name TEXT NOT NULL,
  type TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('ACTIVE', 'STANDBY')),
  total_hours_provided INTEGER NOT NULL,
  total_cost INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_allocation_history_created_at
  ON allocation_history (created_at);
