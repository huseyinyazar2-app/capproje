ALTER TABLE offers ADD COLUMN accepted_at TEXT;
ALTER TABLE offers ADD COLUMN accepted_by TEXT REFERENCES users(id);
ALTER TABLE offers ADD COLUMN rejected_at TEXT;
ALTER TABLE offers ADD COLUMN rejected_by TEXT REFERENCES users(id);
ALTER TABLE offers ADD COLUMN converted_project_id TEXT REFERENCES projects(id);

ALTER TABLE projects ADD COLUMN source_offer_id TEXT REFERENCES offers(id);

ALTER TABLE work_items ADD COLUMN revision_no INTEGER NOT NULL DEFAULT 1;
ALTER TABLE work_items ADD COLUMN revision_status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE work_items ADD COLUMN revision_approved_at TEXT;
ALTER TABLE work_items ADD COLUMN revision_approved_by TEXT REFERENCES users(id);

ALTER TABLE production_orders ADD COLUMN work_item_revision_no INTEGER;
ALTER TABLE production_orders ADD COLUMN released_at TEXT;
ALTER TABLE production_orders ADD COLUMN released_by TEXT REFERENCES users(id);

ALTER TABLE financial_transactions ADD COLUMN approved_at TEXT;
ALTER TABLE financial_transactions ADD COLUMN approved_by TEXT REFERENCES users(id);
ALTER TABLE financial_transactions ADD COLUMN reversal_of_id TEXT REFERENCES financial_transactions(id);
ALTER TABLE financial_transactions ADD COLUMN reversed_transaction_id TEXT REFERENCES financial_transactions(id);

CREATE INDEX IF NOT EXISTS idx_offers_tenant_converted ON offers(tenant_id, converted_project_id);
CREATE INDEX IF NOT EXISTS idx_projects_tenant_source_offer ON projects(tenant_id, source_offer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_tenant_source_offer_unique ON projects(tenant_id, source_offer_id) WHERE source_offer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_items_tenant_revision ON work_items(tenant_id, revision_status, revision_no);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_tenant_reversal ON financial_transactions(tenant_id, reversal_of_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_transactions_tenant_reversal_unique ON financial_transactions(tenant_id, reversal_of_id) WHERE reversal_of_id IS NOT NULL;

PRAGMA optimize;
