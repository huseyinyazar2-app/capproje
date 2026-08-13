import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

const migrationUrl = new URL("../migrations/0005_capproje_domain.sql", import.meta.url);
const workerUrl = new URL("../worker/index.js", import.meta.url);
const apiUrl = new URL("../src/api.js", import.meta.url);
const workspaceUrl = new URL("../src/LiveWorkspace.jsx", import.meta.url);

const [migration, worker, api, workspace] = await Promise.all([
  readFile(migrationUrl, "utf8"),
  readFile(workerUrl, "utf8"),
  readFile(apiUrl, "utf8"),
  readFile(workspaceUrl, "utf8"),
]);

const domains = [
  { camel: "siteSurveys", slug: "site-surveys", table: "site_surveys", form: ["surveyNumber", "surveyDate", "location", "status"] },
  { camel: "surveyMeasurements", slug: "survey-measurements", table: "survey_measurements", form: ["siteSurveyId", "spaceName", "elementType", "width", "height", "quantity", "unit"] },
  { camel: "contracts", slug: "contracts", table: "contracts", form: ["contractNumber", "paymentModel", "contractAmount", "paymentSchedule", "photoConsent", "status"] },
  { camel: "designRevisions", slug: "design-revisions", table: "design_revisions", form: ["projectId", "revisionNumber", "drawingType", "fileId", "rejectionReason", "status"] },
  { camel: "progressPayments", slug: "progress-payments", table: "progress_payments", form: ["progressNumber", "periodStart", "periodEnd", "currentWork", "deduction", "retention", "tax", "netPayable", "status"] },
  { camel: "inventoryItems", slug: "inventory-items", table: "inventory_items", form: ["sku", "name", "unit", "reservedQuantity", "minimumQuantity", "averageCost"] },
  { camel: "stockMovements", slug: "stock-movements", table: "stock_movements", form: ["movementNumber", "inventoryItemId", "movementType", "movementDate", "quantity", "unitCost", "status"] },
  { camel: "projectMeetings", slug: "project-meetings", table: "project_meetings", form: ["meetingType", "meetingDate", "title", "attendees", "summary", "status"] },
  { camel: "meetingActions", slug: "meeting-actions", table: "meeting_actions", form: ["meetingId", "title", "ownerUserId", "dueDate", "priority", "status"] },
  { camel: "qualityInspections", slug: "quality-inspections", table: "quality_inspections", form: ["inspectionNumber", "projectId", "inspectionType", "inspectionDate", "result", "checklist", "correctiveAction", "status"] },
  { camel: "handovers", slug: "handovers", table: "handovers", form: ["handoverNumber", "projectId", "handoverDate", "customerContact", "satisfactionScore", "customerSignatureFileId", "status"] },
  { camel: "handoverPunchItems", slug: "handover-punch-items", table: "handover_punch_items", form: ["handoverId", "title", "responsibleUserId", "dueDate", "severity", "status"] },
];

