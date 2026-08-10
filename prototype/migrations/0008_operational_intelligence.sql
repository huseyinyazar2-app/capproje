CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT,
  module TEXT,
  record_id TEXT,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread','read','dismissed')),
  due_at TEXT,
  read_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_communications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES customers(id),
  channel TEXT NOT NULL CHECK (channel IN ('phone','email','whatsapp','meeting','site','other')),
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound','outbound','internal')),
  contact_name TEXT,
  subject TEXT NOT NULL,
  summary TEXT,
  decision TEXT,
  occurred_at TEXT NOT NULL,
  next_follow_up_at TEXT,
  owner_user_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','follow_up','closed')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resource_assignments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  employee_id TEXT REFERENCES employees(id),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('employee','team','work_center','subcontractor')),
  resource_name TEXT NOT NULL,
  role TEXT,
  planned_start TEXT NOT NULL,
  planned_end TEXT NOT NULL,
  allocation_percent INTEGER NOT NULL DEFAULT 100 CHECK (allocation_percent BETWEEN 1 AND 100),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','confirmed','active','completed','cancelled')),
  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user_status ON notifications(tenant_id, user_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_project ON notifications(tenant_id, project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_project_communications_tenant_project ON project_communications(tenant_id, project_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_project_communications_tenant_follow_up ON project_communications(tenant_id, status, next_follow_up_at);
CREATE INDEX IF NOT EXISTS idx_resource_assignments_tenant_dates ON resource_assignments(tenant_id, planned_start, planned_end, status);
CREATE INDEX IF NOT EXISTS idx_resource_assignments_tenant_project ON resource_assignments(tenant_id, project_id, status);

INSERT OR IGNORE INTO permissions (code, description) VALUES
('project-communications.read','Proje iletişim geçmişini görüntüleme'),
('project-communications.write','Proje iletişimi ekleme ve düzenleme'),
('project-communications.delete','Proje iletişimi silme'),
('resource-assignments.read','Kaynak ve kapasite planını görüntüleme'),
('resource-assignments.write','Kaynak ve kapasite planı ekleme ve düzenleme'),
('resource-assignments.delete','Kaynak ve kapasite planı silme');

UPDATE role_templates SET permissions_json=json_insert(permissions_json,
  '$[#]','project-communications.read','$[#]','project-communications.write')
WHERE code IN ('architect','project_manager');
UPDATE role_templates SET permissions_json=json_insert(permissions_json,
  '$[#]','project-communications.read')
WHERE code IN ('finance');
UPDATE role_templates SET permissions_json=json_insert(permissions_json,
  '$[#]','resource-assignments.read','$[#]','resource-assignments.write')
WHERE code IN ('project_manager','production','installation','hr');

INSERT OR IGNORE INTO role_permissions (tenant_id,role_id,permission_code)
SELECT r.tenant_id,r.id,p.code
FROM roles r
JOIN permissions p ON
  (r.code IN ('architect','project_manager') AND p.code IN ('project-communications.read','project-communications.write')) OR
  (r.code='finance' AND p.code='project-communications.read') OR
  (r.code IN ('project_manager','production','installation','hr') AND p.code IN ('resource-assignments.read','resource-assignments.write')) OR
  (r.code='read_only' AND p.code IN ('project-communications.read','resource-assignments.read'));
