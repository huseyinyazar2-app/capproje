import { databaseFromEnv } from "./database.js";

const JSON_COLUMNS = new Set(["settings_json", "metadata_json", "dependency_ids_json", "team_json", "payment_schedule_json", "attendees_json", "checklist_json"]);

const resources = {
  customers: { table: "customers", required: ["name"], search: ["code", "name", "contact_name", "email", "phone"], fields: ["code","type","name","contact_name","email","phone","tax_office","tax_number","address","city","payment_terms","credit_limit_minor","notes","status","metadata_json"] },
  suppliers: { table: "suppliers", required: ["name"], search: ["code", "name", "category", "contact_name"], fields: ["code","name","category","contact_name","email","phone","tax_office","tax_number","address","city","payment_terms","rating","notes","status","metadata_json"] },
  projects: { table: "projects", required: ["code", "name"], search: ["code", "name", "project_type", "city"], filters: ["customer_id", "status", "manager_user_id"], refs: { customer_id: "customers" }, fields: ["code","customer_id","name","project_type","site_address","city","architect_user_id","manager_user_id","status","priority","planned_start_date","planned_end_date","actual_start_date","actual_end_date","contract_amount_minor","estimated_cost_minor","progress_percent","photo_consent","description","metadata_json"] },
  offers: { table: "offers", required: ["offer_number"], search: ["offer_number", "notes", "rejection_reason"], filters: ["project_id", "customer_id", "status"], refs: { project_id: "projects", customer_id: "customers" }, fields: ["project_id","customer_id","offer_number","revision","offer_date","valid_until","currency","subtotal_minor","discount_total_minor","tax_total_minor","grand_total_minor","payment_terms","delivery_terms","status","rejection_reason","notes","metadata_json"] },
  "offer-items": { table: "offer_items", required: ["offer_id", "description"], search: ["item_code", "description"], filters: ["offer_id"], refs: { offer_id: "offers" }, fields: ["offer_id","parent_id","item_code","description","unit","quantity","unit_price_minor","cost_price_minor","discount_rate","tax_rate","total_minor","sort_order","metadata_json"] },
  "project-tasks": { table: "project_tasks", required: ["project_id", "title"], search: ["title", "description", "department"], filters: ["project_id", "assignee_user_id", "status"], refs: { project_id: "projects", parent_id: "project_tasks" }, fields: ["project_id","parent_id","title","description","assignee_user_id","department","status","priority","planned_start","planned_end","completed_at","progress_percent","dependency_ids_json","metadata_json"] },
  "work-items": { table: "work_items", required: ["project_id", "description"], search: ["space_name", "product_type", "item_code", "description"], filters: ["project_id", "task_id", "supplier_id", "status", "revision_status"], refs: { project_id: "projects", task_id: "project_tasks", supplier_id: "suppliers" }, fields: ["project_id","task_id","space_name","product_type","item_code","description","width","height","depth","unit","quantity","material","finish","production_type","supplier_id","unit_cost_minor","unit_price_minor","status","metadata_json"] },
  "purchase-requests": { table: "purchase_requests", required: ["request_number", "description"], search: ["request_number", "description", "notes"], filters: ["project_id", "requester_user_id", "status"], refs: { project_id: "projects", preferred_supplier_id: "suppliers" }, fields: ["request_number","project_id","requester_user_id","needed_by","priority","description","quantity","unit","estimated_amount_minor","currency","preferred_supplier_id","status","approved_by","approved_at","notes","metadata_json"] },
  "purchase-orders": { table: "purchase_orders", required: ["order_number", "supplier_id"], search: ["order_number", "notes"], filters: ["request_id", "project_id", "supplier_id", "status"], refs: { request_id: "purchase_requests", project_id: "projects", supplier_id: "suppliers" }, fields: ["order_number","request_id","project_id","supplier_id","order_date","expected_date","currency","subtotal_minor","tax_total_minor","grand_total_minor","status","delivery_address","notes","metadata_json"] },
  "production-orders": { table: "production_orders", required: ["order_number", "project_id"], search: ["order_number", "workshop", "assigned_team", "instructions"], filters: ["project_id", "work_item_id", "supplier_id", "status", "trade_type"], refs: { project_id: "projects", work_item_id: "work_items", supplier_id: "suppliers" }, fields: ["order_number","project_id","work_item_id","production_type","trade_type","supplier_id","workshop","assigned_team","planned_start","planned_end","actual_start","actual_end","quantity","completed_quantity","quality_status","status","instructions","metadata_json"] },
  installations: { table: "installations", required: ["installation_number", "project_id"], search: ["installation_number", "location", "acceptance_contact", "issue_notes"], filters: ["project_id", "team_lead_user_id", "status"], refs: { project_id: "projects" }, fields: ["installation_number","project_id","location","team_lead_user_id","team_json","planned_start","planned_end","actual_start","actual_end","progress_percent","status","acceptance_contact","acceptance_date","issue_notes","metadata_json"] },
  accounts: { table: "accounts", required: ["code", "name", "type"], search: ["code", "name", "bank_name", "iban"], filters: ["type", "status"], fields: ["code","name","type","currency","bank_name","iban","opening_balance_minor","current_balance_minor","status","metadata_json"] },
  "financial-transactions": { table: "financial_transactions", required: ["transaction_number", "type", "transaction_date", "amount_minor"], search: ["transaction_number", "category", "reference", "description"], filters: ["project_id", "account_id", "customer_id", "supplier_id", "type", "status", "official"], refs: { project_id: "projects", account_id: "accounts", customer_id: "customers", supplier_id: "suppliers" }, fields: ["transaction_number","project_id","account_id","customer_id","supplier_id","type","category","transaction_date","due_date","amount_minor","currency","exchange_rate","official","payment_method","reference","description","status","metadata_json"] },
  invoices: { table: "invoices", required: ["invoice_number", "direction", "issue_date"], search: ["invoice_number", "notes"], filters: ["project_id", "customer_id", "supplier_id", "direction", "status", "official"], refs: { project_id: "projects", customer_id: "customers", supplier_id: "suppliers" }, fields: ["invoice_number","direction","project_id","customer_id","supplier_id","issue_date","due_date","currency","subtotal_minor","tax_total_minor","grand_total_minor","paid_total_minor","official","datasoft_status","status","notes","metadata_json"] },
  employees: { table: "employees", required: ["employee_number", "first_name", "last_name"], search: ["employee_number", "first_name", "last_name", "department", "title", "email"], filters: ["department", "status"], fields: ["employee_number","user_id","first_name","last_name","national_id_masked","birth_date","email","phone","department","title","employment_type","hire_date","termination_date","manager_employee_id","salary_amount_minor","salary_currency","emergency_contact","address","status","metadata_json"] },
  attendance: { table: "attendance", required: ["employee_id", "work_date"], search: ["location", "notes"], filters: ["employee_id", "work_date", "status"], refs: { employee_id: "employees" }, fields: ["employee_id","work_date","check_in","check_out","regular_minutes","overtime_minutes","location","source","status","notes","metadata_json"] },
  leaves: { table: "leave_requests", required: ["employee_id", "leave_type", "start_date", "end_date", "day_count"], search: ["leave_type", "reason"], filters: ["employee_id", "status"], refs: { employee_id: "employees" }, fields: ["employee_id","leave_type","start_date","end_date","day_count","reason","status","approved_by","approved_at","metadata_json"] },
  "payroll-inputs": { table: "payroll_inputs", required: ["employee_id", "period"], search: ["period", "notes"], filters: ["employee_id", "period", "status"], refs: { employee_id: "employees" }, fields: ["employee_id","period","base_salary_minor","overtime_amount_minor","bonus_amount_minor","allowance_amount_minor","deduction_amount_minor","advance_amount_minor","net_preview_minor","currency","status","notes","metadata_json"] },
  files: { table: "files", required: ["entity_type", "entity_id", "file_name", "object_key"], search: ["file_name", "category", "description", "space_name", "capture_stage"], filters: ["entity_type", "entity_id", "category", "project_id", "work_item_id", "installation_id", "quality_inspection_id", "capture_stage", "visibility"], refs: { project_id: "projects", work_item_id: "work_items", design_revision_id: "design_revisions", quality_inspection_id: "quality_inspections", installation_id: "installations" }, fields: ["entity_type","entity_id","category","file_name","object_key","content_type","size_bytes","checksum","uploaded_by","description","project_id","work_item_id","design_revision_id","quality_inspection_id","installation_id","space_name","capture_stage","taken_at","visibility","photo_consent_snapshot","metadata_json"] },
  "audit-logs": { table: "audit_logs", readOnly: true, search: ["action", "entity_type", "entity_id"], filters: ["user_id", "action", "entity_type"], fields: [] },
  memberships: { table: "memberships", required: ["user_id", "role_id"], search: ["title"], filters: ["user_id", "role_id", "status"], refs: { role_id: "roles" }, userRefs: ["user_id"], fields: ["user_id","role_id","title","status"] },
  roles: { table: "roles", required: ["code", "name"], search: ["code", "name", "description"], fields: ["code","name","description","is_system"] },
  "site-surveys": { table: "site_surveys", required: ["survey_number", "survey_date"], search: ["survey_number", "location", "customer_contact", "notes"], filters: ["project_id", "customer_id", "status"], refs: { project_id: "projects", customer_id: "customers" }, memberRefs: ["surveyor_user_id"], fields: ["project_id","customer_id","survey_number","survey_date","location","surveyor_user_id","customer_contact","status","notes","metadata_json"] },
  "survey-measurements": { table: "survey_measurements", required: ["site_survey_id", "space_name", "element_type", "unit"], search: ["space_name", "element_type", "item_code", "description", "material"], filters: ["site_survey_id", "element_type"], refs: { site_survey_id: "site_surveys" }, fields: ["site_survey_id","space_name","element_type","item_code","description","width","height","depth","length","quantity","unit","material","finish","sort_order","notes","metadata_json"] },
  contracts: { table: "contracts", required: ["contract_number", "project_id", "customer_id", "payment_model"], search: ["contract_number", "signed_by_customer", "signed_by_company", "notes"], filters: ["project_id", "customer_id", "offer_id", "payment_model", "status"], refs: { project_id: "projects", customer_id: "customers", offer_id: "offers" }, fields: ["contract_number","project_id","customer_id","offer_id","payment_model","currency","contract_amount_minor","advance_rate","advance_amount_minor","retention_rate","retention_amount_minor","warranty_months","warranty_amount_minor","payment_schedule_json","effective_date","planned_start_date","planned_end_date","signed_by_customer","signed_by_company","photo_consent","status","termination_reason","notes","metadata_json"] },
  "design-revisions": { table: "design_revisions", required: ["project_id", "drawing_type", "title"], search: ["title", "rejection_reason", "notes"], filters: ["project_id", "work_item_id", "drawing_type", "status"], refs: { project_id: "projects", work_item_id: "work_items", file_id: "files", supersedes_id: "design_revisions" }, fields: ["project_id","work_item_id","revision_number","drawing_type","title","file_id","status","rejection_reason","supersedes_id","notes","metadata_json"] },
  "progress-payments": { table: "progress_payments", required: ["progress_number", "project_id", "contract_id", "period_start", "period_end"], search: ["progress_number", "rejection_reason", "notes"], filters: ["project_id", "contract_id", "status"], refs: { project_id: "projects", contract_id: "contracts", invoice_id: "invoices", payment_transaction_id: "financial_transactions" }, fields: ["progress_number","project_id","contract_id","period_start","period_end","currency","previous_work_minor","current_work_minor","cumulative_work_minor","deduction_minor","retention_minor","tax_minor","net_payable_minor","status","rejection_reason","invoice_id","payment_transaction_id","notes","metadata_json"] },
  "inventory-items": { table: "inventory_items", required: ["sku", "name", "unit"], search: ["sku", "name", "category", "warehouse_location"], filters: ["category", "status", "preferred_supplier_id"], refs: { preferred_supplier_id: "suppliers" }, fields: ["sku","name","category","unit","reserved_quantity","minimum_quantity","average_cost_minor","warehouse_location","preferred_supplier_id","status","notes","metadata_json"] },
  "stock-movements": { table: "stock_movements", required: ["movement_number", "inventory_item_id", "movement_type", "movement_date", "quantity"], search: ["movement_number", "reference", "notes"], filters: ["inventory_item_id", "project_id", "movement_type", "status"], refs: { inventory_item_id: "inventory_items", project_id: "projects" }, fields: ["movement_number","inventory_item_id","project_id","movement_type","movement_date","quantity","unit_cost_minor","total_cost_minor","status","source_type","source_id","reference","notes","metadata_json"] },
  "project-meetings": { table: "project_meetings", required: ["meeting_type","meeting_date","title"], search: ["title","summary"], filters: ["project_id","meeting_type","status"], refs: { project_id: "projects" }, memberRefs: ["facilitator_user_id"], fields: ["project_id","meeting_type","meeting_date","title","facilitator_user_id","attendees_json","summary","status","metadata_json"] },
  "meeting-actions": { table: "meeting_actions", required: ["meeting_id","title"], search: ["title","description"], filters: ["meeting_id","project_id","owner_user_id","status"], refs: { meeting_id: "project_meetings", project_id: "projects" }, memberRefs: ["owner_user_id"], fields: ["meeting_id","project_id","title","description","owner_user_id","due_date","priority","status","completed_at","metadata_json"] },
  "quality-inspections": { table: "quality_inspections", required: ["inspection_number","project_id","inspection_type","inspection_date"], search: ["inspection_number","defect_notes","corrective_action"], filters: ["project_id","work_item_id","production_order_id","installation_id","inspection_type","result","status"], refs: { project_id: "projects", work_item_id: "work_items", production_order_id: "production_orders", installation_id: "installations" }, memberRefs: ["inspector_user_id"], fields: ["inspection_number","project_id","work_item_id","production_order_id","installation_id","inspection_type","inspection_date","inspector_user_id","result","checklist_json","defect_notes","corrective_action","corrective_due_date","status","metadata_json"] },
  handovers: { table: "handovers", required: ["handover_number","project_id","handover_date","customer_contact"], search: ["handover_number","customer_contact","acceptance_notes"], filters: ["project_id","installation_id","status"], refs: { project_id: "projects", installation_id: "installations", customer_signature_file_id: "files" }, fields: ["handover_number","project_id","installation_id","handover_date","customer_contact","satisfaction_score","customer_signature_file_id","acceptance_notes","status","metadata_json"] },
  "handover-punch-items": { table: "handover_punch_items", required: ["handover_id","title"], search: ["title","description"], filters: ["handover_id","responsible_user_id","severity","status"], refs: { handover_id: "handovers" }, memberRefs: ["responsible_user_id"], fields: ["handover_id","title","description","responsible_user_id","due_date","severity","status","resolved_at","accepted_at","metadata_json"] },
  "project-communications": { table: "project_communications", required: ["project_id","channel","subject","occurred_at"], search: ["contact_name","subject","summary","decision"], filters: ["project_id","customer_id","channel","owner_user_id","status"], refs: { project_id: "projects", customer_id: "customers" }, memberRefs: ["owner_user_id"], fields: ["project_id","customer_id","channel","direction","contact_name","subject","summary","decision","occurred_at","next_follow_up_at","owner_user_id","status","metadata_json"] },
  "resource-assignments": { table: "resource_assignments", required: ["project_id","resource_type","resource_name","planned_start","planned_end"], search: ["resource_name","role","notes"], filters: ["project_id","employee_id","resource_type","status"], refs: { project_id: "projects", employee_id: "employees" }, fields: ["project_id","employee_id","resource_type","resource_name","role","planned_start","planned_end","allocation_percent","status","notes","metadata_json"] },
  "material-requirements": { table: "material_requirements", required: ["project_id","description","required_quantity","unit"], search: ["item_code","description","notes"], filters: ["project_id","work_item_id","inventory_item_id","preferred_supplier_id","status"], refs: { project_id: "projects", work_item_id: "work_items", inventory_item_id: "inventory_items", preferred_supplier_id: "suppliers", purchase_request_id: "purchase_requests" }, fields: ["project_id","work_item_id","inventory_item_id","preferred_supplier_id","item_code","description","required_quantity","unit","needed_by","status","notes","metadata_json"] },
  "supplier-quotations": { table: "supplier_quotations", required: ["purchase_request_id", "supplier_id"], search: ["quotation_number", "payment_terms", "quality_note", "notes"], filters: ["purchase_request_id", "supplier_id", "status"], refs: { purchase_request_id: "purchase_requests", supplier_id: "suppliers" }, fields: ["purchase_request_id","supplier_id","quotation_number","quotation_date","valid_until","currency","quantity","unit","unit_price_minor","total_minor","lead_time_days","payment_terms","quality_note","status","rejection_reason","notes","metadata_json"] },
  "work-centers": { table: "work_centers", required: ["code", "name"], search: ["code", "name", "category", "notes"], filters: ["category", "status", "is_outsourced"], fields: ["code","name","category","daily_capacity_minutes","hourly_cost_minor","is_outsourced","status","notes","metadata_json"] },
  "bom-lines": { table: "bom_lines", required: ["work_item_id", "description", "quantity_per_unit", "unit"], search: ["item_code", "description", "notes"], filters: ["work_item_id", "inventory_item_id", "supplier_id"], refs: { work_item_id: "work_items", inventory_item_id: "inventory_items", supplier_id: "suppliers" }, fields: ["work_item_id","inventory_item_id","item_code","description","quantity_per_unit","unit","scrap_rate","unit_cost_minor","supplier_id","sort_order","notes","metadata_json"] },
  "production-operations": { table: "production_operations", required: ["production_order_id", "name"], search: ["name", "description", "notes"], filters: ["production_order_id", "work_center_id", "status"], refs: { production_order_id: "production_orders", work_center_id: "work_centers" }, memberRefs: ["assignee_user_id"], fields: ["production_order_id","work_center_id","sequence","name","description","planned_minutes","planned_start","planned_end","assignee_user_id","status","notes","metadata_json"] },
  "production-issues": { table: "production_issues", required: ["production_order_id", "issue_type", "description"], search: ["issue_number", "description", "root_cause", "resolution"], filters: ["production_order_id", "production_operation_id", "project_id", "work_item_id", "issue_type", "severity", "status"], refs: { production_order_id: "production_orders", production_operation_id: "production_operations", project_id: "projects", work_item_id: "work_items" }, memberRefs: ["responsible_user_id"], serverDefaults: (principal, timestamp) => ({ reported_at: timestamp, reported_by: principal.user.id }), fields: ["production_order_id","production_operation_id","project_id","work_item_id","issue_number","issue_type","severity","description","responsible_user_id","rework_quantity","scrap_quantity","cost_impact_minor","delay_days","root_cause","status","metadata_json"] },
};

const aliases = {
  purchases: "purchase-orders",
  "work-orders": "production-orders",
  transactions: "financial-transactions",
};

const backupTables = ["customers","suppliers","projects","offers","offer_items","project_tasks","work_items","purchase_requests","purchase_orders","production_orders","installations","accounts","financial_transactions","invoices","employees","attendance","leave_requests","payroll_inputs","files","audit_logs","roles","role_permissions","memberships","membership_roles","site_surveys","survey_measurements","contracts","design_revisions","progress_payments","inventory_items","stock_movements","project_meetings","meeting_actions","quality_inspections","handovers","handover_punch_items","notifications","project_communications","resource_assignments","material_requirements","supplier_quotations","work_centers","bom_lines","production_operations","production_issues"];
const backupMigrations = ["0001_tenant_core.sql", "0002_permissions.sql", "0003_workflows.sql", "0004_production_readiness.sql", "0005_capproje_domain.sql", "0006_phone_auth.sql", "0007_password_auth.sql", "0008_operational_intelligence.sql", "0009_material_planning.sql", "0010_contextual_media.sql", "0011_membership_roles.sql", "0012_operational_completion.sql", "0013_sourcing_bom_and_costing.sql"];
const BACKUP_SCHEMA_VERSION = backupMigrations.length;
const dailyBackupSeen = new Map();
const DAILY_BACKUP_SEEN_LIMIT = 500;
const ownerRoles = new Set(["owner", "admin"]);

// Bir üst yetki, kapsadığı ayrıntılı yetkileri de karşılar. Rol şablonları ve rol
// editörü ayrıntılı kodları kullandığı için ikisi de sunucuda geçerli olmalıdır.
const impliedPermissions = {
  "files.manage": ["files.read", "files.write", "files.delete"],
  "users.manage": ["memberships.read", "memberships.write", "memberships.delete"],
  "roles.manage": ["roles.read", "roles.write", "roles.delete"],
  "backups.manage": ["backups.read", "backups.write"],
};
const impliedBy = new Map();
for (const [parent, children] of Object.entries(impliedPermissions)) {
  for (const child of children) {
    if (!impliedBy.has(child)) impliedBy.set(child, new Set());
    impliedBy.get(child).add(parent);
  }
}
const fileEntityContexts = {
  projects: ["projects", null],
  offers: ["offers", "project_id"],
  "work-items": ["work_items", "project_id"],
  "design-revisions": ["design_revisions", "project_id"],
  "production-orders": ["production_orders", "project_id"],
  "quality-inspections": ["quality_inspections", "project_id"],
  installations: ["installations", "project_id"],
  handovers: ["handovers", "project_id"],
  employees: ["employees", null],
};
const PHONE_SESSION_COOKIE = "__Host-capproje_session";
const PHONE_SESSION_SECONDS = 12 * 60 * 60;
// Oturum, kullanıldıkça kayan pencereyle uzar; vardiya ortasında düşmemesi için.
const PHONE_SESSION_RENEW_THRESHOLD_SECONDS = 60 * 60;
const PHONE_SESSION_MAX_PER_USER = 10;
// Cloudflare Workers WebCrypto rejects PBKDF2 iteration counts above 100,000.
const PASSWORD_ITERATIONS = 100_000;
const PASSWORD_ITERATIONS_CEILING = 1_000_000;
const staticSecurityHeaders = {
  "content-security-policy": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; manifest-src 'self'; worker-src 'self'",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "x-content-type-options": "nosniff",
};
const projectTransitions = {
  lead: ["discovery", "estimating", "cancelled"],
  discovery: ["estimating", "on_hold", "cancelled"],
  estimating: ["offered", "on_hold", "cancelled"],
  offered: ["contracted", "estimating", "lost"],
  contracted: ["design", "on_hold", "cancelled"],
  design: ["procurement", "production", "on_hold", "cancelled"],
  procurement: ["production", "on_hold", "cancelled"],
  production: ["installation", "on_hold", "cancelled"],
  installation: ["acceptance", "on_hold", "cancelled"],
  acceptance: ["completed", "installation", "on_hold"],
  on_hold: ["discovery", "estimating", "offered", "contracted", "design", "procurement", "production", "installation", "acceptance", "cancelled"],
  completed: [], lost: [], cancelled: [],
};
const projectStageDefinitions = [
  ["lead", "Talep"], ["discovery", "Keşif"], ["estimating", "Teklif Hazırlığı"], ["offered", "Teklif"],
  ["contracted", "Sözleşme"], ["design", "Tasarım"], ["procurement", "Satın Alma"],
  ["production", "Üretim & Kalite"], ["installation", "Montaj"], ["acceptance", "Teslim"], ["completed", "Kapanış"],
];
const projectPrimaryNext = {
  lead: "discovery", discovery: "estimating", estimating: "offered", offered: "contracted", contracted: "design",
  design: "procurement", procurement: "production", production: "installation", installation: "acceptance", acceptance: "completed",
};
const projectTaskTemplates = {
  discovery: [["Keşif randevusunu planla", "Proje", 3]],
  estimating: [["Keşif metrajlarını doğrula", "Proje", 2], ["Güncel tedarikçi fiyatlarını topla", "Satın Alma", 4]],
  offered: [["Teklifi müşteriye sun ve takip tarihini belirle", "Satış", 2]],
  contracted: [["Sözleşme ve ödeme planını tamamla", "Finans", 3], ["Proje başlangıç toplantısını planla", "Proje", 2]],
  design: [["2D/3D tasarım paketini hazırla", "Tasarım", 7], ["Müşteri tasarım onayını takip et", "Tasarım", 9]],
  procurement: [["Malzeme ihtiyaç listesini kesinleştir", "Satın Alma", 3], ["Stok rezervasyonlarını kontrol et", "Depo", 3]],
  production: [["Üretim emirlerini ve iş merkezi planını yayınla", "Üretim", 2], ["Final kalite kontrolünü planla", "Kalite", 7]],
  installation: [["Saha hazır olma kontrolünü tamamla", "Montaj", 2], ["Sevk ve montaj ekibini kesinleştir", "Montaj", 2]],
  acceptance: [["Teslim eksik listesini müşteriyle kontrol et", "Proje", 2]],
  completed: [["Proje kapanış ve kârlılık değerlendirmesini tamamla", "Yönetim", 5]],
};
const workflowManagedResources = new Set(["offers", "projects", "production-orders", "purchase-requests", "purchase-orders", "leaves", "financial-transactions", "site-surveys", "contracts", "design-revisions", "progress-payments", "stock-movements", "project-meetings", "quality-inspections", "handovers", "material-requirements", "supplier-quotations", "production-operations", "production-issues"]);

// Eski tablolarda durum alanı serbest metindi. Kanonik küme hem burada hem de
// 0012 migration'ındaki tetikleyicilerde tanımlıdır; ikisi birlikte güncellenmelidir.
const statusEnums = {
  projects: ["lead","discovery","estimating","offered","contracted","design","procurement","production","installation","acceptance","completed","on_hold","lost","cancelled"],
  offers: ["draft","costing","sent","pending","revision_requested","accepted","rejected","expired","cancelled"],
  "purchase-requests": ["draft","pending","approved","rejected","ordered","partial","received","cancelled"],
  "purchase-orders": ["draft","ordered","partial","received","cancelled"],
  "production-orders": ["draft","planned","released","waiting_material","in_progress","quality_control","paused","completed","cancelled"],
  installations: ["planned","survey_needed","site_waiting","in_transit","in_progress","incomplete","completed","cancelled"],
  "financial-transactions": ["draft","planned","pending","approved","collected","paid","overdue","reversed","cancelled"],
  invoices: ["draft","open","partial","paid","collected","overdue","cancelled"],
  employees: ["active","on_leave","inactive","terminated"],
  attendance: ["present","absent","leave","remote","holiday","sick"],
  leaves: ["pending","approved","rejected","cancelled"],
  "payroll-inputs": ["draft","approved","exported","cancelled"],
  "work-items": ["planned","approved","production","completed","cancelled"],
  "project-tasks": ["todo","in_progress","blocked","completed","cancelled"],
  accounts: ["active","passive","closed"],
  customers: ["active","passive","blacklisted"],
  suppliers: ["active","passive","blacklisted"],
  "inventory-items": ["active","passive","discontinued"],
  "material-requirements": ["draft","shortage","covered","consumed","cancelled"],
  memberships: ["active","invited","disabled"],
  "supplier-quotations": ["draft","received","selected","rejected","expired"],
  "work-centers": ["active","passive"],
  "production-operations": ["pending","in_progress","blocked","completed","skipped"],
  "production-issues": ["open","in_progress","resolved","cancelled"],
};
const enumFields = {
  "work-items": { revision_status: ["draft","review","changes_requested","approved","superseded"], production_type: ["internal","external"] },
  "production-orders": { production_type: ["internal","external"], trade_type: ["internal","cila","metal","glass_mirror","door","upholstery","stone","other"] },
  "financial-transactions": { type: ["income","expense","progress_payment","advance","cost_forecast"] },
  invoices: { direction: ["sales","purchase"] },
  customers: { type: ["company","individual","hotel","architect"] },
  projects: { photo_consent: ["not_requested","denied","internal_only","marketing_allowed"], priority: ["low","normal","high","critical"] },
  "project-tasks": { priority: ["low","normal","high","critical"] },
  files: { visibility: ["internal","customer","marketing"] },
  "production-issues": { issue_type: ["material","quality","machine","drawing","manpower","supplier","other"], severity: ["low","normal","high","critical"] },
};
// Serbest metin alanları için üst sınırlar. Gövde boyutu sınırı tek başına
// veritabanına devasa tek alan yazılmasını engellemiyordu.
const TEXT_FIELD_LIMIT = 2000;
const LONG_TEXT_FIELDS = new Set(["description", "notes", "instructions", "summary", "decision", "address", "site_address", "issue_notes", "defect_notes", "corrective_action", "acceptance_notes", "rejection_reason", "termination_reason", "message"]);
const LONG_TEXT_FIELD_LIMIT = 20000;
const JSON_FIELD_LIMIT = 100000;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...extraHeaders },
  });
}

