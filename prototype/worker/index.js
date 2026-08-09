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
  files: { table: "files", required: ["entity_type", "entity_id", "file_name", "object_key"], search: ["file_name", "category", "description"], filters: ["entity_type", "entity_id", "category"], fields: ["entity_type","entity_id","category","file_name","object_key","content_type","size_bytes","checksum","uploaded_by","description","metadata_json"] },
  "audit-logs": { table: "audit_logs", readOnly: true, search: ["action", "entity_type", "entity_id"], filters: ["user_id", "action", "entity_type"], fields: [] },
  memberships: { table: "memberships", required: ["user_id", "role_id"], search: ["title"], filters: ["user_id", "role_id", "status"], fields: ["user_id","role_id","title","status"] },
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
};

const aliases = {
  purchases: "purchase-orders",
  "work-orders": "production-orders",
  transactions: "financial-transactions",
};

const backupTables = ["customers","suppliers","projects","offers","offer_items","project_tasks","work_items","purchase_requests","purchase_orders","production_orders","installations","accounts","financial_transactions","invoices","employees","attendance","leave_requests","payroll_inputs","files","audit_logs","roles","role_permissions","memberships","site_surveys","survey_measurements","contracts","design_revisions","progress_payments","inventory_items","stock_movements","project_meetings","meeting_actions","quality_inspections","handovers","handover_punch_items"];
const backupMigrations = ["0001_tenant_core.sql", "0002_permissions.sql", "0003_workflows.sql", "0004_production_readiness.sql", "0005_capproje_domain.sql", "0006_phone_auth.sql"];
const dailyBackupSeen = new Map();
const ownerRoles = new Set(["owner", "admin"]);
const PHONE_SESSION_COOKIE = "__Host-capproje_session";
const PHONE_SESSION_SECONDS = 12 * 60 * 60;
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
const workflowManagedResources = new Set(["offers", "projects", "production-orders", "purchase-requests", "leaves", "financial-transactions", "site-surveys", "contracts", "design-revisions", "progress-payments", "stock-movements", "project-meetings", "quality-inspections", "handovers"]);

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

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function authHash(env, value) {
  return sha256(`${env.PHONE_AUTH_PEPPER || "capproje-phone-auth"}:${value}`);
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
  if (authorization.startsWith("Bearer ")) {
    const tokenHash = await sha256(authorization.slice(7).trim());
    user = await one(env.DB.prepare("SELECT u.id, u.email, u.full_name, u.phone, u.status FROM api_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.revoked_at IS NULL AND (t.expires_at IS NULL OR t.expires_at>?) AND u.status='active'").bind(tokenHash, now()));
    if (user) await run(env.DB.prepare("UPDATE api_tokens SET last_used_at=? WHERE token_hash=?").bind(now(), tokenHash));
  } else {
    const sessionToken = cookieValue(request, PHONE_SESSION_COOKIE);
    if (sessionToken) {
      const tokenHash = await sha256(sessionToken);
      user = await one(env.DB.prepare("SELECT u.id,u.email,u.full_name,u.phone,u.status FROM phone_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'").bind(tokenHash, now()));
      if (user) await run(env.DB.prepare("UPDATE phone_sessions SET last_seen_at=? WHERE token_hash=?").bind(now(), tokenHash));
    }
    if (!user) {
      const platformEmail = env.ALLOW_PLATFORM_AUTH === "true"
        ? request.headers.get("oai-authenticated-user-email")
        : null;
      const devEmail = env.ALLOW_DEV_AUTH === "true" ? request.headers.get("x-user-email") : null;
      const email = platformEmail || devEmail;
      if (email) user = await one(env.DB.prepare("SELECT id,email,full_name,phone,status FROM users WHERE email=? COLLATE NOCASE AND status='active'").bind(email.trim()));
    }
  }
  if (!user) return null;

  const tenantId = request.headers.get("x-tenant-id");
  if (!tenantId) {
    const memberships = await all(env.DB.prepare("SELECT m.id AS membership_id,m.tenant_id,m.title,r.id AS role_id,r.code AS role_code,r.name AS role_name,t.name AS tenant_name,t.slug AS tenant_slug FROM memberships m JOIN roles r ON r.id=m.role_id AND r.tenant_id=m.tenant_id JOIN tenants t ON t.id=m.tenant_id WHERE m.user_id=? AND m.status='active' AND t.status='active' ORDER BY t.name").bind(user.id));
    if (memberships.length === 0) return { user, forbiddenTenant: true };
    if (memberships.length > 1) return { user, tenantSelectionRequired: true, tenants: memberships.map((item) => ({ id: item.tenant_id, name: item.tenant_name, slug: item.tenant_slug, role: { id: item.role_id, code: item.role_code, name: item.role_name } })) };
    const membership = memberships[0];
    const permissionRows = ownerRoles.has(membership.role_code) ? [] : await all(env.DB.prepare("SELECT permission_code FROM role_permissions WHERE tenant_id=? AND role_id=?").bind(membership.tenant_id, membership.role_id));
    return { user, tenantId: membership.tenant_id, membership, permissions: permissionRows.map((item) => item.permission_code), tenantAutoSelected: true };
  }
  if (!validId(tenantId)) return { user, tenantMissing: true };
  const membership = await one(env.DB.prepare("SELECT m.id AS membership_id,m.tenant_id,m.title,r.id AS role_id,r.code AS role_code,r.name AS role_name,t.name AS tenant_name,t.slug AS tenant_slug FROM memberships m JOIN roles r ON r.id=m.role_id AND r.tenant_id=m.tenant_id JOIN tenants t ON t.id=m.tenant_id WHERE m.user_id=? AND m.tenant_id=? AND m.status='active' AND t.status='active'").bind(user.id, tenantId));
  if (!membership) return { user, forbiddenTenant: true };
  const permissionRows = ownerRoles.has(membership.role_code) ? [] : await all(env.DB.prepare("SELECT permission_code FROM role_permissions WHERE tenant_id=? AND role_id=?").bind(tenantId, membership.role_id));
  return { user, tenantId, membership, permissions: permissionRows.map((item) => item.permission_code) };
}

