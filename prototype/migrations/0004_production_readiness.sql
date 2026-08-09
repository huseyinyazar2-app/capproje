ALTER TABLE backup_runs ADD COLUMN backup_date TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_backup_runs_tenant_daily
  ON backup_runs(tenant_id, backup_date)
  WHERE backup_date IS NOT NULL;

INSERT OR IGNORE INTO permissions (code, description) VALUES
  ('tokens.manage', 'Kişisel API tokenlarını oluşturma, yenileme ve iptal etme');

PRAGMA optimize;
