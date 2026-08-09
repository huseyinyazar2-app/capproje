CREATE TABLE IF NOT EXISTS site_surveys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id),
  customer_id TEXT REFERENCES customers(id),
  survey_number TEXT NOT NULL,
  survey_date TEXT NOT NULL,
  location TEXT,
  surveyor_user_id TEXT REFERENCES users(id),
  customer_contact TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_progress','completed','approved','cancelled')),
  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  completed_at TEXT,
  approved_at TEXT,
  approved_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, survey_number)
);

CREATE TABLE IF NOT EXISTS survey_measurements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_survey_id TEXT NOT NULL REFERENCES site_surveys(id) ON DELETE CASCADE,
  space_name TEXT NOT NULL,
  element_type TEXT NOT NULL,
  item_code TEXT,
  description TEXT,
  width REAL,
  height REAL,
  depth REAL,
  length REAL,
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT NOT NULL,
  material TEXT,
  finish TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contract_number TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  offer_id TEXT REFERENCES offers(id),
  payment_model TEXT NOT NULL CHECK (payment_model IN ('progress_payment','advance_balance','custom')),
  currency TEXT NOT NULL DEFAULT 'TRY',
  contract_amount_minor INTEGER NOT NULL DEFAULT 0,
  advance_rate REAL NOT NULL DEFAULT 0,
  advance_amount_minor INTEGER NOT NULL DEFAULT 0,
  retention_rate REAL NOT NULL DEFAULT 0,
  retention_amount_minor INTEGER NOT NULL DEFAULT 0,
  warranty_months INTEGER NOT NULL DEFAULT 0,
  warranty_amount_minor INTEGER NOT NULL DEFAULT 0,
  payment_schedule_json TEXT NOT NULL DEFAULT '[]',
  effective_date TEXT,
  planned_start_date TEXT,
  planned_end_date TEXT,
  signed_at TEXT,
  signed_by_customer TEXT,
  signed_by_company TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_signature','signed','active','completed','terminated','cancelled')),
  termination_reason TEXT,
  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, contract_number)
);

CREATE TABLE IF NOT EXISTS design_revisions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id),
  work_item_id TEXT REFERENCES work_items(id),
  revision_number INTEGER NOT NULL DEFAULT 1,
  drawing_type TEXT NOT NULL CHECK (drawing_type IN ('2d','3d','shop_drawing')),
  title TEXT NOT NULL,
  file_id TEXT REFERENCES files(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','internal_review','client_review','approved','rejected','superseded')),
  submitted_at TEXT,
  client_decision_at TEXT,
  client_decision_by TEXT,
  rejection_reason TEXT,
  supersedes_id TEXT REFERENCES design_revisions(id),
  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, project_id, drawing_type, revision_number)
);

CREATE TABLE IF NOT EXISTS progress_payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  progress_number TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  contract_id TEXT NOT NULL REFERENCES contracts(id),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TRY',
  previous_work_minor INTEGER NOT NULL DEFAULT 0,
  current_work_minor INTEGER NOT NULL DEFAULT 0,
  cumulative_work_minor INTEGER NOT NULL DEFAULT 0,
  deduction_minor INTEGER NOT NULL DEFAULT 0,
  retention_minor INTEGER NOT NULL DEFAULT 0,
  tax_minor INTEGER NOT NULL DEFAULT 0,
  net_payable_minor INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','rejected','invoiced','paid','cancelled')),
  approved_at TEXT,
  approved_by TEXT REFERENCES users(id),
  rejection_reason TEXT,
  invoice_id TEXT REFERENCES invoices(id),
  invoiced_at TEXT,
  payment_transaction_id TEXT REFERENCES financial_transactions(id),
  paid_at TEXT,
  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, progress_number)
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT NOT NULL,
  on_hand_quantity REAL NOT NULL DEFAULT 0,
  reserved_quantity REAL NOT NULL DEFAULT 0,
  minimum_quantity REAL NOT NULL DEFAULT 0,
  average_cost_minor INTEGER NOT NULL DEFAULT 0,
  warehouse_location TEXT,
  preferred_supplier_id TEXT REFERENCES suppliers(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','passive','discontinued')),
  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, sku)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  movement_number TEXT NOT NULL,
  inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id),
  project_id TEXT REFERENCES projects(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('receipt','issue','adjustment_in','adjustment_out','project_issue','project_return')),
  movement_date TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit_cost_minor INTEGER NOT NULL DEFAULT 0,
  total_cost_minor INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','cancelled')),
  source_type TEXT,
  source_id TEXT,
  reference TEXT,
  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  posted_at TEXT,
  posted_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, movement_number)
);

