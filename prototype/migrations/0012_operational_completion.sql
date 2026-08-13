-- Üretim, satın alma ve stok zincirini tamamlar; eski tablolara durum doğrulaması ekler.

ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;

ALTER TABLE production_orders ADD COLUMN started_at TEXT;
ALTER TABLE production_orders ADD COLUMN started_by TEXT REFERENCES users(id);
ALTER TABLE production_orders ADD COLUMN completed_at TEXT;
ALTER TABLE production_orders ADD COLUMN completed_by TEXT REFERENCES users(id);
ALTER TABLE production_orders ADD COLUMN cancelled_at TEXT;
ALTER TABLE production_orders ADD COLUMN cancel_reason TEXT;

ALTER TABLE purchase_orders ADD COLUMN ordered_at TEXT;
ALTER TABLE purchase_orders ADD COLUMN received_at TEXT;
ALTER TABLE purchase_orders ADD COLUMN received_by TEXT REFERENCES users(id);
ALTER TABLE purchase_orders ADD COLUMN cancel_reason TEXT;

ALTER TABLE purchase_requests ADD COLUMN purchase_order_id TEXT REFERENCES purchase_orders(id);

ALTER TABLE material_requirements ADD COLUMN consumed_quantity REAL NOT NULL DEFAULT 0 CHECK (consumed_quantity >= 0);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_order ON purchase_requests(tenant_id, purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_request ON purchase_orders(tenant_id, request_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_cleanup ON idempotency_records(created_at);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_updated ON customers(tenant_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_updated ON suppliers(tenant_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_updated ON employees(tenant_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_updated ON accounts(tenant_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_offer_items_tenant_offer ON offer_items(tenant_id, offer_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_leave_requests_tenant_updated ON leave_requests(tenant_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_payroll_inputs_tenant_period ON payroll_inputs(tenant_id, period, status);

-- Eski tablolarda durum alanı serbest metindi. Önce kanonik kümenin dışındaki
-- kayıtları güvenli varsayılana taşıyıp eski değeri metadata içinde saklıyoruz,
-- ardından tetikleyicilerle kümeyi zorunlu kılıyoruz.
UPDATE projects SET metadata_json=json_set(metadata_json,'$.legacy_status',status), status='lead'
  WHERE status NOT IN ('lead','discovery','estimating','offered','contracted','design','procurement','production','installation','acceptance','completed','on_hold','lost','cancelled');
UPDATE offers SET metadata_json=json_set(metadata_json,'$.legacy_status',status), status='draft'
  WHERE status NOT IN ('draft','costing','sent','pending','revision_requested','accepted','rejected','expired','cancelled');
UPDATE purchase_requests SET metadata_json=json_set(metadata_json,'$.legacy_status',status), status='draft'
  WHERE status NOT IN ('draft','pending','approved','rejected','ordered','partial','received','cancelled');
UPDATE purchase_orders SET metadata_json=json_set(metadata_json,'$.legacy_status',status), status='draft'
  WHERE status NOT IN ('draft','ordered','partial','received','cancelled');
UPDATE production_orders SET metadata_json=json_set(metadata_json,'$.legacy_status',status), status='draft'
  WHERE status NOT IN ('draft','planned','released','waiting_material','in_progress','quality_control','paused','completed','cancelled');
UPDATE installations SET metadata_json=json_set(metadata_json,'$.legacy_status',status), status='planned'
  WHERE status NOT IN ('planned','survey_needed','site_waiting','in_transit','in_progress','incomplete','completed','cancelled');
UPDATE financial_transactions SET metadata_json=json_set(metadata_json,'$.legacy_status',status), status='draft'
  WHERE status NOT IN ('draft','planned','pending','approved','collected','paid','overdue','reversed','cancelled');
UPDATE invoices SET metadata_json=json_set(metadata_json,'$.legacy_status',status), status='draft'
  WHERE status NOT IN ('draft','open','partial','paid','collected','overdue','cancelled');
UPDATE employees SET metadata_json=json_set(metadata_json,'$.legacy_status',status), status='active'
  WHERE status NOT IN ('active','on_leave','inactive','terminated');
UPDATE attendance SET metadata_json=json_set(metadata_json,'$.legacy_status',status), status='present'
  WHERE status NOT IN ('present','absent','leave','remote','holiday','sick');
UPDATE leave_requests SET metadata_json=json_set(metadata_json,'$.legacy_status',status), status='pending'
  WHERE status NOT IN ('pending','approved','rejected','cancelled');
UPDATE payroll_inputs SET metadata_json=json_set(metadata_json,'$.legacy_status',status), status='draft'
  WHERE status NOT IN ('draft','approved','exported','cancelled');
UPDATE work_items SET metadata_json=json_set(metadata_json,'$.legacy_status',status), status='planned'
  WHERE status NOT IN ('planned','approved','production','completed','cancelled');
UPDATE work_items SET revision_status='draft'
  WHERE revision_status NOT IN ('draft','review','changes_requested','approved','superseded');
UPDATE project_tasks SET metadata_json=json_set(metadata_json,'$.legacy_status',status), status='todo'
  WHERE status NOT IN ('todo','in_progress','blocked','completed','cancelled');
UPDATE accounts SET metadata_json=json_set(metadata_json,'$.legacy_status',status), status='active'
  WHERE status NOT IN ('active','passive','closed');
UPDATE customers SET metadata_json=json_set(metadata_json,'$.legacy_status',status), status='active'
  WHERE status NOT IN ('active','passive','blacklisted');
UPDATE suppliers SET metadata_json=json_set(metadata_json,'$.legacy_status',status), status='active'
  WHERE status NOT IN ('active','passive','blacklisted');

CREATE TRIGGER IF NOT EXISTS trg_projects_status_insert BEFORE INSERT ON projects
WHEN NEW.status NOT IN ('lead','discovery','estimating','offered','contracted','design','procurement','production','installation','acceptance','completed','on_hold','lost','cancelled')
BEGIN
  SELECT RAISE(ABORT,'invalid status for projects');
END;
CREATE TRIGGER IF NOT EXISTS trg_projects_status_update BEFORE UPDATE OF status ON projects
WHEN NEW.status NOT IN ('lead','discovery','estimating','offered','contracted','design','procurement','production','installation','acceptance','completed','on_hold','lost','cancelled')
BEGIN
  SELECT RAISE(ABORT,'invalid status for projects');
END;

CREATE TRIGGER IF NOT EXISTS trg_offers_status_insert BEFORE INSERT ON offers
WHEN NEW.status NOT IN ('draft','costing','sent','pending','revision_requested','accepted','rejected','expired','cancelled')
BEGIN
  SELECT RAISE(ABORT,'invalid status for offers');
END;
CREATE TRIGGER IF NOT EXISTS trg_offers_status_update BEFORE UPDATE OF status ON offers
WHEN NEW.status NOT IN ('draft','costing','sent','pending','revision_requested','accepted','rejected','expired','cancelled')
BEGIN
  SELECT RAISE(ABORT,'invalid status for offers');
END;

CREATE TRIGGER IF NOT EXISTS trg_purchase_requests_status_insert BEFORE INSERT ON purchase_requests
WHEN NEW.status NOT IN ('draft','pending','approved','rejected','ordered','partial','received','cancelled')
BEGIN
  SELECT RAISE(ABORT,'invalid status for purchase_requests');
END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_requests_status_update BEFORE UPDATE OF status ON purchase_requests
WHEN NEW.status NOT IN ('draft','pending','approved','rejected','ordered','partial','received','cancelled')
BEGIN
  SELECT RAISE(ABORT,'invalid status for purchase_requests');
END;

CREATE TRIGGER IF NOT EXISTS trg_purchase_orders_status_insert BEFORE INSERT ON purchase_orders
WHEN NEW.status NOT IN ('draft','ordered','partial','received','cancelled')
BEGIN
  SELECT RAISE(ABORT,'invalid status for purchase_orders');
END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_orders_status_update BEFORE UPDATE OF status ON purchase_orders
WHEN NEW.status NOT IN ('draft','ordered','partial','received','cancelled')
BEGIN
  SELECT RAISE(ABORT,'invalid status for purchase_orders');
END;

CREATE TRIGGER IF NOT EXISTS trg_production_orders_status_insert BEFORE INSERT ON production_orders
WHEN NEW.status NOT IN ('draft','planned','released','waiting_material','in_progress','quality_control','paused','completed','cancelled')
BEGIN
  SELECT RAISE(ABORT,'invalid status for production_orders');
END;
CREATE TRIGGER IF NOT EXISTS trg_production_orders_status_update BEFORE UPDATE OF status ON production_orders
WHEN NEW.status NOT IN ('draft','planned','released','waiting_material','in_progress','quality_control','paused','completed','cancelled')
BEGIN
  SELECT RAISE(ABORT,'invalid status for production_orders');
END;

CREATE TRIGGER IF NOT EXISTS trg_installations_status_insert BEFORE INSERT ON installations
WHEN NEW.status NOT IN ('planned','survey_needed','site_waiting','in_transit','in_progress','incomplete','completed','cancelled')
BEGIN
  SELECT RAISE(ABORT,'invalid status for installations');
END;
CREATE TRIGGER IF NOT EXISTS trg_installations_status_update BEFORE UPDATE OF status ON installations
WHEN NEW.status NOT IN ('planned','survey_needed','site_waiting','in_transit','in_progress','incomplete','completed','cancelled')
BEGIN
  SELECT RAISE(ABORT,'invalid status for installations');
END;

CREATE TRIGGER IF NOT EXISTS trg_financial_transactions_status_insert BEFORE INSERT ON financial_transactions
WHEN NEW.status NOT IN ('draft','planned','pending','approved','collected','paid','overdue','reversed','cancelled')
BEGIN
  SELECT RAISE(ABORT,'invalid status for financial_transactions');
END;
CREATE TRIGGER IF NOT EXISTS trg_financial_transactions_status_update BEFORE UPDATE OF status ON financial_transactions
WHEN NEW.status NOT IN ('draft','planned','pending','approved','collected','paid','overdue','reversed','cancelled')
BEGIN
  SELECT RAISE(ABORT,'invalid status for financial_transactions');
END;

CREATE TRIGGER IF NOT EXISTS trg_invoices_status_insert BEFORE INSERT ON invoices
WHEN NEW.status NOT IN ('draft','open','partial','paid','collected','overdue','cancelled')
BEGIN
  SELECT RAISE(ABORT,'invalid status for invoices');
END;
CREATE TRIGGER IF NOT EXISTS trg_invoices_status_update BEFORE UPDATE OF status ON invoices
WHEN NEW.status NOT IN ('draft','open','partial','paid','collected','overdue','cancelled')
BEGIN
  SELECT RAISE(ABORT,'invalid status for invoices');
END;

CREATE TRIGGER IF NOT EXISTS trg_employees_status_insert BEFORE INSERT ON employees
WHEN NEW.status NOT IN ('active','on_leave','inactive','terminated')
BEGIN
  SELECT RAISE(ABORT,'invalid status for employees');
END;
CREATE TRIGGER IF NOT EXISTS trg_employees_status_update BEFORE UPDATE OF status ON employees
WHEN NEW.status NOT IN ('active','on_leave','inactive','terminated')
BEGIN
  SELECT RAISE(ABORT,'invalid status for employees');
END;

CREATE TRIGGER IF NOT EXISTS trg_attendance_status_insert BEFORE INSERT ON attendance
WHEN NEW.status IS NOT NULL AND NEW.status NOT IN ('present','absent','leave','remote','holiday','sick')
BEGIN
  SELECT RAISE(ABORT,'invalid status for attendance');
END;
CREATE TRIGGER IF NOT EXISTS trg_attendance_status_update BEFORE UPDATE OF status ON attendance
WHEN NEW.status IS NOT NULL AND NEW.status NOT IN ('present','absent','leave','remote','holiday','sick')
BEGIN
  SELECT RAISE(ABORT,'invalid status for attendance');
END;

CREATE TRIGGER IF NOT EXISTS trg_leave_requests_status_insert BEFORE INSERT ON leave_requests
WHEN NEW.status NOT IN ('pending','approved','rejected','cancelled')
BEGIN
  SELECT RAISE(ABORT,'invalid status for leave_requests');
END;
CREATE TRIGGER IF NOT EXISTS trg_leave_requests_status_update BEFORE UPDATE OF status ON leave_requests
WHEN NEW.status NOT IN ('pending','approved','rejected','cancelled')
BEGIN
  SELECT RAISE(ABORT,'invalid status for leave_requests');
END;

CREATE TRIGGER IF NOT EXISTS trg_payroll_inputs_status_insert BEFORE INSERT ON payroll_inputs
WHEN NEW.status IS NOT NULL AND NEW.status NOT IN ('draft','approved','exported','cancelled')
BEGIN
  SELECT RAISE(ABORT,'invalid status for payroll_inputs');
END;
CREATE TRIGGER IF NOT EXISTS trg_payroll_inputs_status_update BEFORE UPDATE OF status ON payroll_inputs
WHEN NEW.status IS NOT NULL AND NEW.status NOT IN ('draft','approved','exported','cancelled')
BEGIN
  SELECT RAISE(ABORT,'invalid status for payroll_inputs');
END;

CREATE TRIGGER IF NOT EXISTS trg_work_items_status_insert BEFORE INSERT ON work_items
WHEN NEW.status NOT IN ('planned','approved','production','completed','cancelled')
   OR NEW.revision_status NOT IN ('draft','review','changes_requested','approved','superseded')
BEGIN
  SELECT RAISE(ABORT,'invalid status for work_items');
END;
CREATE TRIGGER IF NOT EXISTS trg_work_items_status_update BEFORE UPDATE OF status, revision_status ON work_items
WHEN NEW.status NOT IN ('planned','approved','production','completed','cancelled')
   OR NEW.revision_status NOT IN ('draft','review','changes_requested','approved','superseded')
BEGIN
  SELECT RAISE(ABORT,'invalid status for work_items');
END;

CREATE TRIGGER IF NOT EXISTS trg_project_tasks_status_insert BEFORE INSERT ON project_tasks
WHEN NEW.status NOT IN ('todo','in_progress','blocked','completed','cancelled')
BEGIN
  SELECT RAISE(ABORT,'invalid status for project_tasks');
END;
CREATE TRIGGER IF NOT EXISTS trg_project_tasks_status_update BEFORE UPDATE OF status ON project_tasks
WHEN NEW.status NOT IN ('todo','in_progress','blocked','completed','cancelled')
BEGIN
  SELECT RAISE(ABORT,'invalid status for project_tasks');
END;

CREATE TRIGGER IF NOT EXISTS trg_accounts_status_insert BEFORE INSERT ON accounts
WHEN NEW.status NOT IN ('active','passive','closed')
BEGIN
  SELECT RAISE(ABORT,'invalid status for accounts');
END;
CREATE TRIGGER IF NOT EXISTS trg_accounts_status_update BEFORE UPDATE OF status ON accounts
WHEN NEW.status NOT IN ('active','passive','closed')
BEGIN
  SELECT RAISE(ABORT,'invalid status for accounts');
END;

CREATE TRIGGER IF NOT EXISTS trg_customers_status_insert BEFORE INSERT ON customers
WHEN NEW.status NOT IN ('active','passive','blacklisted')
BEGIN
  SELECT RAISE(ABORT,'invalid status for customers');
END;
CREATE TRIGGER IF NOT EXISTS trg_customers_status_update BEFORE UPDATE OF status ON customers
WHEN NEW.status NOT IN ('active','passive','blacklisted')
BEGIN
  SELECT RAISE(ABORT,'invalid status for customers');
END;

CREATE TRIGGER IF NOT EXISTS trg_suppliers_status_insert BEFORE INSERT ON suppliers
WHEN NEW.status NOT IN ('active','passive','blacklisted')
BEGIN
  SELECT RAISE(ABORT,'invalid status for suppliers');
END;
CREATE TRIGGER IF NOT EXISTS trg_suppliers_status_update BEFORE UPDATE OF status ON suppliers
WHEN NEW.status NOT IN ('active','passive','blacklisted')
BEGIN
  SELECT RAISE(ABORT,'invalid status for suppliers');
END;

-- Stok çıkışı, projeye ayrılmış rezervasyonun altına düşmemelidir.
CREATE TRIGGER IF NOT EXISTS trg_inventory_on_hand_not_negative
BEFORE UPDATE OF on_hand_quantity ON inventory_items
WHEN NEW.on_hand_quantity < 0
BEGIN
  SELECT RAISE(ABORT,'inventory on-hand quantity cannot be negative');
END;

INSERT OR IGNORE INTO permissions (code, description) VALUES
('production-orders.complete','Üretim emrini başlatma, tamamlama ve iptal etme'),
('purchase-requests.order','Onaylı satın alma talebinden sipariş oluşturma'),
('purchase-orders.receive','Satın alma siparişinde mal kabulü yapma'),
('material-requirements.consume','Ayrılmış malzemeyi üretime verme veya rezervasyonu serbest bırakma');

UPDATE role_templates SET permissions_json=json_insert(permissions_json,
  '$[#]','production-orders.complete','$[#]','material-requirements.consume')
WHERE code='production';
UPDATE role_templates SET permissions_json=json_insert(permissions_json,
  '$[#]','purchase-requests.order','$[#]','purchase-orders.receive','$[#]','material-requirements.consume')
WHERE code='purchasing';
UPDATE role_templates SET permissions_json=json_insert(permissions_json,
  '$[#]','production-orders.complete')
WHERE code='project_manager';

INSERT OR IGNORE INTO role_permissions (tenant_id,role_id,permission_code)
SELECT r.tenant_id,r.id,p.code
FROM roles r
JOIN permissions p ON
  (r.code='production' AND p.code IN ('production-orders.complete','material-requirements.consume')) OR
  (r.code='purchasing' AND p.code IN ('purchase-requests.order','purchase-orders.receive','material-requirements.consume')) OR
  (r.code='project_manager' AND p.code='production-orders.complete');

PRAGMA optimize;