function secureStaticResponse(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(staticSecurityHeaders)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function problem(status, code, message, details) {
  return json({ error: { code, message, ...(details ? { details } : {}) } }, status);
}

function now() { return new Date().toISOString(); }
function id(prefix = "") { return prefix + crypto.randomUUID(); }
function validId(value) { return typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value); }
function escapeLike(value) { return String(value).replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_"); }
function rawApiToken() { return `cap_${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`; }

async function sha256(value) {
  const input = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const bytes = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeTurkishMobile(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0090")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("05")) digits = `90${digits.slice(1)}`;
  else if (digits.length === 10 && digits.startsWith("5")) digits = `90${digits}`;
  if (!/^905\d{9}$/.test(digits)) return null;
  return `+${digits}`;
}

function cookieValue(request, name) {
  const cookies = request.headers.get("cookie") || "";
  for (const part of cookies.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function phoneSessionCookie(token, maxAge = PHONE_SESSION_SECONDS) {
  const value = token ? encodeURIComponent(token) : "";
  return `${PHONE_SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

// Origin karşılaştırması host üzerinden yapılır. Ters vekil sunucu
// X-Forwarded-Proto başlığını iletmezse şema karşılaştırması yanlış negatif
// üretir ve tüm yazma işlemleri kilitlenirdi; host karşılaştırması ise saldırgan
// alan adını yine reddeder. Ek alan adları ALLOWED_ORIGINS ile tanımlanabilir.
function sameOrigin(request, env = {}) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let originHost;
  try { originHost = new URL(origin).host; } catch { return false; }
  if (originHost === new URL(request.url).host) return true;
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);
  return allowed.some((value) => {
    try { return new URL(value.includes("://") ? value : `https://${value}`).host === originHost; }
    catch { return false; }
  });
}

async function authHash(env, value) {
  return sha256(`${env.PHONE_AUTH_PEPPER || env.PASSWORD_AUTH_PEPPER || "capproje-auth"}:${value}`);
}

function base64Bytes(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function bytesFromBase64(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function derivePasswordHash(env, password, salt, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${password}:${env.PASSWORD_AUTH_PEPPER || ""}`),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: bytesFromBase64(salt), iterations },
    key,
    256,
  );
  return base64Bytes(new Uint8Array(bits));
}

// Workers 100.000 iterasyonla sınırlı; kendi sunucusunda çalışırken
// PASSWORD_ITERATIONS ortam değişkeniyle yükseltilebilir. Her kaydın iterasyon
// sayısı ayrı saklandığı için geçiş kademelidir, mevcut şifreler bozulmaz.
function passwordIterations(env) {
  const configured = Number(env.PASSWORD_ITERATIONS);
  if (!Number.isSafeInteger(configured) || configured < PASSWORD_ITERATIONS || configured > PASSWORD_ITERATIONS_CEILING) return PASSWORD_ITERATIONS;
  return configured;
}

async function passwordRecord(env, password) {
  const salt = base64Bytes(crypto.getRandomValues(new Uint8Array(16)));
  const iterations = passwordIterations(env);
  return { hash: await derivePasswordHash(env, password, salt, iterations), salt, iterations };
}

function safeHashEqual(left, right) {
  if (!left || !right) return false;
  const a = bytesFromBase64(left);
  const b = bytesFromBase64(right);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) difference |= (a[index] || 0) ^ (b[index] || 0);
  return difference === 0;
}

function validPassword(value) {
  return typeof value === "string" && value.length >= 8 && value.length <= 128;
}

function twilioCredentials(env) {
  const username = env.TWILIO_API_KEY || env.TWILIO_ACCOUNT_SID;
  const password = env.TWILIO_API_KEY_SECRET || env.TWILIO_AUTH_TOKEN;
  if (!username || !password || !env.TWILIO_VERIFY_SERVICE_SID) return null;
  return { username, password, serviceSid: env.TWILIO_VERIFY_SERVICE_SID };
}

async function twilioVerify(env, endpoint, values) {
  const credentials = twilioCredentials(env);
  if (!credentials) throw new Error("phone_auth_not_configured");
  const response = await fetch(`https://verify.twilio.com/v2/Services/${encodeURIComponent(credentials.serviceSid)}/${endpoint}`, {
    method: "POST",
    headers: {
      authorization: `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: new URLSearchParams(values),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`twilio_verify_${response.status}`);
  return payload;
}

async function one(statement) {
  const result = await statement.first();
  return result || null;
}

async function all(statement) {
  const result = await statement.all();
  return result?.results || [];
}

async function run(statement) {
  return statement.run();
}

function decodeRow(row) {
  if (!row) return row;
  const decoded = { ...row };
  for (const key of JSON_COLUMNS) {
    if (typeof decoded[key] === "string") {
      try { decoded[key] = JSON.parse(decoded[key]); } catch { /* Eski/bozuk kayıt ham haliyle kalır. */ }
    }
  }
  for (const key of ["official", "is_system"]) {
    if (key in decoded) decoded[key] = Boolean(decoded[key]);
  }
  return decoded;
}

function serializeRow(row, slug, principal) {
  const result = decodeRow(row);
  if (!result) return result;
  if (!allowed(principal, "cost.view")) {
    for (const field of ["estimated_cost","cost_price","unit_cost","estimated_cost_minor","cost_price_minor","unit_cost_minor"]) delete result[field];
  }
  if (!allowed(principal, "salary.view")) {
    for (const field of ["salary_amount","base_salary","overtime_amount","bonus_amount","allowance_amount","deduction_amount","advance_amount","net_preview","salary_amount_minor","base_salary_minor","overtime_amount_minor","bonus_amount_minor","allowance_amount_minor","deduction_amount_minor","advance_amount_minor","net_preview_minor"]) delete result[field];
  }
  if (!allowed(principal, "hr.sensitive.read")) for (const field of ["national_id_masked","birth_date","emergency_contact","address"]) delete result[field];
  if (!allowed(principal, "finance.sensitive.read")) for (const field of ["iban","official","opening_balance_minor","current_balance_minor"]) delete result[field];
  return result;
}

function clientIp(request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

async function authenticate(request, env) {
  const authorization = request.headers.get("authorization") || "";
  let user;
  let sessionId = null;
  let sessionExpiresAt = null;
  if (authorization.startsWith("Bearer ")) {
    const tokenHash = await sha256(authorization.slice(7).trim());
    user = await one(env.DB.prepare("SELECT u.id, u.email, u.full_name, u.phone, u.status, u.must_change_password FROM api_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.revoked_at IS NULL AND (t.expires_at IS NULL OR t.expires_at>?) AND u.status='active'").bind(tokenHash, now()));
    if (user) await run(env.DB.prepare("UPDATE api_tokens SET last_used_at=? WHERE token_hash=?").bind(now(), tokenHash));
  } else {
    const sessionToken = cookieValue(request, PHONE_SESSION_COOKIE);
    if (sessionToken) {
      const tokenHash = await sha256(sessionToken);
      const timestamp = now();
      const session = await one(env.DB.prepare("SELECT s.id AS session_id,s.expires_at,u.id,u.email,u.full_name,u.phone,u.status,u.must_change_password FROM phone_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'").bind(tokenHash, timestamp));
      if (session) {
        sessionId = session.session_id;
        sessionExpiresAt = session.expires_at;
        // Kayan pencere: oturum kullanıldıkça uzar, kullanılmazsa kendiliğinden düşer.
        const remainingMs = Date.parse(session.expires_at) - Date.now();
        if (Number.isFinite(remainingMs) && remainingMs < PHONE_SESSION_RENEW_THRESHOLD_SECONDS * 1000) {
          sessionExpiresAt = new Date(Date.now() + PHONE_SESSION_SECONDS * 1000).toISOString();
          await run(env.DB.prepare("UPDATE phone_sessions SET last_seen_at=?,expires_at=? WHERE token_hash=? AND revoked_at IS NULL").bind(timestamp, sessionExpiresAt, tokenHash));
        } else {
          await run(env.DB.prepare("UPDATE phone_sessions SET last_seen_at=? WHERE token_hash=?").bind(timestamp, tokenHash));
        }
        user = { id: session.id, email: session.email, full_name: session.full_name, phone: session.phone, status: session.status, must_change_password: session.must_change_password };
      }
    }
    if (!user) {
      const platformEmail = env.ALLOW_PLATFORM_AUTH === "true"
        ? request.headers.get("oai-authenticated-user-email")
        : null;
      const devEmail = env.ALLOW_DEV_AUTH === "true" ? request.headers.get("x-user-email") : null;
      const email = platformEmail || devEmail;
      if (email) user = await one(env.DB.prepare("SELECT id,email,full_name,phone,status,must_change_password FROM users WHERE email=? COLLATE NOCASE AND status='active'").bind(email.trim()));
    }
  }
  if (!user) return null;
  const mustChangePassword = Boolean(user.must_change_password);
  delete user.must_change_password;

  const base = { user, sessionId, sessionExpiresAt, mustChangePassword };

  async function expandMembership(membership) {
    // Roller ve yetkiler tek sorguda toplanır; önceden rol başına ayrı sorgu atılıyordu.
    const extraRoles = await all(env.DB.prepare("SELECT r.id AS role_id,r.code AS role_code,r.name AS role_name FROM membership_roles mr JOIN roles r ON r.id=mr.role_id AND r.tenant_id=mr.tenant_id WHERE mr.tenant_id=? AND mr.membership_id=? ORDER BY r.name").bind(membership.tenant_id, membership.membership_id));
    const roles = [];
    const seen = new Set();
    for (const role of [{ role_id: membership.role_id, role_code: membership.role_code, role_name: membership.role_name }, ...extraRoles]) {
      if (!role.role_id || seen.has(role.role_id)) continue;
      seen.add(role.role_id);
      roles.push({ id: role.role_id, code: role.role_code, name: role.role_name });
    }
    const isOwner = roles.some((role) => ownerRoles.has(role.code));
    const permissionCodes = new Set();
    if (!isOwner && roles.length) {
      const placeholders = roles.map(() => "?").join(",");
      const rows = await all(env.DB.prepare(`SELECT DISTINCT permission_code FROM role_permissions WHERE tenant_id=? AND role_id IN (${placeholders})`).bind(membership.tenant_id, ...roles.map((role) => role.id)));
      rows.forEach((item) => permissionCodes.add(item.permission_code));
    }
    return { membership: { ...membership, roles }, permissions: [...permissionCodes], isOwner };
  }

  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) {
    const memberships = await all(env.DB.prepare("SELECT m.id AS membership_id,m.tenant_id,m.title,r.id AS role_id,r.code AS role_code,r.name AS role_name,t.name AS tenant_name,t.slug AS tenant_slug FROM memberships m JOIN roles r ON r.id=m.role_id AND r.tenant_id=m.tenant_id JOIN tenants t ON t.id=m.tenant_id WHERE m.user_id=? AND m.status='active' AND t.status='active' ORDER BY t.name").bind(user.id));
    if (memberships.length === 0) return { ...base, forbiddenTenant: true };
    if (memberships.length > 1) {
      const expanded = await Promise.all(memberships.map((item) => expandMembership(item)));
      return { ...base, tenantSelectionRequired: true, tenants: expanded.map(({ membership }) => ({ id: membership.tenant_id, name: membership.tenant_name, slug: membership.tenant_slug, role: membership.roles[0], roles: membership.roles })) };
    }
    const expanded = await expandMembership(memberships[0]);
    return { ...base, tenantId: memberships[0].tenant_id, ...expanded, tenantAutoSelected: true };
  }
  if (!validId(tenantId)) return { ...base, tenantMissing: true };
  const membership = await one(env.DB.prepare("SELECT m.id AS membership_id,m.tenant_id,m.title,r.id AS role_id,r.code AS role_code,r.name AS role_name,t.name AS tenant_name,t.slug AS tenant_slug FROM memberships m JOIN roles r ON r.id=m.role_id AND r.tenant_id=m.tenant_id JOIN tenants t ON t.id=m.tenant_id WHERE m.user_id=? AND m.tenant_id=? AND m.status='active' AND t.status='active'").bind(user.id, tenantId));
  if (!membership) return { ...base, forbiddenTenant: true };
  return { ...base, tenantId, ...(await expandMembership(membership)) };
}

function allowed(principal, permission) {
  if (principal.isOwner) return true;
  if (principal.permissions.includes(permission)) return true;
  const parents = impliedBy.get(permission);
  if (parents) for (const parent of parents) if (principal.permissions.includes(parent)) return true;
  // Genel "approve" yetkisi, kaynak bazlı onay yetkilerini karşılar.
  if (permission.endsWith(".approve") && principal.permissions.includes("approve")) return true;
  return false;
}

function permissionFor(slug, action) {
  return `${slug}.${action}`;
}

function sensitiveWriteProblem(principal, body) {
  const guarded = [
    ["cost.view", ["estimated_cost","cost_price","unit_cost","estimated_cost_minor","cost_price_minor","unit_cost_minor","estimated_amount_minor","average_cost_minor"]],
    ["salary.view", ["salary_amount","base_salary","overtime_amount","bonus_amount","allowance_amount","deduction_amount","advance_amount","net_preview","salary_amount_minor","base_salary_minor","overtime_amount_minor","bonus_amount_minor","allowance_amount_minor","deduction_amount_minor","advance_amount_minor","net_preview_minor"]],
    ["hr.sensitive.read", ["national_id_masked","birth_date","emergency_contact","address"]],
    ["finance.sensitive.read", ["iban","official","opening_balance_minor","current_balance_minor"]],
  ];
  for (const [permission, fields] of guarded) {
    const attempted = fields.filter((field) => Object.prototype.hasOwnProperty.call(body, field));
    if (attempted.length && !allowed(principal, permission)) return problem(403, "sensitive_field_forbidden", `${attempted.join(", ")} alanları için ${permission} yetkisi gereklidir.`);
  }
  return null;
}

async function audit(env, principal, request, action, entityType, entityId, changes = {}) {
  await run(env.DB.prepare("INSERT INTO audit_logs (id,tenant_id,user_id,action,entity_type,entity_id,request_id,ip_address,changes_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(id("aud_"), principal?.tenantId || null, principal?.user?.id || null, action, entityType, entityId || null, request?.headers?.get("x-request-id") || null, request ? clientIp(request) : null, JSON.stringify(changes), now()));
}

function auditStatement(env, principal, request, action, entityType, entityId, changes = {}) {
  return env.DB.prepare("INSERT INTO audit_logs (id,tenant_id,user_id,action,entity_type,entity_id,request_id,ip_address,changes_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(id("aud_"), principal.tenantId, principal.user?.id || null, action, entityType, entityId || null, request?.headers?.get("x-request-id") || null, request ? clientIp(request) : null, JSON.stringify(changes), now());
}

async function commitWorkflow(env, principal, request, statements, action, entityType, entityId, changes = {}) {
  if (typeof env.DB.batch !== "function") {
    const error = new Error("Atomic D1 batch is unavailable; workflow was not started.");
    error.code = "atomic_batch_unavailable";
    throw error;
  }
  return env.DB.batch([...statements, auditStatement(env, principal, request, action, entityType, entityId, changes)]);
}

function workflowCommitProblem(env, error) {
  return problem(503, "workflow_commit_failed", "İş akışı ve denetim kaydı atomik olarak yazılamadı; hiçbir durum değişikliği uygulanmadı.", env.EXPOSE_ERRORS === "true" ? String(error?.message || error) : undefined);
}

async function parseBody(request) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new Response(null, { status: 415 });
  try { return await request.json(); } catch { throw new Response(null, { status: 400 }); }
}

function textFieldLimit(key) {
  if (JSON_COLUMNS.has(key)) return JSON_FIELD_LIMIT;
  return LONG_TEXT_FIELDS.has(key) ? LONG_TEXT_FIELD_LIMIT : TEXT_FIELD_LIMIT;
}

function normalizeInput(slug, config, body, creating) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "JSON nesnesi bekleniyor." };
  const allowedFields = new Set(config.fields);
  const unknown = Object.keys(body).filter((key) => !allowedFields.has(key));
  if (unknown.length) return { error: `Desteklenmeyen alanlar: ${unknown.join(", ")}` };
  if (creating) {
    const missing = (config.required || []).filter((key) => body[key] === undefined || body[key] === null || body[key] === "");
    if (missing.length) return { error: `Zorunlu alanlar: ${missing.join(", ")}` };
  }
  const allowedStatuses = statusEnums[slug];
  const otherEnums = enumFields[slug] || {};
  const values = {};
  for (const [key, value] of Object.entries(body)) {
    if (key.endsWith("_minor")) {
      const normalizedMoney = typeof value === "string" && /^-?\d+$/.test(value) ? Number(value) : value;
      if (!Number.isSafeInteger(normalizedMoney)) return { error: `${key} güvenli bir tam sayı veya tam sayı metni (kuruş) olmalıdır.` };
      values[key] = normalizedMoney;
    } else if (JSON_COLUMNS.has(key)) {
      const serialized = typeof value === "string" ? value : JSON.stringify(value ?? (key.endsWith("_ids_json") || key === "team_json" ? [] : {}));
      if (serialized.length > JSON_FIELD_LIMIT) return { error: `${key} en fazla ${JSON_FIELD_LIMIT} karakter olabilir.` };
      values[key] = serialized;
    } else if (["official", "is_system"].includes(key)) values[key] = value ? 1 : 0;
    else {
      if (key === "status" && allowedStatuses && value !== undefined && value !== null && value !== "" && !allowedStatuses.includes(value)) {
        return { error: `status yalnız şu değerlerden biri olabilir: ${allowedStatuses.join(", ")}` };
      }
      if (otherEnums[key] && value !== undefined && value !== null && value !== "" && !otherEnums[key].includes(value)) {
        return { error: `${key} yalnız şu değerlerden biri olabilir: ${otherEnums[key].join(", ")}` };
      }
      if (typeof value === "string") {
        const limit = textFieldLimit(key);
        if (value.length > limit) return { error: `${key} en fazla ${limit} karakter olabilir.` };
      } else if (value !== null && typeof value === "object") {
        return { error: `${key} metin, sayı veya null olmalıdır.` };
      }
      values[key] = value;
    }
  }
  return { values };
}

async function validateReferences(env, principal, config, values) {
  for (const [field, table] of Object.entries(config.refs || {})) {
    const referencedId = values[field];
    if (referencedId === undefined || referencedId === null || referencedId === "") continue;
    if (!validId(referencedId)) return `${field} geçersiz.`;
    const linked = await one(env.DB.prepare(`SELECT id FROM ${table} WHERE id=? AND tenant_id=?`).bind(referencedId, principal.tenantId));
    if (!linked) return `${field} bu firmaya ait geçerli bir kaydı göstermiyor.`;
  }
  for (const field of config.memberRefs || []) {
    const userId = values[field];
    if (userId === undefined || userId === null || userId === "") continue;
    const membership = await one(env.DB.prepare("SELECT id FROM memberships WHERE tenant_id=? AND user_id=? AND status='active'").bind(principal.tenantId, userId));
    if (!membership) return `${field} bu firmada aktif üyeliği olan bir kullanıcıyı göstermiyor.`;
  }
  for (const field of config.userRefs || []) {
    const userId = values[field];
    if (userId === undefined || userId === null || userId === "") continue;
    if (!validId(userId)) return `${field} geçersiz.`;
    const user = await one(env.DB.prepare("SELECT id FROM users WHERE id=?").bind(userId));
    if (!user) return `${field} kayıtlı bir kullanıcıyı göstermiyor.`;
  }
  return null;
}

// Sistem rollerini (owner/admin) yalnızca firma sahibi atayabilir; aksi hâlde
// "kullanıcı yönetimi" yetkisi olan herkes kendini sahibe yükseltebilirdi.
async function privilegedRoleProblem(env, principal, roleIds) {
  const ids = roleIds.filter((value) => typeof value === "string" && value);
  if (!ids.length || principal.isOwner) return null;
  const placeholders = ids.map(() => "?").join(",");
  const rows = await all(env.DB.prepare(`SELECT code FROM roles WHERE tenant_id=? AND id IN (${placeholders})`).bind(principal.tenantId, ...ids));
  if (rows.some((row) => ownerRoles.has(row.code))) {
    return problem(403, "privileged_role_forbidden", "Firma sahibi veya yönetici rolünü yalnızca mevcut bir firma sahibi atayabilir.");
  }
  return null;
}

async function getSession(principal) {
  if (principal.tenantSelectionRequired) return json({ data: { user: principal.user, tenant: null, role: null, permissions: [], tenants: principal.tenants, requires_tenant_selection: true, must_change_password: Boolean(principal.mustChangePassword) } });
  return json({ data: {
    user: principal.user,
    must_change_password: Boolean(principal.mustChangePassword),
    session_expires_at: principal.sessionExpiresAt || null,
    tenant: { id: principal.tenantId, name: principal.membership.tenant_name, slug: principal.membership.tenant_slug },
    membership: { id: principal.membership.membership_id, title: principal.membership.title },
    role: principal.membership.roles[0],
    roles: principal.membership.roles,
    permissions: principal.isOwner ? ["*"] : principal.permissions,
    tenant_auto_selected: Boolean(principal.tenantAutoSelected),
  } });
}

// Yetki kataloğu artık arayüzde sabit kodlu değil; kaynak veritabanıdır.
// Böylece yeni bir yetki eklendiğinde rol editörü kendiliğinden güncellenir.
async function getPermissionCatalog(env, principal) {
  const rows = await all(env.DB.prepare("SELECT code,description FROM permissions ORDER BY code"));
  const implied = Object.fromEntries(Object.entries(impliedPermissions).map(([parent, children]) => [parent, [...children]]));
  return json({ data: rows, meta: { implied, granted: principal.isOwner ? ["*"] : principal.permissions } });
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  // Öndeki =,+,-,@ karakterleri elektronik tabloda formül olarak yorumlanır.
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${guarded.replaceAll('"', '""')}"`;
}

async function exportResource(request, env, principal, slug, config) {
  if (!allowed(principal, "export")) return problem(403, "forbidden", "Dışa aktarma yetkiniz yok.");
  if (!allowed(principal, permissionFor(slug, "read"))) return problem(403, "forbidden", "Bu kayıtları görüntüleme yetkiniz yok.");
  const url = new URL(request.url);
  const clauses = ["tenant_id=?"];
  const bindings = [principal.tenantId];
  for (const field of config.filters || []) {
    const value = url.searchParams.get(field);
    if (value !== null && value !== "") { clauses.push(`${field}=?`); bindings.push(value); }
  }
  const limit = Math.min(10000, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "5000", 10) || 5000));
  const rows = await all(env.DB.prepare(`SELECT * FROM ${config.table} WHERE ${clauses.join(" AND ")} ORDER BY ${config.table === "audit_logs" ? "created_at" : "updated_at"} DESC LIMIT ?`).bind(...bindings, limit));
  const serialized = rows.map((row) => serializeRow(row, slug, principal));
  const columns = [...new Set(serialized.flatMap((row) => Object.keys(row)))];
  const lines = [columns.map(csvCell).join(","), ...serialized.map((row) => columns.map((column) => csvCell(row[column])).join(","))];
  await audit(env, principal, request, "export", slug, null, { row_count: serialized.length });
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${slug}-${now().slice(0, 10)}.csv`)}`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

async function getDashboard(env, principal) {
  if (!allowed(principal, "dashboard.read")) return problem(403, "forbidden", "Dashboard görüntüleme yetkiniz yok.");
  const tenant = principal.tenantId;
  const queries = [
    ["projects", "SELECT COUNT(*) AS count FROM projects WHERE tenant_id=? AND status NOT IN ('completed','cancelled')"],
    ["openOffers", "SELECT COUNT(*) AS count,COALESCE(SUM(grand_total_minor),0) AS amount_minor FROM offers WHERE tenant_id=? AND status IN ('sent','pending')"],
    ["production", "SELECT COUNT(*) AS count FROM production_orders WHERE tenant_id=? AND status NOT IN ('completed','cancelled')"],
    ["installations", "SELECT COUNT(*) AS count FROM installations WHERE tenant_id=? AND status NOT IN ('completed','cancelled')"],
    // Alacak: tahsil edilmemiş tüm gelir hareketleri. Onaylı ama henüz tahsil
    // edilmemiş kayıtlar da alacaktır; önceden kapsam dışıydı.
    ["receivables", "SELECT COALESCE(SUM(amount_minor),0) AS amount_minor,COALESCE(SUM(CASE WHEN due_date IS NOT NULL AND due_date<date('now') THEN amount_minor ELSE 0 END),0) AS overdue_amount_minor FROM financial_transactions WHERE tenant_id=? AND type='income' AND status IN ('planned','pending','approved','overdue')"],
    ["payables", "SELECT COALESCE(SUM(amount_minor),0) AS amount_minor FROM financial_transactions WHERE tenant_id=? AND type='expense' AND status IN ('planned','pending','approved','overdue')"],
    ["employees", "SELECT COUNT(*) AS count FROM employees WHERE tenant_id=? AND status='active'"],
  ];
  const data = {};
  for (const [name, sql] of queries) data[name] = await one(env.DB.prepare(sql).bind(tenant));
  data.recentProjects = (await all(env.DB.prepare("SELECT id,code,name,status,progress_percent,updated_at FROM projects WHERE tenant_id=? ORDER BY updated_at DESC LIMIT 6").bind(tenant))).map(decodeRow);
  data.pipeline = (await all(env.DB.prepare("SELECT status,COUNT(*) AS count FROM projects WHERE tenant_id=? AND status NOT IN ('cancelled','lost') GROUP BY status ORDER BY status").bind(tenant))).map(decodeRow);
  data.attention = await one(env.DB.prepare(`SELECT
    (SELECT COUNT(*) FROM project_tasks WHERE tenant_id=? AND status IN ('todo','in_progress','blocked') AND planned_end IS NOT NULL AND planned_end<date('now')) AS overdue_tasks,
    (SELECT COUNT(*) FROM purchase_requests WHERE tenant_id=? AND status='pending') AS pending_purchases,
    (SELECT COUNT(*) FROM design_revisions WHERE tenant_id=? AND status IN ('internal_review','client_review')) AS pending_designs,
    (SELECT COUNT(*) FROM quality_inspections WHERE tenant_id=? AND result IN ('conditional','fail') AND status<>'closed') AS quality_issues,
    (SELECT COUNT(*) FROM notifications WHERE tenant_id=? AND user_id=? AND status='unread') AS unread_notifications,
    (SELECT COUNT(*) FROM project_communications WHERE tenant_id=? AND status IN ('open','follow_up') AND next_follow_up_at IS NOT NULL AND next_follow_up_at<=date('now','+3 day')) AS pending_follow_ups,
    (SELECT COUNT(*) FROM resource_assignments WHERE tenant_id=? AND status IN ('planned','confirmed','active') AND planned_start<=date('now','+14 day') AND planned_end>=date('now')) AS upcoming_assignments,
    (SELECT COUNT(*) FROM material_requirements WHERE tenant_id=? AND status NOT IN ('cancelled','consumed') AND required_quantity>reserved_quantity+ordered_quantity) AS material_shortages,
    (SELECT COUNT(*) FROM (
      SELECT DISTINCT COALESCE(a.employee_id, a.resource_type || '|' || a.resource_name) AS resource_key
      FROM resource_assignments a
      WHERE a.tenant_id=? AND a.status IN ('planned','confirmed','active')
        AND (SELECT COALESCE(SUM(b.allocation_percent),0) FROM resource_assignments b
             WHERE b.tenant_id=a.tenant_id AND b.status IN ('planned','confirmed','active')
               AND b.planned_start<=a.planned_end AND b.planned_end>=a.planned_start
               AND ((a.employee_id IS NOT NULL AND b.employee_id=a.employee_id)
                 OR (a.employee_id IS NULL AND b.employee_id IS NULL AND b.resource_type=a.resource_type AND b.resource_name=a.resource_name))) > 100
    )) AS capacity_conflicts
  `).bind(tenant, tenant, tenant, tenant, tenant, principal.user.id, tenant, tenant, tenant, tenant));
  return json({ data });
}

async function getNotifications(env, principal) {
  const rows = (await all(env.DB.prepare("SELECT id,project_id,type,title,message,module,record_id,status,due_at,read_at,created_at FROM notifications WHERE tenant_id=? AND user_id=? AND status<>'dismissed' ORDER BY CASE status WHEN 'unread' THEN 0 ELSE 1 END,created_at DESC LIMIT 50").bind(principal.tenantId, principal.user.id))).map(decodeRow);
  return json({ data: rows, meta: { unread: rows.filter((row) => row.status === "unread").length } });
}

async function markNotification(request, env, principal, notificationId) {
  const notification = await one(env.DB.prepare("SELECT id,status FROM notifications WHERE id=? AND tenant_id=? AND user_id=?").bind(notificationId, principal.tenantId, principal.user.id));
  if (!notification) return problem(404, "not_found", "Bildirim bulunamadı.");
  let body = {};
  try { body = await parseBody(request); } catch { return problem(400, "invalid_body", "Geçerli JSON gönderin."); }
  const status = body?.status === "dismissed" ? "dismissed" : "read";
  const timestamp = now();
  await run(env.DB.prepare("UPDATE notifications SET status=?,read_at=?,updated_at=? WHERE id=? AND tenant_id=? AND user_id=?").bind(status, status === "read" ? timestamp : null, timestamp, notificationId, principal.tenantId, principal.user.id));
  return json({ data: { id: notificationId, status } });
}

async function globalSearch(request, env, principal) {
  const query = String(new URL(request.url).searchParams.get("q") || "").trim();
  if (query.length < 2) return json({ data: [] });
  const like = `%${escapeLike(query)}%`;
  const tenant = principal.tenantId;
  const definitions = [
    ["projects", "projects", "code", "name", "status", "projects.read"],
    ["customers", "customers", "code", "name", "contact_name", "customers.read"],
    ["offers", "offers", "offer_number", "notes", "status", "offers.read"],
    ["workItems", "work_items", "item_code", "description", "space_name", "work-items.read"],
    ["purchases", "purchase_requests", "request_number", "description", "status", "purchase-requests.read"],
    ["files", "files", "file_name", "description", "category", "files.read"],
  ];
  const data = [];
  for (const [module, table, codeColumn, titleColumn, subtitleColumn, permission] of definitions) {
    if (!allowed(principal, permission)) continue;
    const sql = `SELECT id,${codeColumn} AS code,${titleColumn} AS title,${subtitleColumn} AS subtitle FROM ${table} WHERE tenant_id=? AND (COALESCE(${codeColumn},'') LIKE ? ESCAPE '\\' OR COALESCE(${titleColumn},'') LIKE ? ESCAPE '\\' OR COALESCE(${subtitleColumn},'') LIKE ? ESCAPE '\\') ORDER BY updated_at DESC LIMIT 6`;
    for (const row of await all(env.DB.prepare(sql).bind(tenant, like, like, like))) data.push({ ...decodeRow(row), module });
  }
  return json({ data: data.slice(0, 30) });
}

function transitionConditions(target, facts) {
  const condition = (id, label, passed, severity, module, message = label) => ({ id, label, passed: Boolean(passed), severity, module, message });
  const rules = {
    discovery: [condition("customer", "Müşteri bağlantısı tanımlı", facts.has_customer, "warning", "projects", "Projeye müşteri bağlanması önerilir.")],
    estimating: [condition("survey", "Onaylı keşif ve metraj mevcut", facts.survey_approved > 0, "blocker", "siteSurveys")],
    offered: [condition("offer", "Müşteriye sunulmuş teklif mevcut", facts.offer_presented > 0, "blocker", "offers")],
    contracted: [condition("accepted_offer", "Kabul edilmiş teklif mevcut", facts.offer_accepted > 0 || facts.contract_signed > 0, "blocker", "offers"), condition("signed_contract", "İmzalı sözleşme mevcut", facts.contract_signed > 0, "warning", "contracts")],
    design: [condition("contract", "İmzalı veya aktif sözleşme mevcut", facts.contract_signed > 0, "blocker", "contracts"), condition("payment_plan", "Ödeme planı tanımlı", facts.payment_plan_ready > 0, "warning", "contracts")],
    procurement: [condition("approved_design", "Onaylı tasarım revizyonu mevcut", facts.design_approved > 0, "blocker", "designRevisions"), condition("work_items", "Ürün ve iş kalemleri tanımlı", facts.work_item_total > 0, "blocker", "workItems")],
    production: [condition("approved_design", "Güncel tasarım onaylı", facts.design_approved > 0, "blocker", "designRevisions"), condition("work_items", "Üretilecek iş kalemleri hazır", facts.work_item_total > 0, "blocker", "workItems"), condition("material_plan", "Malzeme ihtiyaç planı hazır", facts.material_requirement_total > 0, "warning", "materialRequirements"), condition("material_shortage", "Tüm malzemeler stoktan ayrıldı veya siparişe bağlandı", facts.material_shortage_count === 0, "blocker", "materialRequirements"), condition("purchase_approvals", "Bekleyen satın alma onayı yok", facts.purchase_pending === 0, "warning", "purchases"), condition("capacity", "Ekip ve iş merkezi kapasite çakışması yok", facts.capacity_conflict_count === 0, "warning", "resourceAssignments")],
    installation: [condition("production_complete", "Üretim emirleri tamamlandı", facts.production_total > 0 && facts.production_done === facts.production_total, "blocker", "production"), condition("quality_pass", "Final kalite kontrolü geçti", facts.final_quality_pass > 0, "blocker", "qualityInspections")],
    acceptance: [condition("installation_complete", "Montaj tamamlandı", facts.installation_total > 0 && facts.installation_done === facts.installation_total, "blocker", "installations")],
    completed: [condition("handover", "Müşteri teslimi kabul etti", facts.handover_accepted > 0, "blocker", "handovers"), condition("punch", "Açık teslim eksiği yok", facts.open_punch_items === 0, "blocker", "handoverPunchItems")],
  };
  return rules[target] || [];
}

async function projectCommandCenterData(env, principal, project) {
  const tenant = principal.tenantId;
  const projectId = project.id;
  const facts = decodeRow(await one(env.DB.prepare(`SELECT
    CASE WHEN ? IS NULL OR ?='' THEN 0 ELSE 1 END AS has_customer,
    (SELECT COUNT(*) FROM site_surveys WHERE tenant_id=? AND project_id=? AND status='approved') AS survey_approved,
    (SELECT COUNT(*) FROM offers WHERE tenant_id=? AND project_id=? AND status IN ('sent','accepted')) AS offer_presented,
    (SELECT COUNT(*) FROM offers WHERE tenant_id=? AND project_id=? AND status='accepted') AS offer_accepted,
    (SELECT COUNT(*) FROM contracts WHERE tenant_id=? AND project_id=? AND status IN ('signed','active','completed')) AS contract_signed,
    (SELECT COUNT(*) FROM contracts WHERE tenant_id=? AND project_id=? AND status IN ('signed','active','completed') AND payment_schedule_json NOT IN ('','[]','{}')) AS payment_plan_ready,
    (SELECT COUNT(*) FROM design_revisions WHERE tenant_id=? AND project_id=? AND status='approved') AS design_approved,
    (SELECT COUNT(*) FROM work_items WHERE tenant_id=? AND project_id=?) AS work_item_total,
    (SELECT COUNT(*) FROM purchase_requests WHERE tenant_id=? AND project_id=? AND status='pending') AS purchase_pending,
    (SELECT COUNT(*) FROM production_orders WHERE tenant_id=? AND project_id=? AND status<>'cancelled') AS production_total,
    (SELECT COUNT(*) FROM production_orders WHERE tenant_id=? AND project_id=? AND status='completed') AS production_done,
    (SELECT COUNT(*) FROM quality_inspections WHERE tenant_id=? AND project_id=? AND inspection_type='final' AND result='pass' AND status IN ('completed','closed')) AS final_quality_pass,
    (SELECT COUNT(*) FROM installations WHERE tenant_id=? AND project_id=? AND status<>'cancelled') AS installation_total,
    (SELECT COUNT(*) FROM installations WHERE tenant_id=? AND project_id=? AND status='completed') AS installation_done,
    (SELECT COUNT(*) FROM handovers WHERE tenant_id=? AND project_id=? AND status IN ('accepted','closed')) AS handover_accepted,
    (SELECT COUNT(*) FROM handover_punch_items hpi JOIN handovers h ON h.id=hpi.handover_id AND h.tenant_id=hpi.tenant_id WHERE hpi.tenant_id=? AND h.project_id=? AND hpi.status IN ('open','in_progress','resolved')) AS open_punch_items,
    (SELECT COUNT(*) FROM project_tasks WHERE tenant_id=? AND project_id=? AND status IN ('todo','in_progress','blocked')) AS open_tasks,
    (SELECT COUNT(*) FROM project_tasks WHERE tenant_id=? AND project_id=? AND status IN ('todo','in_progress','blocked') AND planned_end IS NOT NULL AND planned_end<date('now')) AS overdue_tasks,
    (SELECT COUNT(*) FROM files WHERE tenant_id=? AND entity_type='projects' AND entity_id=?) AS file_total,
    (SELECT COALESCE(SUM(CASE WHEN type='income' AND status IN ('approved','collected','paid') THEN amount_minor ELSE 0 END),0) FROM financial_transactions WHERE tenant_id=? AND project_id=?) AS income_minor,
    (SELECT COALESCE(SUM(CASE WHEN type='expense' AND status IN ('approved','paid') THEN amount_minor ELSE 0 END),0) FROM financial_transactions WHERE tenant_id=? AND project_id=?) AS expense_minor,
    (SELECT COALESCE(SUM(grand_total_minor),0) FROM purchase_orders WHERE tenant_id=? AND project_id=? AND status NOT IN ('draft','cancelled')) AS committed_purchase_minor,
    (SELECT COALESCE(SUM(po.grand_total_minor),0) FROM purchase_orders po WHERE po.tenant_id=? AND po.project_id=? AND po.status NOT IN ('draft','cancelled')
      AND EXISTS (SELECT 1 FROM financial_transactions ft WHERE ft.tenant_id=po.tenant_id AND ft.project_id=po.project_id AND ft.type='expense' AND ft.status IN ('approved','paid') AND ft.supplier_id=po.supplier_id AND (ft.reference=po.order_number OR ft.reference=po.id))) AS invoiced_purchase_minor,
    (SELECT COUNT(*) FROM project_communications WHERE tenant_id=? AND project_id=?) AS communication_total,
    (SELECT COUNT(*) FROM project_communications WHERE tenant_id=? AND project_id=? AND status IN ('open','follow_up') AND next_follow_up_at IS NOT NULL) AS pending_follow_ups,
    (SELECT COUNT(*) FROM resource_assignments WHERE tenant_id=? AND project_id=? AND status IN ('planned','confirmed','active')) AS assignment_total,
    (SELECT COALESCE(SUM(allocation_percent),0) FROM resource_assignments WHERE tenant_id=? AND project_id=? AND status IN ('planned','confirmed','active') AND planned_start<=date('now') AND planned_end>=date('now')) AS active_allocation_percent
  `).bind(project.customer_id, project.customer_id,
    tenant, projectId, tenant, projectId, tenant, projectId, tenant, projectId, tenant, projectId,
    tenant, projectId, tenant, projectId, tenant, projectId, tenant, projectId, tenant, projectId,
    tenant, projectId, tenant, projectId, tenant, projectId, tenant, projectId, tenant, projectId,
    tenant, projectId, tenant, projectId, tenant, projectId, tenant, projectId, tenant, projectId,
    tenant, projectId, tenant, projectId, tenant, projectId, tenant, projectId, tenant, projectId, tenant, projectId)));
  const materialFacts = await one(env.DB.prepare(`SELECT
    COUNT(*) AS material_requirement_total,
    COALESCE(SUM(required_quantity),0) AS material_required_quantity,
    COALESCE(SUM(reserved_quantity),0) AS material_reserved_quantity,
    COALESCE(SUM(ordered_quantity),0) AS material_ordered_quantity,
    COALESCE(SUM(CASE WHEN required_quantity>reserved_quantity+ordered_quantity THEN 1 ELSE 0 END),0) AS material_shortage_count
    FROM material_requirements WHERE tenant_id=? AND project_id=? AND status NOT IN ('cancelled','consumed')`).bind(tenant, projectId));
  // İkili karşılaştırma yerine çakışan pencerelerdeki toplam yük; üç ayrı %40'lık
  // atama gibi durumlar önceden gözden kaçıyordu.
  const capacityFacts = await one(env.DB.prepare(`SELECT COUNT(*) AS capacity_conflict_count FROM (
    SELECT DISTINCT COALESCE(a.employee_id, a.resource_type || '|' || a.resource_name) AS resource_key
    FROM resource_assignments a
    WHERE a.tenant_id=? AND a.status IN ('planned','confirmed','active')
      AND (SELECT COALESCE(SUM(b.allocation_percent),0) FROM resource_assignments b
           WHERE b.tenant_id=a.tenant_id AND b.status IN ('planned','confirmed','active')
             AND b.planned_start<=a.planned_end AND b.planned_end>=a.planned_start
             AND ((a.employee_id IS NOT NULL AND b.employee_id=a.employee_id)
               OR (a.employee_id IS NULL AND b.employee_id IS NULL AND b.resource_type=a.resource_type AND b.resource_name=a.resource_name))) > 100
      AND (a.project_id=? OR EXISTS (SELECT 1 FROM resource_assignments c
           WHERE c.tenant_id=a.tenant_id AND c.project_id=? AND c.status IN ('planned','confirmed','active')
             AND c.planned_start<=a.planned_end AND c.planned_end>=a.planned_start
             AND ((a.employee_id IS NOT NULL AND c.employee_id=a.employee_id)
               OR (a.employee_id IS NULL AND c.employee_id IS NULL AND c.resource_type=a.resource_type AND c.resource_name=a.resource_name))))
  )`).bind(tenant, projectId, projectId));
  const mediaFacts = await one(env.DB.prepare(`SELECT COUNT(*) AS file_total,
    COALESCE(SUM(CASE WHEN content_type LIKE 'image/%' THEN 1 ELSE 0 END),0) AS photo_total
    FROM files WHERE tenant_id=? AND (project_id=? OR (entity_type='projects' AND entity_id=?))`).bind(tenant, projectId, projectId));
  const recentMedia = (await all(env.DB.prepare(`SELECT id,file_name,content_type,category,space_name,capture_stage,taken_at,visibility,description,created_at
    FROM files WHERE tenant_id=? AND (project_id=? OR (entity_type='projects' AND entity_id=?))
    ORDER BY COALESCE(taken_at,created_at) DESC LIMIT 8`).bind(tenant, projectId, projectId))).map(decodeRow);
  const combinedFacts = { ...(facts || {}), ...(materialFacts || {}), ...(capacityFacts || {}), ...(mediaFacts || {}) };
  const normalizedFacts = Object.fromEntries(Object.entries(combinedFacts).map(([key, value]) => [key, typeof value === "number" ? value : Number(value || 0)]));
  const currentIndex = projectStageDefinitions.findIndex(([status]) => status === project.status);
  const stages = projectStageDefinitions.map(([status, label], index) => {
    const checks = transitionConditions(status, normalizedFacts);
    const passed = checks.filter((item) => item.passed).length;
    return { status, label, state: status === project.status ? "current" : index < currentIndex ? "complete" : "upcoming", score: checks.length ? Math.round((passed / checks.length) * 100) : index <= currentIndex ? 100 : 0, checks };
  });
  const nextStatus = projectPrimaryNext[project.status] || null;
  const nextChecks = transitionConditions(nextStatus, normalizedFacts);
  const blockers = nextChecks.filter((item) => !item.passed && item.severity === "blocker");
  const warnings = nextChecks.filter((item) => !item.passed && item.severity === "warning");
  const readiness = nextChecks.length ? Math.round((nextChecks.filter((item) => item.passed).length / nextChecks.length) * 100) : project.status === "completed" ? 100 : 0;
  const contractValue = Number(project.contract_amount_minor || 0);
  // Gerçekleşen maliyet finans hareketlerinden gelir. Satın alma siparişleri ayrı
  // bir "taahhüt" kalemidir; faturası kesilmiş siparişler zaten gider hareketi
  // olarak göründüğü için taahhüde ikinci kez eklenmez.
  const actualCost = Math.abs(Number(normalizedFacts.expense_minor || 0));
  const openCommitment = Math.max(0, Number(normalizedFacts.committed_purchase_minor || 0) - Number(normalizedFacts.invoiced_purchase_minor || 0));
  const forecastCost = actualCost + openCommitment;
  const nextActions = [...blockers, ...warnings].map((item) => ({ title: item.message, module: item.module, priority: item.severity === "blocker" ? "high" : "normal" }));
  if (!nextActions.length && nextStatus) nextActions.push({ title: `${projectStageDefinitions.find(([status]) => status === nextStatus)?.[1] || nextStatus} aşamasına geçmeye hazır`, module: "projects", priority: "normal" });
  return {
    project: serializeRow(project, "projects", principal), stages, nextStatus, readiness, blockers, warnings, nextActions, recentMedia,
    facts: normalizedFacts,
    finance: {
      contractValueMinor: contractValue,
      actualCostMinor: actualCost,
      openCommitmentMinor: openCommitment,
      forecastCostMinor: forecastCost,
      estimatedProfitMinor: contractValue - forecastCost,
      realisedProfitMinor: contractValue - actualCost,
      marginPercent: contractValue ? Math.round(((contractValue - forecastCost) / contractValue) * 1000) / 10 : null,
    },
  };
}

// Mahal ve iş kalemi seviyesinde maliyet kırılımı.
//
// Dört kolon ayrı tutulur ve asla toplanmaz:
//   bütçe      = iş kalemi birim maliyeti × miktar (teklif anındaki hedef)
//   gerçekleşen = onaylı/ödenmiş gider hareketleri + kesinleşmiş stok çıkışları
//   taahhüt     = açık satın alma siparişleri (faturası kesilmemiş kısım)
//   kalan tahmin = bütçeden henüz harcanmamış kısım
// Bitiş tahmini (EAC) = gerçekleşen + taahhüt + kalan tahmin.
async function getProjectCostBreakdown(request, env, principal, projectId) {
  if (!allowed(principal, "projects.read")) return problem(403, "forbidden", "Proje maliyetini görüntüleme yetkiniz yok.");
  if (!allowed(principal, "cost.view")) return problem(403, "forbidden", "Maliyet kırılımı için cost.view yetkisi gereklidir.");
  const project = await workflowRow(env, principal, "projects", projectId);
  if (!project) return problem(404, "not_found", "Proje bulunamadı.");
  const tenant = principal.tenantId;

  const items = await all(env.DB.prepare(`SELECT wi.id, wi.space_name, wi.item_code, wi.description, wi.product_type,
      COALESCE(wi.quantity,0) AS quantity, COALESCE(wi.unit_cost_minor,0) AS unit_cost_minor, COALESCE(wi.unit_price_minor,0) AS unit_price_minor,
      wi.status, wi.revision_no,
      (SELECT COALESCE(SUM(ft.amount_minor),0) FROM financial_transactions ft
        WHERE ft.tenant_id=wi.tenant_id AND ft.work_item_id=wi.id AND ft.type='expense' AND ft.status IN ('approved','paid')) AS expense_minor,
      (SELECT COALESCE(SUM(sm.total_cost_minor),0) FROM stock_movements sm
        WHERE sm.tenant_id=wi.tenant_id AND sm.work_item_id=wi.id AND sm.status='posted' AND sm.movement_type IN ('issue','project_issue','adjustment_out')) AS stock_cost_minor,
      (SELECT COALESCE(SUM(po.grand_total_minor),0) FROM purchase_orders po
        WHERE po.tenant_id=wi.tenant_id AND po.work_item_id=wi.id AND po.status NOT IN ('draft','cancelled')) AS committed_minor,
      (SELECT COALESCE(SUM(pi.cost_impact_minor),0) FROM production_issues pi
        WHERE pi.tenant_id=wi.tenant_id AND pi.work_item_id=wi.id AND pi.status='resolved') AS issue_cost_minor,
      (SELECT COALESCE(SUM(pi.rework_quantity),0) FROM production_issues pi
        WHERE pi.tenant_id=wi.tenant_id AND pi.work_item_id=wi.id AND pi.status='resolved') AS rework_quantity,
      (SELECT COALESCE(SUM(bl.quantity_per_unit*(1+bl.scrap_rate/100.0)*COALESCE(wi.quantity,0)*bl.unit_cost_minor),0) FROM bom_lines bl
        WHERE bl.tenant_id=wi.tenant_id AND bl.work_item_id=wi.id) AS bom_cost_minor
    FROM work_items wi WHERE wi.tenant_id=? AND wi.project_id=? ORDER BY COALESCE(wi.space_name,''), wi.item_code, wi.created_at`).bind(tenant, projectId));

  const rows = items.map((row) => {
    const quantity = Number(row.quantity || 0);
    const bomCost = Number(row.bom_cost_minor || 0);
    // Reçete varsa bütçe reçeteden, yoksa iş kalemi birim maliyetinden gelir.
    const budget = bomCost > 0 ? Math.round(bomCost) : Math.round(Number(row.unit_cost_minor || 0) * quantity);
    const actual = Math.abs(Number(row.expense_minor || 0)) + Math.abs(Number(row.stock_cost_minor || 0)) + Math.abs(Number(row.issue_cost_minor || 0));
    const committed = Number(row.committed_minor || 0);
    const remaining = Math.max(0, budget - actual - committed);
    const forecast = actual + committed + remaining;
    const revenue = Math.round(Number(row.unit_price_minor || 0) * quantity);
    return {
      id: row.id,
      space_name: row.space_name || "Belirtilmemiş",
      item_code: row.item_code,
      description: row.description,
      product_type: row.product_type,
      status: row.status,
      revision_no: row.revision_no,
      quantity,
      rework_quantity: Number(row.rework_quantity || 0),
      revenue_minor: revenue,
      budget_cost_minor: budget,
      actual_cost_minor: actual,
      committed_cost_minor: committed,
      remaining_cost_minor: remaining,
      forecast_cost_minor: forecast,
      issue_cost_minor: Math.abs(Number(row.issue_cost_minor || 0)),
      variance_minor: budget - forecast,
      forecast_margin_minor: revenue - forecast,
      margin_percent: revenue ? Math.round(((revenue - forecast) / revenue) * 1000) / 10 : null,
      over_budget: budget > 0 && forecast > budget,
    };
  });

  const sum = (list, key) => list.reduce((total, item) => total + Number(item[key] || 0), 0);
  const spaces = [...new Map(rows.map((row) => [row.space_name, row.space_name])).keys()].map((space) => {
    const spaceRows = rows.filter((row) => row.space_name === space);
    const revenue = sum(spaceRows, "revenue_minor");
    const forecast = sum(spaceRows, "forecast_cost_minor");
    return {
      space_name: space,
      work_item_count: spaceRows.length,
      revenue_minor: revenue,
      budget_cost_minor: sum(spaceRows, "budget_cost_minor"),
      actual_cost_minor: sum(spaceRows, "actual_cost_minor"),
      committed_cost_minor: sum(spaceRows, "committed_cost_minor"),
      remaining_cost_minor: sum(spaceRows, "remaining_cost_minor"),
      forecast_cost_minor: forecast,
      forecast_margin_minor: revenue - forecast,
      margin_percent: revenue ? Math.round(((revenue - forecast) / revenue) * 1000) / 10 : null,
      over_budget_items: spaceRows.filter((row) => row.over_budget).length,
    };
  });

  // İş kalemine bağlanmamış proje giderleri kırılımda kaybolmamalıdır.
  const unassigned = await one(env.DB.prepare(`SELECT
      (SELECT COALESCE(SUM(amount_minor),0) FROM financial_transactions WHERE tenant_id=? AND project_id=? AND work_item_id IS NULL AND type='expense' AND status IN ('approved','paid')) AS expense_minor,
      (SELECT COALESCE(SUM(grand_total_minor),0) FROM purchase_orders WHERE tenant_id=? AND project_id=? AND work_item_id IS NULL AND status NOT IN ('draft','cancelled')) AS committed_minor`)
    .bind(tenant, projectId, tenant, projectId));

  const contractValue = Number(project.contract_amount_minor || 0);
  const totalActual = sum(rows, "actual_cost_minor") + Math.abs(Number(unassigned?.expense_minor || 0));
  const totalCommitted = sum(rows, "committed_cost_minor") + Number(unassigned?.committed_minor || 0);
  const totalRemaining = sum(rows, "remaining_cost_minor");
  const totalForecast = totalActual + totalCommitted + totalRemaining;

  return json({
    data: {
      project: serializeRow(project, "projects", principal),
      spaces,
      workItems: rows,
      unassigned: {
        actual_cost_minor: Math.abs(Number(unassigned?.expense_minor || 0)),
        committed_cost_minor: Number(unassigned?.committed_minor || 0),
      },
      totals: {
        contract_value_minor: contractValue,
        planned_revenue_minor: sum(rows, "revenue_minor"),
        budget_cost_minor: sum(rows, "budget_cost_minor"),
        actual_cost_minor: totalActual,
        committed_cost_minor: totalCommitted,
        remaining_cost_minor: totalRemaining,
        forecast_cost_minor: totalForecast,
        forecast_margin_minor: contractValue - totalForecast,
        margin_percent: contractValue ? Math.round(((contractValue - totalForecast) / contractValue) * 1000) / 10 : null,
        issue_cost_minor: sum(rows, "issue_cost_minor"),
      },
    },
    meta: { work_item_count: rows.length, space_count: spaces.length, over_budget_items: rows.filter((row) => row.over_budget).length },
  });
}

async function getProjectCommandCenter(env, principal, projectId) {
  if (!allowed(principal, "projects.read")) return problem(403, "forbidden", "Proje komuta merkezini görüntüleme yetkiniz yok.");
  const project = await workflowRow(env, principal, "projects", projectId);
  if (!project) return problem(404, "not_found", "Proje bulunamadı.");
  return json({ data: await projectCommandCenterData(env, principal, project) });
}

async function listResource(request, env, principal, slug, config) {
  if (!allowed(principal, permissionFor(slug, "read"))) return problem(403, "forbidden", "Bu kayıtları görüntüleme yetkiniz yok.");
  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") || "25", 10) || 25));
  const clauses = ["tenant_id=?"];
  const bindings = [principal.tenantId];
  for (const field of config.filters || []) {
    const value = url.searchParams.get(field);
    if (value !== null && value !== "") { clauses.push(`${field}=?`); bindings.push(value); }
  }
  const q = url.searchParams.get("q")?.trim();
  if (q && config.search?.length) {
    clauses.push(`(${config.search.map((field) => `COALESCE(${field},'') LIKE ? ESCAPE '\\'`).join(" OR ")})`);
    const like = `%${escapeLike(q)}%`;
    for (let index = 0; index < config.search.length; index += 1) bindings.push(like);
  }
  const where = clauses.join(" AND ");
  const totalRow = await one(env.DB.prepare(`SELECT COUNT(*) AS total FROM ${config.table} WHERE ${where}`).bind(...bindings));
  const rows = await all(env.DB.prepare(`SELECT * FROM ${config.table} WHERE ${where} ORDER BY ${config.table === "audit_logs" ? "created_at" : "updated_at"} DESC LIMIT ? OFFSET ?`).bind(...bindings, pageSize, (page - 1) * pageSize));
  const serialized = rows.map((row) => serializeRow(row, slug, principal));
  if (slug === "memberships" && rows.length) {
    // Satır başına sorgu yerine tek geçişte tüm rolleri çekiyoruz.
    const placeholders = rows.map(() => "?").join(",");
    const roleRows = await all(env.DB.prepare(`SELECT mr.membership_id,r.id,r.code,r.name FROM membership_roles mr JOIN roles r ON r.id=mr.role_id AND r.tenant_id=mr.tenant_id WHERE mr.tenant_id=? AND mr.membership_id IN (${placeholders}) ORDER BY r.name`).bind(principal.tenantId, ...rows.map((row) => row.id)));
    const fallbackRoles = await all(env.DB.prepare(`SELECT id,code,name FROM roles WHERE tenant_id=? AND id IN (${rows.map(() => "?").join(",")})`).bind(principal.tenantId, ...rows.map((row) => row.role_id)));
    const byMembership = new Map();
    for (const row of roleRows) {
      if (!byMembership.has(row.membership_id)) byMembership.set(row.membership_id, []);
      byMembership.get(row.membership_id).push(row);
    }
    const fallbackById = new Map(fallbackRoles.map((role) => [role.id, role]));
    // Ekip listesinde ham kullanıcı kimliği yerine ad ve e-posta gösterilebilsin.
    const userRows = await all(env.DB.prepare(`SELECT id,full_name,email FROM users WHERE id IN (${rows.map(() => "?").join(",")})`).bind(...rows.map((row) => row.user_id)));
    const userById = new Map(userRows.map((user) => [user.id, user]));
    for (let index = 0; index < rows.length; index += 1) {
      const roles = byMembership.get(rows[index].id) || [fallbackById.get(rows[index].role_id)].filter(Boolean);
      serialized[index].role_ids = roles.map((role) => role.id);
      serialized[index].role_names = roles.map((role) => role.name).join(", ");
      const user = userById.get(rows[index].user_id);
      serialized[index].user_name = user?.full_name || null;
      serialized[index].user_email = user?.email || null;
    }
  }
  return json({ data: serialized, meta: { page, pageSize, total: Number(totalRow?.total || 0) } });
}

async function getResource(env, principal, slug, config, resourceId) {
  if (!allowed(principal, permissionFor(slug, "read"))) return problem(403, "forbidden", "Bu kaydı görüntüleme yetkiniz yok.");
  let row = await one(env.DB.prepare(`SELECT * FROM ${config.table} WHERE id=? AND tenant_id=?`).bind(resourceId, principal.tenantId));
  // Üyelik seçicileri kullanıcı kimliğiyle de aranabilmelidir.
  if (!row && slug === "memberships") row = await one(env.DB.prepare("SELECT * FROM memberships WHERE user_id=? AND tenant_id=?").bind(resourceId, principal.tenantId));
  if (!row) return problem(404, "not_found", "Kayıt bulunamadı.");
  const serialized = serializeRow(row, slug, principal);
  if (slug === "memberships") {
    const user = await one(env.DB.prepare("SELECT full_name,email FROM users WHERE id=?").bind(row.user_id));
    serialized.user_name = user?.full_name || null;
    serialized.user_email = user?.email || null;
  }
  return json({ data: serialized });
}

async function createResource(request, env, principal, slug, config) {
  if (config.readOnly) return problem(405, "read_only", "Bu kaynak salt okunurdur.");
  if (!allowed(principal, permissionFor(slug, "write"))) return problem(403, "forbidden", "Kayıt ekleme yetkiniz yok.");
  let body;
  try { body = await parseBody(request); } catch (response) { return problem(response.status, "invalid_body", response.status === 415 ? "Content-Type application/json olmalıdır." : "Geçersiz JSON."); }
  const sensitiveError = sensitiveWriteProblem(principal, body);
  if (sensitiveError) return sensitiveError;
  if (["invoices", "financial-transactions"].includes(slug) && body.official === undefined && !allowed(principal, "finance.sensitive.read")) body = { ...body, official: false };
  const allowedInitialStatuses = {
    offers: new Set([undefined, "draft", "sent", "pending"]),
    projects: new Set([undefined, "lead"]),
    "production-orders": new Set([undefined, "draft", "planned"]),
    "purchase-requests": new Set([undefined, "draft", "pending"]),
    "purchase-orders": new Set([undefined, "draft"]),
    "material-requirements": new Set([undefined, "draft"]),
    "supplier-quotations": new Set([undefined, "draft", "received"]),
    "production-operations": new Set([undefined, "pending"]),
    "production-issues": new Set([undefined, "open"]),
    leaves: new Set([undefined, "pending"]),
    "financial-transactions": new Set([undefined, "draft", "planned", "pending"]),
    "site-surveys": new Set([undefined, "draft"]),
    contracts: new Set([undefined, "draft"]),
    "design-revisions": new Set([undefined, "draft"]),
    "progress-payments": new Set([undefined, "draft"]),
    "stock-movements": new Set([undefined, "draft"]),
    "project-meetings": new Set([undefined, "draft"]),
    "quality-inspections": new Set([undefined, "draft"]),
    handovers: new Set([undefined, "draft"]),
  };
  if (allowedInitialStatuses[slug] && !allowedInitialStatuses[slug].has(body.status)) return problem(409, "workflow_endpoint_required", "Bu başlangıç durumu yalnız ilgili iş akışı endpoint'i ile oluşturulabilir.");
  const normalized = normalizeInput(slug, config, body, true);
  if (normalized.error) return problem(422, "validation_error", normalized.error);
  const referenceError = await validateReferences(env, principal, config, normalized.values);
  if (referenceError) return problem(422, "cross_tenant_reference", referenceError);
  if (slug === "memberships") {
    const roleProblem = await privilegedRoleProblem(env, principal, [normalized.values.role_id]);
    if (roleProblem) return roleProblem;
  }
  if (slug === "roles" && !principal.isOwner && ownerRoles.has(normalized.values.code)) {
    return problem(403, "privileged_role_forbidden", "owner veya admin kodlu rolü yalnızca firma sahibi oluşturabilir.");
  }
  if (slug === "survey-measurements") {
    const survey = await workflowRow(env, principal, "site_surveys", normalized.values.site_survey_id);
    if (!survey || ["approved", "cancelled"].includes(survey.status)) return problem(409, "survey_locked", "Onaylı veya iptal edilmiş keşfin metrajı değiştirilemez.");
  }
  if (slug === "progress-payments") {
    const contract = await workflowRow(env, principal, "contracts", normalized.values.contract_id);
    if (!contract || contract.project_id !== normalized.values.project_id || !["signed", "active"].includes(contract.status)) return problem(422, "contract_not_eligible", "Hakediş için aynı projeye ait imzalı veya aktif sözleşme zorunludur.");
  }
  if (slug === "meeting-actions") {
    const meeting = await workflowRow(env, principal, "project_meetings", normalized.values.meeting_id);
    if (!meeting || meeting.status === "closed") return problem(409, "meeting_closed", "Kapatılmış toplantıya aksiyon eklenemez.");
  }
  if (slug === "handover-punch-items") {
    const handover = await workflowRow(env, principal, "handovers", normalized.values.handover_id);
    if (!handover || ["accepted", "closed"].includes(handover.status)) return problem(409, "handover_locked", "Kabul edilmiş teslime eksik kalemi eklenemez.");
  }
  const resourceId = id(`${config.table.slice(0, 3)}_`);
  const timestamp = now();
  // Sunucunun doldurduğu, istemcinin gönderemeyeceği alanlar.
  for (const [column, value] of Object.entries(config.serverDefaults?.(principal, timestamp) || {})) {
    if (normalized.values[column] === undefined) normalized.values[column] = value;
  }
  const fields = Object.keys(normalized.values);
  const columns = ["id", "tenant_id", ...fields, "created_at", ...(config.table === "audit_logs" ? [] : ["updated_at"] )];
  const values = [resourceId, principal.tenantId, ...fields.map((field) => normalized.values[field]), timestamp, ...(config.table === "audit_logs" ? [] : [timestamp])];
  try {
    await run(env.DB.prepare(`INSERT INTO ${config.table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`).bind(...values));
  } catch (error) {
    return problem(409, "constraint_error", "Kayıt oluşturulamadı; numara veya ilişkili kayıtları kontrol edin.", env.EXPOSE_ERRORS === "true" ? String(error) : undefined);
  }
  await audit(env, principal, request, "create", slug, resourceId, normalized.values);
  return getResource(env, principal, slug, config, resourceId);
}

async function updateResource(request, env, principal, slug, config, resourceId) {
  if (config.readOnly) return problem(405, "read_only", "Bu kaynak salt okunurdur.");
  if (!allowed(principal, permissionFor(slug, "write"))) return problem(403, "forbidden", "Kayıt düzenleme yetkiniz yok.");
  let body;
  try { body = await parseBody(request); } catch (response) { return problem(response.status, "invalid_body", response.status === 415 ? "Content-Type application/json olmalıdır." : "Geçersiz JSON."); }
  const sensitiveError = sensitiveWriteProblem(principal, body);
  if (sensitiveError) return sensitiveError;
  const normalized = normalizeInput(slug, config, body, false);
  if (normalized.error) return problem(422, "validation_error", normalized.error);
  const referenceError = await validateReferences(env, principal, config, normalized.values);
  if (referenceError) return problem(422, "cross_tenant_reference", referenceError);
  const existing = await one(env.DB.prepare(`SELECT * FROM ${config.table} WHERE id=? AND tenant_id=?`).bind(resourceId, principal.tenantId));
  if (!existing) return problem(404, "not_found", "Kayıt bulunamadı.");
  if (slug === "memberships") {
    const roleProblem = await privilegedRoleProblem(env, principal, [normalized.values.role_id, existing.role_id]);
    if (roleProblem) return roleProblem;
  }
  if (slug === "roles" && !principal.isOwner && (ownerRoles.has(normalized.values.code) || ownerRoles.has(existing.code))) {
    return problem(403, "privileged_role_forbidden", "owner veya admin kodlu rol yalnızca firma sahibi tarafından değiştirilebilir.");
  }
  if (workflowManagedResources.has(slug) && normalized.values.status !== undefined && normalized.values.status !== existing.status) return problem(409, "workflow_endpoint_required", "Durum değişikliği yalnız ilgili iş akışı endpoint'i üzerinden yapılabilir.");
  if (slug === "financial-transactions" && ["approved", "reversed"].includes(existing.status)) return problem(409, "approved_record_immutable", "Onaylı finans kaydı düzenlenemez; ters kayıt oluşturun.");
  const immutableDomainStates = {
    "site-surveys": ["approved", "cancelled"],
    contracts: ["signed", "active", "completed", "terminated", "cancelled"],
    "design-revisions": ["approved", "superseded"],
    "progress-payments": ["approved", "invoiced", "paid", "cancelled"],
    "stock-movements": ["posted", "cancelled"],
    "project-meetings": ["published", "closed"],
    "quality-inspections": ["completed", "closed"],
    handovers: ["accepted", "closed"],
  };
  if (immutableDomainStates[slug]?.includes(existing.status)) return problem(409, "workflow_record_immutable", "Kesinleşmiş iş akışı kaydı doğrudan düzenlenemez.");
  if (slug === "survey-measurements") {
    const surveyId = normalized.values.site_survey_id || existing.site_survey_id;
    const survey = await workflowRow(env, principal, "site_surveys", surveyId);
    if (!survey || ["approved", "cancelled"].includes(survey.status)) return problem(409, "survey_locked", "Onaylı veya iptal edilmiş keşfin metrajı değiştirilemez.");
  }
  if (slug === "meeting-actions") {
    const meeting = await workflowRow(env, principal, "project_meetings", normalized.values.meeting_id || existing.meeting_id);
    if (!meeting || meeting.status === "closed") return problem(409, "meeting_closed", "Kapatılmış toplantının aksiyonları değiştirilemez.");
  }
  if (slug === "handover-punch-items") {
    const handover = await workflowRow(env, principal, "handovers", normalized.values.handover_id || existing.handover_id);
    if (!handover || ["accepted", "closed"].includes(handover.status)) return problem(409, "handover_locked", "Kabul edilmiş teslimin eksik listesi değiştirilemez.");
  }
  if (slug === "work-items" && existing.revision_status === "approved" && Object.keys(normalized.values).length) {
    normalized.values.revision_no = Number(existing.revision_no || 1) + 1;
    normalized.values.revision_status = "draft";
    normalized.values.revision_approved_at = null;
    normalized.values.revision_approved_by = null;
  }
  const fields = Object.keys(normalized.values);
  if (!fields.length) return problem(422, "validation_error", "Güncellenecek alan bulunamadı.");
  const assignments = fields.map((field) => `${field}=?`);
  if (config.table !== "audit_logs") assignments.push("updated_at=?");
  const values = [...fields.map((field) => normalized.values[field]), ...(config.table === "audit_logs" ? [] : [now()]), resourceId, principal.tenantId];
  try { await run(env.DB.prepare(`UPDATE ${config.table} SET ${assignments.join(",")} WHERE id=? AND tenant_id=?`).bind(...values)); }
  catch (error) { return problem(409, "constraint_error", "Kayıt güncellenemedi.", env.EXPOSE_ERRORS === "true" ? String(error) : undefined); }
  await audit(env, principal, request, "update", slug, resourceId, normalized.values);
  return getResource(env, principal, slug, config, resourceId);
}

async function inviteMember(request, env, principal) {
  if (!allowed(principal, "memberships.write")) return problem(403, "forbidden", "Kullanıcı yönetme yetkiniz yok.");
  let body;
  try { body = await parseBody(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
  const roleIds = [...new Set((Array.isArray(body?.role_ids) ? body.role_ids : body?.role_id ? [body.role_id] : []).filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];
  if (!body?.email || !body?.phone || !body?.full_name || !roleIds.length) return problem(422, "validation_error", "E-posta, telefon, ad soyad ve en az bir rol zorunludur.");
  const passwordError = passwordProblem(body?.temporary_password, "Geçici şifre");
  if (passwordError) return problem(422, "weak_password", passwordError);
  const roles = [];
  for (const roleId of roleIds) {
    const role = await one(env.DB.prepare("SELECT id,code,name FROM roles WHERE id=? AND tenant_id=?").bind(roleId, principal.tenantId));
    if (!role) return problem(422, "cross_tenant_reference", "Seçilen rollerden biri bu firmaya ait değil.");
    roles.push(role);
  }
  const roleProblem = await privilegedRoleProblem(env, principal, roleIds);
  if (roleProblem) return roleProblem;
  const email = String(body.email).trim().toLowerCase();
  const phone = normalizeTurkishMobile(body.phone);
  if (!phone) return problem(422, "invalid_phone", "Türkiye cep telefonu numarasını kontrol edin.");
  const byEmail = await one(env.DB.prepare("SELECT id,email,full_name,phone,status FROM users WHERE email=? COLLATE NOCASE").bind(email));
  const byPhone = await one(env.DB.prepare("SELECT id,email,full_name,phone,status FROM users WHERE phone=?").bind(phone));
  if (byEmail && byPhone && byEmail.id !== byPhone.id) return problem(409, "identity_conflict", "E-posta ve telefon farklı kullanıcılarla eşleşiyor.");
  let user = byEmail || byPhone;
  const timestamp = now();
  const credential = await passwordRecord(env, body.temporary_password);
  try {
    if (!user) {
      user = { id: id("usr_"), email, full_name: body.full_name, phone, status: "invited" };
      await run(env.DB.prepare("INSERT INTO users (id,email,full_name,phone,status,password_hash,password_salt,password_iterations,password_changed_at,must_change_password,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,1,?,?)").bind(user.id, email, body.full_name, phone, "invited", credential.hash, credential.salt, credential.iterations, timestamp, timestamp, timestamp));
    } else {
      await run(env.DB.prepare("UPDATE users SET email=?,full_name=?,phone=?,password_hash=?,password_salt=?,password_iterations=?,password_changed_at=?,must_change_password=1,updated_at=? WHERE id=?").bind(email, body.full_name, phone, credential.hash, credential.salt, credential.iterations, timestamp, timestamp, user.id));
      user = { ...user, email, full_name: body.full_name, phone };
    }
  } catch { return problem(409, "identity_conflict", "E-posta veya telefon başka bir kullanıcı tarafından kullanılıyor."); }
  const membershipId = id("mem_");
  try {
    const statements = [env.DB.prepare("INSERT INTO memberships (id,tenant_id,user_id,role_id,title,status,created_at,updated_at) VALUES (?,?,?,?,?,'invited',?,?)").bind(membershipId, principal.tenantId, user.id, roleIds[0], body.title || null, timestamp, timestamp)];
    roleIds.forEach((roleId) => statements.push(env.DB.prepare("INSERT INTO membership_roles (tenant_id,membership_id,role_id,created_at) VALUES (?,?,?,?)").bind(principal.tenantId, membershipId, roleId, timestamp)));
    if (typeof env.DB.batch === "function") await env.DB.batch(statements);
    else for (const statement of statements) await run(statement);
  } catch { return problem(409, "membership_exists", "Bu kullanıcı firmaya daha önce eklenmiş."); }
  await audit(env, principal, request, "invite", "memberships", membershipId, { user_id: user.id, role_ids: roleIds });
  return json({ data: { id: membershipId, tenant_id: principal.tenantId, user, role_id: roleIds[0], role_ids: roleIds, roles, role_names: roles.map((role) => role.name).join(", "), title: body.title || null, status: "invited" } }, 201);
}

async function rolePermissions(request, env, principal, roleId) {
  if (!allowed(principal, "roles.manage")) return problem(403, "forbidden", "Rol yetkilerini yönetme izniniz yok.");
  const role = await one(env.DB.prepare("SELECT id,code,name FROM roles WHERE id=? AND tenant_id=?").bind(roleId, principal.tenantId));
  if (!role) return problem(404, "not_found", "Rol bulunamadı.");
  if (!principal.isOwner && ownerRoles.has(role.code) && request.method !== "GET") {
    return problem(403, "privileged_role_forbidden", "Firma sahibi rolünün yetkileri yalnızca firma sahibi tarafından değiştirilebilir.");
  }
  if (request.method === "GET") {
    const rows = await all(env.DB.prepare("SELECT permission_code FROM role_permissions WHERE tenant_id=? AND role_id=? ORDER BY permission_code").bind(principal.tenantId, roleId));
    return json({ data: { role, permissions: rows.map((row) => row.permission_code) } });
  }
  if (request.method !== "PUT") return problem(405, "method_not_allowed", "Bu HTTP yöntemi desteklenmiyor.");
  let body;
  try { body = await parseBody(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
  if (!Array.isArray(body?.permissions) || body.permissions.some((code) => typeof code !== "string")) return problem(422, "validation_error", "permissions bir metin dizisi olmalıdır.");
  const uniqueCodes = [...new Set(body.permissions)];
  if (uniqueCodes.length) {
    const placeholders = uniqueCodes.map(() => "?").join(",");
    const existing = await all(env.DB.prepare(`SELECT code FROM permissions WHERE code IN (${placeholders})`).bind(...uniqueCodes));
    if (existing.length !== uniqueCodes.length) return problem(422, "unknown_permission", "Bilinmeyen yetki kodu var.");
  }
  const statements = [env.DB.prepare("DELETE FROM role_permissions WHERE tenant_id=? AND role_id=?").bind(principal.tenantId, roleId)];
  for (const code of uniqueCodes) statements.push(env.DB.prepare("INSERT INTO role_permissions (tenant_id,role_id,permission_code) VALUES (?,?,?)").bind(principal.tenantId, roleId, code));
  if (typeof env.DB.batch === "function") await env.DB.batch(statements);
  else for (const statement of statements) await run(statement);
  await audit(env, principal, request, "permissions.update", "roles", roleId, { permissions: uniqueCodes });
  return json({ data: { role, permissions: uniqueCodes } });
}

function tokenExpiry(days = 90) {
  if (!Number.isInteger(days) || days < 1 || days > 365) return null;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function tokenManagement(request, env, principal, segments) {
  if (!principal.isOwner && !allowed(principal, "tokens.manage")) return problem(403, "forbidden", "API tokenı yönetme yetkiniz yok.");
  if (segments.length === 3 && request.method === "GET") {
    const rows = await all(env.DB.prepare("SELECT id,name,expires_at,last_used_at,revoked_at,created_at FROM api_tokens WHERE user_id=? ORDER BY created_at DESC").bind(principal.user.id));
    return json({ data: rows });
  }
  if (segments.length === 3 && request.method === "POST") {
    let body;
    try { body = await optionalJson(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
    const active = await one(env.DB.prepare("SELECT COUNT(*) AS count FROM api_tokens WHERE user_id=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?)").bind(principal.user.id, now()));
    if (Number(active?.count || 0) >= 10) return problem(409, "token_limit", "En fazla 10 aktif API tokenı kullanılabilir.");
    const expiresAt = tokenExpiry(body.expires_in_days === undefined ? 90 : Number(body.expires_in_days));
    if (!expiresAt) return problem(422, "validation_error", "expires_in_days 1 ile 365 arasında tam sayı olmalıdır.");
    const rawToken = rawApiToken();
    const tokenId = id("tok_");
    const name = String(body.name || "API Tokenı").trim().slice(0, 80);
    try {
      await commitWorkflow(env, principal, request, [env.DB.prepare("INSERT INTO api_tokens (id,user_id,name,token_hash,expires_at,created_at) VALUES (?,?,?,?,?,?)").bind(tokenId, principal.user.id, name, await sha256(rawToken), expiresAt, now())], "token.create", "api-tokens", tokenId, { name, expires_at: expiresAt });
    } catch (error) { return workflowCommitProblem(env, error); }
    return json({ data: { id: tokenId, name, token: rawToken, expires_at: expiresAt, created_at: now() }, meta: { secret_visible_once: true } }, 201);
  }
  if (segments.length === 5 && request.method === "POST" && ["rotate", "revoke"].includes(segments[4])) {
    const tokenId = segments[3];
    if (!validId(tokenId)) return problem(400, "invalid_id", "Geçersiz token kimliği.");
    const existing = await one(env.DB.prepare("SELECT id,name,expires_at,revoked_at,created_at FROM api_tokens WHERE id=? AND user_id=?").bind(tokenId, principal.user.id));
    if (!existing) return problem(404, "not_found", "API tokenı bulunamadı.");
    if (existing.revoked_at) return json({ data: existing, meta: { replayed: true } });
    const timestamp = now();
    if (segments[4] === "revoke") {
      try {
        await commitWorkflow(env, principal, request, [env.DB.prepare("UPDATE api_tokens SET revoked_at=? WHERE id=? AND user_id=? AND revoked_at IS NULL").bind(timestamp, tokenId, principal.user.id)], "token.revoke", "api-tokens", tokenId, {});
      } catch (error) { return workflowCommitProblem(env, error); }
      return json({ data: { ...existing, revoked_at: timestamp } });
    }
    let body;
    try { body = await optionalJson(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
    const expiresAt = tokenExpiry(body.expires_in_days === undefined ? 90 : Number(body.expires_in_days));
    if (!expiresAt) return problem(422, "validation_error", "expires_in_days 1 ile 365 arasında tam sayı olmalıdır.");
    const newRawToken = rawApiToken();
    const newTokenId = id("tok_");
    const name = String(body.name || `${existing.name} (yenilendi)`).trim().slice(0, 80);
    try {
      await commitWorkflow(env, principal, request, [
        env.DB.prepare("UPDATE api_tokens SET revoked_at=? WHERE id=? AND user_id=? AND revoked_at IS NULL").bind(timestamp, tokenId, principal.user.id),
        env.DB.prepare("INSERT INTO api_tokens (id,user_id,name,token_hash,expires_at,created_at) VALUES (?,?,?,?,?,?)").bind(newTokenId, principal.user.id, name, await sha256(newRawToken), expiresAt, timestamp),
      ], "token.rotate", "api-tokens", tokenId, { replacement_token_id: newTokenId, expires_at: expiresAt });
    } catch (error) { return workflowCommitProblem(env, error); }
    return json({ data: { id: newTokenId, name, token: newRawToken, expires_at: expiresAt, created_at: timestamp }, meta: { secret_visible_once: true, replaced_token_id: tokenId } }, 201);
  }
  return problem(405, "method_not_allowed", "Bu token işlemi desteklenmiyor.");
}

async function optionalJson(request) {
  if (!request.headers.get("content-type")) return {};
  return parseBody(request);
}

function phoneAuthReady(env) {
  return env.PHONE_AUTH_ENABLED === "true" && Boolean(twilioCredentials(env)) && String(env.PHONE_AUTH_PEPPER || "").length >= 16;
}

async function startPhoneAuth(request, env) {
  if (!phoneAuthReady(env)) return problem(503, "phone_auth_unavailable", "Telefonla giriş henüz yapılandırılmamış.");
  if (!sameOrigin(request, env)) return problem(403, "origin_forbidden", "Giriş isteğinin kaynağı geçersiz.");
  let body;
  try { body = await parseBody(request); } catch { return problem(400, "invalid_body", "Geçerli JSON gönderin."); }
  const phone = normalizeTurkishMobile(body?.phone);
  if (!phone) return problem(422, "invalid_phone", "Türkiye cep telefonu numarasını kontrol edin.");

  const timestamp = now();
  const retentionCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  await run(env.DB.prepare("DELETE FROM phone_auth_requests WHERE created_at<?").bind(retentionCutoff));
  await run(env.DB.prepare("DELETE FROM phone_sessions WHERE expires_at<? OR (revoked_at IS NOT NULL AND revoked_at<?)").bind(timestamp, retentionCutoff));
  const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const phoneHash = await authHash(env, phone);
  const ipHash = await authHash(env, clientIp(request) || "unknown");
  const [phoneRate, ipRate] = await Promise.all([
    one(env.DB.prepare("SELECT COUNT(*) AS count FROM phone_auth_requests WHERE phone_hash=? AND created_at>?").bind(phoneHash, windowStart)),
    one(env.DB.prepare("SELECT COUNT(*) AS count FROM phone_auth_requests WHERE ip_hash=? AND created_at>?").bind(ipHash, windowStart)),
  ]);
  if (Number(phoneRate?.count || 0) >= 5 || Number(ipRate?.count || 0) >= 20) {
    return problem(429, "rate_limited", "Çok fazla kod isteği yapıldı. Lütfen 10 dakika sonra tekrar deneyin.", { retry_after_seconds: 600 });
  }

  const challengeId = id("pha_");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const user = await one(env.DB.prepare("SELECT DISTINCT u.id FROM users u JOIN memberships m ON m.user_id=u.id JOIN tenants t ON t.id=m.tenant_id WHERE u.phone=? AND u.status IN ('active','invited') AND m.status IN ('active','invited') AND t.status='active' LIMIT 1").bind(phone));
  if (!user) {
    await run(env.DB.prepare("INSERT INTO phone_auth_requests (id,phone_hash,ip_hash,status,created_at,expires_at) VALUES (?,?,?,?,?,?)").bind(challengeId, phoneHash, ipHash, "suppressed", timestamp, expiresAt));
    return json({ data: { challenge_id: challengeId, expires_in_seconds: 600 } }, 202);
  }

  try {
    await twilioVerify(env, "Verifications", { To: phone, Channel: "sms", Locale: "tr", RiskCheck: "enable" });
    await run(env.DB.prepare("INSERT INTO phone_auth_requests (id,phone_hash,ip_hash,status,created_at,expires_at) VALUES (?,?,?,?,?,?)").bind(challengeId, phoneHash, ipHash, "pending", timestamp, expiresAt));
  } catch (error) {
    await run(env.DB.prepare("INSERT INTO phone_auth_requests (id,phone_hash,ip_hash,status,created_at,expires_at) VALUES (?,?,?,?,?,?)").bind(challengeId, phoneHash, ipHash, "failed", timestamp, expiresAt));
    console.error("Phone verification start failed", error);
    return problem(502, "sms_delivery_failed", "Doğrulama kodu gönderilemedi. Lütfen daha sonra tekrar deneyin.");
  }
  return json({ data: { challenge_id: challengeId, expires_in_seconds: 600 } }, 202);
}

async function verifyPhoneAuth(request, env) {
  if (!phoneAuthReady(env)) return problem(503, "phone_auth_unavailable", "Telefonla giriş henüz yapılandırılmamış.");
  if (!sameOrigin(request, env)) return problem(403, "origin_forbidden", "Giriş isteğinin kaynağı geçersiz.");
  let body;
  try { body = await parseBody(request); } catch { return problem(400, "invalid_body", "Geçerli JSON gönderin."); }
  const phone = normalizeTurkishMobile(body?.phone);
  const code = String(body?.code || "").replace(/\D/g, "");
  const challengeId = String(body?.challenge_id || "");
  if (!phone || !/^\d{4,10}$/.test(code) || !validId(challengeId)) return problem(422, "invalid_verification", "Telefon, doğrulama kodu veya oturum bilgisi geçersiz.");

  const phoneHash = await authHash(env, phone);
  const challenge = await one(env.DB.prepare("SELECT id,status,expires_at FROM phone_auth_requests WHERE id=? AND phone_hash=?").bind(challengeId, phoneHash));
  if (!challenge || challenge.status !== "pending" || challenge.expires_at <= now()) return problem(401, "verification_expired", "Doğrulama isteği geçersiz veya süresi dolmuş.");

  let verification;
  try { verification = await twilioVerify(env, "VerificationCheck", { To: phone, Code: code }); }
  catch (error) {
    console.error("Phone verification check failed", error);
    return problem(401, "verification_failed", "Doğrulama kodu geçersiz veya süresi dolmuş.");
  }
  if (verification.status !== "approved") {
    await run(env.DB.prepare("UPDATE phone_auth_requests SET status='rejected',verified_at=? WHERE id=? AND status='pending'").bind(now(), challengeId));
    return problem(401, "verification_failed", "Doğrulama kodu geçersiz veya süresi dolmuş.");
  }

  const user = await one(env.DB.prepare("SELECT DISTINCT u.id,u.email,u.full_name,u.phone,u.status FROM users u JOIN memberships m ON m.user_id=u.id JOIN tenants t ON t.id=m.tenant_id WHERE u.phone=? AND u.status IN ('active','invited') AND m.status IN ('active','invited') AND t.status='active' LIMIT 1").bind(phone));
  if (!user) return problem(403, "account_unavailable", "Bu telefon için aktif bir çalışma alanı üyeliği bulunamadı.");

  const timestamp = now();
  const rawToken = `cps_${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
  const tokenHash = await sha256(rawToken);
  const expiresAt = new Date(Date.now() + PHONE_SESSION_SECONDS * 1000).toISOString();
  const statements = [
    env.DB.prepare("UPDATE users SET status='active',updated_at=? WHERE id=? AND status='invited'").bind(timestamp, user.id),
    env.DB.prepare("UPDATE memberships SET status='active',updated_at=? WHERE user_id=? AND status='invited'").bind(timestamp, user.id),
    env.DB.prepare("UPDATE phone_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL AND id NOT IN (SELECT id FROM phone_sessions WHERE user_id=? AND revoked_at IS NULL AND expires_at>? ORDER BY last_seen_at DESC LIMIT ?)")
      .bind(timestamp, user.id, user.id, timestamp, PHONE_SESSION_MAX_PER_USER - 1),
    env.DB.prepare("INSERT INTO phone_sessions (id,user_id,token_hash,ip_hash,user_agent_hash,created_at,last_seen_at,expires_at) VALUES (?,?,?,?,?,?,?,?)")
      .bind(id("phs_"), user.id, tokenHash, await authHash(env, clientIp(request) || "unknown"), await authHash(env, request.headers.get("user-agent") || "unknown"), timestamp, timestamp, expiresAt),
    env.DB.prepare("UPDATE phone_auth_requests SET status='approved',verified_at=? WHERE id=? AND status='pending'").bind(timestamp, challengeId),
  ];
  if (typeof env.DB.batch === "function") await env.DB.batch(statements);
  else for (const statement of statements) await run(statement);
  return json({ data: { authenticated: true, expires_at: expiresAt } }, 200, { "set-cookie": phoneSessionCookie(rawToken) });
}

function passwordAuthReady(env) {
  return env.PASSWORD_AUTH_ENABLED === "true" && String(env.PASSWORD_AUTH_PEPPER || "").length >= 16;
}

async function loginWithPassword(request, env) {
  if (!passwordAuthReady(env)) return problem(503, "password_auth_unavailable", "Şifreyle giriş henüz yapılandırılmamış.");
  if (!sameOrigin(request, env)) return problem(403, "origin_forbidden", "Giriş isteğinin kaynağı geçersiz.");
  let body;
  try { body = await parseBody(request); } catch { return problem(400, "invalid_body", "Geçerli JSON gönderin."); }
  const phone = normalizeTurkishMobile(body?.phone);
  const password = body?.password;
  if (!phone || !validPassword(password)) return problem(422, "invalid_credentials", "Telefon numarası veya şifre geçersiz.");

  const timestamp = now();
  const retentionCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const phoneHash = await authHash(env, phone);
  const ipHash = await authHash(env, clientIp(request) || "unknown");
  await run(env.DB.prepare("DELETE FROM password_auth_attempts WHERE created_at<?").bind(retentionCutoff));
  await run(env.DB.prepare("DELETE FROM phone_sessions WHERE expires_at<? OR (revoked_at IS NOT NULL AND revoked_at<?)").bind(timestamp, retentionCutoff));
  const [phoneRate, ipRate] = await Promise.all([
    one(env.DB.prepare("SELECT COUNT(*) AS count FROM password_auth_attempts WHERE phone_hash=? AND created_at>?").bind(phoneHash, windowStart)),
    one(env.DB.prepare("SELECT COUNT(*) AS count FROM password_auth_attempts WHERE ip_hash=? AND created_at>?").bind(ipHash, windowStart)),
  ]);
  if (Number(phoneRate?.count || 0) >= 5 || Number(ipRate?.count || 0) >= 20) {
    return problem(429, "rate_limited", "Çok fazla giriş denemesi yapıldı. Lütfen 10 dakika sonra tekrar deneyin.", { retry_after_seconds: 600 });
  }

  const user = await one(env.DB.prepare("SELECT DISTINCT u.id,u.email,u.full_name,u.phone,u.status,u.password_hash,u.password_salt,u.password_iterations,u.must_change_password FROM users u JOIN memberships m ON m.user_id=u.id JOIN tenants t ON t.id=m.tenant_id WHERE u.phone=? AND u.status IN ('active','invited') AND m.status IN ('active','invited') AND t.status='active' LIMIT 1").bind(phone));
  const dummySalt = base64Bytes(new TextEncoder().encode("capproje-dummy!"));
  const calculated = await derivePasswordHash(env, password, user?.password_salt || dummySalt, Number(user?.password_iterations || PASSWORD_ITERATIONS));
  const authenticated = Boolean(user?.password_hash) && safeHashEqual(calculated, user.password_hash);
  if (!authenticated) {
    await run(env.DB.prepare("INSERT INTO password_auth_attempts (id,phone_hash,ip_hash,success,created_at) VALUES (?,?,?,?,?)").bind(id("paa_"), phoneHash, ipHash, 0, timestamp));
    return problem(401, "invalid_credentials", "Telefon numarası veya şifre hatalı.");
  }

  const rawToken = `cps_${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
  const tokenHash = await sha256(rawToken);
  const expiresAt = new Date(Date.now() + PHONE_SESSION_SECONDS * 1000).toISOString();
  const statements = [
    env.DB.prepare("UPDATE users SET status='active',password_last_login_at=?,updated_at=? WHERE id=?").bind(timestamp, timestamp, user.id),
    env.DB.prepare("UPDATE memberships SET status='active',updated_at=? WHERE user_id=? AND status='invited'").bind(timestamp, user.id),
    // Telefon ve masaüstü aynı anda kullanılabilmeli; yalnızca en eski oturumlar
    // üst sınırı aşınca kapatılır, her girişte tüm cihazlar düşürülmez.
    env.DB.prepare("UPDATE phone_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL AND id NOT IN (SELECT id FROM phone_sessions WHERE user_id=? AND revoked_at IS NULL AND expires_at>? ORDER BY last_seen_at DESC LIMIT ?)")
      .bind(timestamp, user.id, user.id, timestamp, PHONE_SESSION_MAX_PER_USER - 1),
    env.DB.prepare("INSERT INTO phone_sessions (id,user_id,token_hash,ip_hash,user_agent_hash,created_at,last_seen_at,expires_at,auth_method) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind(id("phs_"), user.id, tokenHash, ipHash, await authHash(env, request.headers.get("user-agent") || "unknown"), timestamp, timestamp, expiresAt, "password"),
    env.DB.prepare("INSERT INTO password_auth_attempts (id,phone_hash,ip_hash,success,created_at) VALUES (?,?,?,?,?)").bind(id("paa_"), phoneHash, ipHash, 1, timestamp),
  ];
  if (typeof env.DB.batch === "function") await env.DB.batch(statements);
  else for (const statement of statements) await run(statement);
  return json({ data: { authenticated: true, expires_at: expiresAt, must_change_password: Boolean(user.must_change_password) } }, 200, { "set-cookie": phoneSessionCookie(rawToken) });
}

function passwordProblem(value, field = "Şifre") {
  if (!validPassword(value)) return `${field} en az 8, en fazla 128 karakter olmalıdır.`;
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(value) || !/\d/.test(value)) return `${field} en az bir harf ve bir rakam içermelidir.`;
  return null;
}

// Davetle verilen geçici şifreyi kullanıcının kendisinin değiştirebilmesi için.
async function changePassword(request, env, principal) {
  if (!passwordAuthReady(env)) return problem(503, "password_auth_unavailable", "Şifreyle giriş yapılandırılmamış.");
  if (!sameOrigin(request, env)) return problem(403, "origin_forbidden", "İsteğin kaynağı geçersiz.");
  let body;
  try { body = await parseBody(request); } catch { return problem(400, "invalid_body", "Geçerli JSON gönderin."); }
  const invalid = passwordProblem(body?.new_password, "Yeni şifre");
  if (invalid) return problem(422, "weak_password", invalid);
  if (body.new_password === body.current_password) return problem(422, "weak_password", "Yeni şifre mevcut şifreyle aynı olamaz.");
  const user = await one(env.DB.prepare("SELECT id,password_hash,password_salt,password_iterations FROM users WHERE id=?").bind(principal.user.id));
  if (!user?.password_hash) return problem(409, "password_not_set", "Bu hesapta şifre tanımlı değil; yöneticinizden yeni davet isteyin.");
  const calculated = await derivePasswordHash(env, String(body.current_password || ""), user.password_salt, Number(user.password_iterations || PASSWORD_ITERATIONS));
  if (!safeHashEqual(calculated, user.password_hash)) return problem(401, "invalid_credentials", "Mevcut şifre hatalı.");

  const credential = await passwordRecord(env, body.new_password);
  const timestamp = now();
  const currentToken = cookieValue(request, PHONE_SESSION_COOKIE);
  const currentHash = currentToken ? await sha256(currentToken) : null;
  const statements = [
    env.DB.prepare("UPDATE users SET password_hash=?,password_salt=?,password_iterations=?,password_changed_at=?,must_change_password=0,updated_at=? WHERE id=?")
      .bind(credential.hash, credential.salt, credential.iterations, timestamp, timestamp, user.id),
    // Şifre değişince diğer tüm oturumlar kapanır, mevcut oturum korunur.
    env.DB.prepare("UPDATE phone_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL AND token_hash IS NOT ?").bind(timestamp, user.id, currentHash),
  ];
  try {
    if (typeof env.DB.batch === "function") await env.DB.batch(statements);
    else for (const statement of statements) await run(statement);
  } catch (error) { return workflowCommitProblem(env, error); }
  await audit(env, principal, request, "password.change", "users", user.id, {});
  return json({ data: { password_changed_at: timestamp, must_change_password: false } });
}

// Şifre sıfırlama, teslim kanalı (SMS/e-posta) olmadan güvenli biçimde:
// kullanıcı talep açar, yetkili kullanıcı kimliği doğrulayıp yeni geçici şifreyi
// verir. Yanıt, telefonun kayıtlı olup olmadığını ele vermez.
async function requestPasswordReset(request, env) {
  if (!passwordAuthReady(env)) return problem(503, "password_auth_unavailable", "Şifreyle giriş yapılandırılmamış.");
  if (!sameOrigin(request, env)) return problem(403, "origin_forbidden", "İsteğin kaynağı geçersiz.");
  let body;
  try { body = await parseBody(request); } catch { return problem(400, "invalid_body", "Geçerli JSON gönderin."); }
  const phone = normalizeTurkishMobile(body?.phone);
  if (!phone) return problem(422, "invalid_phone", "Türkiye cep telefonu numarasını kontrol edin.");

  const timestamp = now();
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const retentionCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const phoneHash = await authHash(env, phone);
  const ipHash = await authHash(env, clientIp(request) || "unknown");
  await run(env.DB.prepare("DELETE FROM password_reset_requests WHERE created_at<?").bind(retentionCutoff));
  await run(env.DB.prepare("UPDATE password_reset_requests SET status='expired' WHERE status='pending' AND expires_at<?").bind(timestamp));
  const [phoneRate, ipRate] = await Promise.all([
    one(env.DB.prepare("SELECT COUNT(*) AS count FROM password_reset_requests WHERE phone_hash=? AND created_at>?").bind(phoneHash, windowStart)),
    one(env.DB.prepare("SELECT COUNT(*) AS count FROM password_reset_requests WHERE ip_hash=? AND created_at>?").bind(ipHash, windowStart)),
  ]);
  if (Number(phoneRate?.count || 0) >= 3 || Number(ipRate?.count || 0) >= 10) {
    return problem(429, "rate_limited", "Çok fazla sıfırlama talebi gönderildi. Lütfen bir saat sonra tekrar deneyin.", { retry_after_seconds: 3600 });
  }

  const membership = await one(env.DB.prepare("SELECT u.id AS user_id,m.tenant_id FROM users u JOIN memberships m ON m.user_id=u.id JOIN tenants t ON t.id=m.tenant_id WHERE u.phone=? AND u.status IN ('active','invited') AND m.status IN ('active','invited') AND t.status='active' ORDER BY m.created_at LIMIT 1").bind(phone));
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await run(env.DB.prepare("INSERT INTO password_reset_requests (id,tenant_id,user_id,phone_hash,ip_hash,contact_note,status,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(id("prr_"), membership?.tenant_id || null, membership?.user_id || null, phoneHash, ipHash, String(body.note || "").slice(0, 500) || null, membership ? "pending" : "rejected", timestamp, expiresAt));
  // Kayıt bulunsa da bulunmasa da aynı yanıt döner.
  return json({ data: { received: true }, meta: { message: "Talebiniz firma yöneticinize iletildi. Yönetici kimliğinizi doğruladıktan sonra size yeni bir geçici şifre verecektir." } }, 202);
}

async function passwordResetRequestsRoute(request, env, principal) {
  if (!allowed(principal, "users.reset-password")) return problem(403, "forbidden", "Şifre sıfırlama taleplerini görüntüleme yetkiniz yok.");
  if (request.method !== "GET") return problem(405, "method_not_allowed", "Bu HTTP yöntemi desteklenmiyor.");
  const rows = await all(env.DB.prepare(`SELECT r.id,r.user_id,r.contact_note,r.status,r.created_at,r.expires_at,r.handled_at,
      u.full_name AS user_name,u.email AS user_email,m.id AS membership_id,m.title
    FROM password_reset_requests r
    LEFT JOIN users u ON u.id=r.user_id
    LEFT JOIN memberships m ON m.user_id=r.user_id AND m.tenant_id=r.tenant_id
    WHERE r.tenant_id=? AND r.status='pending' AND r.expires_at>?
    ORDER BY r.created_at DESC LIMIT 50`).bind(principal.tenantId, now()));
  return json({ data: rows.map(decodeRow), meta: { count: rows.length } });
}

async function resetMemberPassword(request, env, principal, membershipId) {
  if (!allowed(principal, "users.reset-password")) return problem(403, "forbidden", "Kullanıcıya yeni şifre verme yetkiniz yok.");
  const membership = await one(env.DB.prepare("SELECT m.id,m.user_id,m.role_id,u.full_name,u.email FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.id=? AND m.tenant_id=?").bind(membershipId, principal.tenantId));
  if (!membership) return problem(404, "not_found", "Üyelik bulunamadı.");
  const roleProblem = await privilegedRoleProblem(env, principal, [membership.role_id]);
  if (roleProblem) return roleProblem;
  let body;
  try { body = await parseBody(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
  const passwordError = passwordProblem(body?.temporary_password, "Geçici şifre");
  if (passwordError) return problem(422, "weak_password", passwordError);

  const credential = await passwordRecord(env, body.temporary_password);
  const timestamp = now();
  try {
    await commitWorkflow(env, principal, request, [
      env.DB.prepare("UPDATE users SET password_hash=?,password_salt=?,password_iterations=?,password_changed_at=?,must_change_password=1,updated_at=? WHERE id=?")
        .bind(credential.hash, credential.salt, credential.iterations, timestamp, timestamp, membership.user_id),
      // Eski oturumlar kapanır; sıfırlama sonrası yalnız yeni şifreyle girilir.
      env.DB.prepare("UPDATE phone_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL").bind(timestamp, membership.user_id),
      env.DB.prepare("UPDATE password_reset_requests SET status='fulfilled',handled_by=?,handled_at=? WHERE tenant_id=? AND user_id=? AND status='pending'")
        .bind(principal.user.id, timestamp, principal.tenantId, membership.user_id),
    ], "password.reset", "memberships", membershipId, { user_id: membership.user_id });
  } catch (error) { return workflowCommitProblem(env, error); }
  return json({ data: { membership_id: membershipId, user_id: membership.user_id, must_change_password: true }, meta: { message: "Geçici şifreyi kullanıcıya güvenli bir kanaldan iletin; ilk girişte değiştirmesi zorunludur." } });
}

async function sessionRoute(request, env, principal, segments) {
  if (segments.length === 3 && request.method === "GET") {
    const rows = await all(env.DB.prepare("SELECT id,auth_method,created_at,last_seen_at,expires_at FROM phone_sessions WHERE user_id=? AND revoked_at IS NULL AND expires_at>? ORDER BY last_seen_at DESC").bind(principal.user.id, now()));
    return json({ data: rows.map((row) => ({ ...row, current: row.id === principal.sessionId })) });
  }
  if (segments.length === 4 && request.method === "DELETE") {
    if (!sameOrigin(request, env)) return problem(403, "origin_forbidden", "İsteğin kaynağı geçersiz.");
    const target = segments[3];
    if (target !== "others" && !validId(target)) return problem(400, "invalid_id", "Geçersiz oturum kimliği.");
    const timestamp = now();
    if (target === "others") {
      await run(env.DB.prepare("UPDATE phone_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL AND id IS NOT ?").bind(timestamp, principal.user.id, principal.sessionId || null));
    } else {
      await run(env.DB.prepare("UPDATE phone_sessions SET revoked_at=? WHERE id=? AND user_id=? AND revoked_at IS NULL").bind(timestamp, target, principal.user.id));
    }
    await audit(env, principal, request, "session.revoke", "sessions", target === "others" ? null : target, {});
    return new Response(null, { status: 204 });
  }
  return problem(405, "method_not_allowed", "Bu oturum işlemi desteklenmiyor.");
}

async function logoutPhoneAuth(request, env) {
  if (!sameOrigin(request, env)) return problem(403, "origin_forbidden", "Çıkış isteğinin kaynağı geçersiz.");
  const token = cookieValue(request, PHONE_SESSION_COOKIE);
  if (token) await run(env.DB.prepare("UPDATE phone_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL").bind(now(), await sha256(token)));
  return json({ data: { authenticated: false } }, 200, { "set-cookie": phoneSessionCookie(null, 0) });
}

async function workflowRow(env, principal, table, resourceId) {
  return one(env.DB.prepare(`SELECT * FROM ${table} WHERE id=? AND tenant_id=?`).bind(resourceId, principal.tenantId));
}

async function offerAction(request, env, principal, offerId, action) {
  const capability = action === "convert-to-project" ? "offers.convert" : "offers.approve";
  if (!allowed(principal, capability)) return problem(403, "forbidden", "Bu teklif işlemi için yetkiniz yok.");
  const offer = await workflowRow(env, principal, "offers", offerId);
  if (!offer) return problem(404, "not_found", "Teklif bulunamadı.");
  let body;
  try { body = await optionalJson(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
  const timestamp = now();

  if (action === "accept") {
    if (offer.status === "accepted") return json({ data: serializeRow(offer, "offers", principal), meta: { replayed: true } });
    if (!["draft", "sent", "pending"].includes(offer.status)) return problem(409, "invalid_transition", `${offer.status} durumundaki teklif kabul edilemez.`);
    try {
      await commitWorkflow(env, principal, request, [env.DB.prepare("UPDATE offers SET status='accepted',accepted_at=?,accepted_by=?,rejection_reason=NULL,rejected_at=NULL,rejected_by=NULL,updated_at=? WHERE id=? AND tenant_id=?").bind(timestamp, principal.user.id, timestamp, offerId, principal.tenantId)], "accept", "offers", offerId, { from: offer.status, to: "accepted" });
    } catch (error) { return workflowCommitProblem(env, error); }
  } else if (action === "reject") {
    if (offer.status === "rejected") return json({ data: serializeRow(offer, "offers", principal), meta: { replayed: true } });
    if (!["draft", "sent", "pending"].includes(offer.status)) return problem(409, "invalid_transition", `${offer.status} durumundaki teklif reddedilemez.`);
    if (!body.reason || String(body.reason).trim().length < 3) return problem(422, "validation_error", "Ret nedeni zorunludur.");
    try {
      await commitWorkflow(env, principal, request, [env.DB.prepare("UPDATE offers SET status='rejected',rejection_reason=?,rejected_at=?,rejected_by=?,updated_at=? WHERE id=? AND tenant_id=?").bind(String(body.reason).trim(), timestamp, principal.user.id, timestamp, offerId, principal.tenantId)], "reject", "offers", offerId, { from: offer.status, to: "rejected", reason: String(body.reason).trim() });
    } catch (error) { return workflowCommitProblem(env, error); }
  } else {
    if (offer.status !== "accepted") return problem(409, "invalid_transition", "Yalnız kabul edilmiş teklif projeye dönüştürülebilir.");
    const linkedId = offer.converted_project_id || offer.project_id;
    if (linkedId) {
      const linked = await workflowRow(env, principal, "projects", linkedId);
      if (linked) {
        if (!offer.converted_project_id) {
          try {
            await commitWorkflow(env, principal, request, [env.DB.prepare("UPDATE offers SET converted_project_id=?,updated_at=? WHERE id=? AND tenant_id=?").bind(linked.id, timestamp, offerId, principal.tenantId)], "convert-to-project", "offers", offerId, { project_id: linked.id, linked_existing_project: true });
          } catch (error) { return workflowCommitProblem(env, error); }
        }
        return json({ data: serializeRow(linked, "projects", principal), meta: { replayed: true, source_offer_id: offerId } });
      }
    }
    const projectId = id("pro_");
    const safeOfferNumber = String(offer.offer_number || offer.id).replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 50);
    const projectCode = String(body.code || `PRJ-${safeOfferNumber}`);
    const projectName = String(body.name || `Teklif ${offer.offer_number} Projesi`);
    try {
      await commitWorkflow(env, principal, request, [
        env.DB.prepare("INSERT INTO projects (id,tenant_id,code,customer_id,name,status,contract_amount_minor,source_offer_id,description,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,'contracted',?,?,?,?,?,?)").bind(projectId, principal.tenantId, projectCode, offer.customer_id || null, projectName, offer.grand_total_minor || 0, offerId, body.description || null, JSON.stringify({ source_offer_revision: offer.revision || 1 }), timestamp, timestamp),
        env.DB.prepare("UPDATE offers SET project_id=?,converted_project_id=?,updated_at=? WHERE id=? AND tenant_id=? AND converted_project_id IS NULL").bind(projectId, projectId, timestamp, offerId, principal.tenantId),
      ], "convert-to-project", "offers", offerId, { project_id: projectId, project_code: projectCode });
    } catch (error) {
      const concurrent = await one(env.DB.prepare("SELECT * FROM projects WHERE source_offer_id=? AND tenant_id=?").bind(offerId, principal.tenantId));
      if (concurrent) {
        await run(env.DB.prepare("UPDATE offers SET project_id=?,converted_project_id=?,updated_at=? WHERE id=? AND tenant_id=?").bind(concurrent.id, concurrent.id, timestamp, offerId, principal.tenantId));
        return json({ data: serializeRow(concurrent, "projects", principal), meta: { replayed: true, source_offer_id: offerId } });
      }
      return workflowCommitProblem(env, error);
    }
    return json({ data: serializeRow(await workflowRow(env, principal, "projects", projectId), "projects", principal), meta: { source_offer_id: offerId } }, 201);
  }
  return json({ data: serializeRow(await workflowRow(env, principal, "offers", offerId), "offers", principal) });
}

async function transitionProject(request, env, principal, projectId) {
  if (!allowed(principal, "projects.transition")) return problem(403, "forbidden", "Proje aşaması değiştirme yetkiniz yok.");
  const project = await workflowRow(env, principal, "projects", projectId);
  if (!project) return problem(404, "not_found", "Proje bulunamadı.");
  let body;
  try { body = await parseBody(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
  const target = body?.status;
  if (target === project.status) return json({ data: serializeRow(project, "projects", principal), meta: { replayed: true } });
  if (!projectTransitions[project.status]?.includes(target)) return problem(409, "invalid_transition", `${project.status} durumundan ${target || "boş"} durumuna geçilemez.`);
  const intelligence = await projectCommandCenterData(env, principal, project);
  const targetChecks = transitionConditions(target, intelligence.facts);
  const blockers = targetChecks.filter((item) => !item.passed && item.severity === "blocker");
  const warnings = targetChecks.filter((item) => !item.passed && item.severity === "warning");
  const overrideReason = String(body.override_reason || "").trim();
  if (blockers.length && !overrideReason) return problem(409, "project_gate_blocked", "Bu aşamaya geçmeden önce zorunlu proje koşulları tamamlanmalıdır.", { blockers, warnings, target });
  if (blockers.length && !principal.isOwner) return problem(403, "override_forbidden", "Zorunlu proje koşullarını yalnız firma sahibi veya yönetici gerekçeyle aşabilir.", { blockers, warnings, target });
  if (blockers.length && overrideReason.length < 10) return problem(422, "override_reason_required", "Yönetici istisnası için en az 10 karakterlik gerekçe yazılmalıdır.", { blockers, warnings, target });
  const timestamp = now();
  const completion = target === "completed" ? timestamp : project.actual_end_date;
  const statements = [env.DB.prepare("UPDATE projects SET status=?,actual_end_date=?,updated_at=? WHERE id=? AND tenant_id=?").bind(target, completion || null, timestamp, projectId, principal.tenantId)];
  for (const [index, [title, department, dueDays]] of (projectTaskTemplates[target] || []).entries()) {
    const taskId = `tsk_auto_${projectId}_${target}_${index}`.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 100);
    const plannedEnd = new Date(Date.now() + dueDays * 86400000).toISOString().slice(0, 10);
    statements.push(env.DB.prepare("INSERT OR IGNORE INTO project_tasks (id,tenant_id,project_id,title,department,status,priority,planned_start,planned_end,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,'todo',?,?,?,?,?,?)").bind(taskId, principal.tenantId, projectId, title, department, blockers.length ? "high" : "normal", timestamp.slice(0, 10), plannedEnd, JSON.stringify({ auto_generated: true, source_stage: target }), timestamp, timestamp));
  }
  const notificationId = `ntf_${projectId}_${target}_${Date.now()}`.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 100);
  const targetLabel = projectStageDefinitions.find(([status]) => status === target)?.[1] || target;
  statements.push(env.DB.prepare("INSERT INTO notifications (id,tenant_id,user_id,project_id,type,title,message,module,record_id,status,due_at,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'unread',?,?,?,?)").bind(notificationId, principal.tenantId, project.manager_user_id || principal.user.id, projectId, blockers.length ? "warning" : "stage", `${project.code} · ${targetLabel}`, `${project.name} projesi ${targetLabel} aşamasına geçti. Açılan görevleri kontrol edin.`, "projects", projectId, project.planned_end_date || null, JSON.stringify({ source: "project_transition", override_used: Boolean(overrideReason) }), timestamp, timestamp));
  try {
    await commitWorkflow(env, principal, request, statements, "transition", "projects", projectId, { from: project.status, to: target, note: body.note || null, override_reason: overrideReason || null, blockers, warnings });
  } catch (error) { return workflowCommitProblem(env, error); }
  return json({ data: serializeRow(await workflowRow(env, principal, "projects", projectId), "projects", principal), meta: { warnings, override_used: Boolean(overrideReason) } });
}

async function approveWorkItemRevision(request, env, principal, workItemId) {
  if (!allowed(principal, "work-items.revision.approve")) return problem(403, "forbidden", "İş kalemi revizyonu onaylama yetkiniz yok.");
  const item = await workflowRow(env, principal, "work_items", workItemId);
  if (!item) return problem(404, "not_found", "İş kalemi bulunamadı.");
  if (item.revision_status === "approved") return json({ data: serializeRow(item, "work-items", principal), meta: { replayed: true } });
  if (!["draft", "review", "changes_requested"].includes(item.revision_status)) return problem(409, "invalid_transition", `${item.revision_status} revizyonu onaylanamaz.`);
  const timestamp = now();
  try {
    await commitWorkflow(env, principal, request, [env.DB.prepare("UPDATE work_items SET status='approved',revision_status='approved',revision_approved_at=?,revision_approved_by=?,updated_at=? WHERE id=? AND tenant_id=?").bind(timestamp, principal.user.id, timestamp, workItemId, principal.tenantId)], "revision.approve", "work-items", workItemId, { revision_no: item.revision_no || 1 });
  } catch (error) { return workflowCommitProblem(env, error); }
  return json({ data: serializeRow(await workflowRow(env, principal, "work_items", workItemId), "work-items", principal) });
}

async function releaseProductionOrder(request, env, principal, orderId) {
  if (!allowed(principal, "production-orders.release")) return problem(403, "forbidden", "Üretime salım yetkiniz yok.");
  const order = await one(env.DB.prepare("SELECT po.*,wi.status AS work_item_status,wi.revision_no AS current_revision_no,wi.revision_status AS current_revision_status FROM production_orders po LEFT JOIN work_items wi ON wi.id=po.work_item_id AND wi.tenant_id=po.tenant_id WHERE po.id=? AND po.tenant_id=?").bind(orderId, principal.tenantId));
  if (!order) return problem(404, "not_found", "Üretim emri bulunamadı.");
  if (order.status === "released") {
    if (Number(order.work_item_revision_no) !== Number(order.current_revision_no)) return problem(409, "stale_revision", "Üretim emrindeki iş kalemi revizyonu güncel değil.");
    return json({ data: serializeRow(order, "production-orders", principal), meta: { replayed: true } });
  }
  if (!["draft", "planned"].includes(order.status)) return problem(409, "invalid_transition", `${order.status} durumundaki üretim emri salınamaz.`);
  if (!order.work_item_id || order.work_item_status !== "approved" || order.current_revision_status !== "approved" || !Number.isInteger(Number(order.current_revision_no))) return problem(409, "revision_not_approved", "Üretime salım için güncel ve onaylı bir iş kalemi revizyonu zorunludur.");
  const timestamp = now();
  try {
    await commitWorkflow(env, principal, request, [env.DB.prepare("UPDATE production_orders SET status='released',work_item_revision_no=?,released_at=?,released_by=?,updated_at=? WHERE id=? AND tenant_id=?").bind(Number(order.current_revision_no), timestamp, principal.user.id, timestamp, orderId, principal.tenantId)], "release", "production-orders", orderId, { work_item_id: order.work_item_id, revision_no: Number(order.current_revision_no) });
  } catch (error) { return workflowCommitProblem(env, error); }
  return json({ data: serializeRow(await workflowRow(env, principal, "production_orders", orderId), "production-orders", principal) });
}

// Salımdan sonraki üretim yaşam döngüsü. Bu akış olmadan hiçbir üretim emri
// 'completed' olamıyor ve proje montaj aşamasına geçemiyordu.
const productionTransitions = {
  released: ["waiting_material", "in_progress", "cancelled"],
  waiting_material: ["in_progress", "paused", "cancelled"],
  in_progress: ["quality_control", "paused", "completed", "cancelled"],
  quality_control: ["completed", "in_progress", "cancelled"],
  paused: ["in_progress", "waiting_material", "cancelled"],
  draft: ["cancelled"],
  planned: ["cancelled"],
  completed: [],
  cancelled: [],
};

async function transitionProductionOrder(request, env, principal, orderId) {
  if (!allowed(principal, "production-orders.complete")) return problem(403, "forbidden", "Üretim emri aşamasını değiştirme yetkiniz yok.");
  const order = await workflowRow(env, principal, "production_orders", orderId);
  if (!order) return problem(404, "not_found", "Üretim emri bulunamadı.");
  let body;
  try { body = await parseBody(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
  const target = body?.status;
  if (target === order.status) return json({ data: serializeRow(order, "production-orders", principal), meta: { replayed: true } });
  if (!productionTransitions[order.status]?.includes(target)) return problem(409, "invalid_transition", `${order.status} durumundaki üretim emri ${target || "boş"} durumuna geçirilemez.`);
  if (target === "cancelled" && !String(body.reason || "").trim()) return problem(422, "validation_error", "İptal nedeni zorunludur.");

  const planned = Number(order.quantity || 0);
  let completedQuantity = order.completed_quantity == null ? null : Number(order.completed_quantity);
  if (body.completed_quantity !== undefined && body.completed_quantity !== null && body.completed_quantity !== "") {
    const requested = Number(body.completed_quantity);
    if (!Number.isFinite(requested) || requested < 0) return problem(422, "validation_error", "completed_quantity sıfır veya daha büyük bir sayı olmalıdır.");
    if (planned > 0 && requested > planned) return problem(422, "validation_error", "Tamamlanan miktar planlanan miktarı aşamaz.");
    completedQuantity = requested;
  }
  if (target === "completed") {
    // Tamamlanan miktar verilmediyse planlanan miktarın tamamı üretilmiş sayılır.
    if (completedQuantity == null || completedQuantity === 0) completedQuantity = planned > 0 ? planned : completedQuantity;
    if (planned > 0 && Number(completedQuantity || 0) <= 0) return problem(422, "completed_quantity_required", "Tamamlama için üretilen miktar girilmelidir.");
  }

  const timestamp = now();
  const statements = [env.DB.prepare(`UPDATE production_orders SET status=?,
      completed_quantity=COALESCE(?,completed_quantity),
      actual_start=CASE WHEN ?='in_progress' AND actual_start IS NULL THEN ? ELSE actual_start END,
      started_at=CASE WHEN ?='in_progress' AND started_at IS NULL THEN ? ELSE started_at END,
      started_by=CASE WHEN ?='in_progress' AND started_by IS NULL THEN ? ELSE started_by END,
      actual_end=CASE WHEN ?='completed' THEN ? ELSE actual_end END,
      completed_at=CASE WHEN ?='completed' THEN ? ELSE completed_at END,
      completed_by=CASE WHEN ?='completed' THEN ? ELSE completed_by END,
      cancelled_at=CASE WHEN ?='cancelled' THEN ? ELSE cancelled_at END,
      cancel_reason=CASE WHEN ?='cancelled' THEN ? ELSE cancel_reason END,
      updated_at=? WHERE id=? AND tenant_id=? AND status=?`)
    .bind(target, completedQuantity,
      target, timestamp, target, timestamp, target, principal.user.id,
      target, timestamp, target, timestamp, target, principal.user.id,
      target, timestamp, target, String(body.reason || "").trim() || null,
      timestamp, orderId, principal.tenantId, order.status)];

  if (target === "completed" && order.work_item_id) {
    statements.push(env.DB.prepare("UPDATE work_items SET status='completed',updated_at=? WHERE id=? AND tenant_id=? AND status IN ('approved','production')").bind(timestamp, order.work_item_id, principal.tenantId));
  }
  if (target === "in_progress" && order.work_item_id) {
    statements.push(env.DB.prepare("UPDATE work_items SET status='production',updated_at=? WHERE id=? AND tenant_id=? AND status='approved'").bind(timestamp, order.work_item_id, principal.tenantId));
  }
  try {
    await commitWorkflow(env, principal, request, statements, "transition", "production-orders", orderId, { from: order.status, to: target, completed_quantity: completedQuantity, reason: body.reason || null });
  } catch (error) { return workflowCommitProblem(env, error); }
  const updated = await workflowRow(env, principal, "production_orders", orderId);
  if (updated.status !== target) return problem(409, "concurrent_update", "Üretim emri başka bir işlem tarafından güncellendi; listeyi yenileyip tekrar deneyin.");
  return json({ data: serializeRow(updated, "production-orders", principal) });
}

// Üretim sorunu ve yeniden işlem. Çözüme kapatılan sorunun yeniden işlem ve
// hurda miktarı üretim emrine işlenir; kayıp kaynağı kârlılıkta görünür kalır.
async function productionIssueAction(request, env, principal, issueId, action) {
  const capability = action === "resolve" ? "production-issues.resolve" : "production-issues.write";
  if (!allowed(principal, capability)) return problem(403, "forbidden", "Bu üretim sorunu işlemi için yetkiniz yok.");
  const record = await workflowRow(env, principal, "production_issues", issueId);
  if (!record) return problem(404, "not_found", "Üretim sorunu bulunamadı.");
  let body;
  try { body = await optionalJson(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
  const timestamp = now();

  if (action === "resolve") {
    if (record.status === "resolved") return json({ data: serializeRow(record, "production-issues", principal), meta: { replayed: true } });
    if (!["open", "in_progress"].includes(record.status)) return problem(409, "invalid_transition", `${record.status} durumundaki sorun çözüme kapatılamaz.`);
    const resolution = String(body.resolution || "").trim();
    if (resolution.length < 3) return problem(422, "validation_error", "Çözüm açıklaması zorunludur.");
    const rework = body.rework_quantity == null ? Number(record.rework_quantity || 0) : Number(body.rework_quantity);
    const scrap = body.scrap_quantity == null ? Number(record.scrap_quantity || 0) : Number(body.scrap_quantity);
    if (!Number.isFinite(rework) || rework < 0 || !Number.isFinite(scrap) || scrap < 0) return problem(422, "validation_error", "Yeniden işlem ve hurda miktarı sıfır veya daha büyük olmalıdır.");
    const costImpact = body.cost_impact_minor == null ? Number(record.cost_impact_minor || 0) : Number(body.cost_impact_minor);
    if (!Number.isSafeInteger(costImpact)) return problem(422, "validation_error", "cost_impact_minor kuruş cinsinden tam sayı olmalıdır.");
    if (costImpact !== Number(record.cost_impact_minor || 0) && !allowed(principal, "cost.view")) return problem(403, "sensitive_field_forbidden", "Maliyet etkisi girmek için cost.view yetkisi gereklidir.");

    const reworkDelta = rework - Number(record.rework_quantity || 0);
    const scrapDelta = scrap - Number(record.scrap_quantity || 0);
    try {
      await commitWorkflow(env, principal, request, [
        env.DB.prepare("UPDATE production_issues SET status='resolved',resolution=?,root_cause=COALESCE(?,root_cause),rework_quantity=?,scrap_quantity=?,cost_impact_minor=?,delay_days=COALESCE(?,delay_days),resolved_at=?,resolved_by=?,updated_at=? WHERE id=? AND tenant_id=? AND status IN ('open','in_progress')")
          .bind(resolution, String(body.root_cause || "").trim() || null, rework, scrap, costImpact, body.delay_days == null ? null : Number(body.delay_days), timestamp, principal.user.id, timestamp, issueId, principal.tenantId),
        env.DB.prepare("UPDATE production_orders SET rework_quantity=MAX(0,rework_quantity+?),scrap_quantity=MAX(0,scrap_quantity+?),updated_at=? WHERE id=? AND tenant_id=?")
          .bind(reworkDelta, scrapDelta, timestamp, record.production_order_id, principal.tenantId),
      ], "resolve", "production-issues", issueId, { rework_quantity: rework, scrap_quantity: scrap, cost_impact_minor: costImpact });
    } catch (error) { return workflowCommitProblem(env, error); }
    return json({ data: serializeRow(await workflowRow(env, principal, "production_issues", issueId), "production-issues", principal) });
  }

  const transitions = { open: ["in_progress", "cancelled"], in_progress: ["open", "cancelled"], resolved: [], cancelled: [] };
  const target = body.status;
  if (target === record.status) return json({ data: serializeRow(record, "production-issues", principal), meta: { replayed: true } });
  if (!transitions[record.status]?.includes(target)) return problem(409, "invalid_transition", `${record.status} durumundaki sorun ${target || "boş"} durumuna geçirilemez.`);
  if (target === "cancelled" && !String(body.reason || "").trim()) return problem(422, "validation_error", "İptal nedeni zorunludur.");
  try {
    await commitWorkflow(env, principal, request, [env.DB.prepare("UPDATE production_issues SET status=?,resolution=COALESCE(?,resolution),updated_at=? WHERE id=? AND tenant_id=?")
      .bind(target, String(body.reason || "").trim() || null, timestamp, issueId, principal.tenantId)], "transition", "production-issues", issueId, { from: record.status, to: target });
  } catch (error) { return workflowCommitProblem(env, error); }
  return json({ data: serializeRow(await workflowRow(env, principal, "production_issues", issueId), "production-issues", principal) });
}

async function reserveMaterialRequirement(request, env, principal, requirementId) {
  if (!allowed(principal, "material-requirements.reserve")) return problem(403, "forbidden", "Malzemeyi stoktan ayırma yetkiniz yok.");
  const requirement = await workflowRow(env, principal, "material_requirements", requirementId);
  if (!requirement) return problem(404, "not_found", "Malzeme ihtiyacı bulunamadı.");
  if (["cancelled", "consumed"].includes(requirement.status)) return problem(409, "invalid_transition", "Kapalı malzeme ihtiyacı için rezervasyon yapılamaz.");
  if (!requirement.inventory_item_id) return problem(422, "inventory_item_required", "Stoktan ayırmak için ihtiyaç kaydına stok kartı bağlanmalıdır.");
  const inventory = await workflowRow(env, principal, "inventory_items", requirement.inventory_item_id);
  if (!inventory || inventory.status !== "active") return problem(409, "inventory_unavailable", "Bağlı stok kartı aktif değil veya bulunamadı.");
  let body;
  try { body = await optionalJson(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
  const remaining = Math.max(0, Number(requirement.required_quantity) - Number(requirement.reserved_quantity) - Number(requirement.ordered_quantity));
  if (!remaining) return json({ data: serializeRow(requirement, "material-requirements", principal), meta: { replayed: true, reserved_quantity: 0 } });
  const available = Math.max(0, Number(inventory.on_hand_quantity) - Number(inventory.reserved_quantity));
  const requested = body.quantity == null ? remaining : Number(body.quantity);
  if (!Number.isFinite(requested) || requested <= 0) return problem(422, "validation_error", "Ayrılacak miktar sıfırdan büyük olmalıdır.");
  const quantity = Math.min(remaining, available, requested);
  if (quantity <= 0) return problem(409, "insufficient_stock", "Bu stok kartında ayrılabilir miktar bulunmuyor.", { available_quantity: available, remaining_quantity: remaining });
  const reservedTotal = Number(requirement.reserved_quantity) + quantity;
  const covered = reservedTotal + Number(requirement.ordered_quantity) >= Number(requirement.required_quantity);
  const timestamp = now();
  let results;
  try {
    // Her iki güncelleme de aynı koşula bağlıdır. Stok ayrılamazsa ilk statement
    // hiçbir satıra dokunmaz; ikinci statement de kendi damgasını (updated_at)
    // aradığı için sessizce boş geçer. Böylece rezerve edilmemiş miktarın
    // "karşılandı" olarak yazılması mümkün değildir.
    results = await commitWorkflow(env, principal, request, [
      env.DB.prepare("UPDATE inventory_items SET reserved_quantity=reserved_quantity+?,updated_at=? WHERE id=? AND tenant_id=? AND reserved_quantity+?<=on_hand_quantity").bind(quantity, timestamp, inventory.id, principal.tenantId, quantity),
      env.DB.prepare("UPDATE material_requirements SET reserved_quantity=reserved_quantity+?,status=?,updated_at=? WHERE id=? AND tenant_id=? AND EXISTS (SELECT 1 FROM inventory_items ii WHERE ii.id=? AND ii.tenant_id=? AND ii.updated_at=?)")
        .bind(quantity, covered ? "covered" : "shortage", timestamp, requirementId, principal.tenantId, inventory.id, principal.tenantId, timestamp),
    ], "reserve", "material-requirements", requirementId, { inventory_item_id: inventory.id, quantity });
  } catch (error) { return workflowCommitProblem(env, error); }
  const updatedInventory = await workflowRow(env, principal, "inventory_items", inventory.id);
  if (!Number(results?.[0]?.meta?.changes || 0)) {
    return problem(409, "insufficient_stock", "Stok bu sırada başka bir işlem tarafından ayrıldı; hiçbir değişiklik uygulanmadı.", {
      available_quantity: Math.max(0, Number(updatedInventory?.on_hand_quantity || 0) - Number(updatedInventory?.reserved_quantity || 0)),
      remaining_quantity: remaining,
    });
  }
  return json({ data: serializeRow(await workflowRow(env, principal, "material_requirements", requirementId), "material-requirements", principal), meta: { reserved_quantity: quantity, available_quantity: Math.max(0, Number(updatedInventory.on_hand_quantity) - Number(updatedInventory.reserved_quantity)) } });
}

// Ürün reçetesinden malzeme ihtiyacı üretimi. Reçete satırı × iş kalemi miktarı,
// fire payı eklenerek malzeme planına yazılır; aynı satır iki kez patlatılmaz.
async function explodeBom(request, env, principal, workItemId) {
  if (!allowed(principal, "work-items.explode-bom")) return problem(403, "forbidden", "Ürün reçetesinden malzeme ihtiyacı üretme yetkiniz yok.");
  const item = await workflowRow(env, principal, "work_items", workItemId);
  if (!item) return problem(404, "not_found", "İş kalemi bulunamadı.");
  const lines = await all(env.DB.prepare("SELECT * FROM bom_lines WHERE tenant_id=? AND work_item_id=? ORDER BY sort_order,created_at").bind(principal.tenantId, workItemId));
  if (!lines.length) return problem(409, "bom_empty", "Bu iş kalemi için tanımlı ürün reçetesi yok.");
  let body;
  try { body = await optionalJson(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }

  const multiplier = body.quantity == null ? Number(item.quantity || 0) : Number(body.quantity);
  if (!Number.isFinite(multiplier) || multiplier <= 0) return problem(422, "validation_error", "Patlatma için iş kalemi miktarı sıfırdan büyük olmalıdır.");

  const existing = await all(env.DB.prepare("SELECT id,metadata_json FROM material_requirements WHERE tenant_id=? AND work_item_id=? AND status<>'cancelled'").bind(principal.tenantId, workItemId));
  const alreadyExploded = new Set();
  for (const row of existing) {
    try { const meta = JSON.parse(row.metadata_json || "{}"); if (meta.bom_line_id) alreadyExploded.add(meta.bom_line_id); }
    catch { /* Bozuk metadata görmezden gelinir. */ }
  }

  const timestamp = now();
  const statements = [];
  const created = [];
  for (const line of lines) {
    if (alreadyExploded.has(line.id)) continue;
    const gross = Number(line.quantity_per_unit) * multiplier * (1 + Number(line.scrap_rate || 0) / 100);
    const quantity = Math.round(gross * 1000) / 1000;
    if (!(quantity > 0)) continue;
    const requirementId = id("mat_");
    statements.push(env.DB.prepare("INSERT INTO material_requirements (id,tenant_id,project_id,work_item_id,inventory_item_id,preferred_supplier_id,item_code,description,required_quantity,unit,needed_by,status,notes,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?, 'draft',?,?,?,?)")
      .bind(requirementId, principal.tenantId, item.project_id, workItemId, line.inventory_item_id || null, line.supplier_id || null, line.item_code || null, line.description, quantity, line.unit, body.needed_by || null, line.notes || null, JSON.stringify({ source: "bom", bom_line_id: line.id, work_item_quantity: multiplier, scrap_rate: Number(line.scrap_rate || 0) }), timestamp, timestamp));
    created.push({ id: requirementId, bom_line_id: line.id, description: line.description, required_quantity: quantity, unit: line.unit });
  }
  if (!created.length) return json({ data: [], meta: { replayed: true, skipped_lines: lines.length, message: "Reçetedeki tüm satırlar için malzeme ihtiyacı zaten açılmış." } });
  try {
    await commitWorkflow(env, principal, request, statements, "explode-bom", "work-items", workItemId, { line_count: created.length, work_item_quantity: multiplier });
  } catch (error) { return workflowCommitProblem(env, error); }
  return json({ data: created, meta: { work_item_id: workItemId, work_item_quantity: multiplier, skipped_lines: lines.length - created.length } }, 201);
}

// İş merkezi yükü: planlanan operasyon dakikaları ile günlük kapasitenin
// karşılaştırılması. Darboğazlar üretim planı yapılmadan görünür olur.
async function workCenterLoad(request, env, principal) {
  if (!allowed(principal, "work-centers.read")) return problem(403, "forbidden", "İş merkezi yükünü görüntüleme yetkiniz yok.");
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || now().slice(0, 10);
  const to = url.searchParams.get("to") || new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10);
  if (Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) return problem(422, "validation_error", "from ve to geçerli tarih olmalıdır.");
  if (from > to) return problem(422, "validation_error", "Başlangıç tarihi bitiş tarihinden sonra olamaz.");
  const workingDays = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1);

  const centers = await all(env.DB.prepare("SELECT * FROM work_centers WHERE tenant_id=? AND status='active' ORDER BY name").bind(principal.tenantId));
  const load = await all(env.DB.prepare(`SELECT o.work_center_id,
      COALESCE(SUM(o.planned_minutes),0) AS planned_minutes,
      COALESCE(SUM(CASE WHEN o.status='completed' THEN o.actual_minutes ELSE 0 END),0) AS actual_minutes,
      COUNT(*) AS operation_count,
      COALESCE(SUM(CASE WHEN o.status IN ('pending','in_progress','blocked') THEN o.planned_minutes ELSE 0 END),0) AS open_minutes,
      COALESCE(SUM(CASE WHEN o.status='blocked' THEN 1 ELSE 0 END),0) AS blocked_count
    FROM production_operations o
    WHERE o.tenant_id=? AND o.work_center_id IS NOT NULL
      AND COALESCE(o.planned_start, date('now')) <= ? AND COALESCE(o.planned_end, o.planned_start, date('now')) >= ?
    GROUP BY o.work_center_id`).bind(principal.tenantId, to, from));
  const byCenter = new Map(load.map((row) => [row.work_center_id, row]));

  const data = centers.map((center) => {
    const row = byCenter.get(center.id) || {};
    const capacityMinutes = Number(center.daily_capacity_minutes) * workingDays;
    const plannedMinutes = Number(row.planned_minutes || 0);
    return {
      ...serializeRow(center, "work-centers", principal),
      window: { from, to, working_days: workingDays },
      capacity_minutes: capacityMinutes,
      planned_minutes: plannedMinutes,
      open_minutes: Number(row.open_minutes || 0),
      actual_minutes: Number(row.actual_minutes || 0),
      operation_count: Number(row.operation_count || 0),
      blocked_count: Number(row.blocked_count || 0),
      load_percent: capacityMinutes ? Math.round((plannedMinutes / capacityMinutes) * 1000) / 10 : null,
      overloaded: capacityMinutes > 0 && plannedMinutes > capacityMinutes,
    };
  });
  return json({ data, meta: { from, to, working_days: workingDays, bottlenecks: data.filter((item) => item.overloaded).map((item) => item.code) } });
}

async function transitionProductionOperation(request, env, principal, operationId) {
  if (!allowed(principal, "production-operations.execute")) return problem(403, "forbidden", "Üretim operasyonu yürütme yetkiniz yok.");
  const record = await workflowRow(env, principal, "production_operations", operationId);
  if (!record) return problem(404, "not_found", "Üretim operasyonu bulunamadı.");
  let body;
  try { body = await parseBody(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
  const transitions = { pending: ["in_progress", "blocked", "skipped"], in_progress: ["completed", "blocked"], blocked: ["in_progress", "skipped"], completed: [], skipped: [] };
  const target = body.status;
  if (target === record.status) return json({ data: serializeRow(record, "production-operations", principal), meta: { replayed: true } });
  if (!transitions[record.status]?.includes(target)) return problem(409, "invalid_transition", `${record.status} durumundaki operasyon ${target || "boş"} durumuna geçirilemez.`);
  if (target === "blocked" && !String(body.reason || "").trim()) return problem(422, "validation_error", "Duraklatma nedeni zorunludur.");

  let actualMinutes = Number(record.actual_minutes || 0);
  if (body.actual_minutes !== undefined && body.actual_minutes !== null && body.actual_minutes !== "") {
    const requested = Number(body.actual_minutes);
    if (!Number.isInteger(requested) || requested < 0) return problem(422, "validation_error", "actual_minutes sıfır veya daha büyük tam sayı olmalıdır.");
    actualMinutes = requested;
  } else if (target === "completed" && record.started_at) {
    // Süre girilmediyse başlangıçtan bu yana geçen süre yazılır.
    actualMinutes = Math.max(actualMinutes, Math.round((Date.now() - Date.parse(record.started_at)) / 60000));
  }

  const timestamp = now();
  try {
    await commitWorkflow(env, principal, request, [env.DB.prepare(`UPDATE production_operations SET status=?,actual_minutes=?,
        started_at=CASE WHEN ?='in_progress' AND started_at IS NULL THEN ? ELSE started_at END,
        completed_at=CASE WHEN ?='completed' THEN ? ELSE completed_at END,
        notes=COALESCE(?,notes),updated_at=? WHERE id=? AND tenant_id=? AND status=?`)
      .bind(target, actualMinutes, target, timestamp, target, timestamp, String(body.reason || "").trim() || null, timestamp, operationId, principal.tenantId, record.status)],
      "transition", "production-operations", operationId, { from: record.status, to: target, actual_minutes: actualMinutes });
  } catch (error) { return workflowCommitProblem(env, error); }
  const updated = await workflowRow(env, principal, "production_operations", operationId);
  if (updated.status !== target) return problem(409, "concurrent_update", "Operasyon başka bir işlem tarafından güncellendi; listeyi yenileyip tekrar deneyin.");
  const remaining = await one(env.DB.prepare("SELECT COUNT(*) AS count FROM production_operations WHERE tenant_id=? AND production_order_id=? AND status IN ('pending','in_progress','blocked')").bind(principal.tenantId, record.production_order_id));
  return json({ data: serializeRow(updated, "production-operations", principal), meta: { open_operations: Number(remaining?.count || 0) } });
}

// Rezervasyonun sonu: malzeme ya üretime verilir (consume) ya da serbest
// bırakılır (release). İkisi de stok kartındaki reserved_quantity'yi düşürür;
// bu adım olmadan rezervasyonlar kalıcı olarak asılı kalıyordu.
async function settleMaterialRequirement(request, env, principal, requirementId, action) {
  if (!allowed(principal, "material-requirements.consume")) return problem(403, "forbidden", "Malzeme rezervasyonunu kapatma yetkiniz yok.");
  const requirement = await workflowRow(env, principal, "material_requirements", requirementId);
  if (!requirement) return problem(404, "not_found", "Malzeme ihtiyacı bulunamadı.");
  if (requirement.status === "cancelled") return problem(409, "invalid_transition", "İptal edilmiş malzeme ihtiyacı kapatılamaz.");
  if (action === "consume" && requirement.status === "consumed") return json({ data: serializeRow(requirement, "material-requirements", principal), meta: { replayed: true } });
  let body;
  try { body = await optionalJson(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
  const reserved = Number(requirement.reserved_quantity || 0);
  const requested = body.quantity == null ? reserved : Number(body.quantity);
  if (!Number.isFinite(requested) || requested < 0) return problem(422, "validation_error", "Miktar sıfır veya daha büyük bir sayı olmalıdır.");
  const quantity = Math.min(reserved, requested);
  if (action === "release" && quantity <= 0) return json({ data: serializeRow(requirement, "material-requirements", principal), meta: { replayed: true, released_quantity: 0 } });

  const timestamp = now();
  const statements = [];
  if (quantity > 0 && requirement.inventory_item_id) {
    statements.push(env.DB.prepare("UPDATE inventory_items SET reserved_quantity=MAX(0,reserved_quantity-?),on_hand_quantity=CASE WHEN ?='consume' THEN MAX(0,on_hand_quantity-?) ELSE on_hand_quantity END,updated_at=? WHERE id=? AND tenant_id=?")
      .bind(quantity, action, quantity, timestamp, requirement.inventory_item_id, principal.tenantId));
  }
  if (action === "consume") {
    statements.push(env.DB.prepare("UPDATE material_requirements SET reserved_quantity=MAX(0,reserved_quantity-?),consumed_quantity=consumed_quantity+?,status='consumed',updated_at=? WHERE id=? AND tenant_id=? AND status<>'cancelled'")
      .bind(quantity, quantity, timestamp, requirementId, principal.tenantId));
  } else {
    statements.push(env.DB.prepare("UPDATE material_requirements SET reserved_quantity=MAX(0,reserved_quantity-?),status=CASE WHEN MAX(0,reserved_quantity-?)+ordered_quantity>=required_quantity THEN 'covered' ELSE 'shortage' END,updated_at=? WHERE id=? AND tenant_id=? AND status<>'cancelled'")
      .bind(quantity, quantity, timestamp, requirementId, principal.tenantId));
  }
  try {
    await commitWorkflow(env, principal, request, statements, action, "material-requirements", requirementId, { inventory_item_id: requirement.inventory_item_id || null, quantity });
  } catch (error) { return workflowCommitProblem(env, error); }
  return json({ data: serializeRow(await workflowRow(env, principal, "material_requirements", requirementId), "material-requirements", principal), meta: action === "consume" ? { consumed_quantity: quantity } : { released_quantity: quantity } });
}

async function createMaterialPurchaseRequest(request, env, principal, requirementId) {
  if (!allowed(principal, "material-requirements.purchase")) return problem(403, "forbidden", "Malzeme ihtiyacından satın alma talebi oluşturma yetkiniz yok.");
  const requirement = await workflowRow(env, principal, "material_requirements", requirementId);
  if (!requirement) return problem(404, "not_found", "Malzeme ihtiyacı bulunamadı.");
  if (["cancelled", "consumed"].includes(requirement.status)) return problem(409, "invalid_transition", "Kapalı malzeme ihtiyacı satın almaya bağlanamaz.");
  if (requirement.purchase_request_id) {
    const existing = await workflowRow(env, principal, "purchase_requests", requirement.purchase_request_id);
    if (existing) return json({ data: serializeRow(existing, "purchase-requests", principal), meta: { replayed: true, material_requirement_id: requirementId } });
  }
  const missing = Math.max(0, Number(requirement.required_quantity) - Number(requirement.reserved_quantity) - Number(requirement.ordered_quantity));
  if (!missing) return problem(409, "material_already_covered", "Bu ihtiyaç stok veya mevcut tedarik kaydıyla karşılanmış durumda.");
  const purchaseRequestId = id("pr_");
  const requestNumber = `MAT-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${purchaseRequestId.slice(-6).toUpperCase()}`;
  const timestamp = now();
  try {
    await commitWorkflow(env, principal, request, [
      env.DB.prepare("INSERT INTO purchase_requests (id,tenant_id,request_number,project_id,requester_user_id,needed_by,priority,description,quantity,unit,preferred_supplier_id,status,notes,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,?, 'normal',?,?,?,?, 'pending',?,?,?,?)").bind(purchaseRequestId, principal.tenantId, requestNumber, requirement.project_id, principal.user.id, requirement.needed_by || null, requirement.description, missing, requirement.unit, requirement.preferred_supplier_id || null, requirement.notes || null, JSON.stringify({ source: "material_requirement", material_requirement_id: requirementId, inventory_item_id: requirement.inventory_item_id || null }), timestamp, timestamp),
      env.DB.prepare("UPDATE material_requirements SET ordered_quantity=ordered_quantity+?,purchase_request_id=?,status='covered',updated_at=? WHERE id=? AND tenant_id=? AND purchase_request_id IS NULL").bind(missing, purchaseRequestId, timestamp, requirementId, principal.tenantId),
    ], "create-purchase-request", "material-requirements", requirementId, { purchase_request_id: purchaseRequestId, quantity: missing });
  } catch (error) {
    const concurrent = await workflowRow(env, principal, "material_requirements", requirementId);
    if (concurrent?.purchase_request_id) {
      const existing = await workflowRow(env, principal, "purchase_requests", concurrent.purchase_request_id);
      if (existing) return json({ data: serializeRow(existing, "purchase-requests", principal), meta: { replayed: true, material_requirement_id: requirementId } });
    }
    return workflowCommitProblem(env, error);
  }
  return json({ data: serializeRow(await workflowRow(env, principal, "purchase_requests", purchaseRequestId), "purchase-requests", principal), meta: { material_requirement_id: requirementId } }, 201);
}

async function approvePurchaseRequest(request, env, principal, requestId) {
  if (!allowed(principal, "purchase-requests.approve")) return problem(403, "forbidden", "Satın alma talebi onaylama yetkiniz yok.");
  const record = await workflowRow(env, principal, "purchase_requests", requestId);
  if (!record) return problem(404, "not_found", "Satın alma talebi bulunamadı.");
  if (record.status === "approved") return json({ data: serializeRow(record, "purchase-requests", principal), meta: { replayed: true } });
  if (!["draft", "pending"].includes(record.status)) return problem(409, "invalid_transition", `${record.status} durumundaki talep onaylanamaz.`);
  const timestamp = now();
  try {
    await commitWorkflow(env, principal, request, [env.DB.prepare("UPDATE purchase_requests SET status='approved',approved_by=?,approved_at=?,updated_at=? WHERE id=? AND tenant_id=?").bind(principal.user.id, timestamp, timestamp, requestId, principal.tenantId)], "approve", "purchase-requests", requestId, { from: record.status, to: "approved" });
  } catch (error) { return workflowCommitProblem(env, error); }
  return json({ data: serializeRow(await workflowRow(env, principal, "purchase_requests", requestId), "purchase-requests", principal) });
}

// Onaylı talepten sipariş: zincirin eksik ilk halkası. Talep ile sipariş
// arasındaki bağ purchase_order_id üzerinden idempotenttir.
async function createPurchaseOrderFromRequest(request, env, principal, requestId) {
  if (!allowed(principal, "purchase-requests.order")) return problem(403, "forbidden", "Satın alma talebinden sipariş oluşturma yetkiniz yok.");
  const record = await workflowRow(env, principal, "purchase_requests", requestId);
  if (!record) return problem(404, "not_found", "Satın alma talebi bulunamadı.");
  if (record.purchase_order_id) {
    const existing = await workflowRow(env, principal, "purchase_orders", record.purchase_order_id);
    if (existing) return json({ data: serializeRow(existing, "purchase-orders", principal), meta: { replayed: true, purchase_request_id: requestId } });
  }
  if (record.status !== "approved") return problem(409, "invalid_transition", "Yalnız onaylı satın alma talebinden sipariş oluşturulabilir.");
  let body;
  try { body = await optionalJson(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
  const supplierId = body.supplier_id || record.preferred_supplier_id;
  if (!validId(supplierId)) return problem(422, "validation_error", "Sipariş için supplier_id zorunludur.");
  const supplier = await workflowRow(env, principal, "suppliers", supplierId);
  if (!supplier) return problem(422, "cross_tenant_reference", "supplier_id bu firmaya ait geçerli bir tedarikçiyi göstermiyor.");
  if (!allowed(principal, "cost.view") && body.subtotal_minor !== undefined) return problem(403, "sensitive_field_forbidden", "Tutar girmek için cost.view yetkisi gereklidir.");

  const orderId = id("pur_");
  const orderNumber = String(body.order_number || `PO-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${orderId.slice(-6).toUpperCase()}`).slice(0, 60);
  const subtotal = Number(body.subtotal_minor ?? record.estimated_amount_minor ?? 0) || 0;
  const taxTotal = Number(body.tax_total_minor ?? 0) || 0;
  if (!Number.isSafeInteger(subtotal) || !Number.isSafeInteger(taxTotal)) return problem(422, "validation_error", "Tutarlar kuruş cinsinden tam sayı olmalıdır.");
  const timestamp = now();
  try {
    await commitWorkflow(env, principal, request, [
      env.DB.prepare("INSERT INTO purchase_orders (id,tenant_id,order_number,request_id,project_id,supplier_id,order_date,expected_date,currency,subtotal_minor,tax_total_minor,grand_total_minor,status,ordered_at,notes,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'ordered',?,?,?,?,?)")
        .bind(orderId, principal.tenantId, orderNumber, requestId, record.project_id || null, supplierId, timestamp.slice(0, 10), body.expected_date || record.needed_by || null, record.currency || "TRY", subtotal, taxTotal, subtotal + taxTotal, timestamp, body.notes || record.notes || null, JSON.stringify({ source: "purchase_request", purchase_request_id: requestId }), timestamp, timestamp),
      env.DB.prepare("UPDATE purchase_requests SET status='ordered',purchase_order_id=?,updated_at=? WHERE id=? AND tenant_id=? AND purchase_order_id IS NULL AND status='approved'")
        .bind(orderId, timestamp, requestId, principal.tenantId),
    ], "create-order", "purchase-requests", requestId, { purchase_order_id: orderId, supplier_id: supplierId });
  } catch (error) {
    const concurrent = await workflowRow(env, principal, "purchase_requests", requestId);
    if (concurrent?.purchase_order_id) {
      const existing = await workflowRow(env, principal, "purchase_orders", concurrent.purchase_order_id);
      if (existing) return json({ data: serializeRow(existing, "purchase-orders", principal), meta: { replayed: true, purchase_request_id: requestId } });
    }
    return workflowCommitProblem(env, error);
  }
  return json({ data: serializeRow(await workflowRow(env, principal, "purchase_orders", orderId), "purchase-orders", principal), meta: { purchase_request_id: requestId } }, 201);
}

// Mal kabul: siparişi kapatır, isteğe bağlı olarak stok girişi yazar ve
// bağlı malzeme ihtiyaçlarının teslim alınan miktarını günceller.
async function receivePurchaseOrder(request, env, principal, orderId) {
  if (!allowed(principal, "purchase-orders.receive")) return problem(403, "forbidden", "Mal kabul yetkiniz yok.");
  const order = await workflowRow(env, principal, "purchase_orders", orderId);
  if (!order) return problem(404, "not_found", "Satın alma siparişi bulunamadı.");
  if (order.status === "received") return json({ data: serializeRow(order, "purchase-orders", principal), meta: { replayed: true } });
  if (!["ordered", "partial"].includes(order.status)) return problem(409, "invalid_transition", `${order.status} durumundaki sipariş için mal kabul yapılamaz.`);
  let body;
  try { body = await optionalJson(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
  const partial = body.partial === true;
  const timestamp = now();
  const statements = [env.DB.prepare("UPDATE purchase_orders SET status=?,received_at=CASE WHEN ?='received' THEN ? ELSE received_at END,received_by=CASE WHEN ?='received' THEN ? ELSE received_by END,updated_at=? WHERE id=? AND tenant_id=? AND status IN ('ordered','partial')")
    .bind(partial ? "partial" : "received", partial ? "partial" : "received", timestamp, partial ? "partial" : "received", principal.user.id, timestamp, orderId, principal.tenantId)];

  let movementId = null;
  const quantity = body.quantity == null ? null : Number(body.quantity);
  if (body.inventory_item_id !== undefined && body.inventory_item_id !== null && body.inventory_item_id !== "") {
    if (!validId(body.inventory_item_id)) return problem(422, "validation_error", "inventory_item_id geçersiz.");
    const inventory = await workflowRow(env, principal, "inventory_items", body.inventory_item_id);
    if (!inventory) return problem(422, "cross_tenant_reference", "inventory_item_id bu firmada bulunamadı.");
    if (!Number.isFinite(quantity) || quantity <= 0) return problem(422, "validation_error", "Stok girişi için sıfırdan büyük quantity zorunludur.");
    movementId = id("sto_");
    const unitCost = Number(body.unit_cost_minor ?? inventory.average_cost_minor ?? 0) || 0;
    if (!Number.isSafeInteger(unitCost)) return problem(422, "validation_error", "unit_cost_minor kuruş cinsinden tam sayı olmalıdır.");
    statements.push(env.DB.prepare("INSERT INTO stock_movements (id,tenant_id,movement_number,inventory_item_id,project_id,movement_type,movement_date,quantity,unit_cost_minor,total_cost_minor,status,source_type,source_id,reference,notes,metadata_json,posted_at,posted_by,created_at,updated_at) VALUES (?,?,?,?,?, 'receipt',?,?,?,?, 'posted','purchase_order',?,?,?,?,?,?,?,?)")
      .bind(movementId, principal.tenantId, `GR-${timestamp.slice(0, 10).replaceAll("-", "")}-${movementId.slice(-6).toUpperCase()}`, inventory.id, order.project_id || null, timestamp.slice(0, 10), quantity, unitCost, Math.round(quantity * unitCost), orderId, order.order_number, body.notes || null, JSON.stringify({ source: "purchase_order_receipt", purchase_order_id: orderId }), timestamp, principal.user.id, timestamp, timestamp));
    statements.push(env.DB.prepare("UPDATE inventory_items SET on_hand_quantity=on_hand_quantity+?,updated_at=? WHERE id=? AND tenant_id=?").bind(quantity, timestamp, inventory.id, principal.tenantId));
  }

  // Siparişi doğuran talebe bağlı malzeme ihtiyacının teslim alınan miktarını yaz.
  if (order.request_id) {
    statements.push(env.DB.prepare("UPDATE material_requirements SET received_quantity=CASE WHEN ? IS NULL THEN ordered_quantity ELSE MIN(required_quantity, received_quantity+?) END,updated_at=? WHERE tenant_id=? AND purchase_request_id=?")
      .bind(quantity, quantity, timestamp, principal.tenantId, order.request_id));
    statements.push(env.DB.prepare("UPDATE purchase_requests SET status=?,updated_at=? WHERE id=? AND tenant_id=? AND status IN ('ordered','partial')")
      .bind(partial ? "partial" : "received", timestamp, order.request_id, principal.tenantId));
  }
  try {
    await commitWorkflow(env, principal, request, statements, "receive", "purchase-orders", orderId, { partial, inventory_item_id: body.inventory_item_id || null, quantity, stock_movement_id: movementId });
  } catch (error) { return workflowCommitProblem(env, error); }
  return json({ data: serializeRow(await workflowRow(env, principal, "purchase_orders", orderId), "purchase-orders", principal), meta: { stock_movement_id: movementId, partial } });
}

// Tedarikçi teklif toplama ve karşılaştırma. Kazanan teklif seçildiğinde talebe
// tercih edilen tedarikçi ve tutar yazılır; sipariş açma adımı bunu kullanır.
async function compareQuotations(env, principal, requestId) {
  if (!allowed(principal, "supplier-quotations.read")) return problem(403, "forbidden", "Tedarikçi tekliflerini görüntüleme yetkiniz yok.");
  const record = await workflowRow(env, principal, "purchase_requests", requestId);
  if (!record) return problem(404, "not_found", "Satın alma talebi bulunamadı.");
  const rows = await all(env.DB.prepare(`SELECT q.*,s.name AS supplier_name,s.rating AS supplier_rating
    FROM supplier_quotations q JOIN suppliers s ON s.id=q.supplier_id AND s.tenant_id=q.tenant_id
    WHERE q.tenant_id=? AND q.purchase_request_id=? AND q.status<>'expired'
    ORDER BY q.total_minor ASC, q.lead_time_days ASC`).bind(principal.tenantId, requestId));
  const quotations = rows.map((row) => serializeRow(row, "supplier-quotations", principal));
  const comparable = quotations.filter((row) => Number(row.total_minor) > 0);
  const cheapest = comparable[0] || null;
  const fastest = [...comparable].sort((left, right) => Number(left.lead_time_days ?? Infinity) - Number(right.lead_time_days ?? Infinity))[0] || null;
  const selected = quotations.find((row) => row.status === "selected") || null;
  const totals = comparable.map((row) => Number(row.total_minor));
  return json({
    data: {
      request: serializeRow(record, "purchase-requests", principal),
      quotations,
      recommendation: {
        cheapest_quotation_id: cheapest?.id || null,
        fastest_quotation_id: fastest?.id || null,
        selected_quotation_id: selected?.id || null,
        // En ucuz ile seçilen arasındaki fark, kararın gerekçesini görünür kılar.
        saving_against_highest_minor: totals.length > 1 ? Math.max(...totals) - Math.min(...totals) : 0,
        spread_percent: totals.length > 1 && Math.min(...totals) > 0 ? Math.round(((Math.max(...totals) - Math.min(...totals)) / Math.min(...totals)) * 1000) / 10 : null,
      },
    },
    meta: { count: quotations.length, comparable_count: comparable.length },
  });
}

async function quotationAction(request, env, principal, quotationId, action) {
  const capability = action === "select" ? "supplier-quotations.select" : "supplier-quotations.write";
  if (!allowed(principal, capability)) return problem(403, "forbidden", "Bu teklif işlemi için yetkiniz yok.");
  const record = await workflowRow(env, principal, "supplier_quotations", quotationId);
  if (!record) return problem(404, "not_found", "Tedarikçi teklifi bulunamadı.");
  let body;
  try { body = await optionalJson(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
  const timestamp = now();

  if (action === "select") {
    if (record.status === "selected") return json({ data: serializeRow(record, "supplier-quotations", principal), meta: { replayed: true } });
    if (!["draft", "received"].includes(record.status)) return problem(409, "invalid_transition", `${record.status} durumundaki teklif seçilemez.`);
    const purchase = await workflowRow(env, principal, "purchase_requests", record.purchase_request_id);
    if (!purchase) return problem(404, "not_found", "Teklifin bağlı olduğu satın alma talebi bulunamadı.");
    if (["ordered", "partial", "received", "cancelled"].includes(purchase.status)) return problem(409, "invalid_transition", "Siparişe bağlanmış talepte teklif seçimi değiştirilemez.");
    const reason = String(body.reason || "").trim();
    // En ucuz teklif seçilmiyorsa gerekçe zorunludur; karar denetlenebilir kalır.
    const cheapest = await one(env.DB.prepare("SELECT id,total_minor FROM supplier_quotations WHERE tenant_id=? AND purchase_request_id=? AND status IN ('draft','received') AND total_minor>0 ORDER BY total_minor ASC LIMIT 1").bind(principal.tenantId, record.purchase_request_id));
    if (cheapest && cheapest.id !== quotationId && reason.length < 10) {
      return problem(422, "selection_reason_required", "En düşük teklif seçilmediğinde en az 10 karakterlik gerekçe zorunludur.", { cheapest_quotation_id: cheapest.id, cheapest_total_minor: cheapest.total_minor });
    }
    try {
      await commitWorkflow(env, principal, request, [
        env.DB.prepare("UPDATE supplier_quotations SET status='rejected',updated_at=? WHERE tenant_id=? AND purchase_request_id=? AND id<>? AND status IN ('draft','received','selected')").bind(timestamp, principal.tenantId, record.purchase_request_id, quotationId),
        env.DB.prepare("UPDATE supplier_quotations SET status='selected',selected_at=?,selected_by=?,rejection_reason=NULL,updated_at=? WHERE id=? AND tenant_id=?").bind(timestamp, principal.user.id, timestamp, quotationId, principal.tenantId),
        env.DB.prepare("UPDATE purchase_requests SET preferred_supplier_id=?,estimated_amount_minor=?,currency=?,updated_at=? WHERE id=? AND tenant_id=?").bind(record.supplier_id, record.total_minor, record.currency || "TRY", timestamp, record.purchase_request_id, principal.tenantId),
      ], "select", "supplier-quotations", quotationId, { purchase_request_id: record.purchase_request_id, supplier_id: record.supplier_id, total_minor: record.total_minor, reason: reason || null });
    } catch (error) { return workflowCommitProblem(env, error); }
    return json({ data: serializeRow(await workflowRow(env, principal, "supplier_quotations", quotationId), "supplier-quotations", principal) });
  }

  const transitions = { draft: ["received", "expired"], received: ["rejected", "expired"], selected: [], rejected: ["received"], expired: [] };
  const target = body.status;
  if (target === record.status) return json({ data: serializeRow(record, "supplier-quotations", principal), meta: { replayed: true } });
  if (!transitions[record.status]?.includes(target)) return problem(409, "invalid_transition", `${record.status} durumundaki teklif ${target || "boş"} durumuna geçirilemez.`);
  if (target === "rejected" && !String(body.reason || "").trim()) return problem(422, "validation_error", "Ret nedeni zorunludur.");
  try {
    await commitWorkflow(env, principal, request, [env.DB.prepare("UPDATE supplier_quotations SET status=?,rejection_reason=CASE WHEN ?='rejected' THEN ? ELSE rejection_reason END,updated_at=? WHERE id=? AND tenant_id=?")
      .bind(target, target, String(body.reason || "").trim() || null, timestamp, quotationId, principal.tenantId)], "transition", "supplier-quotations", quotationId, { from: record.status, to: target });
  } catch (error) { return workflowCommitProblem(env, error); }
  return json({ data: serializeRow(await workflowRow(env, principal, "supplier_quotations", quotationId), "supplier-quotations", principal) });
}

async function decideLeave(request, env, principal, leaveId, decision) {
  if (!allowed(principal, "leaves.approve")) return problem(403, "forbidden", "İzin talebi kararı verme yetkiniz yok.");
  const record = await workflowRow(env, principal, "leave_requests", leaveId);
  if (!record) return problem(404, "not_found", "İzin talebi bulunamadı.");
  const target = decision === "approve" ? "approved" : "rejected";
  if (record.status === target) return json({ data: serializeRow(record, "leaves", principal), meta: { replayed: true } });
  if (record.status !== "pending") return problem(409, "invalid_transition", `${record.status} durumundaki izin talebi için karar verilemez.`);
  let body;
  try { body = await optionalJson(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
  if (target === "rejected" && !body.reason) return problem(422, "validation_error", "Ret nedeni zorunludur.");
  const timestamp = now();
  try {
    await commitWorkflow(env, principal, request, [env.DB.prepare("UPDATE leave_requests SET status=?,approved_by=?,approved_at=?,reason=COALESCE(?,reason),updated_at=? WHERE id=? AND tenant_id=?").bind(target, principal.user.id, timestamp, body.reason || null, timestamp, leaveId, principal.tenantId)], decision, "leaves", leaveId, { from: record.status, to: target, reason: body.reason || null });
  } catch (error) { return workflowCommitProblem(env, error); }
  return json({ data: serializeRow(await workflowRow(env, principal, "leave_requests", leaveId), "leaves", principal) });
}

async function financialAction(request, env, principal, transactionId, action) {
  const capability = `financial-transactions.${action}`;
  if (!allowed(principal, capability)) return problem(403, "forbidden", "Bu finans işlemi için yetkiniz yok.");
  const record = await workflowRow(env, principal, "financial_transactions", transactionId);
  if (!record) return problem(404, "not_found", "Finans hareketi bulunamadı.");
  const timestamp = now();
  if (action === "approve") {
    if (record.status === "approved") return json({ data: serializeRow(record, "financial-transactions", principal), meta: { replayed: true } });
    if (!["draft", "planned", "pending"].includes(record.status)) return problem(409, "invalid_transition", `${record.status} durumundaki hareket onaylanamaz.`);
    try {
      await commitWorkflow(env, principal, request, [env.DB.prepare("UPDATE financial_transactions SET status='approved',approved_at=?,approved_by=?,updated_at=? WHERE id=? AND tenant_id=?").bind(timestamp, principal.user.id, timestamp, transactionId, principal.tenantId)], "approve", "financial-transactions", transactionId, { from: record.status, to: "approved" });
    } catch (error) { return workflowCommitProblem(env, error); }
    return json({ data: serializeRow(await workflowRow(env, principal, "financial_transactions", transactionId), "financial-transactions", principal) });
  }
  if (record.status === "reversed") {
    const reversal = record.reversed_transaction_id ? await workflowRow(env, principal, "financial_transactions", record.reversed_transaction_id) : await one(env.DB.prepare("SELECT * FROM financial_transactions WHERE reversal_of_id=? AND tenant_id=?").bind(transactionId, principal.tenantId));
    return json({ data: serializeRow(reversal || record, "financial-transactions", principal), meta: { replayed: true, reversed_transaction_id: record.reversed_transaction_id || reversal?.id } });
  }
  if (record.status !== "approved" || record.reversal_of_id) return problem(409, "invalid_transition", "Yalnız onaylı asli finans hareketi ters kayıtla düzeltilebilir.");
  let body;
  try { body = await optionalJson(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
  const reversalId = id("fin_");
  const reversalNumber = `${record.transaction_number}-REV`;
  try {
    await commitWorkflow(env, principal, request, [
      env.DB.prepare("INSERT INTO financial_transactions (id,tenant_id,transaction_number,project_id,account_id,customer_id,supplier_id,type,category,transaction_date,amount_minor,currency,exchange_rate,official,payment_method,reference,description,status,approved_at,approved_by,reversal_of_id,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'approved',?,?,?,?,?,?)").bind(reversalId, principal.tenantId, reversalNumber, record.project_id || null, record.account_id || null, record.customer_id || null, record.supplier_id || null, record.type, record.category || null, timestamp.slice(0, 10), -Number(record.amount_minor), record.currency || "TRY", record.exchange_rate || 1, record.official ? 1 : 0, record.payment_method || null, record.reference || null, body.reason || `Ters kayıt: ${record.transaction_number}`, timestamp, principal.user.id, transactionId, JSON.stringify({ reversal_reason: body.reason || null }), timestamp, timestamp),
      env.DB.prepare("UPDATE financial_transactions SET status='reversed',reversed_transaction_id=?,updated_at=? WHERE id=? AND tenant_id=? AND status='approved'").bind(reversalId, timestamp, transactionId, principal.tenantId),
    ], "reverse", "financial-transactions", transactionId, { reversal_id: reversalId, reason: body.reason || null });
  } catch (error) {
    const existing = await one(env.DB.prepare("SELECT * FROM financial_transactions WHERE reversal_of_id=? AND tenant_id=?").bind(transactionId, principal.tenantId));
    if (existing) return json({ data: serializeRow(existing, "financial-transactions", principal), meta: { replayed: true, reversed_transaction_id: existing.id } });
    return workflowCommitProblem(env, error);
  }
  return json({ data: serializeRow(await workflowRow(env, principal, "financial_transactions", reversalId), "financial-transactions", principal), meta: { reversed_transaction_id: reversalId } }, 201);
}

async function transitionSurvey(request, env, principal, surveyId) {
  if (!allowed(principal, "site-surveys.approve")) return problem(403, "forbidden", "Keşif aşaması değiştirme yetkiniz yok.");
  const record = await workflowRow(env, principal, "site_surveys", surveyId);
  if (!record) return problem(404, "not_found", "Keşif bulunamadı.");
  let body;
  try { body = await parseBody(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
  const transitions = { draft: ["in_progress", "cancelled"], in_progress: ["completed", "cancelled"], completed: ["approved", "in_progress"], approved: [], cancelled: [] };
  if (body.status === record.status) return json({ data: serializeRow(record, "site-surveys", principal), meta: { replayed: true } });
  if (!transitions[record.status]?.includes(body.status)) return problem(409, "invalid_transition", `${record.status} durumundan ${body.status || "boş"} durumuna geçilemez.`);
  const timestamp = now();
  try {
    await commitWorkflow(env, principal, request, [env.DB.prepare("UPDATE site_surveys SET status=?,completed_at=CASE WHEN ?='completed' THEN ? ELSE completed_at END,approved_at=CASE WHEN ?='approved' THEN ? ELSE approved_at END,approved_by=CASE WHEN ?='approved' THEN ? ELSE approved_by END,updated_at=? WHERE id=? AND tenant_id=?").bind(body.status, body.status, timestamp, body.status, timestamp, body.status, principal.user.id, timestamp, surveyId, principal.tenantId)], "transition", "site-surveys", surveyId, { from: record.status, to: body.status });
  } catch (error) { return workflowCommitProblem(env, error); }
  return json({ data: serializeRow(await workflowRow(env, principal, "site_surveys", surveyId), "site-surveys", principal) });
}

async function transitionContract(request, env, principal, contractId) {
  if (!allowed(principal, "contracts.transition")) return problem(403, "forbidden", "Sözleşme yaşam döngüsü yetkiniz yok.");
  const record = await workflowRow(env, principal, "contracts", contractId);
  if (!record) return problem(404, "not_found", "Sözleşme bulunamadı.");
  let body;
  try { body = await parseBody(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
  const transitions = { draft: ["pending_signature", "cancelled"], pending_signature: ["signed", "cancelled"], signed: ["active", "terminated"], active: ["completed", "terminated"], completed: [], terminated: [], cancelled: [] };
  if (body.status === record.status) return json({ data: serializeRow(record, "contracts", principal), meta: { replayed: true } });
  if (!transitions[record.status]?.includes(body.status)) return problem(409, "invalid_transition", `${record.status} durumundan ${body.status || "boş"} durumuna geçilemez.`);
  const customerSigner = body.signed_by_customer || record.signed_by_customer;
  const companySigner = body.signed_by_company || record.signed_by_company;
  if (body.status === "signed" && (!customerSigner || !companySigner)) return problem(422, "signature_required", "Müşteri ve firma imza yetkilileri zorunludur.");
  if (body.status === "terminated" && !body.reason) return problem(422, "validation_error", "Fesih nedeni zorunludur.");
  const timestamp = now();
  try {
    await commitWorkflow(env, principal, request, [env.DB.prepare("UPDATE contracts SET status=?,signed_at=CASE WHEN ?='signed' THEN ? ELSE signed_at END,signed_by_customer=COALESCE(?,signed_by_customer),signed_by_company=COALESCE(?,signed_by_company),termination_reason=CASE WHEN ?='terminated' THEN ? ELSE termination_reason END,updated_at=? WHERE id=? AND tenant_id=?").bind(body.status, body.status, timestamp, body.signed_by_customer || null, body.signed_by_company || null, body.status, body.reason || null, timestamp, contractId, principal.tenantId)], "transition", "contracts", contractId, { from: record.status, to: body.status, reason: body.reason || null });
  } catch (error) { return workflowCommitProblem(env, error); }
  return json({ data: serializeRow(await workflowRow(env, principal, "contracts", contractId), "contracts", principal) });
}

async function designRevisionAction(request, env, principal, revisionId, action) {
  const capability = action === "submit" ? "design-revisions.write" : "design-revisions.approve";
  if (!allowed(principal, capability)) return problem(403, "forbidden", "Tasarım revizyonu işlemi için yetkiniz yok.");
  const record = await workflowRow(env, principal, "design_revisions", revisionId);
  if (!record) return problem(404, "not_found", "Tasarım revizyonu bulunamadı.");
  let body;
  try { body = await optionalJson(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
  const timestamp = now();
  let target;
  const statements = [];
  if (action === "submit") {
    target = "client_review";
    if (!["draft", "internal_review", "rejected"].includes(record.status)) return problem(409, "invalid_transition", `${record.status} revizyonu müşteriye sunulamaz.`);
    statements.push(env.DB.prepare("UPDATE design_revisions SET status='client_review',submitted_at=?,rejection_reason=NULL,updated_at=? WHERE id=? AND tenant_id=?").bind(timestamp, timestamp, revisionId, principal.tenantId));
  } else if (action === "approve") {
    target = "approved";
    if (record.status === "approved") return json({ data: serializeRow(record, "design-revisions", principal), meta: { replayed: true } });
    if (record.status !== "client_review") return problem(409, "invalid_transition", `${record.status} revizyonu müşteri tarafından onaylanamaz.`);
    statements.push(env.DB.prepare("UPDATE design_revisions SET status='superseded',updated_at=? WHERE tenant_id=? AND project_id=? AND drawing_type=? AND status='approved' AND id<>?").bind(timestamp, principal.tenantId, record.project_id, record.drawing_type, revisionId));
    statements.push(env.DB.prepare("UPDATE design_revisions SET status='approved',client_decision_at=?,client_decision_by=?,rejection_reason=NULL,updated_at=? WHERE id=? AND tenant_id=?").bind(timestamp, body.client_name || null, timestamp, revisionId, principal.tenantId));
  } else if (action === "reject") {
    target = "rejected";
    if (record.status === "rejected") return json({ data: serializeRow(record, "design-revisions", principal), meta: { replayed: true } });
    if (record.status !== "client_review") return problem(409, "invalid_transition", `${record.status} revizyonu reddedilemez.`);
    if (!body.reason) return problem(422, "validation_error", "Ret nedeni zorunludur.");
    statements.push(env.DB.prepare("UPDATE design_revisions SET status='rejected',client_decision_at=?,client_decision_by=?,rejection_reason=?,updated_at=? WHERE id=? AND tenant_id=?").bind(timestamp, body.client_name || null, body.reason, timestamp, revisionId, principal.tenantId));
  } else {
    target = "superseded";
    if (record.status === "superseded") return json({ data: serializeRow(record, "design-revisions", principal), meta: { replayed: true } });
    if (record.status !== "approved" || !validId(body.replacement_revision_id)) return problem(409, "invalid_transition", "Onaylı revizyon ve geçerli replacement_revision_id zorunludur.");
    const replacement = await workflowRow(env, principal, "design_revisions", body.replacement_revision_id);
    if (!replacement || replacement.project_id !== record.project_id || replacement.drawing_type !== record.drawing_type || replacement.id === record.id) return problem(422, "cross_tenant_reference", "Yeni revizyon aynı tenant, proje ve çizim tipinde olmalıdır.");
    statements.push(env.DB.prepare("UPDATE design_revisions SET status='superseded',updated_at=? WHERE id=? AND tenant_id=?").bind(timestamp, revisionId, principal.tenantId));
    statements.push(env.DB.prepare("UPDATE design_revisions SET supersedes_id=?,updated_at=? WHERE id=? AND tenant_id=?").bind(revisionId, timestamp, replacement.id, principal.tenantId));
  }
  try { await commitWorkflow(env, principal, request, statements, action, "design-revisions", revisionId, { from: record.status, to: target, reason: body.reason || null }); }
  catch (error) { return workflowCommitProblem(env, error); }
  return json({ data: serializeRow(await workflowRow(env, principal, "design_revisions", revisionId), "design-revisions", principal) });
}

async function progressPaymentAction(request, env, principal, paymentId, action) {
  const capability = action === "submit" ? "progress-payments.write" : "progress-payments.approve";
  if (!allowed(principal, capability)) return problem(403, "forbidden", "Hakediş işlemi için yetkiniz yok.");
  const record = await workflowRow(env, principal, "progress_payments", paymentId);
  if (!record) return problem(404, "not_found", "Hakediş bulunamadı.");
  let body;
  try { body = await optionalJson(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
  const targets = { submit: "pending", approve: "approved", reject: "rejected", invoice: "invoiced", paid: "paid" };
  const target = targets[action];
  if (record.status === target) return json({ data: serializeRow(record, "progress-payments", principal), meta: { replayed: true } });
  const allowedFrom = { submit: ["draft", "rejected"], approve: ["pending"], reject: ["pending"], invoice: ["approved"], paid: ["invoiced"] };
  if (!allowedFrom[action]?.includes(record.status)) return problem(409, "invalid_transition", `${record.status} hakedişi ${target} durumuna geçirilemez.`);
  if (action === "reject" && !body.reason) return problem(422, "validation_error", "Ret nedeni zorunludur.");
  if (action === "invoice") {
    const invoice = validId(body.invoice_id) ? await workflowRow(env, principal, "invoices", body.invoice_id) : null;
    if (!invoice || invoice.project_id !== record.project_id) return problem(422, "cross_tenant_reference", "Hakediş projesine ait invoice_id zorunludur.");
  }
  if (action === "paid") {
    const transaction = validId(body.payment_transaction_id) ? await workflowRow(env, principal, "financial_transactions", body.payment_transaction_id) : null;
    if (!transaction || transaction.project_id !== record.project_id || transaction.status !== "approved") return problem(422, "cross_tenant_reference", "Hakediş projesine ait onaylı payment_transaction_id zorunludur.");
  }
  const timestamp = now();
  const statement = env.DB.prepare("UPDATE progress_payments SET status=?,approved_at=CASE WHEN ?='approved' THEN ? ELSE approved_at END,approved_by=CASE WHEN ?='approved' THEN ? ELSE approved_by END,rejection_reason=CASE WHEN ?='rejected' THEN ? WHEN ?='approved' THEN NULL ELSE rejection_reason END,invoice_id=CASE WHEN ?='invoiced' THEN ? ELSE invoice_id END,invoiced_at=CASE WHEN ?='invoiced' THEN ? ELSE invoiced_at END,payment_transaction_id=CASE WHEN ?='paid' THEN ? ELSE payment_transaction_id END,paid_at=CASE WHEN ?='paid' THEN ? ELSE paid_at END,updated_at=? WHERE id=? AND tenant_id=?")
    .bind(target, target, timestamp, target, principal.user.id, target, body.reason || null, target, target, body.invoice_id || null, target, timestamp, target, body.payment_transaction_id || null, target, timestamp, timestamp, paymentId, principal.tenantId);
  try { await commitWorkflow(env, principal, request, [statement], action, "progress-payments", paymentId, { from: record.status, to: target, invoice_id: body.invoice_id || null, payment_transaction_id: body.payment_transaction_id || null }); }
  catch (error) { return workflowCommitProblem(env, error); }
  return json({ data: serializeRow(await workflowRow(env, principal, "progress_payments", paymentId), "progress-payments", principal) });
}

async function postStockMovement(request, env, principal, movementId) {
  if (!allowed(principal, "stock-movements.post")) return problem(403, "forbidden", "Stok hareketi kesinleştirme yetkiniz yok.");
  const record = await one(env.DB.prepare("SELECT sm.*,ii.on_hand_quantity,ii.reserved_quantity,ii.name AS inventory_item_name FROM stock_movements sm JOIN inventory_items ii ON ii.id=sm.inventory_item_id AND ii.tenant_id=sm.tenant_id WHERE sm.id=? AND sm.tenant_id=?").bind(movementId, principal.tenantId));
  if (!record) return problem(404, "not_found", "Stok hareketi bulunamadı.");
  if (record.status === "posted") return json({ data: serializeRow(record, "stock-movements", principal), meta: { replayed: true } });
  if (record.status !== "draft") return problem(409, "invalid_transition", `${record.status} durumundaki stok hareketi kesinleştirilemez.`);
  const outbound = ["issue", "adjustment_out", "project_issue"].includes(record.movement_type);
  const quantity = Number(record.quantity);
  // Projeye çıkış, o proje için ayrılmış rezervasyonu tüketir; serbest çıkış ise
  // yalnızca rezerve edilmemiş bakiyeden yapılabilir.
  const consumesReservation = record.movement_type === "project_issue";
  if (outbound && Number(record.on_hand_quantity) < quantity) return problem(409, "insufficient_stock", "Stok miktarı bu çıkış için yetersiz.");
  if (outbound && !consumesReservation && Number(record.on_hand_quantity) - Number(record.reserved_quantity || 0) < quantity) {
    return problem(409, "stock_reserved", "Bu miktar başka projelere ayrılmış durumda. Projeye çıkış (project_issue) kullanın veya önce rezervasyonu serbest bırakın.", { available_quantity: Math.max(0, Number(record.on_hand_quantity) - Number(record.reserved_quantity || 0)) });
  }
  const timestamp = now();
  const totalCost = Number(record.total_cost_minor || 0) || Math.round(quantity * Number(record.unit_cost_minor || 0));
  const delta = outbound ? -quantity : quantity;
  const availabilityGuard = outbound
    ? (consumesReservation ? "AND on_hand_quantity >= ?" : "AND on_hand_quantity - reserved_quantity >= ?")
    : "";
  const updateBalance = env.DB.prepare(`UPDATE inventory_items SET on_hand_quantity=on_hand_quantity+?,reserved_quantity=MAX(0,reserved_quantity-?),updated_at=? WHERE id=? AND tenant_id=? ${availabilityGuard}`)
    .bind(delta, consumesReservation ? quantity : 0, timestamp, record.inventory_item_id, principal.tenantId, ...(outbound ? [quantity] : []));
  // Hareket ancak stok gerçekten güncellendiyse (aynı işlemdeki updated_at damgası)
  // kesinleşir; yetersiz stokta iki statement de sessizce boş geçer.
  const postMovement = env.DB.prepare("UPDATE stock_movements SET status='posted',total_cost_minor=?,posted_at=?,posted_by=?,updated_at=? WHERE id=? AND tenant_id=? AND status='draft' AND EXISTS (SELECT 1 FROM inventory_items ii WHERE ii.id=stock_movements.inventory_item_id AND ii.tenant_id=stock_movements.tenant_id AND ii.updated_at=?)")
    .bind(totalCost, timestamp, principal.user.id, timestamp, movementId, principal.tenantId, timestamp);
  let results;
  try {
    results = await commitWorkflow(env, principal, request, [updateBalance, postMovement], "post", "stock-movements", movementId, { inventory_item_id: record.inventory_item_id, movement_type: record.movement_type, quantity: record.quantity });
  } catch (error) {
    return workflowCommitProblem(env, error);
  }
  if (!Number(results?.[1]?.meta?.changes || 0)) {
    const current = await workflowRow(env, principal, "inventory_items", record.inventory_item_id);
    return problem(409, "insufficient_stock", "Stok miktarı bu sırada değişti; hareket uygulanmadı.", { available_quantity: Math.max(0, Number(current?.on_hand_quantity || 0) - Number(current?.reserved_quantity || 0)) });
  }
  return json({ data: serializeRow(await workflowRow(env, principal, "stock_movements", movementId), "stock-movements", principal) });
}

async function meetingTransition(request, env, principal, meetingId) {
  if (!allowed(principal, "project-meetings.publish")) return problem(403, "forbidden", "Toplantı yayınlama yetkiniz yok.");
  const record = await workflowRow(env, principal, "project_meetings", meetingId);
  if (!record) return problem(404, "not_found", "Toplantı bulunamadı.");
  let body;
  try { body = await parseBody(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
  const transitions = { draft: ["published"], published: ["closed"], closed: [] };
  if (record.status === body.status) return json({ data: serializeRow(record, "project-meetings", principal), meta: { replayed: true } });
  if (!transitions[record.status]?.includes(body.status)) return problem(409, "invalid_transition", "Geçersiz toplantı durumu geçişi.");
  const timestamp = now();
  try { await commitWorkflow(env, principal, request, [env.DB.prepare("UPDATE project_meetings SET status=?,published_at=CASE WHEN ?='published' THEN ? ELSE published_at END,closed_at=CASE WHEN ?='closed' THEN ? ELSE closed_at END,updated_at=? WHERE id=? AND tenant_id=?").bind(body.status, body.status, timestamp, body.status, timestamp, timestamp, meetingId, principal.tenantId)], "transition", "project-meetings", meetingId, { from: record.status, to: body.status }); }
  catch (error) { return workflowCommitProblem(env, error); }
  return json({ data: serializeRow(await workflowRow(env, principal, "project_meetings", meetingId), "project-meetings", principal) });
}

async function qualityTransition(request, env, principal, inspectionId) {
  if (!allowed(principal, "quality-inspections.complete")) return problem(403, "forbidden", "Kalite kontrolünü sonuçlandırma yetkiniz yok.");
  const record = await workflowRow(env, principal, "quality_inspections", inspectionId);
  if (!record) return problem(404, "not_found", "Kalite kontrolü bulunamadı.");
  let body;
  try { body = await parseBody(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
  const transitions = { draft: ["completed"], completed: ["closed"], closed: [] };
  if (record.status === body.status) return json({ data: serializeRow(record, "quality-inspections", principal), meta: { replayed: true } });
  if (!transitions[record.status]?.includes(body.status)) return problem(409, "invalid_transition", "Geçersiz kalite kontrolü geçişi.");
  const result = body.result || record.result;
  if (body.status === "completed" && !["pass", "conditional", "fail"].includes(result)) return problem(422, "result_required", "Kontrol tamamlanırken pass, conditional veya fail sonucu zorunludur.");
  const timestamp = now();
  try { await commitWorkflow(env, principal, request, [env.DB.prepare("UPDATE quality_inspections SET status=?,result=?,completed_at=CASE WHEN ?='completed' THEN ? ELSE completed_at END,closed_at=CASE WHEN ?='closed' THEN ? ELSE closed_at END,updated_at=? WHERE id=? AND tenant_id=?").bind(body.status, result, body.status, timestamp, body.status, timestamp, timestamp, inspectionId, principal.tenantId)], "transition", "quality-inspections", inspectionId, { from: record.status, to: body.status, result }); }
  catch (error) { return workflowCommitProblem(env, error); }
  return json({ data: serializeRow(await workflowRow(env, principal, "quality_inspections", inspectionId), "quality-inspections", principal) });
}

async function handoverTransition(request, env, principal, handoverId) {
  if (!allowed(principal, "handovers.transition")) return problem(403, "forbidden", "Teslim-kabul aşaması değiştirme yetkiniz yok.");
  const record = await workflowRow(env, principal, "handovers", handoverId);
  if (!record) return problem(404, "not_found", "Teslim kaydı bulunamadı.");
  let body;
  try { body = await parseBody(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
  const transitions = { draft: ["punch_open", "accepted", "rejected"], punch_open: ["accepted", "rejected"], accepted: ["closed"], rejected: ["punch_open"], closed: [] };
  if (record.status === body.status) return json({ data: serializeRow(record, "handovers", principal), meta: { replayed: true } });
  if (!transitions[record.status]?.includes(body.status)) return problem(409, "invalid_transition", "Geçersiz teslim-kabul durumu geçişi.");
  const score = body.satisfaction_score ?? record.satisfaction_score;
  const signatureId = body.customer_signature_file_id || record.customer_signature_file_id;
  if (body.status === "accepted") {
    const signature = validId(signatureId) ? await workflowRow(env, principal, "files", signatureId) : null;
    if (!signature || !Number.isInteger(Number(score)) || Number(score) < 1 || Number(score) > 5) return problem(422, "acceptance_evidence_required", "Kabul için tenant kapsamlı müşteri imzası ve 1-5 memnuniyet skoru zorunludur.");
    const openPunch = await one(env.DB.prepare("SELECT COUNT(*) AS count FROM handover_punch_items WHERE tenant_id=? AND handover_id=? AND status NOT IN ('accepted','cancelled')").bind(principal.tenantId, handoverId));
    if (Number(openPunch?.count || 0) > 0) return problem(409, "punch_list_open", "Kabulden önce tüm eksik kalemleri kapatılmalıdır.");
  }
  if (body.status === "rejected" && !body.reason) return problem(422, "validation_error", "Ret nedeni zorunludur.");
  const timestamp = now();
  try { await commitWorkflow(env, principal, request, [env.DB.prepare("UPDATE handovers SET status=?,satisfaction_score=COALESCE(?,satisfaction_score),customer_signature_file_id=COALESCE(?,customer_signature_file_id),acceptance_notes=COALESCE(?,acceptance_notes),accepted_at=CASE WHEN ?='accepted' THEN ? ELSE accepted_at END,rejected_at=CASE WHEN ?='rejected' THEN ? ELSE rejected_at END,closed_at=CASE WHEN ?='closed' THEN ? ELSE closed_at END,updated_at=? WHERE id=? AND tenant_id=?").bind(body.status, score || null, signatureId || null, body.reason || body.acceptance_notes || null, body.status, timestamp, body.status, timestamp, body.status, timestamp, timestamp, handoverId, principal.tenantId)], "transition", "handovers", handoverId, { from: record.status, to: body.status, satisfaction_score: score || null }); }
  catch (error) { return workflowCommitProblem(env, error); }
  return json({ data: serializeRow(await workflowRow(env, principal, "handovers", handoverId), "handovers", principal) });
}

async function deleteResource(request, env, principal, slug, config, resourceId) {
  if (config.readOnly) return problem(405, "read_only", "Bu kaynak salt okunurdur.");
  if (!allowed(principal, permissionFor(slug, "delete"))) return problem(403, "forbidden", "Kayıt silme yetkiniz yok.");
  const existing = await one(env.DB.prepare(`SELECT * FROM ${config.table} WHERE id=? AND tenant_id=?`).bind(resourceId, principal.tenantId));
  if (!existing) return problem(404, "not_found", "Kayıt bulunamadı.");
  if (slug === "financial-transactions" && ["approved", "reversed"].includes(existing.status)) return problem(409, "approved_record_immutable", "Onaylı finans kaydı silinemez; ters kayıt oluşturun.");
  const protectedStates = { "site-surveys": ["approved"], contracts: ["signed","active","completed","terminated"], "design-revisions": ["approved","superseded"], "progress-payments": ["approved","invoiced","paid"], "stock-movements": ["posted"], "project-meetings": ["published","closed"], "quality-inspections": ["completed","closed"], handovers: ["accepted","closed"] };
  if (protectedStates[slug]?.includes(existing.status)) return problem(409, "workflow_record_immutable", "Kesinleşmiş iş akışı kaydı silinemez.");
  if (slug === "survey-measurements") {
    const survey = await workflowRow(env, principal, "site_surveys", existing.site_survey_id);
    if (!survey || ["approved", "cancelled"].includes(survey.status)) return problem(409, "survey_locked", "Onaylı veya iptal edilmiş keşfin metrajı silinemez.");
  }
  if (slug === "meeting-actions") {
    const meeting = await workflowRow(env, principal, "project_meetings", existing.meeting_id);
    if (!meeting || meeting.status === "closed") return problem(409, "meeting_closed", "Kapatılmış toplantının aksiyonu silinemez.");
  }
  if (slug === "handover-punch-items") {
    const handover = await workflowRow(env, principal, "handovers", existing.handover_id);
    if (!handover || ["accepted", "closed"].includes(handover.status)) return problem(409, "handover_locked", "Kabul edilmiş teslimin eksik kalemi silinemez.");
  }
  try {
    if (slug === "files" && existing.object_key && env.FILES) await env.FILES.delete(existing.object_key);
    await run(env.DB.prepare(`DELETE FROM ${config.table} WHERE id=? AND tenant_id=?`).bind(resourceId, principal.tenantId));
  } catch (error) { return problem(409, "record_in_use", "Bu kayıt ilişkili kayıtlarda kullanıldığı için silinemiyor.", env.EXPOSE_ERRORS === "true" ? String(error) : undefined); }
  await audit(env, principal, request, "delete", slug, resourceId, { previous: decodeRow(existing) });
  return new Response(null, { status: 204 });
}

async function resolveFileContext(env, principal, form, entityType, entityId) {
  const entityDefinition = fileEntityContexts[entityType];
  if (!entityDefinition) return { error: problem(422, "validation_error", "Desteklenmeyen bağlı modül seçildi.") };
  const [entityTable, entityProjectColumn] = entityDefinition;
  const entity = await one(env.DB.prepare(`SELECT * FROM ${entityTable} WHERE id=? AND tenant_id=?`).bind(entityId, principal.tenantId));
  if (!entity) return { error: problem(422, "cross_tenant_reference", "Bağlı kayıt bu firmada bulunamadı.") };

  const contextDefinitions = [
    ["work_item_id", "work_items"],
    ["design_revision_id", "design_revisions"],
    ["quality_inspection_id", "quality_inspections"],
    ["installation_id", "installations"],
  ];
  const context = {};
  const projectIds = new Set();
  if (entityType === "projects") projectIds.add(entity.id);
  else if (entityProjectColumn && entity[entityProjectColumn]) projectIds.add(entity[entityProjectColumn]);

  for (const [field, table] of contextDefinitions) {
    const value = String(form.get(field) || "").trim();
    if (!value) { context[field] = null; continue; }
    if (!validId(value)) return { error: problem(422, "validation_error", `${field} geçerli bir kayıt ID'si olmalıdır.`) };
    const record = await one(env.DB.prepare(`SELECT id,project_id FROM ${table} WHERE id=? AND tenant_id=?`).bind(value, principal.tenantId));
    if (!record) return { error: problem(422, "cross_tenant_reference", `${field} bu firmada bulunamadı.`) };
    context[field] = record.id;
    if (record.project_id) projectIds.add(record.project_id);
  }

  const requestedProjectId = String(form.get("project_id") || "").trim();
  if (requestedProjectId) {
    if (!validId(requestedProjectId)) return { error: problem(422, "validation_error", "project_id geçerli bir kayıt ID'si olmalıdır.") };
    projectIds.add(requestedProjectId);
  }
  if (projectIds.size > 1) return { error: problem(422, "project_context_mismatch", "Dosyanın proje, iş kalemi ve operasyon bağlantıları aynı projeye ait olmalıdır.") };

  const projectId = [...projectIds][0] || null;
  const project = projectId ? await one(env.DB.prepare("SELECT id,photo_consent FROM projects WHERE id=? AND tenant_id=?").bind(projectId, principal.tenantId)) : null;
  if (projectId && !project) return { error: problem(422, "cross_tenant_reference", "Bağlı proje bu firmada bulunamadı.") };
  const visibility = String(form.get("visibility") || "internal");
  if (!["internal", "customer", "marketing"].includes(visibility)) return { error: problem(422, "validation_error", "Geçersiz dosya görünürlüğü.") };
  if (visibility === "marketing" && project?.photo_consent !== "marketing_allowed") return { error: problem(409, "photo_consent_required", "Pazarlama görünürlüğü için projede pazarlama fotoğraf izni bulunmalıdır.") };
  const captureStage = String(form.get("capture_stage") || "other");
  if (!["discovery","design","procurement","production","quality","installation","handover","other"].includes(captureStage)) return { error: problem(422, "validation_error", "Geçersiz çekim aşaması.") };
  const takenAt = String(form.get("taken_at") || "").trim();
  if (takenAt && Number.isNaN(Date.parse(takenAt))) return { error: problem(422, "validation_error", "Çekim tarihi geçerli değil.") };
  const spaceName = String(form.get("space_name") || "").trim().slice(0, 120) || null;
  return { context: { ...context, project_id: projectId, space_name: spaceName, capture_stage: captureStage, taken_at: takenAt || null, visibility, photo_consent_snapshot: project?.photo_consent || null } };
}

async function uploadFile(request, env, principal) {
  if (!allowed(principal, permissionFor("files", "write"))) return problem(403, "forbidden", "Dosya yükleme yetkiniz yok.");
  if (!env.FILES) return problem(503, "storage_unavailable", "Dosya deposu yapılandırılmamış.");
  let form;
  try { form = await request.formData(); } catch { return problem(400, "invalid_form", "Geçerli multipart form verisi gönderin."); }
  const file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function") return problem(422, "validation_error", "file alanı zorunludur.");
  const maxBytes = Number(env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024);
  if (file.size > maxBytes) return problem(413, "file_too_large", `Dosya en fazla ${maxBytes} bayt olabilir.`);
  const entityType = String(form.get("entity_type") || "general");
  const entityId = String(form.get("entity_id") || "general");
  if (!validId(entityId) || !/^[A-Za-z0-9_-]{1,50}$/.test(entityType)) return problem(422, "validation_error", "Geçersiz entity_type veya entity_id.");
  const category = String(form.get("category") || "other");
  if (category === "photo" && !String(file.type || "").startsWith("image/")) return problem(422, "validation_error", "Fotoğraf kategorisine yalnız görüntü dosyası yüklenebilir.");
  const resolved = await resolveFileContext(env, principal, form, entityType, entityId);
  if (resolved.error) return resolved.error;
  const context = resolved.context;
  const fileId = id("fil_");
  const safeName = String(file.name || "file").replace(/[^A-Za-z0-9._-]+/g, "_").slice(-120);
  const objectKey = `${principal.tenantId}/${entityType}/${entityId}/${fileId}-${safeName}`;
  const bytes = await file.arrayBuffer();
  const checksum = await sha256(bytes);
  const timestamp = now();
  try {
    await env.FILES.put(objectKey, bytes, { httpMetadata: { contentType: file.type || "application/octet-stream" }, customMetadata: { tenantId: principal.tenantId, fileId, projectId: context.project_id || "" } });
    await run(env.DB.prepare("INSERT INTO files (id,tenant_id,entity_type,entity_id,category,file_name,object_key,content_type,size_bytes,checksum,uploaded_by,description,project_id,work_item_id,design_revision_id,quality_inspection_id,installation_id,space_name,capture_stage,taken_at,visibility,photo_consent_snapshot,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(fileId, principal.tenantId, entityType, entityId, category, file.name || safeName, objectKey, file.type || "application/octet-stream", file.size, checksum, principal.user.id, form.get("description") || null, context.project_id, context.work_item_id, context.design_revision_id, context.quality_inspection_id, context.installation_id, context.space_name, context.capture_stage, context.taken_at, context.visibility, context.photo_consent_snapshot, "{}", timestamp, timestamp));
  } catch (error) {
    try { await env.FILES.delete(objectKey); } catch { /* best-effort orphan cleanup */ }
    return problem(503, "file_store_failed", "Dosya ve bağlam kaydı güvenli biçimde tamamlanamadı; yükleme geri alındı.", env.EXPOSE_ERRORS === "true" ? String(error) : undefined);
  }
  await audit(env, principal, request, "upload", "files", fileId, { entity_type: entityType, entity_id: entityId, project_id: context.project_id, capture_stage: context.capture_stage, visibility: context.visibility, size_bytes: file.size });
  return json({ data: decodeRow(await one(env.DB.prepare("SELECT * FROM files WHERE id=? AND tenant_id=?").bind(fileId, principal.tenantId))) }, 201);
}

async function downloadFile(env, principal, fileId) {
  if (!allowed(principal, "files.read")) return problem(403, "forbidden", "Dosya görüntüleme yetkiniz yok.");
  if (!env.FILES) return problem(503, "storage_unavailable", "Dosya deposu yapılandırılmamış.");
  const metadata = await one(env.DB.prepare("SELECT * FROM files WHERE id=? AND tenant_id=?").bind(fileId, principal.tenantId));
  if (!metadata) return problem(404, "not_found", "Dosya bulunamadı.");
  // Görünürlük yazarken doğrulanıyordu ama okurken kontrol edilmiyordu.
  if (metadata.visibility === "marketing" && metadata.photo_consent_snapshot !== "marketing_allowed" && !allowed(principal, "files.manage")) {
    return problem(403, "photo_consent_revoked", "Bu görselin pazarlama izni artık geçerli değil.");
  }
  const object = await env.FILES.get(metadata.object_key);
  if (!object) return problem(404, "object_missing", "Dosya nesnesi bulunamadı.");
  const inlineTypes = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp", "application/pdf"]);
  const inline = inlineTypes.has(String(metadata.content_type || "").toLowerCase());
  const headers = new Headers({
    "content-type": inline ? metadata.content_type : "application/octet-stream",
    "content-disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(metadata.file_name)}`,
    "content-security-policy": "default-src 'none'; sandbox",
    "cache-control": "private, max-age=300",
    "x-content-type-options": "nosniff",
  });
  if (object.httpEtag) headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
}

async function writeBackup(env, tenantId, triggeredBy = "scheduler") {
  const backupId = id("bak_");
  const started = now();
  const automated = triggeredBy === "scheduler" || triggeredBy === "request-fallback";
  const backupDate = automated ? started.slice(0, 10) : null;
  try {
    await run(env.DB.prepare("INSERT INTO backup_runs (id,tenant_id,status,triggered_by,backup_date,created_at) VALUES (?,?,?,?,?,?)").bind(backupId, tenantId, "running", triggeredBy, backupDate, started));
  } catch (error) {
    if (!backupDate) throw error;
    const existing = await one(env.DB.prepare("SELECT * FROM backup_runs WHERE tenant_id=? AND backup_date=? ORDER BY created_at DESC LIMIT 1").bind(tenantId, backupDate));
    if (existing) return { ...decodeRow(existing), replayed: true };
    throw error;
  }
  if (!env.FILES) {
    const message = "R2 FILES binding yapılandırılmamış.";
    await run(env.DB.prepare("UPDATE backup_runs SET status='failed',error_message=?,completed_at=? WHERE id=? AND tenant_id=?").bind(message, now(), backupId, tenantId));
    await audit(env, { tenantId, user: null }, null, "backup.failed", "backups", backupId, { error: message });
    return { id: backupId, tenant_id: tenantId, status: "failed", error_message: message };
  }
  try {
    const lines = [JSON.stringify({ type: "manifest", version: 1, schema_version: BACKUP_SCHEMA_VERSION, migrations: backupMigrations, tenant_id: tenantId, created_at: started })];
    const tenant = await one(env.DB.prepare("SELECT * FROM tenants WHERE id=?").bind(tenantId));
    lines.push(JSON.stringify({ table: "tenants", row: tenant }));
    const users = await all(env.DB.prepare("SELECT u.* FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.tenant_id=?").bind(tenantId));
    for (const row of users) lines.push(JSON.stringify({ table: "users", row }));
    let rowCount = users.length + (tenant ? 1 : 0);
    for (const table of backupTables) {
      const rows = await all(env.DB.prepare(`SELECT * FROM ${table} WHERE tenant_id=?`).bind(tenantId));
      rowCount += rows.length;
      for (const row of rows) lines.push(JSON.stringify({ table, row }));
    }
    const objectKey = `backups/${tenantId}/${started.slice(0, 10)}/${backupId}.jsonl`;
    await env.FILES.put(objectKey, lines.join("\n"), { httpMetadata: { contentType: "application/x-ndjson" }, customMetadata: { tenantId, backupId, createdAt: started } });
    await run(env.DB.prepare("UPDATE backup_runs SET status='completed',object_key=?,row_count=?,completed_at=? WHERE id=? AND tenant_id=?").bind(objectKey, rowCount, now(), backupId, tenantId));
    await audit(env, { tenantId, user: null }, null, "backup.completed", "backups", backupId, { object_key: objectKey, row_count: rowCount });
    return { id: backupId, tenant_id: tenantId, status: "completed", object_key: objectKey, row_count: rowCount };
  } catch (error) {
    const message = String(error?.message || error).slice(0, 500);
    await run(env.DB.prepare("UPDATE backup_runs SET status='failed',error_message=?,completed_at=? WHERE id=? AND tenant_id=?").bind(message, now(), backupId, tenantId));
    await audit(env, { tenantId, user: null }, null, "backup.failed", "backups", backupId, { error: message });
    return { id: backupId, tenant_id: tenantId, status: "failed", error_message: message };
  }
}

async function ensureDailyBackup(env, tenantId) {
  if (!env.DB || !env.FILES || env.ENABLE_REQUEST_BACKUP_FALLBACK === "false") return null;
  const backupDate = now().slice(0, 10);
  if (dailyBackupSeen.get(tenantId) === backupDate) return null;
  const existing = await one(env.DB.prepare("SELECT id,status FROM backup_runs WHERE tenant_id=? AND backup_date=? ORDER BY created_at DESC LIMIT 1").bind(tenantId, backupDate));
  if (existing) {
    rememberDailyBackup(tenantId, backupDate);
    return { ...existing, replayed: true };
  }
  const result = await writeBackup(env, tenantId, "request-fallback");
  rememberDailyBackup(tenantId, backupDate);
  return result;
}

// Uzun ömürlü self-host sürecinde bu harita sınırsız büyüyebiliyordu.
function rememberDailyBackup(tenantId, backupDate) {
  if (dailyBackupSeen.size >= DAILY_BACKUP_SEEN_LIMIT) {
    for (const key of dailyBackupSeen.keys()) {
      dailyBackupSeen.delete(key);
      if (dailyBackupSeen.size < DAILY_BACKUP_SEEN_LIMIT) break;
    }
  }
  dailyBackupSeen.set(tenantId, backupDate);
}

async function backupRoute(request, env, principal, segments) {
  const needed = request.method === "GET" ? "backups.read" : "backups.write";
  if (!allowed(principal, needed)) return problem(403, "forbidden", "Yedek yönetimi yetkiniz yok.");
  if (segments.length === 1 && request.method === "GET") {
    const rows = await all(env.DB.prepare("SELECT * FROM backup_runs WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100").bind(principal.tenantId));
    return json({ data: rows.map(decodeRow) });
  }
  if (segments.length === 1 && request.method === "POST") {
    const result = await writeBackup(env, principal.tenantId, principal.user.id);
    return json({ data: result }, result.status === "completed" ? 201 : 503);
  }
  if (segments.length === 3 && segments[2] === "restore" && request.method === "POST") {
    return problem(501, "restore_not_enabled", "Geri yükleme güvenlik nedeniyle uygulama içinden çalıştırılmaz. Yedeği indirip sunucuda `npm run db:verify-backup -- <dosya>` ile doğrulayın; gerçek geri yükleme bakım penceresinde `--into` seçeneğiyle yapılır.", { verification_command: "npm run db:verify-backup -- <yedek.jsonl>" });
  }
  return problem(404, "not_found", "Yedek endpoint'i bulunamadı.");
}

async function bootstrap(request, env) {
  if (!env.BOOTSTRAP_SECRET || request.headers.get("x-bootstrap-secret") !== env.BOOTSTRAP_SECRET) return problem(403, "forbidden", "Bootstrap anahtarı geçersiz.");
  const count = await one(env.DB.prepare("SELECT COUNT(*) AS count FROM tenants"));
  if (Number(count?.count || 0) > 0) return problem(409, "already_bootstrapped", "Sistem daha önce başlatılmış.");
  let body;
  try { body = await parseBody(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
  for (const key of ["tenant_name", "tenant_slug", "owner_email", "owner_name"]) if (!body?.[key]) return problem(422, "validation_error", `${key} zorunludur.`);
  const ownerPhone = body.owner_phone ? normalizeTurkishMobile(body.owner_phone) : null;
  if (body.owner_phone && !ownerPhone) return problem(422, "invalid_phone", "owner_phone geçerli bir Türkiye cep telefonu olmalıdır.");
  if (body.owner_password && (!ownerPhone || !validPassword(body.owner_password))) return problem(422, "invalid_password", "Şifreli giriş için geçerli telefon ve en az 8 karakter owner_password zorunludur.");
  const timestamp = now();
  const ownerCredential = body.owner_password ? await passwordRecord(env, body.owner_password) : null;
  const tenantId = id("ten_");
  const userId = id("usr_");
  const roleId = id("rol_");
  const membershipId = id("mem_");
  const rawToken = rawApiToken();
  const tokenHash = await sha256(rawToken);
  const tokenExpiresAt = tokenExpiry(90);
  const templates = await all(env.DB.prepare("SELECT code,name,description,permissions_json FROM role_templates ORDER BY code"));
  try {
    const statements = [
      env.DB.prepare("INSERT INTO tenants (id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)").bind(tenantId, body.tenant_name, body.tenant_slug, timestamp, timestamp),
      env.DB.prepare("INSERT INTO users (id,email,full_name,phone,password_hash,password_salt,password_iterations,password_changed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(userId, String(body.owner_email).toLowerCase(), body.owner_name, ownerPhone, ownerCredential?.hash || null, ownerCredential?.salt || null, ownerCredential?.iterations || null, ownerCredential ? timestamp : null, timestamp, timestamp),
      env.DB.prepare("INSERT INTO roles (id,tenant_id,code,name,description,is_system,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(roleId, tenantId, "owner", "Firma Sahibi", "Tüm tenant yetkilerine sahiptir.", 1, timestamp, timestamp),
      env.DB.prepare("INSERT INTO memberships (id,tenant_id,user_id,role_id,title,status,created_at,updated_at) VALUES (?,?,?,?,?,'active',?,?)").bind(membershipId, tenantId, userId, roleId, body.owner_title || "Firma Sahibi", timestamp, timestamp),
      env.DB.prepare("INSERT INTO membership_roles (tenant_id,membership_id,role_id,created_at) VALUES (?,?,?,?)").bind(tenantId, membershipId, roleId, timestamp),
      env.DB.prepare("INSERT INTO api_tokens (id,user_id,name,token_hash,expires_at,created_at) VALUES (?,?,?,?,?,?)").bind(id("tok_"), userId, "İlk kurulum", tokenHash, tokenExpiresAt, timestamp),
    ];
    for (const template of templates) {
      const templateRoleId = `${tenantId}_role_${template.code}`;
      statements.push(env.DB.prepare("INSERT INTO roles (id,tenant_id,code,name,description,is_system,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)").bind(templateRoleId, tenantId, template.code, template.name, template.description, timestamp, timestamp));
      if (template.code === "read_only") statements.push(env.DB.prepare("INSERT INTO role_permissions (tenant_id,role_id,permission_code) SELECT ?,?,code FROM permissions WHERE code LIKE '%.read' AND code NOT IN ('hr.sensitive.read','finance.sensitive.read','audit-logs.read','backups.read')").bind(tenantId, templateRoleId));
      else statements.push(env.DB.prepare("INSERT INTO role_permissions (tenant_id,role_id,permission_code) SELECT ?,?,p.code FROM json_each(?) j JOIN permissions p ON p.code=j.value").bind(tenantId, templateRoleId, template.permissions_json));
    }
    if (typeof env.DB.batch === "function") await env.DB.batch(statements);
    else for (const statement of statements) await run(statement);
  } catch (error) { return problem(500, "bootstrap_failed", "İlk kurulum tamamlanamadı.", env.EXPOSE_ERRORS === "true" ? String(error) : undefined); }
  return json({ data: { tenant: { id: tenantId, name: body.tenant_name, slug: body.tenant_slug }, user: { id: userId, email: body.owner_email, full_name: body.owner_name }, token: rawToken, token_expires_at: tokenExpiresAt }, meta: { secret_visible_once: true } }, 201);
}

// Geçici şifreyle giren kullanıcı, şifresini değiştirmeden veri yazamaz.
const passwordChangeExemptPaths = new Set(["/api/v1/session", "/api/v1/me", "/api/v1/auth/password/change", "/api/v1/permissions"]);

async function dispatchAuthenticated(request, env, principal, url, segments) {
  if (principal.mustChangePassword && !passwordChangeExemptPaths.has(url.pathname) && !["GET", "HEAD"].includes(request.method)) {
    return problem(403, "password_change_required", "Devam etmeden önce geçici şifrenizi değiştirmelisiniz.");
  }
  if ((url.pathname === "/api/v1/session" || url.pathname === "/api/v1/me") && request.method === "GET") return getSession(principal);
  if (segments[2] === "sessions") return sessionRoute(request, env, principal, segments);
  if (url.pathname === "/api/v1/permissions" && request.method === "GET") return getPermissionCatalog(env, principal);
  if (url.pathname === "/api/v1/dashboard" && request.method === "GET") return getDashboard(env, principal);
  if (url.pathname === "/api/v1/search" && request.method === "GET") return globalSearch(request, env, principal);
  if (url.pathname === "/api/v1/notifications" && request.method === "GET") return getNotifications(env, principal);
  if (segments.length === 5 && segments[2] === "notifications" && segments[4] === "read" && request.method === "POST" && validId(segments[3])) return markNotification(request, env, principal, segments[3]);
  if (segments[0] === "api" && segments[1] === "admin" && segments[2] === "backups") return backupRoute(request, env, principal, segments.slice(2));
  if (url.pathname === "/api/v1/files/upload" && request.method === "POST") return uploadFile(request, env, principal);
  if (segments.length === 5 && segments[2] === "files" && segments[4] === "content" && request.method === "GET") return downloadFile(env, principal, segments[3]);
  if (url.pathname === "/api/v1/memberships/invite" && request.method === "POST") return inviteMember(request, env, principal);
  if (segments.length === 5 && segments[2] === "roles" && segments[4] === "permissions") return rolePermissions(request, env, principal, segments[3]);
  if (segments.length === 5 && segments[2] === "projects" && segments[4] === "command-center" && request.method === "GET" && validId(segments[3])) return getProjectCommandCenter(env, principal, segments[3]);
  if (segments.length === 5 && segments[2] === "projects" && segments[4] === "cost-breakdown" && request.method === "GET" && validId(segments[3])) return getProjectCostBreakdown(request, env, principal, segments[3]);
  if (segments.length === 5 && segments[2] === "purchase-requests" && segments[4] === "quotation-comparison" && request.method === "GET" && validId(segments[3])) return compareQuotations(env, principal, segments[3]);
  if (url.pathname === "/api/v1/work-centers/load" && request.method === "GET") return workCenterLoad(request, env, principal);
  if (url.pathname === "/api/v1/password-reset-requests") return passwordResetRequestsRoute(request, env, principal);
  if (segments.length === 5 && segments[2] === "memberships" && segments[4] === "reset-password" && request.method === "POST" && validId(segments[3])) return resetMemberPassword(request, env, principal, segments[3]);
  if (segments[2] === "tokens") return tokenManagement(request, env, principal, segments);
  if (request.method === "POST" && segments.length === 5 && validId(segments[3])) {
    const [resource, resourceId, action] = [segments[2], segments[3], segments[4]];
    if (resource === "offers" && ["accept", "reject", "convert-to-project"].includes(action)) return offerAction(request, env, principal, resourceId, action);
    if (resource === "projects" && action === "transition") return transitionProject(request, env, principal, resourceId);
    if (resource === "work-items" && action === "approve-revision") return approveWorkItemRevision(request, env, principal, resourceId);
    if (resource === "work-items" && action === "explode-bom") return explodeBom(request, env, principal, resourceId);
    if (resource === "supplier-quotations" && ["select", "transition"].includes(action)) return quotationAction(request, env, principal, resourceId, action);
    if (resource === "production-operations" && action === "transition") return transitionProductionOperation(request, env, principal, resourceId);
    if (resource === "production-issues" && ["resolve", "transition"].includes(action)) return productionIssueAction(request, env, principal, resourceId, action);
    if (resource === "production-orders" && action === "release") return releaseProductionOrder(request, env, principal, resourceId);
    if (resource === "production-orders" && action === "transition") return transitionProductionOrder(request, env, principal, resourceId);
    if (resource === "material-requirements" && action === "reserve") return reserveMaterialRequirement(request, env, principal, resourceId);
    if (resource === "material-requirements" && ["consume", "release"].includes(action)) return settleMaterialRequirement(request, env, principal, resourceId, action);
    if (resource === "material-requirements" && action === "create-purchase-request") return createMaterialPurchaseRequest(request, env, principal, resourceId);
    if (resource === "purchase-requests" && action === "approve") return approvePurchaseRequest(request, env, principal, resourceId);
    if (resource === "purchase-requests" && action === "create-order") return createPurchaseOrderFromRequest(request, env, principal, resourceId);
    if (resource === "purchase-orders" && action === "receive") return receivePurchaseOrder(request, env, principal, resourceId);
    if (resource === "leaves" && ["approve", "reject"].includes(action)) return decideLeave(request, env, principal, resourceId, action);
    if (resource === "financial-transactions" && ["approve", "reverse"].includes(action)) return financialAction(request, env, principal, resourceId, action);
    if (resource === "site-surveys" && action === "transition") return transitionSurvey(request, env, principal, resourceId);
    if (resource === "contracts" && action === "transition") return transitionContract(request, env, principal, resourceId);
    if (resource === "design-revisions" && ["submit", "approve", "reject", "supersede"].includes(action)) return designRevisionAction(request, env, principal, resourceId, action);
    if (resource === "progress-payments" && ["submit", "approve", "reject", "invoice", "paid"].includes(action)) return progressPaymentAction(request, env, principal, resourceId, action);
    if (resource === "stock-movements" && action === "post") return postStockMovement(request, env, principal, resourceId);
    if (resource === "project-meetings" && action === "transition") return meetingTransition(request, env, principal, resourceId);
    if (resource === "quality-inspections" && action === "transition") return qualityTransition(request, env, principal, resourceId);
    if (resource === "handovers" && action === "transition") return handoverTransition(request, env, principal, resourceId);
  }

  if (segments[0] !== "api" || segments[1] !== "v1" || segments.length < 3 || segments.length > 4) return problem(404, "not_found", "API endpoint'i bulunamadı.");
  const requestedSlug = segments[2];
  const slug = aliases[requestedSlug] || requestedSlug;
  const config = resources[slug];
  if (!config) return problem(404, "not_found", "API kaynağı bulunamadı.");
  const resourceId = segments[3];
  if (resourceId === "export" && request.method === "GET") return exportResource(request, env, principal, slug, config);
  if (resourceId && !validId(resourceId)) return problem(400, "invalid_id", "Geçersiz kayıt kimliği.");
  if (!resourceId && request.method === "GET") return listResource(request, env, principal, slug, config);
  if (!resourceId && request.method === "POST") return createResource(request, env, principal, slug, config);
  if (resourceId && request.method === "GET") return getResource(env, principal, slug, config, resourceId);
  if (resourceId && ["PATCH", "PUT"].includes(request.method)) return updateResource(request, env, principal, slug, config, resourceId);
  if (resourceId && request.method === "DELETE") return deleteResource(request, env, principal, slug, config, resourceId);
  return problem(405, "method_not_allowed", "Bu HTTP yöntemi desteklenmiyor.");
}

const IDEMPOTENCY_IN_PROGRESS_MS = 2 * 60 * 1000;
const IDEMPOTENCY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function idempotencyReplay(record) {
  return new Response(record.status_code === 204 ? null : record.response_body, {
    status: record.status_code,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "idempotency-replayed": "true" },
  });
}

async function withIdempotency(request, env, principal, handler) {
  if (new URL(request.url).pathname.startsWith("/api/v1/tokens")) return handler();
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key || !["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return handler();
  if (!/^[A-Za-z0-9._:-]{8,200}$/.test(key)) return problem(400, "invalid_idempotency_key", "Idempotency-Key 8-200 güvenli karakter içermelidir.");
  const path = new URL(request.url).pathname;
  const selectRecord = () => one(env.DB.prepare("SELECT id,status_code,response_body,created_at FROM idempotency_records WHERE tenant_id=? AND user_id=? AND idempotency_key=? AND method=? AND path=?").bind(principal.tenantId, principal.user.id, key, request.method, path));
  const staleBefore = new Date(Date.now() - IDEMPOTENCY_IN_PROGRESS_MS).toISOString();

  const existing = await selectRecord();
  if (existing?.status_code && existing.response_body !== null) return idempotencyReplay(existing);
  if (existing) {
    // Handler çökerse kayıt "işleniyor" durumunda asılı kalıyordu ve aynı anahtar
    // sonsuza dek 409 alıyordu. Belirli süreyi aşan yarım kayıtları geri alıyoruz.
    if (existing.created_at > staleBefore) return problem(409, "idempotency_in_progress", "Aynı istek halen işleniyor.");
    await run(env.DB.prepare("DELETE FROM idempotency_records WHERE id=? AND tenant_id=? AND status_code IS NULL").bind(existing.id, principal.tenantId));
  }

  const recordId = id("idem_");
  try {
    await run(env.DB.prepare("INSERT INTO idempotency_records (id,tenant_id,user_id,idempotency_key,method,path,created_at) VALUES (?,?,?,?,?,?,?)").bind(recordId, principal.tenantId, principal.user.id, key, request.method, path, now()));
  } catch {
    const replay = await selectRecord();
    if (replay?.status_code && replay.response_body !== null) return idempotencyReplay(replay);
    return problem(409, "idempotency_in_progress", "Aynı istek halen işleniyor.");
  }

  let response;
  try {
    response = await handler();
  } catch (error) {
    await run(env.DB.prepare("DELETE FROM idempotency_records WHERE id=? AND tenant_id=?").bind(recordId, principal.tenantId)).catch(() => {});
    throw error;
  }
  try {
    const responseBody = response.status === 204 ? "" : await response.clone().text();
    await run(env.DB.prepare("UPDATE idempotency_records SET status_code=?,response_body=?,completed_at=? WHERE id=? AND tenant_id=?").bind(response.status, responseBody, now(), recordId, principal.tenantId));
  } catch (error) {
    await run(env.DB.prepare("DELETE FROM idempotency_records WHERE id=? AND tenant_id=?").bind(recordId, principal.tenantId)).catch(() => {});
    console.error("Idempotency record could not be finalised", error);
  }
  return response;
}

async function purgeExpiredRecords(env) {
  const idempotencyCutoff = new Date(Date.now() - IDEMPOTENCY_RETENTION_MS).toISOString();
  const authCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const timestamp = now();
  await run(env.DB.prepare("DELETE FROM idempotency_records WHERE created_at<?").bind(idempotencyCutoff));
  await run(env.DB.prepare("DELETE FROM phone_sessions WHERE expires_at<? OR (revoked_at IS NOT NULL AND revoked_at<?)").bind(timestamp, authCutoff));
  await run(env.DB.prepare("DELETE FROM phone_auth_requests WHERE created_at<?").bind(authCutoff));
  await run(env.DB.prepare("DELETE FROM password_auth_attempts WHERE created_at<?").bind(authCutoff));
}

async function handleApi(request, env, context) {
  env = { ...env, DB: databaseFromEnv(env) };
  if (!env.DB) return problem(503, "database_unavailable", "DB binding yapılandırılmamış.");
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  if (url.pathname === "/api/v1/health" && request.method === "GET") {
    try {
      const check = await one(env.DB.prepare("SELECT 1 AS ok"));
      if (Number(check?.ok) !== 1) throw new Error("database_check_failed");
      return json({ data: { status: "ok", database: "ok", storage: env.FILES ? "ok" : "unavailable", time: now() } });
    } catch {
      return problem(503, "database_unavailable", "Veritabanı sağlık kontrolü başarısız.");
    }
  }
  if (url.pathname === "/api/v1/bootstrap" && request.method === "POST") return bootstrap(request, env);
  if (url.pathname === "/api/v1/auth/phone/start" && request.method === "POST") return startPhoneAuth(request, env);
  if (url.pathname === "/api/v1/auth/phone/verify" && request.method === "POST") return verifyPhoneAuth(request, env);
  if (url.pathname === "/api/v1/auth/password/login" && request.method === "POST") return loginWithPassword(request, env);
  if (url.pathname === "/api/v1/auth/password/reset-request" && request.method === "POST") return requestPasswordReset(request, env);
  if (url.pathname === "/api/v1/auth/logout" && request.method === "POST") return logoutPhoneAuth(request, env);
  const principal = await authenticate(request, env);
  if (!principal) return problem(401, "unauthorized", "Oturum bulunamadı.", { accepted: ["phone session", "platform identity", "Bearer token"] });
  // Çerezle kimliklenen her mutasyon aynı kaynaktan gelmelidir. SameSite=Lax
  // çoğu senaryoyu kapatır; bu kontrol alt alan adı ve eski tarayıcı boşluklarını
  // da kapatır. Bearer tokenlı entegrasyonlar çerez kullanmadığı için muaftır.
  if (!request.headers.get("authorization")?.startsWith("Bearer ") && !["GET", "HEAD", "OPTIONS"].includes(request.method) && !sameOrigin(request, env)) {
    return problem(403, "origin_forbidden", "İsteğin kaynağı geçersiz.");
  }
  // Şifre değiştirme ve oturum bilgisi firma seçiminden bağımsız çalışmalıdır.
  if (url.pathname === "/api/v1/auth/password/change" && request.method === "POST") return changePassword(request, env, principal);
  if (principal.tenantSelectionRequired) {
    if ((url.pathname === "/api/v1/session" || url.pathname === "/api/v1/me") && request.method === "GET") return getSession(principal);
    return problem(400, "tenant_required", "Birden fazla firma üyeliğiniz var; x-tenant-id seçilmelidir.", { tenants: principal.tenants });
  }
  if (principal.tenantMissing) return problem(400, "tenant_required", "x-tenant-id başlığı zorunludur.");
  if (principal.forbiddenTenant) return problem(403, "tenant_forbidden", "Bu firmaya erişim yetkiniz yok.");

  if (env.FILES && env.ENABLE_REQUEST_BACKUP_FALLBACK !== "false") {
    const fallback = ensureDailyBackup(env, principal.tenantId);
    if (context?.waitUntil) context.waitUntil(fallback);
    else await fallback;
  }

  return withIdempotency(request, env, principal, () => dispatchAuthenticated(request, env, principal, url, segments));
}

async function fetchHandler(request, env, context) {
  const url = new URL(request.url);
  const isApiRoute = url.pathname.startsWith("/api/v1/") || url.pathname.startsWith("/api/admin/");
  if (request.method === "OPTIONS" && isApiRoute) {
    return new Response(null, { status: 204, headers: { allow: "GET,POST,PUT,PATCH,DELETE,OPTIONS", "access-control-allow-headers": "authorization,content-type,idempotency-key,x-tenant-id,x-request-id", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" } });
  }
  if (isApiRoute) {
    try { return await handleApi(request, env, context); }
    catch (error) {
      console.error("Unhandled API error", error);
      return problem(500, "internal_error", "Beklenmeyen bir sunucu hatası oluştu.", env.EXPOSE_ERRORS === "true" ? String(error?.stack || error) : undefined);
    }
  }

  const response = await env.ASSETS.fetch(request);
  const acceptsHtml = request.headers.get("accept")?.includes("text/html");
  if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) return secureStaticResponse(response);
  const indexUrl = new URL(request.url);
  indexUrl.pathname = "/index.html";
  indexUrl.search = "";
  return secureStaticResponse(await env.ASSETS.fetch(new Request(indexUrl, request)));
}

async function scheduledHandler(_controller, env, context) {
  const task = (async () => {
    env = { ...env, DB: databaseFromEnv(env) };
    if (!env.DB) return;
    try { await purgeExpiredRecords(env); }
    catch (error) { console.error("Retention cleanup failed", error); }
    const tenants = await all(env.DB.prepare("SELECT id FROM tenants WHERE status='active' ORDER BY id"));
    for (const tenant of tenants) await writeBackup(env, tenant.id, "scheduler");
  })();
  if (context?.waitUntil) context.waitUntil(task);
  else await task;
}

export const __testing = { authenticate, handleApi, writeBackup, resources, normalizeTurkishMobile, passwordRecord };
export default { fetch: fetchHandler, scheduled: scheduledHandler };
