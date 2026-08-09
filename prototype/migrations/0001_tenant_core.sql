PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tax_number TEXT,
  settings_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS permissions (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (tenant_id, role_id, permission_code)
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id),
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT,
  last_used_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT, type TEXT NOT NULL DEFAULT 'company', name TEXT NOT NULL, contact_name TEXT,
  email TEXT, phone TEXT, tax_office TEXT, tax_number TEXT, address TEXT, city TEXT,
  payment_terms TEXT, credit_limit_minor INTEGER, notes TEXT, status TEXT NOT NULL DEFAULT 'active',
  metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT, name TEXT NOT NULL, category TEXT, contact_name TEXT, email TEXT, phone TEXT,
  tax_office TEXT, tax_number TEXT, address TEXT, city TEXT, payment_terms TEXT,
  rating REAL, notes TEXT, status TEXT NOT NULL DEFAULT 'active', metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL, customer_id TEXT REFERENCES customers(id), name TEXT NOT NULL,
  project_type TEXT, site_address TEXT, city TEXT, architect_user_id TEXT REFERENCES users(id),
  manager_user_id TEXT REFERENCES users(id), status TEXT NOT NULL DEFAULT 'lead', priority TEXT DEFAULT 'normal',
  planned_start_date TEXT, planned_end_date TEXT, actual_start_date TEXT, actual_end_date TEXT,
  contract_amount_minor INTEGER, estimated_cost_minor INTEGER, progress_percent REAL NOT NULL DEFAULT 0,
  description TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id), customer_id TEXT REFERENCES customers(id), offer_number TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1, offer_date TEXT, valid_until TEXT, currency TEXT NOT NULL DEFAULT 'TRY',
  subtotal_minor INTEGER NOT NULL DEFAULT 0, discount_total_minor INTEGER NOT NULL DEFAULT 0, tax_total_minor INTEGER NOT NULL DEFAULT 0,
  grand_total_minor INTEGER NOT NULL DEFAULT 0, payment_terms TEXT, delivery_terms TEXT,
  status TEXT NOT NULL DEFAULT 'draft', rejection_reason TEXT, notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, offer_number, revision)
);