const workflowContracts = [
  ["siteSurveys", "transition"],
  ["contracts", "transition"],
  ["designRevisions", "approve"],
  ["progressPayments", "approve"],
  ["progressPayments", "paid"],
  ["stockMovements", "post"],
  ["projectMeetings", "transition"],
  ["qualityInspections", "transition"],
  ["handovers", "transition"],
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function objectBlock(source, key) {
  const match = source.match(new RegExp(`\\n  ${escapeRegex(key)}: \\{([\\s\\S]*?)\\n  \\},`));
  assert.ok(match, `${key} yapılandırma bloğu bulunamadı`);
  return match[1];
}

function tableBlock(table) {
  const match = migration.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${escapeRegex(table)} \\(([\\s\\S]*?)\\n\\);`));
  assert.ok(match, `${table} tablosu bulunamadı`);
  return match[1];
}

test("domain schema covers discovery through handover with normalized business records", () => {
  for (const { table } of domains) {
    assert.match(tableBlock(table), /tenant_id TEXT NOT NULL/, `${table} tenant kapsamlı değil`);
  }

  assert.match(tableBlock("survey_measurements"), /site_survey_id TEXT NOT NULL[\s\S]*space_name TEXT NOT NULL[\s\S]*element_type TEXT NOT NULL/);
  assert.match(tableBlock("survey_measurements"), /width REAL[\s\S]*height REAL[\s\S]*depth REAL[\s\S]*length REAL[\s\S]*quantity REAL[\s\S]*unit TEXT NOT NULL/);

  const contracts = tableBlock("contracts");
  assert.match(contracts, /payment_model TEXT NOT NULL CHECK \(payment_model IN \('progress_payment','advance_balance','custom'\)\)/);
  assert.match(contracts, /payment_schedule_json TEXT NOT NULL DEFAULT '\[\]'/);
  assert.match(migration, /ALTER TABLE contracts ADD COLUMN photo_consent[\s\S]*'internal_only','marketing_allowed'/);

  const designs = tableBlock("design_revisions");
  assert.match(designs, /drawing_type TEXT NOT NULL CHECK \(drawing_type IN \('2d','3d','shop_drawing'\)\)/);
  assert.match(designs, /revision_number INTEGER NOT NULL[\s\S]*file_id TEXT REFERENCES files\(id\)[\s\S]*client_decision_at TEXT[\s\S]*rejection_reason TEXT/);

  const progress = tableBlock("progress_payments");
  for (const moneyField of ["previous_work_minor", "current_work_minor", "cumulative_work_minor", "deduction_minor", "retention_minor", "tax_minor", "net_payable_minor"]) {
    assert.match(progress, new RegExp(`${moneyField} INTEGER NOT NULL`), `hakedişte ${moneyField} eksik`);
  }
  assert.match(progress, /status TEXT NOT NULL[\s\S]*'draft','pending','approved','rejected','invoiced','paid','cancelled'/);

  assert.match(tableBlock("project_meetings"), /meeting_type TEXT NOT NULL[\s\S]*'weekly_project','weekly_production'/);
  assert.match(tableBlock("meeting_actions"), /meeting_id TEXT NOT NULL[\s\S]*owner_user_id TEXT[\s\S]*due_date TEXT[\s\S]*status TEXT NOT NULL/);
  assert.match(tableBlock("quality_inspections"), /inspection_type TEXT NOT NULL[\s\S]*result TEXT[\s\S]*checklist_json TEXT[\s\S]*corrective_action TEXT/);
  assert.match(tableBlock("handovers"), /satisfaction_score INTEGER CHECK \(satisfaction_score BETWEEN 1 AND 5\)[\s\S]*customer_signature_file_id TEXT/);
  assert.match(tableBlock("handover_punch_items"), /handover_id TEXT NOT NULL[\s\S]*severity TEXT[\s\S]*resolved_at TEXT[\s\S]*accepted_at TEXT/);
  assert.match(migration, /trade_type TEXT CHECK \(trade_type IN \('internal','cila','metal','glass_mirror','door','upholstery','stone','other'\)\)/);
});

test("stock posting stays in the atomic worker batch and migrations remain deployable", () => {
  assert.doesNotMatch(migration, /CREATE TRIGGER|\bBEGIN\b/);
  assert.match(worker, /const postMovement = env\.DB\.prepare/);
  assert.match(worker, /const updateBalance = env\.DB\.prepare/);
  assert.match(worker, /commitWorkflow\([\s\S]*\[updateBalance, postMovement\]/);
  // Kesinleşme, stok satırının aynı işlemdeki damgasına bağlıdır; yetersiz stokta
  // iki statement de boş geçer ve hiçbir yarım durum kalmaz.
  assert.match(worker, /AND EXISTS \(SELECT 1 FROM inventory_items ii WHERE ii\.id=stock_movements\.inventory_item_id/);
  assert.doesNotMatch(worker, /__insufficient_stock__/);
});

test("every domain resource is tenant-scoped, RBAC protected, audited and backed up", () => {
  assert.match(worker, /const clauses = \["tenant_id=\?"\]/);
  assert.match(worker, /permissionFor\(slug, "read"\)/);
  assert.match(worker, /permissionFor\(slug, "write"\)/);
  assert.match(worker, /permissionFor\(slug, "delete"\)/);
  assert.match(worker, /await audit\(env, principal, request, "create", slug/);
  assert.match(worker, /await audit\(env, principal, request, "update", slug/);
  assert.match(worker, /await audit\(env, principal, request, "delete", slug/);
  assert.match(worker, /function commitWorkflow[\s\S]*auditStatement/);
  assert.match(worker, /0005_capproje_domain\.sql/);

  for (const { slug, table } of domains) {
    assert.match(worker, new RegExp(`(?:"${escapeRegex(slug)}"|${escapeRegex(slug)})\\s*:\\s*\\{\\s*table:\\s*"${escapeRegex(table)}"`), `${slug} API kaynağı eksik`);
    assert.match(migration, new RegExp(`\\('${escapeRegex(slug)}\\.read'`), `${slug}.read yetkisi eksik`);
    assert.match(migration, new RegExp(`\\('${escapeRegex(slug)}\\.write'`), `${slug}.write yetkisi eksik`);
    assert.match(worker, new RegExp(`backupTables[\\s\\S]*"${escapeRegex(table)}"`), `${table} yedek kapsamı dışında`);
  }

  for (const permission of ["site-surveys.approve", "contracts.transition", "design-revisions.approve", "progress-payments.approve", "stock-movements.post", "project-meetings.publish", "quality-inspections.complete", "handovers.transition"]) {
    assert.match(migration, new RegExp(`\\('${escapeRegex(permission)}'`), `${permission} RBAC tanımı eksik`);
    assert.match(worker, new RegExp(escapeRegex(permission)), `${permission} sunucuda uygulanmıyor`);
  }
});

test("frontend exposes a dedicated module, form and API mapping for every domain", () => {
  const missing = [];
  for (const { camel, slug, form } of domains) {
    if (!new RegExp(`${escapeRegex(camel)}:\\s*"/${escapeRegex(slug)}"`).test(api)) missing.push(`${camel}: endpoint`);
    if (!new RegExp(`${escapeRegex(camel)}:\\s*"${escapeRegex(slug)}"`).test(api)) missing.push(`${camel}: permission slug`);
    if (!new RegExp(`${escapeRegex(camel)}:\\s*\\{`).test(api)) missing.push(`${camel}: field map`);
    if (!new RegExp(`id:\\s*"${escapeRegex(camel)}"[\\s\\S]{0,300}resource:\\s*"${escapeRegex(camel)}"`).test(workspace)) missing.push(`${camel}: menu module`);

    const configMatch = workspace.match(new RegExp(`\\n  ${escapeRegex(camel)}: \\{([\\s\\S]*?)\\n  \\},`));
    if (!configMatch) {
      missing.push(`${camel}: list/form config`);
      continue;
    }
    const config = configMatch[1];
    if (!/columns:\s*\[/.test(config)) missing.push(`${camel}: columns`);
    if (!/fields:\s*\[/.test(config)) missing.push(`${camel}: fields`);
    for (const field of form) if (!new RegExp(`field\\("${escapeRegex(field)}"`).test(config)) missing.push(`${camel}: form.${field}`);
  }

  for (const [camel, action] of workflowContracts) {
    const workflowPattern = action === "transition"
      ? new RegExp(`module\\.id === "${escapeRegex(camel)}"[\\s\\S]{0,900}return transition`)
      : new RegExp(`module\\.id === "${escapeRegex(camel)}"[\\s\\S]{0,2600}key:\\s*"${escapeRegex(action)}"`);
    if (!workflowPattern.test(workspace)) missing.push(`${camel}: workflow.${action}`);
  }

  if (!/photoConsent:\s*"photo_consent"/.test(api)) missing.push("api: photoConsent map");
  if (!/paymentSchedule:\s*"payment_schedule_json"/.test(api)) missing.push("api: paymentSchedule map");
  if (!/tradeType:\s*"trade_type"/.test(api)) missing.push("api: tradeType map");
  const contracts = objectBlock(workspace, "contracts");
  for (const paymentModel of ["progress_payment", "advance_balance", "custom"]) {
    if (!new RegExp(`"${paymentModel}"`).test(contracts)) missing.push(`contracts: paymentModel.${paymentModel}`);
  }
  for (const invalidPaymentModel of ["milestone", "cash"]) {
    if (new RegExp(`"${invalidPaymentModel}"`).test(contracts)) missing.push(`contracts: invalid paymentModel.${invalidPaymentModel}`);
  }

  const inventory = objectBlock(workspace, "inventoryItems");
  if (!/\["onHandQuantity",/.test(inventory)) missing.push("inventoryItems: onHandQuantity column");
  if (/field\("onHandQuantity"/.test(inventory)) missing.push("inventoryItems: onHandQuantity must be read-only");

  const stockMovements = objectBlock(workspace, "stockMovements");
  for (const movementType of ["receipt", "issue", "adjustment_in", "adjustment_out", "project_issue", "project_return"]) {
    if (!new RegExp(`"${movementType}"`).test(stockMovements)) missing.push(`stockMovements: movementType.${movementType}`);
  }
  for (const invalidMovementType of ["in", "out", "reserve", "release", "adjustment"]) {
    if (new RegExp(`"${invalidMovementType}"`).test(stockMovements)) missing.push(`stockMovements: invalid movementType.${invalidMovementType}`);
  }

  const production = objectBlock(workspace, "production");
  if (!/field\("tradeType"/.test(production)) missing.push("production: form.tradeType");
  for (const tradeType of ["internal", "cila", "metal", "glass_mirror", "door", "upholstery", "stone", "other"]) {
    if (!new RegExp(`"${tradeType}"`).test(production)) missing.push(`production: tradeType.${tradeType}`);
  }
  assert.deepEqual(missing, [], `frontend domain tamamlama eksikleri:\n- ${missing.join("\n- ")}`);
});
