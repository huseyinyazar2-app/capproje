CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique
  ON users(phone)
  WHERE phone IS NOT NULL AND phone <> '';

CREATE TABLE IF NOT EXISTS phone_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_phone_sessions_token_active
  ON phone_sessions(token_hash, expires_at, revoked_at);

CREATE INDEX IF NOT EXISTS idx_phone_sessions_user
  ON phone_sessions(user_id, created_at);

CREATE TABLE IF NOT EXISTS phone_auth_requests (
  id TEXT PRIMARY KEY,
  phone_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','suppressed','failed','expired')),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  verified_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_phone_auth_phone_time
  ON phone_auth_requests(phone_hash, created_at);

CREATE INDEX IF NOT EXISTS idx_phone_auth_ip_time
  ON phone_auth_requests(ip_hash, created_at);

PRAGMA optimize;