function allowed(principal, permission) {
  return ownerRoles.has(principal.membership.role_code) || principal.permissions.includes(permission);
}

function permissionFor(slug, action) {
  if (slug === "memberships" && action !== "read") return "users.manage";
  if (slug === "roles" && action !== "read") return "roles.manage";
  if (slug === "files" && action !== "read") return "files.manage";
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

function normalizeInput(config, body, creating) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "JSON nesnesi bekleniyor." };
  const allowedFields = new Set(config.fields);
  const unknown = Object.keys(body).filter((key) => !allowedFields.has(key));
  if (unknown.length) return { error: `Desteklenmeyen alanlar: ${unknown.join(", ")}` };
  if (creating) {
    const missing = (config.required || []).filter((key) => body[key] === undefined || body[key] === null || body[key] === "");
    if (missing.length) return { error: `Zorunlu alanlar: ${missing.join(", ")}` };
  }
  const values = {};
  for (const [key, value] of Object.entries(body)) {
    if (key.endsWith("_minor")) {
      const normalizedMoney = typeof value === "string" && /^-?\d+$/.test(value) ? Number(value) : value;
      if (!Number.isSafeInteger(normalizedMoney)) return { error: `${key} güvenli bir tam sayı veya tam sayı metni (kuruş) olmalıdır.` };
      values[key] = normalizedMoney;
    } else if (JSON_COLUMNS.has(key)) values[key] = typeof value === "string" ? value : JSON.stringify(value ?? (key.endsWith("_ids_json") || key === "team_json" ? [] : {}));
    else if (["official", "is_system"].includes(key)) values[key] = value ? 1 : 0;
    else values[key] = value;
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
  return null;
}

