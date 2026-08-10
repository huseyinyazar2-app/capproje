ALTER TABLE files ADD COLUMN project_id TEXT REFERENCES projects(id);
ALTER TABLE files ADD COLUMN work_item_id TEXT REFERENCES work_items(id);
ALTER TABLE files ADD COLUMN design_revision_id TEXT REFERENCES design_revisions(id);
ALTER TABLE files ADD COLUMN quality_inspection_id TEXT REFERENCES quality_inspections(id);
ALTER TABLE files ADD COLUMN installation_id TEXT REFERENCES installations(id);
ALTER TABLE files ADD COLUMN space_name TEXT;
ALTER TABLE files ADD COLUMN capture_stage TEXT CHECK (capture_stage IN ('discovery','design','procurement','production','quality','installation','handover','other'));
ALTER TABLE files ADD COLUMN taken_at TEXT;
ALTER TABLE files ADD COLUMN visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','customer','marketing'));
ALTER TABLE files ADD COLUMN photo_consent_snapshot TEXT CHECK (photo_consent_snapshot IN ('not_requested','denied','internal_only','marketing_allowed'));

CREATE INDEX IF NOT EXISTS idx_files_tenant_project_created ON files(tenant_id, project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_files_tenant_work_item ON files(tenant_id, work_item_id, created_at);
CREATE INDEX IF NOT EXISTS idx_files_tenant_installation ON files(tenant_id, installation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_files_tenant_quality ON files(tenant_id, quality_inspection_id, created_at);
CREATE INDEX IF NOT EXISTS idx_files_tenant_stage ON files(tenant_id, capture_stage, created_at);

PRAGMA optimize;
