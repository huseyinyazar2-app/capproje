CREATE TABLE IF NOT EXISTS material_requirements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  work_item_id TEXT REFERENCES work_items(id),
  inventory_item_id TEXT REFERENCES inventory_items(id),
  preferred_supplier_id TEXT REFERENCES suppliers(id),
  purchase_request_id TEXT REFERENCES purchase_requests(id),
  item_code TEXT,
  description TEXT NOT NULL,
  required_quantity REAL NOT NULL CHECK (required_quantity > 0),
  unit TEXT NOT NULL,
  reserved_quantity REAL NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  ordered_quantity REAL NOT NULL DEFAULT 0 CHECK (ordered_quantity >= 0),
  received_quantity REAL NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  needed_by TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','shortage','covered','consumed','cancelled')),
  notes TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_material_requirements_tenant_project ON material_requirements(tenant_id, project_id, status);
CREATE INDEX IF NOT EXISTS idx_material_requirements_tenant_item ON material_requirements(tenant_id, inventory_item_id, status);
CREATE INDEX IF NOT EXISTS idx_material_requirements_tenant_needed_by ON material_requirements(tenant_id, needed_by, status);

CREATE TRIGGER IF NOT EXISTS trg_inventory_reserved_not_overdrawn
BEFORE UPDATE OF reserved_quantity ON inventory_items
WHEN NEW.reserved_quantity > NEW.on_hand_quantity
BEGIN
  SELECT RAISE(ABORT, 'inventory reservation exceeds on-hand quantity');
END;

CREATE TRIGGER IF NOT EXISTS trg_material_requirement_not_overcovered
BEFORE UPDATE OF reserved_quantity, ordered_quantity ON material_requirements
WHEN NEW.reserved_quantity + NEW.ordered_quantity > NEW.required_quantity
BEGIN
  SELECT RAISE(ABORT, 'material requirement coverage exceeds required quantity');
END;

INSERT OR IGNORE INTO permissions (code, description) VALUES
('material-requirements.read','Malzeme ihtiyaç planını görüntüleme'),
('material-requirements.write','Malzeme ihtiyacı ekleme ve düzenleme'),
('material-requirements.delete','Malzeme ihtiyacı silme'),
('material-requirements.reserve','Malzemeyi stoktan projeye ayırma'),
('material-requirements.purchase','Eksik malzeme için satın alma talebi oluşturma');

UPDATE role_templates SET permissions_json=json_insert(permissions_json,
  '$[#]','material-requirements.read','$[#]','material-requirements.write')
WHERE code='project_manager';
UPDATE role_templates SET permissions_json=json_insert(permissions_json,
  '$[#]','material-requirements.read','$[#]','material-requirements.write','$[#]','material-requirements.delete','$[#]','material-requirements.reserve','$[#]','material-requirements.purchase')
WHERE code='purchasing';
UPDATE role_templates SET permissions_json=json_insert(permissions_json,
  '$[#]','material-requirements.read','$[#]','material-requirements.write','$[#]','material-requirements.reserve')
WHERE code='production';

INSERT OR IGNORE INTO role_permissions (tenant_id,role_id,permission_code)
SELECT r.tenant_id,r.id,p.code
FROM roles r
JOIN permissions p ON
  (r.code='project_manager' AND p.code IN ('material-requirements.read','material-requirements.write')) OR
  (r.code='purchasing' AND p.code IN ('material-requirements.read','material-requirements.write','material-requirements.delete','material-requirements.reserve','material-requirements.purchase')) OR
  (r.code='production' AND p.code IN ('material-requirements.read','material-requirements.write','material-requirements.reserve')) OR
  (r.code='read_only' AND p.code='material-requirements.read');

PRAGMA optimize;