CREATE INDEX IF NOT EXISTS idx_site_surveys_tenant_project ON site_surveys(tenant_id, project_id, survey_date);
CREATE INDEX IF NOT EXISTS idx_survey_measurements_tenant_survey ON survey_measurements(tenant_id, site_survey_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_contracts_tenant_project ON contracts(tenant_id, project_id, status);
CREATE INDEX IF NOT EXISTS idx_design_revisions_tenant_project ON design_revisions(tenant_id, project_id, drawing_type, revision_number);
CREATE INDEX IF NOT EXISTS idx_progress_payments_tenant_contract ON progress_payments(tenant_id, contract_id, period_end);
CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant_status ON inventory_items(tenant_id, status, name);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_item ON stock_movements(tenant_id, inventory_item_id, movement_date);

CREATE TRIGGER IF NOT EXISTS trg_stock_movement_post
BEFORE UPDATE OF status ON stock_movements
WHEN NEW.status = 'posted' AND OLD.status = 'draft'
BEGIN
  UPDATE inventory_items
  SET on_hand_quantity = on_hand_quantity + CASE
      WHEN NEW.movement_type IN ('receipt','adjustment_in','project_return') THEN NEW.quantity
      ELSE -NEW.quantity
    END,
    updated_at = NEW.updated_at
  WHERE id = NEW.inventory_item_id
    AND tenant_id = NEW.tenant_id
    AND (
      NEW.movement_type IN ('receipt','adjustment_in','project_return')
      OR on_hand_quantity >= NEW.quantity
    );
  SELECT CASE WHEN changes() = 0 THEN RAISE(ABORT, 'insufficient_stock_or_cross_tenant_item') END;
END;

ALTER TABLE projects ADD COLUMN photo_consent TEXT NOT NULL DEFAULT 'not_requested' CHECK (photo_consent IN ('not_requested','denied','internal_only','marketing_allowed'));
ALTER TABLE contracts ADD COLUMN photo_consent TEXT NOT NULL DEFAULT 'not_requested' CHECK (photo_consent IN ('not_requested','denied','internal_only','marketing_allowed'));
ALTER TABLE production_orders ADD COLUMN trade_type TEXT CHECK (trade_type IN ('internal','cila','metal','glass_mirror','door','upholstery','stone','other'));

CREATE TABLE IF NOT EXISTS project_meetings (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id), meeting_type TEXT NOT NULL CHECK (meeting_type IN ('weekly_project','weekly_production','coordination','site')),
  meeting_date TEXT NOT NULL, title TEXT NOT NULL, facilitator_user_id TEXT REFERENCES users(id),
  attendees_json TEXT NOT NULL DEFAULT '[]', summary TEXT, status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed')),
  published_at TEXT, closed_at TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meeting_actions (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meeting_id TEXT NOT NULL REFERENCES project_meetings(id) ON DELETE CASCADE, project_id TEXT REFERENCES projects(id),
  title TEXT NOT NULL, description TEXT, owner_user_id TEXT REFERENCES users(id), due_date TEXT, priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','cancelled')),
  completed_at TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quality_inspections (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  inspection_number TEXT NOT NULL, project_id TEXT NOT NULL REFERENCES projects(id), work_item_id TEXT REFERENCES work_items(id),
  production_order_id TEXT REFERENCES production_orders(id), installation_id TEXT REFERENCES installations(id),
  inspection_type TEXT NOT NULL CHECK (inspection_type IN ('incoming','in_process','final','site')),
  inspection_date TEXT NOT NULL, inspector_user_id TEXT REFERENCES users(id), result TEXT DEFAULT 'pending' CHECK (result IN ('pending','pass','conditional','fail')),
  checklist_json TEXT NOT NULL DEFAULT '[]', defect_notes TEXT, corrective_action TEXT, corrective_due_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','completed','closed')),
  completed_at TEXT, closed_at TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, inspection_number)
);

CREATE TABLE IF NOT EXISTS handovers (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  handover_number TEXT NOT NULL, project_id TEXT NOT NULL REFERENCES projects(id), installation_id TEXT REFERENCES installations(id),
  handover_date TEXT NOT NULL, customer_contact TEXT NOT NULL, satisfaction_score INTEGER CHECK (satisfaction_score BETWEEN 1 AND 5),
  customer_signature_file_id TEXT REFERENCES files(id), acceptance_notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','punch_open','accepted','rejected','closed')),
  accepted_at TEXT, rejected_at TEXT, closed_at TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, handover_number)
);