CREATE TABLE IF NOT EXISTS offer_items (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  offer_id TEXT NOT NULL REFERENCES offers(id) ON DELETE CASCADE, parent_id TEXT,
  item_code TEXT, description TEXT NOT NULL, unit TEXT, quantity REAL NOT NULL DEFAULT 1,
  unit_price_minor INTEGER NOT NULL DEFAULT 0, cost_price_minor INTEGER, discount_rate REAL DEFAULT 0, tax_rate REAL DEFAULT 20,
  total_minor INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_tasks (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, parent_id TEXT,
  title TEXT NOT NULL, description TEXT, assignee_user_id TEXT REFERENCES users(id), department TEXT,
  status TEXT NOT NULL DEFAULT 'todo', priority TEXT DEFAULT 'normal', planned_start TEXT, planned_end TEXT,
  completed_at TEXT, progress_percent REAL NOT NULL DEFAULT 0, dependency_ids_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS work_items (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, task_id TEXT REFERENCES project_tasks(id),
  space_name TEXT, product_type TEXT, item_code TEXT, description TEXT NOT NULL,
  width REAL, height REAL, depth REAL, unit TEXT, quantity REAL NOT NULL DEFAULT 1,
  material TEXT, finish TEXT, production_type TEXT NOT NULL DEFAULT 'internal', supplier_id TEXT REFERENCES suppliers(id),
  unit_cost_minor INTEGER, unit_price_minor INTEGER, status TEXT NOT NULL DEFAULT 'planned', metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_requests (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_number TEXT NOT NULL, project_id TEXT REFERENCES projects(id), requester_user_id TEXT REFERENCES users(id),
  needed_by TEXT, priority TEXT DEFAULT 'normal', description TEXT NOT NULL, quantity REAL, unit TEXT,
  estimated_amount_minor INTEGER, currency TEXT DEFAULT 'TRY', preferred_supplier_id TEXT REFERENCES suppliers(id),
  status TEXT NOT NULL DEFAULT 'draft', approved_by TEXT REFERENCES users(id), approved_at TEXT, notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, request_number)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL, request_id TEXT REFERENCES purchase_requests(id), project_id TEXT REFERENCES projects(id),
  supplier_id TEXT NOT NULL REFERENCES suppliers(id), order_date TEXT, expected_date TEXT, currency TEXT DEFAULT 'TRY',
  subtotal_minor INTEGER DEFAULT 0, tax_total_minor INTEGER DEFAULT 0, grand_total_minor INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft', delivery_address TEXT, notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, order_number)
);

CREATE TABLE IF NOT EXISTS production_orders (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL, project_id TEXT NOT NULL REFERENCES projects(id), work_item_id TEXT REFERENCES work_items(id),
  production_type TEXT NOT NULL DEFAULT 'internal', supplier_id TEXT REFERENCES suppliers(id), workshop TEXT,
  assigned_team TEXT, planned_start TEXT, planned_end TEXT, actual_start TEXT, actual_end TEXT,
  quantity REAL, completed_quantity REAL DEFAULT 0, quality_status TEXT, status TEXT NOT NULL DEFAULT 'planned',
  instructions TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, order_number)
);

CREATE TABLE IF NOT EXISTS installations (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  installation_number TEXT NOT NULL, project_id TEXT NOT NULL REFERENCES projects(id), location TEXT,
  team_lead_user_id TEXT REFERENCES users(id), team_json TEXT NOT NULL DEFAULT '[]', planned_start TEXT, planned_end TEXT,
  actual_start TEXT, actual_end TEXT, progress_percent REAL DEFAULT 0, status TEXT NOT NULL DEFAULT 'planned',
  acceptance_contact TEXT, acceptance_date TEXT, issue_notes TEXT, metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE (tenant_id, installation_number)
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'TRY',
  bank_name TEXT, iban TEXT, opening_balance_minor INTEGER DEFAULT 0, current_balance_minor INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS financial_transactions (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_number TEXT NOT NULL, project_id TEXT REFERENCES projects(id), account_id TEXT REFERENCES accounts(id),
  customer_id TEXT REFERENCES customers(id), supplier_id TEXT REFERENCES suppliers(id), type TEXT NOT NULL,
  category TEXT, transaction_date TEXT NOT NULL, due_date TEXT, amount_minor INTEGER NOT NULL, currency TEXT DEFAULT 'TRY',
  exchange_rate REAL DEFAULT 1, official INTEGER NOT NULL DEFAULT 1, payment_method TEXT, reference TEXT,
  description TEXT, status TEXT NOT NULL DEFAULT 'planned', metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE (tenant_id, transaction_number)
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL, direction TEXT NOT NULL, project_id TEXT REFERENCES projects(id),
  customer_id TEXT REFERENCES customers(id), supplier_id TEXT REFERENCES suppliers(id), issue_date TEXT NOT NULL,
  due_date TEXT, currency TEXT DEFAULT 'TRY', subtotal_minor INTEGER DEFAULT 0, tax_total_minor INTEGER DEFAULT 0,
  grand_total_minor INTEGER DEFAULT 0, paid_total_minor INTEGER DEFAULT 0, official INTEGER NOT NULL DEFAULT 1,
  datasoft_status TEXT DEFAULT 'pending', status TEXT NOT NULL DEFAULT 'draft', notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, invoice_number, direction)
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_number TEXT NOT NULL, user_id TEXT REFERENCES users(id), first_name TEXT NOT NULL, last_name TEXT NOT NULL,
  national_id_masked TEXT, birth_date TEXT, email TEXT, phone TEXT, department TEXT, title TEXT,
  employment_type TEXT, hire_date TEXT, termination_date TEXT, manager_employee_id TEXT,
  salary_amount_minor INTEGER, salary_currency TEXT DEFAULT 'TRY', emergency_contact TEXT, address TEXT,
  status TEXT NOT NULL DEFAULT 'active', metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE (tenant_id, employee_number)
);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE, work_date TEXT NOT NULL,
  check_in TEXT, check_out TEXT, regular_minutes INTEGER DEFAULT 0, overtime_minutes INTEGER DEFAULT 0,
  location TEXT, source TEXT DEFAULT 'manual', status TEXT DEFAULT 'present', notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE, leave_type TEXT NOT NULL,
  start_date TEXT NOT NULL, end_date TEXT NOT NULL, day_count REAL NOT NULL, reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', approved_by TEXT REFERENCES users(id), approved_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payroll_inputs (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE, period TEXT NOT NULL,
  base_salary_minor INTEGER DEFAULT 0, overtime_amount_minor INTEGER DEFAULT 0, bonus_amount_minor INTEGER DEFAULT 0,
  allowance_amount_minor INTEGER DEFAULT 0, deduction_amount_minor INTEGER DEFAULT 0, advance_amount_minor INTEGER DEFAULT 0,
  net_preview_minor INTEGER DEFAULT 0, currency TEXT DEFAULT 'TRY', status TEXT DEFAULT 'draft', notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, employee_id, period)
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, category TEXT, file_name TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE, content_type TEXT, size_bytes INTEGER, checksum TEXT,
  uploaded_by TEXT REFERENCES users(id), description TEXT, metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL,
  entity_id TEXT, request_id TEXT, ip_address TEXT, changes_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS backup_runs (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  object_key TEXT, status TEXT NOT NULL, row_count INTEGER DEFAULT 0, error_message TEXT,
  triggered_by TEXT, created_at TEXT NOT NULL, completed_at TEXT
);

CREATE TABLE IF NOT EXISTS idempotency_records (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, idempotency_key TEXT NOT NULL,
  method TEXT NOT NULL, path TEXT NOT NULL, status_code INTEGER, response_body TEXT,
  created_at TEXT NOT NULL, completed_at TEXT,
  UNIQUE (tenant_id, user_id, idempotency_key, method, path)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user_tenant ON memberships(user_id, tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_tenant_status ON projects(tenant_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_offers_tenant_project ON offers(tenant_id, project_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_project ON project_tasks(tenant_id, project_id, status);
CREATE INDEX IF NOT EXISTS idx_work_items_tenant_project ON work_items(tenant_id, project_id, status);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_tenant ON purchase_requests(tenant_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON purchase_orders(tenant_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_production_tenant_project ON production_orders(tenant_id, project_id, status);
CREATE INDEX IF NOT EXISTS idx_production_orders_tenant_status ON production_orders(tenant_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_installations_tenant_project ON installations(tenant_id, project_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_date ON financial_transactions(tenant_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_tenant_date ON financial_transactions(tenant_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_due ON invoices(tenant_id, due_date, status);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_status ON employees(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_tenant_date ON attendance(tenant_id, work_date);
CREATE INDEX IF NOT EXISTS idx_files_entity ON files(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_created ON audit_logs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_backups_tenant_created ON backup_runs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_created ON idempotency_records(tenant_id, created_at);

PRAGMA optimize;