async function getSession(principal) {
  if (principal.tenantSelectionRequired) return json({ data: { user: principal.user, tenant: null, role: null, permissions: [], tenants: principal.tenants, requires_tenant_selection: true } });
  return json({ data: {
    user: principal.user,
    tenant: { id: principal.tenantId, name: principal.membership.tenant_name, slug: principal.membership.tenant_slug },
    membership: { id: principal.membership.membership_id, title: principal.membership.title },
    role: { id: principal.membership.role_id, code: principal.membership.role_code, name: principal.membership.role_name },
    permissions: ownerRoles.has(principal.membership.role_code) ? ["*"] : principal.permissions,
    tenant_auto_selected: Boolean(principal.tenantAutoSelected),
  } });
}

async function getDashboard(env, principal) {
  if (!allowed(principal, "dashboard.read")) return problem(403, "forbidden", "Dashboard görüntüleme yetkiniz yok.");
  const tenant = principal.tenantId;
  const queries = [
    ["projects", "SELECT COUNT(*) AS count FROM projects WHERE tenant_id=? AND status NOT IN ('completed','cancelled')"],
    ["openOffers", "SELECT COUNT(*) AS count,COALESCE(SUM(grand_total_minor),0) AS amount_minor FROM offers WHERE tenant_id=? AND status IN ('sent','pending')"],
    ["production", "SELECT COUNT(*) AS count FROM production_orders WHERE tenant_id=? AND status NOT IN ('completed','cancelled')"],
    ["installations", "SELECT COUNT(*) AS count FROM installations WHERE tenant_id=? AND status NOT IN ('completed','cancelled')"],
    ["receivables", "SELECT COALESCE(SUM(amount_minor),0) AS amount_minor FROM financial_transactions WHERE tenant_id=? AND type='income' AND status IN ('planned','pending')"],
    ["employees", "SELECT COUNT(*) AS count FROM employees WHERE tenant_id=? AND status='active'"],
  ];
  const data = {};
  for (const [name, sql] of queries) data[name] = await one(env.DB.prepare(sql).bind(tenant));
  data.recentProjects = (await all(env.DB.prepare("SELECT id,code,name,status,progress_percent,updated_at FROM projects WHERE tenant_id=? ORDER BY updated_at DESC LIMIT 6").bind(tenant))).map(decodeRow);
  return json({ data });
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
    clauses.push(`(${config.search.map((field) => `${field} LIKE ?`).join(" OR ")})`);
    for (let index = 0; index < config.search.length; index += 1) bindings.push(`%${q}%`);
  }
  const where = clauses.join(" AND ");
  const totalRow = await one(env.DB.prepare(`SELECT COUNT(*) AS total FROM ${config.table} WHERE ${where}`).bind(...bindings));
  const rows = await all(env.DB.prepare(`SELECT * FROM ${config.table} WHERE ${where} ORDER BY ${config.table === "audit_logs" ? "created_at" : "updated_at"} DESC LIMIT ? OFFSET ?`).bind(...bindings, pageSize, (page - 1) * pageSize));
  return json({ data: rows.map((row) => serializeRow(row, slug, principal)), meta: { page, pageSize, total: Number(totalRow?.total || 0) } });
}

