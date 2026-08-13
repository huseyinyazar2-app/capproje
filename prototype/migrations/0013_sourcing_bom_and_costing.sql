-- Tedarikçi teklif karşılaştırması, ürün reçetesi, iş merkezi kapasitesi,
-- üretim sorunları, iş kalemi bazlı maliyet ve şifre sıfırlama akışı.

-- Maliyet kırılımının iş kalemine inebilmesi için gider kayıtları iş kalemine bağlanır.
ALTER TABLE financial_transactions ADD COLUMN work_item_id TEXT REFERENCES work_items(id);
ALTER TABLE purchase_orders ADD COLUMN work_item_id TEXT REFERENCES work_items(id);
ALTER TABLE purchase_requests ADD COLUMN work_item_id TEXT REFERENCES work_items(id);
ALTER TABLE stock_movements ADD COLUMN work_item_id TEXT REFERENCES work_items(id);
ALTER TABLE production_orders ADD COLUMN rework_quantity REAL NOT NULL DEFAULT 0 CHECK (rework_quantity >= 0);
ALTER TABLE production_orders ADD COLUMN scrap_quantity REAL NOT NULL DEFAULT 0 CHECK (scrap_quantity >= 0);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_work_item ON financial_transactions(tenant_id, work_item_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_work_item ON purchase_orders(tenant_id, work_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_work_item ON stock_movements(tenant_id, work_item_id);

CREATE TABLE IF NOT EXISTS supplier_quotations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purchase_request_id TEXT NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  supplier_id TEXT NOT NULL REFERENCES suppliers(id),
  quotation_number TEXT,
  quotation_date TEXT,
  valid_until TEXT,
  currency TEXT NOT NULL DEFAULT 'TRY',
  quantity REAL,
  unit TEXT,
  unit_price_minor INTEGER NOT NULL DEFAULT 0,
  total_minor INTEGER NOT NULL DEFAULT 0,
  lead_time_days INTEGER CHECK (lead_time_days IS NULL OR lead_time_days >= 0),
  payment_terms TEXT,
  quality_note TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','received','selected','rejected','expired')),
  selected_at TEXT,
  selected_by TEXT REFERENCES users(id),
  rejection_reason TEXT,
  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, purchase_request_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_quotations_request ON supplier_quotations(tenant_id, purchase_request_id, status);
CREATE INDEX IF NOT EXISTS idx_supplier_quotations_supplier ON supplier_quotations(tenant_id, supplier_id, updated_at);

CREATE TABLE IF NOT EXISTS work_centers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  daily_capacity_minutes INTEGER NOT NULL DEFAULT 480 CHECK (daily_capacity_minutes > 0),
  hourly_cost_minor INTEGER NOT NULL DEFAULT 0,
  is_outsourced INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','passive')),
  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_work_centers_tenant_status ON work_centers(tenant_id, status, name);

CREATE TABLE IF NOT EXISTS bom_lines (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  inventory_item_id TEXT REFERENCES inventory_items(id),
  item_code TEXT,
  description TEXT NOT NULL,
  quantity_per_unit REAL NOT NULL CHECK (quantity_per_unit > 0),
  unit TEXT NOT NULL,
  scrap_rate REAL NOT NULL DEFAULT 0 CHECK (scrap_rate >= 0 AND scrap_rate < 100),
  unit_cost_minor INTEGER NOT NULL DEFAULT 0,
  supplier_id TEXT REFERENCES suppliers(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bom_lines_work_item ON bom_lines(tenant_id, work_item_id, sort_order);

CREATE TABLE IF NOT EXISTS production_operations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  production_order_id TEXT NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  work_center_id TEXT REFERENCES work_centers(id),
  sequence INTEGER NOT NULL DEFAULT 10,
  name TEXT NOT NULL,
  description TEXT,
  planned_minutes INTEGER NOT NULL DEFAULT 0 CHECK (planned_minutes >= 0),
  actual_minutes INTEGER NOT NULL DEFAULT 0 CHECK (actual_minutes >= 0),
  planned_start TEXT,
  planned_end TEXT,
  started_at TEXT,
  completed_at TEXT,
  assignee_user_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','blocked','completed','skipped')),
  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_production_operations_order ON production_operations(tenant_id, production_order_id, sequence);
CREATE INDEX IF NOT EXISTS idx_production_operations_center ON production_operations(tenant_id, work_center_id, planned_start, status);

CREATE TABLE IF NOT EXISTS production_issues (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  production_order_id TEXT NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  production_operation_id TEXT REFERENCES production_operations(id),
  project_id TEXT REFERENCES projects(id),
  work_item_id TEXT REFERENCES work_items(id),
  issue_number TEXT,
  issue_type TEXT NOT NULL CHECK (issue_type IN ('material','quality','machine','drawing','manpower','supplier','other')),
  severity TEXT NOT NULL DEFAULT 'normal' CHECK (severity IN ('low','normal','high','critical')),
  description TEXT NOT NULL,
  reported_by TEXT REFERENCES users(id),
  reported_at TEXT NOT NULL,
  responsible_user_id TEXT REFERENCES users(id),
  rework_quantity REAL NOT NULL DEFAULT 0 CHECK (rework_quantity >= 0),
  scrap_quantity REAL NOT NULL DEFAULT 0 CHECK (scrap_quantity >= 0),
  cost_impact_minor INTEGER NOT NULL DEFAULT 0,
  delay_days INTEGER NOT NULL DEFAULT 0 CHECK (delay_days >= 0),
  root_cause TEXT,
  resolution TEXT,
  resolved_at TEXT,
  resolved_by TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','cancelled')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_production_issues_order ON production_issues(tenant_id, production_order_id, status);
CREATE INDEX IF NOT EXISTS idx_production_issues_project ON production_issues(tenant_id, project_id, reported_at);

-- Şifre sıfırlama: teslim kanalı (SMS/e-posta) yapılandırılmadığı için kullanıcı
-- talebi açar, yetkili kullanıcı yeni geçici şifreyi verir. Telefon yalnız
-- hash'lenmiş biçimde saklanır ve hesabın varlığı istek yanıtından anlaşılamaz.
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  phone_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  contact_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','fulfilled','rejected','expired')),
  handled_by TEXT REFERENCES users(id),
  handled_at TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_password_reset_phone_time ON password_reset_requests(phone_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_ip_time ON password_reset_requests(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tenant_status ON password_reset_requests(tenant_id, status, created_at);

INSERT OR IGNORE INTO permissions (code, description) VALUES
('supplier-quotations.read','Tedarikçi tekliflerini görüntüleme'),
('supplier-quotations.write','Tedarikçi teklifi ekleme ve düzenleme'),
('supplier-quotations.delete','Tedarikçi teklifi silme'),
('supplier-quotations.select','Karşılaştırma sonucunda kazanan teklifi seçme'),
('work-centers.read','İş merkezlerini görüntüleme'),
('work-centers.write','İş merkezi ekleme ve düzenleme'),
('work-centers.delete','İş merkezi silme'),
('bom-lines.read','Ürün reçetesini görüntüleme'),
('bom-lines.write','Ürün reçetesi satırı ekleme ve düzenleme'),
('bom-lines.delete','Ürün reçetesi satırı silme'),
('work-items.explode-bom','Ürün reçetesinden malzeme ihtiyacı üretme'),
('production-operations.read','Üretim operasyonlarını görüntüleme'),
('production-operations.write','Üretim operasyonu ekleme ve düzenleme'),
('production-operations.delete','Üretim operasyonu silme'),
('production-operations.execute','Üretim operasyonunu başlatma ve tamamlama'),
('production-issues.read','Üretim sorunlarını görüntüleme'),
('production-issues.write','Üretim sorunu bildirme ve düzenleme'),
('production-issues.delete','Üretim sorunu silme'),
('production-issues.resolve','Üretim sorununu çözüme kapatma'),
('users.reset-password','Kullanıcıya yeni geçici şifre verme');

UPDATE role_templates SET permissions_json=json_insert(permissions_json,
  '$[#]','supplier-quotations.read','$[#]','supplier-quotations.write','$[#]','supplier-quotations.delete','$[#]','supplier-quotations.select')
WHERE code='purchasing';
UPDATE role_templates SET permissions_json=json_insert(permissions_json,
  '$[#]','supplier-quotations.read','$[#]','bom-lines.read','$[#]','work-centers.read','$[#]','production-operations.read','$[#]','production-issues.read')
WHERE code='project_manager';
UPDATE role_templates SET permissions_json=json_insert(permissions_json,
  '$[#]','work-centers.read','$[#]','work-centers.write','$[#]','bom-lines.read','$[#]','bom-lines.write','$[#]','bom-lines.delete',
  '$[#]','work-items.explode-bom','$[#]','production-operations.read','$[#]','production-operations.write','$[#]','production-operations.delete',
  '$[#]','production-operations.execute','$[#]','production-issues.read','$[#]','production-issues.write','$[#]','production-issues.resolve')
WHERE code='production';
UPDATE role_templates SET permissions_json=json_insert(permissions_json,
  '$[#]','production-issues.read','$[#]','production-issues.write')
WHERE code='installation';
UPDATE role_templates SET permissions_json=json_insert(permissions_json,
  '$[#]','supplier-quotations.read')
WHERE code='finance';

INSERT OR IGNORE INTO role_permissions (tenant_id,role_id,permission_code)
SELECT r.tenant_id,r.id,p.code
FROM roles r
JOIN permissions p ON
  (r.code='purchasing' AND p.code IN ('supplier-quotations.read','supplier-quotations.write','supplier-quotations.delete','supplier-quotations.select')) OR
  (r.code='project_manager' AND p.code IN ('supplier-quotations.read','bom-lines.read','work-centers.read','production-operations.read','production-issues.read')) OR
  (r.code='production' AND p.code IN ('work-centers.read','work-centers.write','bom-lines.read','bom-lines.write','bom-lines.delete','work-items.explode-bom','production-operations.read','production-operations.write','production-operations.delete','production-operations.execute','production-issues.read','production-issues.write','production-issues.resolve')) OR
  (r.code='installation' AND p.code IN ('production-issues.read','production-issues.write')) OR
  (r.code='finance' AND p.code='supplier-quotations.read') OR
  (r.code='read_only' AND p.code IN ('supplier-quotations.read','work-centers.read','bom-lines.read','production-operations.read','production-issues.read'));

PRAGMA optimize;
