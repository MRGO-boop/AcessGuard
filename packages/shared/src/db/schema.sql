-- AccessGuard AI — SQLite schema
-- Mocked enterprise IAM datasets. All timestamps are ISO-8601 strings.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS employees (
  id                        TEXT PRIMARY KEY,
  name                      TEXT NOT NULL,
  email                     TEXT NOT NULL,
  title                     TEXT NOT NULL,
  department                TEXT NOT NULL,
  manager_id                TEXT,
  employee_type             TEXT NOT NULL,
  employment_status         TEXT NOT NULL,
  location                  TEXT NOT NULL,
  country                   TEXT NOT NULL,
  start_date                TEXT NOT NULL,
  mfa_enabled               INTEGER NOT NULL,
  security_training_complete INTEGER NOT NULL,
  on_call                   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  resource     TEXT NOT NULL,
  role         TEXT NOT NULL,
  sensitivity  TEXT NOT NULL,
  granted_at   TEXT NOT NULL,
  granted_by   TEXT NOT NULL,
  temporary    INTEGER NOT NULL,
  expires_at   TEXT,
  FOREIGN KEY (user_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  action      TEXT NOT NULL,
  resource    TEXT,
  outcome     TEXT NOT NULL,
  ip_address  TEXT NOT NULL,
  country     TEXT NOT NULL,
  device      TEXT NOT NULL,
  timestamp   TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS tickets (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL,
  resource    TEXT,
  approver_id TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS policies (
  id                        TEXT PRIMARY KEY,
  name                      TEXT NOT NULL,
  description               TEXT NOT NULL,
  resource_pattern          TEXT NOT NULL,
  requires_mfa              INTEGER NOT NULL,
  requires_ticket           INTEGER NOT NULL,
  requires_manager_approval INTEGER NOT NULL,
  disallow_contractors      INTEGER NOT NULL,
  max_temp_access_hours     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS access_requests (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  resource     TEXT NOT NULL,
  role         TEXT NOT NULL,
  status       TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  decided_by   TEXT,
  created_at   TEXT NOT NULL,
  decided_at   TEXT,
  FOREIGN KEY (user_id) REFERENCES employees(id)
);

CREATE INDEX IF NOT EXISTS idx_permissions_user ON permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_user ON access_requests(user_id);