async function getResource(env, principal, slug, config, resourceId) {
  if (!allowed(principal, permissionFor(slug, "read"))) return problem(403, "forbidden", "Bu kaydı görüntüleme yetkiniz yok.");
  const row = await one(env.DB.prepare(`SELECT * FROM ${config.table} WHERE id=? AND tenant_id=?`).bind(resourceId, principal.tenantId));
  return row ? json({ data: serializeRow(row, slug, principal) }) : problem(404, "not_found", "Kayıt bulunamadı.");
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
  const normalized = normalizeInput(config, body, true);
  if (normalized.error) return problem(422, "validation_error", normalized.error);
  const referenceError = await validateReferences(env, principal, config, normalized.values);
  if (referenceError) return problem(422, "cross_tenant_reference", referenceError);
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
  const normalized = normalizeInput(config, body, false);
  if (normalized.error) return problem(422, "validation_error", normalized.error);
  const referenceError = await validateReferences(env, principal, config, normalized.values);
  if (referenceError) return problem(422, "cross_tenant_reference", referenceError);
  const existing = await one(env.DB.prepare(`SELECT * FROM ${config.table} WHERE id=? AND tenant_id=?`).bind(resourceId, principal.tenantId));
  if (!existing) return problem(404, "not_found", "Kayıt bulunamadı.");
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
  if (!allowed(principal, "users.manage")) return problem(403, "forbidden", "Kullanıcı yönetme yetkiniz yok.");
  let body;
  try { body = await parseBody(request); } catch (response) { return problem(response.status, "invalid_body", "Geçerli JSON gönderin."); }
  if (!body?.email || !body?.phone || !body?.full_name || !body?.role_id) return problem(422, "validation_error", "email, phone, full_name ve role_id zorunludur.");
  const role = await one(env.DB.prepare("SELECT id FROM roles WHERE id=? AND tenant_id=?").bind(body.role_id, principal.tenantId));
  if (!role) return problem(422, "cross_tenant_reference", "Rol bu firmaya ait değil.");
  const email = String(body.email).trim().toLowerCase();
  const phone = normalizeTurkishMobile(body.phone);
  if (!phone) return problem(422, "invalid_phone", "Türkiye cep telefonu numarasını kontrol edin.");
  const byEmail = await one(env.DB.prepare("SELECT id,email,full_name,phone,status FROM users WHERE email=? COLLATE NOCASE").bind(email));
  const byPhone = await one(env.DB.prepare("SELECT id,email,full_name,phone,status FROM users WHERE phone=?").bind(phone));
  if (byEmail && byPhone && byEmail.id !== byPhone.id) return problem(409, "identity_conflict", "E-posta ve telefon farklı kullanıcılarla eşleşiyor.");
  let user = byEmail || byPhone;
  const timestamp = now();
  try {
    if (!user) {
      user = { id: id("usr_"), email, full_name: body.full_name, phone, status: "invited" };
      await run(env.DB.prepare("INSERT INTO users (id,email,full_name,phone,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(user.id, email, body.full_name, phone, "invited", timestamp, timestamp));
    } else {
      await run(env.DB.prepare("UPDATE users SET email=?,full_name=?,phone=?,updated_at=? WHERE id=?").bind(email, body.full_name, phone, timestamp, user.id));
      user = { ...user, email, full_name: body.full_name, phone };
    }
  } catch { return problem(409, "identity_conflict", "E-posta veya telefon başka bir kullanıcı tarafından kullanılıyor."); }
  const membershipId = id("mem_");
  try {
    await run(env.DB.prepare("INSERT INTO memberships (id,tenant_id,user_id,role_id,title,status,created_at,updated_at) VALUES (?,?,?,?,?,'invited',?,?)").bind(membershipId, principal.tenantId, user.id, body.role_id, body.title || null, timestamp, timestamp));
  } catch { return problem(409, "membership_exists", "Bu kullanıcı firmaya daha önce eklenmiş."); }
  await audit(env, principal, request, "invite", "memberships", membershipId, { user_id: user.id, role_id: body.role_id });
  return json({ data: { id: membershipId, tenant_id: principal.tenantId, user, role_id: body.role_id, title: body.title || null, status: "invited" } }, 201);
}

async function rolePermissions(request, env, principal, roleId) {
  if (!allowed(principal, "roles.manage")) return problem(403, "forbidden", "Rol yetkilerini yönetme izniniz yok.");
  const role = await one(env.DB.prepare("SELECT id,code,name FROM roles WHERE id=? AND tenant_id=?").bind(roleId, principal.tenantId));
  if (!role) return problem(404, "not_found", "Rol bulunamadı.");
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
  if (!ownerRoles.has(principal.membership.role_code) && !allowed(principal, "tokens.manage")) return problem(403, "forbidden", "API tokenı yönetme yetkiniz yok.");
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
  if (!sameOrigin(request)) return problem(403, "origin_forbidden", "Giriş isteğinin kaynağı geçersiz.");
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
  if (!sameOrigin(request)) return problem(403, "origin_forbidden", "Giriş isteğinin kaynağı geçersiz.");
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
    env.DB.prepare("UPDATE phone_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL").bind(timestamp, user.id),
    env.DB.prepare("INSERT INTO phone_sessions (id,user_id,token_hash,ip_hash,user_agent_hash,created_at,last_seen_at,expires_at) VALUES (?,?,?,?,?,?,?,?)")
      .bind(id("phs_"), user.id, tokenHash, await authHash(env, clientIp(request) || "unknown"), await authHash(env, request.headers.get("user-agent") || "unknown"), timestamp, timestamp, expiresAt),
    env.DB.prepare("UPDATE phone_auth_requests SET status='approved',verified_at=? WHERE id=? AND status='pending'").bind(timestamp, challengeId),
  ];
  if (typeof env.DB.batch === "function") await env.DB.batch(statements);
  else for (const statement of statements) await run(statement);
  return json({ data: { authenticated: true, expires_at: expiresAt } }, 200, { "set-cookie": phoneSessionCookie(rawToken) });
}

async function logoutPhoneAuth(request, env) {
  if (!sameOrigin(request)) return problem(403, "origin_forbidden", "Çıkış isteğinin kaynağı geçersiz.");
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
  const timestamp = now();
  const completion = target === "completed" ? timestamp : project.actual_end_date;
  try {
    await commitWorkflow(env, principal, request, [env.DB.prepare("UPDATE projects SET status=?,actual_end_date=?,updated_at=? WHERE id=? AND tenant_id=?").bind(target, completion || null, timestamp, projectId, principal.tenantId)], "transition", "projects", projectId, { from: project.status, to: target, note: body.note || null });
  } catch (error) { return workflowCommitProblem(env, error); }
  return json({ data: serializeRow(await workflowRow(env, principal, "projects", projectId), "projects", principal) });
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
  const record = await one(env.DB.prepare("SELECT sm.*,ii.on_hand_quantity,ii.name AS inventory_item_name FROM stock_movements sm JOIN inventory_items ii ON ii.id=sm.inventory_item_id AND ii.tenant_id=sm.tenant_id WHERE sm.id=? AND sm.tenant_id=?").bind(movementId, principal.tenantId));
  if (!record) return problem(404, "not_found", "Stok hareketi bulunamadı.");
  if (record.status === "posted") return json({ data: serializeRow(record, "stock-movements", principal), meta: { replayed: true } });
  if (record.status !== "draft") return problem(409, "invalid_transition", `${record.status} durumundaki stok hareketi kesinleştirilemez.`);
  const outbound = ["issue", "adjustment_out", "project_issue"].includes(record.movement_type);
  if (outbound && Number(record.on_hand_quantity) < Number(record.quantity)) return problem(409, "insufficient_stock", "Stok miktarı bu çıkış için yetersiz.");
  const timestamp = now();
  const totalCost = Number(record.total_cost_minor || 0) || Math.round(Number(record.quantity) * Number(record.unit_cost_minor || 0));
  const delta = outbound ? -Number(record.quantity) : Number(record.quantity);
  const postMovement = env.DB.prepare("UPDATE stock_movements SET status=CASE WHEN EXISTS (SELECT 1 FROM inventory_items ii WHERE ii.id=stock_movements.inventory_item_id AND ii.tenant_id=stock_movements.tenant_id AND (? >= 0 OR ii.on_hand_quantity >= ?)) THEN 'posted' ELSE '__insufficient_stock__' END,total_cost_minor=?,posted_at=?,posted_by=?,updated_at=? WHERE id=? AND tenant_id=? AND status='draft'")
    .bind(delta, Number(record.quantity), totalCost, timestamp, principal.user.id, timestamp, movementId, principal.tenantId);
  const updateBalance = env.DB.prepare("UPDATE inventory_items SET on_hand_quantity=on_hand_quantity+?,updated_at=? WHERE id=? AND tenant_id=? AND EXISTS (SELECT 1 FROM stock_movements sm WHERE sm.id=? AND sm.tenant_id=? AND sm.status='posted' AND sm.posted_at=?)")
    .bind(delta, timestamp, record.inventory_item_id, principal.tenantId, movementId, principal.tenantId, timestamp);
  try {
    await commitWorkflow(env, principal, request, [postMovement, updateBalance], "post", "stock-movements", movementId, { inventory_item_id: record.inventory_item_id, movement_type: record.movement_type, quantity: record.quantity });
  } catch (error) {
    if (String(error?.message || error).toLowerCase().includes("constraint")) return problem(409, "insufficient_stock", "Stok miktarı değişti veya ürün bu tenant'a ait değil; hareket uygulanmadı.");
    return workflowCommitProblem(env, error);
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
  const fileId = id("fil_");
  const safeName = String(file.name || "file").replace(/[^A-Za-z0-9._-]+/g, "_").slice(-120);
  const objectKey = `${principal.tenantId}/${entityType}/${entityId}/${fileId}-${safeName}`;
  const bytes = await file.arrayBuffer();
  const checksum = await sha256(bytes);
  await env.FILES.put(objectKey, bytes, { httpMetadata: { contentType: file.type || "application/octet-stream" }, customMetadata: { tenantId: principal.tenantId, fileId } });
  const timestamp = now();
  await run(env.DB.prepare("INSERT INTO files (id,tenant_id,entity_type,entity_id,category,file_name,object_key,content_type,size_bytes,checksum,uploaded_by,description,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(fileId, principal.tenantId, entityType, entityId, form.get("category") || null, file.name || safeName, objectKey, file.type || "application/octet-stream", file.size, checksum, principal.user.id, form.get("description") || null, "{}", timestamp, timestamp));
  await audit(env, principal, request, "upload", "files", fileId, { entity_type: entityType, entity_id: entityId, size_bytes: file.size });
  return json({ data: decodeRow(await one(env.DB.prepare("SELECT * FROM files WHERE id=? AND tenant_id=?").bind(fileId, principal.tenantId))) }, 201);
}

async function downloadFile(env, principal, fileId) {
  if (!allowed(principal, "files.read")) return problem(403, "forbidden", "Dosya görüntüleme yetkiniz yok.");
  if (!env.FILES) return problem(503, "storage_unavailable", "Dosya deposu yapılandırılmamış.");
  const metadata = await one(env.DB.prepare("SELECT * FROM files WHERE id=? AND tenant_id=?").bind(fileId, principal.tenantId));
  if (!metadata) return problem(404, "not_found", "Dosya bulunamadı.");
  const object = await env.FILES.get(metadata.object_key);
  if (!object) return problem(404, "object_missing", "Dosya nesnesi bulunamadı.");
  const headers = new Headers({ "content-type": metadata.content_type || "application/octet-stream", "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(metadata.file_name)}`, "cache-control": "private, max-age=300", "x-content-type-options": "nosniff" });
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
    const lines = [JSON.stringify({ type: "manifest", version: 1, schema_version: 6, migrations: backupMigrations, tenant_id: tenantId, created_at: started })];
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
    dailyBackupSeen.set(tenantId, backupDate);
    return { ...existing, replayed: true };
  }
  const result = await writeBackup(env, tenantId, "request-fallback");
  dailyBackupSeen.set(tenantId, backupDate);
  return result;
}

async function backupRoute(request, env, principal, segments) {
  if (!ownerRoles.has(principal.membership.role_code)) return problem(403, "owner_required", "Yedek yönetimi yalnızca firma sahibine açıktır.");
  if (segments.length === 1 && request.method === "GET") {
    const rows = await all(env.DB.prepare("SELECT * FROM backup_runs WHERE tenant_id=? ORDER BY created_at DESC LIMIT 100").bind(principal.tenantId));
    return json({ data: rows.map(decodeRow) });
  }
  if (segments.length === 1 && request.method === "POST") {
    const result = await writeBackup(env, principal.tenantId, principal.user.id);
    return json({ data: result }, result.status === "completed" ? 201 : 503);
  }
  if (segments.length === 3 && segments[2] === "restore" && request.method === "POST") {
    return problem(501, "restore_not_enabled", "Geri yükleme güvenlik nedeniyle otomatik çalıştırılmaz. Yedek doğrulaması ve açık bakım onayı sonrası yönetici aracıyla uygulanacaktır.");
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
  const timestamp = now();
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
      env.DB.prepare("INSERT INTO users (id,email,full_name,phone,created_at,updated_at) VALUES (?,?,?,?,?,?)").bind(userId, String(body.owner_email).toLowerCase(), body.owner_name, ownerPhone, timestamp, timestamp),
      env.DB.prepare("INSERT INTO roles (id,tenant_id,code,name,description,is_system,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(roleId, tenantId, "owner", "Firma Sahibi", "Tüm tenant yetkilerine sahiptir.", 1, timestamp, timestamp),
      env.DB.prepare("INSERT INTO memberships (id,tenant_id,user_id,role_id,title,status,created_at,updated_at) VALUES (?,?,?,?,?,'active',?,?)").bind(membershipId, tenantId, userId, roleId, body.owner_title || "Firma Sahibi", timestamp, timestamp),
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

async function dispatchAuthenticated(request, env, principal, url, segments) {
  if ((url.pathname === "/api/v1/session" || url.pathname === "/api/v1/me") && request.method === "GET") return getSession(principal);
  if (url.pathname === "/api/v1/dashboard" && request.method === "GET") return getDashboard(env, principal);
  if (segments[0] === "api" && segments[1] === "admin" && segments[2] === "backups") return backupRoute(request, env, principal, segments.slice(2));
  if (url.pathname === "/api/v1/files/upload" && request.method === "POST") return uploadFile(request, env, principal);
  if (segments.length === 5 && segments[2] === "files" && segments[4] === "content" && request.method === "GET") return downloadFile(env, principal, segments[3]);
  if (url.pathname === "/api/v1/memberships/invite" && request.method === "POST") return inviteMember(request, env, principal);
  if (segments.length === 5 && segments[2] === "roles" && segments[4] === "permissions") return rolePermissions(request, env, principal, segments[3]);
  if (segments[2] === "tokens") return tokenManagement(request, env, principal, segments);
  if (request.method === "POST" && segments.length === 5 && validId(segments[3])) {
    const [resource, resourceId, action] = [segments[2], segments[3], segments[4]];
    if (resource === "offers" && ["accept", "reject", "convert-to-project"].includes(action)) return offerAction(request, env, principal, resourceId, action);
    if (resource === "projects" && action === "transition") return transitionProject(request, env, principal, resourceId);
    if (resource === "work-items" && action === "approve-revision") return approveWorkItemRevision(request, env, principal, resourceId);
    if (resource === "production-orders" && action === "release") return releaseProductionOrder(request, env, principal, resourceId);
    if (resource === "purchase-requests" && action === "approve") return approvePurchaseRequest(request, env, principal, resourceId);
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
  if (resourceId && !validId(resourceId)) return problem(400, "invalid_id", "Geçersiz kayıt kimliği.");
  if (!resourceId && request.method === "GET") return listResource(request, env, principal, slug, config);
  if (!resourceId && request.method === "POST") return createResource(request, env, principal, slug, config);
  if (resourceId && request.method === "GET") return getResource(env, principal, slug, config, resourceId);
  if (resourceId && ["PATCH", "PUT"].includes(request.method)) return updateResource(request, env, principal, slug, config, resourceId);
  if (resourceId && request.method === "DELETE") return deleteResource(request, env, principal, slug, config, resourceId);
  return problem(405, "method_not_allowed", "Bu HTTP yöntemi desteklenmiyor.");
}

async function withIdempotency(request, env, principal, handler) {
  if (new URL(request.url).pathname.startsWith("/api/v1/tokens")) return handler();
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key || !["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return handler();
  if (!/^[A-Za-z0-9._:-]{8,200}$/.test(key)) return problem(400, "invalid_idempotency_key", "Idempotency-Key 8-200 güvenli karakter içermelidir.");
  const path = new URL(request.url).pathname;
  const existing = await one(env.DB.prepare("SELECT status_code,response_body FROM idempotency_records WHERE tenant_id=? AND user_id=? AND idempotency_key=? AND method=? AND path=?").bind(principal.tenantId, principal.user.id, key, request.method, path));
  if (existing?.status_code && existing.response_body !== null) {
    return new Response(existing.status_code === 204 ? null : existing.response_body, { status: existing.status_code, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "idempotency-replayed": "true" } });
  }
  if (existing) return problem(409, "idempotency_in_progress", "Aynı istek halen işleniyor.");
  const recordId = id("idem_");
  try {
    await run(env.DB.prepare("INSERT INTO idempotency_records (id,tenant_id,user_id,idempotency_key,method,path,created_at) VALUES (?,?,?,?,?,?,?)").bind(recordId, principal.tenantId, principal.user.id, key, request.method, path, now()));
  } catch {
    const replay = await one(env.DB.prepare("SELECT status_code,response_body FROM idempotency_records WHERE tenant_id=? AND user_id=? AND idempotency_key=? AND method=? AND path=?").bind(principal.tenantId, principal.user.id, key, request.method, path));
    if (replay?.status_code && replay.response_body !== null) return new Response(replay.status_code === 204 ? null : replay.response_body, { status: replay.status_code, headers: { "content-type": "application/json; charset=utf-8", "idempotency-replayed": "true" } });
    return problem(409, "idempotency_in_progress", "Aynı istek halen işleniyor.");
  }
  const response = await handler();
  const responseBody = response.status === 204 ? "" : await response.clone().text();
  await run(env.DB.prepare("UPDATE idempotency_records SET status_code=?,response_body=?,completed_at=? WHERE id=? AND tenant_id=?").bind(response.status, responseBody, now(), recordId, principal.tenantId));
  return response;
}

async function handleApi(request, env, context) {
  env = { ...env, DB: databaseFromEnv(env) };
  if (!env.DB) return problem(503, "database_unavailable", "DB binding yapılandırılmamış.");
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  if (url.pathname === "/api/v1/health" && request.method === "GET") return json({ data: { status: "ok", time: now() } });
  if (url.pathname === "/api/v1/bootstrap" && request.method === "POST") return bootstrap(request, env);
  if (url.pathname === "/api/v1/auth/phone/start" && request.method === "POST") return startPhoneAuth(request, env);
  if (url.pathname === "/api/v1/auth/phone/verify" && request.method === "POST") return verifyPhoneAuth(request, env);
  if (url.pathname === "/api/v1/auth/logout" && request.method === "POST") return logoutPhoneAuth(request, env);
  const principal = await authenticate(request, env);
  if (!principal) return problem(401, "unauthorized", "Oturum bulunamadı.", { accepted: ["phone session", "platform identity", "Bearer token"] });
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
    return new Response(null, { status: 204, headers: { allow: "GET,POST,PUT,PATCH,DELETE,OPTIONS", "access-control-allow-headers": "authorization,content-type,x-tenant-id,x-request-id", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" } });
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
    const tenants = await all(env.DB.prepare("SELECT id FROM tenants WHERE status='active' ORDER BY id"));
    for (const tenant of tenants) await writeBackup(env, tenant.id, "scheduler");
  })();
  if (context?.waitUntil) context.waitUntil(task);
  else await task;
}

export const __testing = { authenticate, handleApi, writeBackup, resources };
export default { fetch: fetchHandler, scheduled: scheduledHandler };
