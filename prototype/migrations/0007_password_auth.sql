ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN password_salt TEXT;
ALTER TABLE users ADD COLUMN password_iterations INTEGER;
ALTER TABLE users ADD COLUMN password_changed_at TEXT;
ALTER TABLE users ADD COLUMN password_last_login_at TEXT;

ALTER TABLE phone_sessions ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'phone_otp'
  CHECK (auth_method IN ('phone_otp','password'));

CREATE TABLE IF NOT EXISTS password_auth_attempts (
  id TEXT PRIMARY KEY,
  phone_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0 CHECK (success IN (0,1)),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_password_auth_phone_time
  ON password_auth_attempts(phone_hash, created_at);

CREATE INDEX IF NOT EXISTS idx_password_auth_ip_time
  ON password_auth_attempts(ip_hash, created_at);
