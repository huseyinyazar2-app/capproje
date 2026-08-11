PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS membership_roles (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  membership_id TEXT NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, membership_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_membership_roles_membership
  ON membership_roles (tenant_id, membership_id);

CREATE INDEX IF NOT EXISTS idx_membership_roles_role
  ON membership_roles (tenant_id, role_id);

INSERT OR IGNORE INTO membership_roles (tenant_id, membership_id, role_id, created_at)
SELECT tenant_id, id, role_id, created_at
FROM memberships;