CREATE TABLE IF NOT EXISTS handover_punch_items (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  handover_id TEXT NOT NULL REFERENCES handovers(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT,
  responsible_user_id TEXT REFERENCES users(id), due_date TEXT, severity TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','accepted','cancelled')),
  resolved_at TEXT, accepted_at TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_meetings_tenant_date ON project_meetings(tenant_id, meeting_date, meeting_type);
CREATE INDEX IF NOT EXISTS idx_meeting_actions_tenant_due ON meeting_actions(tenant_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_quality_inspections_tenant_project ON quality_inspections(tenant_id, project_id, inspection_date);
CREATE INDEX IF NOT EXISTS idx_handovers_tenant_project ON handovers(tenant_id, project_id, handover_date);
CREATE INDEX IF NOT EXISTS idx_handover_punch_tenant_handover ON handover_punch_items(tenant_id, handover_id, status);

INSERT OR IGNORE INTO permissions (code, description) VALUES
('site-surveys.read','Keşifleri görüntüleme'), ('site-surveys.write','Keşif ekleme ve düzenleme'), ('site-surveys.delete','Keşif silme'), ('site-surveys.approve','Keşif tamamlama ve onaylama'),
('survey-measurements.read','Metraj satırlarını görüntüleme'), ('survey-measurements.write','Metraj satırı ekleme ve düzenleme'), ('survey-measurements.delete','Metraj satırı silme'),
('contracts.read','Sözleşmeleri görüntüleme'), ('contracts.write','Sözleşme ekleme ve düzenleme'), ('contracts.delete','Sözleşme silme'), ('contracts.transition','Sözleşme imza ve yaşam döngüsünü yönetme'),
('design-revisions.read','Tasarım revizyonlarını görüntüleme'), ('design-revisions.write','Tasarım revizyonu ekleme ve düzenleme'), ('design-revisions.delete','Tasarım revizyonu silme'), ('design-revisions.approve','Müşteri tasarım kararlarını yönetme'),
('progress-payments.read','Hakedişleri görüntüleme'), ('progress-payments.write','Hakediş ekleme ve düzenleme'), ('progress-payments.delete','Hakediş silme'), ('progress-payments.approve','Hakediş yaşam döngüsünü yönetme'),
('inventory-items.read','Stok kartlarını görüntüleme'), ('inventory-items.write','Stok kartı ekleme ve düzenleme'), ('inventory-items.delete','Stok kartı silme'),
('stock-movements.read','Stok hareketlerini görüntüleme'), ('stock-movements.write','Stok hareketi ekleme ve düzenleme'), ('stock-movements.delete','Stok hareketi silme'), ('stock-movements.post','Stok hareketini kesinleştirme');

INSERT OR IGNORE INTO permissions (code, description) VALUES
('project-meetings.read','Toplantıları görüntüleme'), ('project-meetings.write','Toplantı ekleme ve düzenleme'), ('project-meetings.delete','Toplantı silme'), ('project-meetings.publish','Toplantı yayınlama ve kapatma'),
('meeting-actions.read','Toplantı aksiyonlarını görüntüleme'), ('meeting-actions.write','Toplantı aksiyonu ekleme ve düzenleme'), ('meeting-actions.delete','Toplantı aksiyonu silme'),
('quality-inspections.read','Kalite ve saha kontrollerini görüntüleme'), ('quality-inspections.write','Kalite kontrolü ekleme ve düzenleme'), ('quality-inspections.delete','Kalite kontrolü silme'), ('quality-inspections.complete','Kalite kontrolünü sonuçlandırma'),
('handovers.read','Teslim ve kabul kayıtlarını görüntüleme'), ('handovers.write','Teslim kaydı ekleme ve düzenleme'), ('handovers.delete','Teslim kaydı silme'), ('handovers.transition','Teslim kabul yaşam döngüsünü yönetme'),
('handover-punch-items.read','Eksik listesini görüntüleme'), ('handover-punch-items.write','Eksik kalemi ekleme ve düzenleme'), ('handover-punch-items.delete','Eksik kalemi silme');

CREATE TABLE IF NOT EXISTS role_templates (
  code TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, permissions_json TEXT NOT NULL
);

INSERT OR REPLACE INTO role_templates (code,name,description,permissions_json) VALUES
('architect','Mimar','Keşif, teklif ve tasarım süreçleri','["dashboard.read","customers.read","customers.write","projects.read","projects.write","offers.read","offers.write","site-surveys.read","site-surveys.write","site-surveys.approve","survey-measurements.read","survey-measurements.write","survey-measurements.delete","design-revisions.read","design-revisions.write","design-revisions.approve","files.read","files.write","files.manage"]'),
('project_manager','Proje Yöneticisi','Proje uçtan uca operasyon yönetimi','["dashboard.read","customers.read","projects.read","projects.write","projects.transition","offers.read","site-surveys.read","survey-measurements.read","contracts.read","project-tasks.read","project-tasks.write","work-items.read","work-items.write","work-items.revision.approve","purchase-requests.read","production-orders.read","installations.read","installations.write","design-revisions.read","design-revisions.write","progress-payments.read","project-meetings.read","project-meetings.write","project-meetings.publish","meeting-actions.read","meeting-actions.write","quality-inspections.read","handovers.read","handovers.write","handover-punch-items.read","handover-punch-items.write","files.read","files.write","cost.view"]'),
('purchasing','Satın Alma','Tedarikçi, satın alma ve stok görünürlüğü','["dashboard.read","projects.read","suppliers.read","suppliers.write","suppliers.delete","purchase-requests.read","purchase-requests.write","purchase-requests.delete","purchase-requests.approve","purchase-orders.read","purchase-orders.write","purchase-orders.delete","inventory-items.read","stock-movements.read","files.read","files.write"]'),
('production','Üretim','İş kalemi, üretim, stok ve kalite operasyonları','["dashboard.read","projects.read","project-tasks.read","project-tasks.write","work-items.read","work-items.write","work-items.revision.approve","production-orders.read","production-orders.write","production-orders.release","inventory-items.read","inventory-items.write","stock-movements.read","stock-movements.write","stock-movements.post","quality-inspections.read","quality-inspections.write","quality-inspections.complete","project-meetings.read","meeting-actions.read","meeting-actions.write","files.read","files.write"]'),
('installation','Montaj','Saha, montaj, kalite ve teslim operasyonları','["dashboard.read","projects.read","work-items.read","installations.read","installations.write","installations.delete","site-surveys.read","quality-inspections.read","quality-inspections.write","quality-inspections.complete","handovers.read","handovers.write","handovers.transition","handover-punch-items.read","handover-punch-items.write","handover-punch-items.delete","meeting-actions.read","meeting-actions.write","files.read","files.write","files.manage"]'),
('finance','Finans / Ön Muhasebe','Finans, fatura, sözleşme ve hakediş yönetimi','["dashboard.read","customers.read","suppliers.read","projects.read","accounts.read","accounts.write","accounts.delete","financial-transactions.read","financial-transactions.write","financial-transactions.delete","financial-transactions.approve","financial-transactions.reverse","invoices.read","invoices.write","invoices.delete","contracts.read","progress-payments.read","progress-payments.write","progress-payments.delete","progress-payments.approve","cost.view","finance.sensitive.read","export","files.read"]'),
('hr','İnsan Kaynakları','Personel, puantaj, izin ve bordro yönetimi','["dashboard.read","employees.read","employees.write","employees.delete","attendance.read","attendance.write","attendance.delete","leaves.read","leaves.write","leaves.delete","leaves.approve","payroll-inputs.read","payroll-inputs.write","payroll-inputs.delete","salary.view","hr.sensitive.read","files.read","files.write"]'),
('read_only','Salt Okunur','Hassas alanlar hariç görüntüleme','[]');

INSERT OR IGNORE INTO roles (id,tenant_id,code,name,description,is_system,created_at,updated_at)
SELECT t.id || '_role_' || rt.code,t.id,rt.code,rt.name,rt.description,1,datetime('now'),datetime('now')
FROM tenants t CROSS JOIN role_templates rt;

INSERT OR IGNORE INTO role_permissions (tenant_id,role_id,permission_code)
SELECT r.tenant_id,r.id,j.value FROM roles r JOIN role_templates rt ON rt.code=r.code JOIN json_each(rt.permissions_json) j
JOIN permissions p ON p.code=j.value WHERE r.code<>'read_only';

INSERT OR IGNORE INTO role_permissions (tenant_id,role_id,permission_code)
SELECT r.tenant_id,r.id,p.code FROM roles r JOIN permissions p ON p.code LIKE '%.read'
WHERE r.code='read_only' AND p.code NOT IN ('hr.sensitive.read','finance.sensitive.read','audit-logs.read','backups.read');

PRAGMA optimize;
