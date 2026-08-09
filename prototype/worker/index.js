const JSON_COLUMNS = new Set(["settings_json", "metadata_json", "dependency_ids_json", "team_json"]);

const resources = {
  customers: { table: "customers", required: ["name"], search: ["code", "name", "contact_name", "email", "phone"], fields: ["code","type","name","contact_name","email","phone","tax_office","tax_number","address","city","payment_terms","credit_limit_minor","notes","status","metadata_json"] },
  suppliers: { table: "suppliers", required: ["name"], search: ["code", "name", "category", "contact_name"], fields: ["code","name","category","contact_name","email","phone","tax_office","tax_number","address","city","payment_terms","rating","notes","status","metadata_json"] },
  projects: { table: "projects", required: ["code", "name"], search: ["code", "name", "project_type", "city"], filters: ["customer_id", "status", "manager_user_id"], refs: { customer_id: "customers" }, fields: ["code","customer_id","name","project_type","site_address","city","architect_user_id","manager_user_id","status","priority","planned_start_date","planned_end_date","actual_start_date","actual_end_date","contract_amount_minor","estimated_cost_minor","progress_percent","description","metadata_json"] },
  offers: { table: "offers", required: ["offer_number"], search: ["offer_number", "notes", "rejection_reason"], filters: ["project_id", "customer_id", "status"], refs: { project_id: "projects", customer_id: "customers" }, fields: ["project_id","customer_id","offer_number","revision","offer_date","valid_until","currency","subtotal_minor","discount_total_minor","tax_total_minor","grand_total_minor","payment_terms","delivery_terms","status","rejection_reason","notes","metadata_json"] },
  "offer-items": { table: "offer_items", required: ["offer_id", "description"], search: ["item_code", "description"], filters: ["offer_id"], refs: { offer_id: "offers" }, fields: ["offer_id","parent_id","item_code","description","unit","quantity","unit_price_minor","cost_price_minor","discount_rate","tax_rate","total_minor","sort_order","metadata_json"] },
  "project-tasks": { table: "project_tasks", required: ["project_id", "title"], search: ["title", "description", "department"], filters: ["project_id", "assignee_user_id", "status"], refs: { project_id: "projects", parent_id: "project_tasks" }, fields: ["project_id","parent_id","title","description","assignee_user_id","department","status","priority","planned_start","planned_end","completed_at","progress_percent","dependency_ids_json","metadata_json"] },
  "work-items": { table: "work_items", required: ["project_id", "description"], search: ["space_name", "product_type", "item_code", "description"], filters: ["project_id", "task_id", "supplier_id", "status", "revision_status"], refs: { project_id: "projects", task_id: "project_tasks", supplier_id: "suppliers" }, fields: ["project_id","task_id","space_name","product_type","item_code","description","width","height","depth","unit","quantity","material","finish","production_type","supplier_id","unit_cost_minor","unit_price_minor","status","metadata_json"] },
  "purchase-requests": { table: "purchase_requests", required: ["request_number", "description"], search: ["request_number", "description", "notes"], filters: ["project_id", "requester_user_id", "status"], refs: { project_id: "projects", preferred_supplier_id: "suppliers" }, fields: ["request_number","project_id","requester_user_id","needed_by","priority","description","quantity","unit","estimated_amount_minor","currency","preferred_supplier_id","status","approved_by","approved_at","notes","metadata_json"] },
  "purchase-orders": { table: "purchase_orders", required: ["order_number", "supplier_id"], search: ["order_number", "notes"], filters: ["request_id", "project_id", "supplier_id", "status"], refs: { request_id: "purchase_requests", project_id: "projects", supplier_id: "suppliers" }, fields: ["order_number","request_id","project_id","supplier_id","order_date","expected_date","currency","subtotal_minor","tax_total_minor","grand_total_minor","status","delivery_address","notes","metadata_json"] },
  "production-orders": { table: "production_orders", required: ["order_number", "project_id"], search: ["order_number", "workshop", "assigned_team", "instructions"], filters: ["project_id", "work_item_id", "supplier_id", "status"], refs: { project_id: "projects", work_item_id: "work_items", supplier_id: "suppliers" }, fields: ["order_number","project_id","work_item_id","production_type","supplier_id","workshop","assigned_team","planned_start","planned_end","actual_start","actual_end","quantity","completed_quantity","quality_status","status","instructions","metadata_json"] },
  installations: { table: "installations", required: ["installation_number", "project_id"], search: ["installation_number", "location", "acceptance_contact", "issue_notes"], filters: ["project_id", "team_lead_user_id", "status"], refs: { project_id: "projects" }, fields: ["installation_number","project_id","location","team_lead_user_id","team_json","planned_start","planned_end","actual_start","actual_end","progress_percent","status","acceptance_contact","acceptance_date","issue_notes","metadata_json"] },
  accounts: { table: "accounts", required: ["code", "name", "type"], search: ["code", "name", "bank_name", "iban"], filters: ["type", "status"], fields: ["code","name","type","currency","bank_name","iban","opening_balance_minor","current_balance_minor","status","metadata_json"] },
  "financial-transactions": { table: "financial_transactions", required: ["transaction_number", "type", "transaction_date", "amount_minor"], search: ["transaction_number", "category", "reference", "description"], filters: ["project_id", "account_id", "customer_id", "supplier_id", "type", "status"], refs: { project_id: "projects", account_id: "accounts", customer_id: "customers", supplier_id: "suppliers" }, fields: ["transaction_number","project_id","account_id","customer_id","supplier_id","type","category","transaction_date","due_date","amount_minor","currency","exchange_rate","official","payment_method","reference","description","status","metadata_json"] },
  invoices: { table: "invoices", required: ["invoice_number", "direction", "issue_date"], search: ["invoice_number", "notes"], filters: ["project_id", "customer_id", "supplier_id", "direction", "status"], refs: { project_id: "projects", customer_id: "customers", supplier_id: "suppliers" }, fields: ["invoice_number","direction","project_id","customer_id","supplier_id","issue_date","due_date","currency","subtotal_minor","tax_total_minor","grand_total_minor","paid_total_minor","official","datasoft_status","status","notes","metadata_json"] },
  employees: { table: "employees", required: ["employee_number", "first_name", "last_name"], search: ["employee_number", "first_name", "last_name", "department", "title", "email"], filters: ["department", "status"], fields: ["employee_number","user_id","first_name","last_name","national_id_masked","birth_date","email","phone","department","title","employment_type","hire_date","termination_date","manager_employee_id","salary_amount_minor","salary_currency","emergency_contact","address","status","metadata_json"] },
  attendance: { table: "attendance", required: ["employee_id", "work_date"], search: ["location", "notes"], filters: ["employee_id", "work_date", "status"], refs: { employee_id: "employees" }, fields: ["employee_id","work_date","check_in","check_out","regular_minutes","overtime_minutes","location","source","status","notes","metadata_json"] },
  leaves: { table: "leave_requests", required: ["employee_id", "leave_type", "start_date", "end_date", "day_count"], search: ["leave_type", "reason"], filters: ["employee_id", "status"], refs: { employee_id: "employees" }, fields: ["employee_id","leave_type","start_date","end_date","day_count","reason","status","approved_by","approved_at","metadata_json"] },
  "payroll-inputs": { table: "payroll_inputs", required: ["employee_id", "period"], search: ["period", "notes"], filters: ["employee_id", "period", "status"], refs: { employee_id: "employees" }, fields: ["employee_id","period","base_salary_minor","overtime_amount_minor","bonus_amount_minor","allowance_amount_minor","deduction_amount_minor","advance_amount_minor","net_preview_minor","currency","status","notes","metadata_json"] },
  files: { table: "files", required: ["entity_type", "entity_id", "file_name", "object_key"], search: ["file_name", "category", "description"], filters: ["entity_type", "entity_id", "category"], fields: ["entity_type","entity_id","category","file_name","object_key","content_type","size_bytes","checksum","uploaded_by","description","metadata_json"] },
  "audit-logs": { table: "audit_logs", readOnly: true, search: ["action", "entity_type", "entity_id"], filters: ["user_id", "action", "entity_type"], fields: [] },
  memberships: { table: "memberships", required: ["user_id", "role_id"], search: ["title"], filters: ["user_id", "role_id", "status"], fields: ["user_id","role_id","title","status"] },
  roles: { table: "roles", required: ["code", "name"], search: ["code", "name", "description"], fields: ["code","name","description","is_system"] },
};

const aliases = {
  purchases: "purchase-orders",
  "work-orders": "production-orders",
  transactions: "financial-transactions",
};

const backupTables = ["customers","suppliers","projects","offers","offer_items","project_tasks","work_items","purchase_requests","purchase_orders","production_orders","installations","accounts","financial_transactions","invoices","employees","attendance","leave_requests","payroll_inputs","files","audit_logs","roles","role_permissions","memberships"];
const backupMigrations = ["0001_tenant_core.sql", "0002_permissions.sql", "0003_workflows.sql"];
const ownerRoles = new Set(["owner", "admin"]);
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
const workflowManagedResources = new Set(["offers", "projects", "production-orders", "purchase-requests", "leaves", "financial-transactions"]);

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...extraHeaders },
  });
}

function problem(status, code, message, details) {
  return json({ error: { code, message, ...(details ? { details } : {}) } }, status);
}

function now() { return new Date().toISOString(); }
function id(prefix = "") { return prefix + crypto.randomUUID(); }
function validId(value) { return typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value); }

async function sha256(value) {
  const input = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const bytes = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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
  if (!allowed(principal, "finance.sensitive.read")) for (const field of ["iban"]) delete result[field];
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
    user = await one(env.DB.prepare("SELECT u.id, u.email, u.full_name, u.status FROM api_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.revoked_at IS NULL AND (t.expires_at IS NULL OR t.expires_at>?) AND u.status='active'").bind(tokenHash, now()));
    if (user) await run(env.DB.prepare("UPDATE api_tokens SET last_used_at=? WHERE token_hash=?").bind(now(), tokenHash));
  } else {
    const platformEmail = request.headers.get("oai-authenticated-user-email");
    const devEmail = env.ALLOW_DEV_AUTH === "true" ? request.headers.get("x-user-email") : null;
    const email = platformEmail || devEmail;
    if (email) user = await one(env.DB.prepare("SELECT id,email,full_name,status FROM users WHERE email=? COLLATE NOCASE AND status='active'").bind(email.trim()));
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
  const allowedInitialStatuses = {
    offers: new Set([undefined, "draft", "sent", "pending"]),
    projects: new Set([undefined, "lead"]),
    "production-orders": new Set([undefined, "draft", "planned"]),
    "purchase-requests": new Set([undefined, "draft", "pending"]),
    leaves: new Set([undefined, "pending"]),
    "financial-transactions": new Set([undefined, "draft", "planned", "pending"]),
  };
  if (allowedInitialStatuses[slug] && !allowedInitialStatuses[slug].has(body.status)) return problem(409, "workflow_endpoint_required", "Bu başlangıç durumu yalnız ilgili iş akışı endpoint'i ile oluşturulabilir.");
  const normalized = normalizeInput(config, body, true);
  if (normalized.error) return problem(422, "validation_error", normalized.error);
  const referenceError = await validateReferences(env, principal, config, normalized.values);
  if (referenceError) return problem(422, "cross_tenant_reference", referenceError);
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
  const normalized = normalizeInput(config, body, false);
  if (normalized.error) return problem(422, "validation_error", normalized.error);
  const referenceError = await validateReferences(env, principal, config, normalized.values);
  if (referenceError) return problem(422, "cross_tenant_reference", referenceError);
  const existing = await one(env.DB.prepare(`SELECT * FROM ${config.table} WHERE id=? AND tenant_id=?`).bind(resourceId, principal.tenantId));
  if (!existing) return problem(404, "not_found", "Kayıt bulunamadı.");
  if (workflowManagedResources.has(slug) && normalized.values.status !== undefined && normalized.values.status !== existing.status) return problem(409, "workflow_endpoint_required", "Durum değişikliği yalnız ilgili iş akışı endpoint'i üzerinden yapılabilir.");
  if (slug === "financial-transactions" && ["approved", "reversed"].includes(existing.status)) return problem(409, "approved_record_immutable", "Onaylı finans kaydı düzenlenemez; ters kayıt oluşturun.");
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
  if (!body?.email || !body?.full_name || !body?.role_id) return problem(422, "validation_error", "email, full_name ve role_id zorunludur.");
  const role = await one(env.DB.prepare("SELECT id FROM roles WHERE id=? AND tenant_id=?").bind(body.role_id, principal.tenantId));
  if (!role) return problem(422, "cross_tenant_reference", "Rol bu firmaya ait değil.");
  const email = String(body.email).trim().toLowerCase();
  let user = await one(env.DB.prepare("SELECT id,email,full_name,status FROM users WHERE email=? COLLATE NOCASE").bind(email));
  const timestamp = now();
  if (!user) {
    user = { id: id("usr_"), email, full_name: body.full_name, status: "invited" };
    await run(env.DB.prepare("INSERT INTO users (id,email,full_name,phone,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(user.id, email, body.full_name, body.phone || null, "invited", timestamp, timestamp));
  }
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

async function optionalJson(request) {
  if (!request.headers.get("content-type")) return {};
  return parseBody(request);
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

async function deleteResource(request, env, principal, slug, config, resourceId) {
  if (config.readOnly) return problem(405, "read_only", "Bu kaynak salt okunurdur.");
  if (!allowed(principal, permissionFor(slug, "delete"))) return problem(403, "forbidden", "Kayıt silme yetkiniz yok.");
  const existing = await one(env.DB.prepare(`SELECT * FROM ${config.table} WHERE id=? AND tenant_id=?`).bind(resourceId, principal.tenantId));
  if (!existing) return problem(404, "not_found", "Kayıt bulunamadı.");
  if (slug === "financial-transactions" && ["approved", "reversed"].includes(existing.status)) return problem(409, "approved_record_immutable", "Onaylı finans kaydı silinemez; ters kayıt oluşturun.");
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
  await run(env.DB.prepare("INSERT INTO backup_runs (id,tenant_id,status,triggered_by,created_at) VALUES (?,?,?,?,?)").bind(backupId, tenantId, "running", triggeredBy, started));
  if (!env.FILES) {
    const message = "R2 FILES binding yapılandırılmamış.";
    await run(env.DB.prepare("UPDATE backup_runs SET status='failed',error_message=?,completed_at=? WHERE id=? AND tenant_id=?").bind(message, now(), backupId, tenantId));
    await audit(env, { tenantId, user: null }, null, "backup.failed", "backups", backupId, { error: message });
    return { id: backupId, tenant_id: tenantId, status: "failed", error_message: message };
  }
  try {
    const lines = [JSON.stringify({ type: "manifest", version: 1, schema_version: 3, migrations: backupMigrations, tenant_id: tenantId, created_at: started })];
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
  const timestamp = now();
  const tenantId = id("ten_");
  const userId = id("usr_");
  const roleId = id("rol_");
  const membershipId = id("mem_");
  const rawToken = `cap_${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
  const tokenHash = await sha256(rawToken);
  try {
    const statements = [
      env.DB.prepare("INSERT INTO tenants (id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)").bind(tenantId, body.tenant_name, body.tenant_slug, timestamp, timestamp),
      env.DB.prepare("INSERT INTO users (id,email,full_name,created_at,updated_at) VALUES (?,?,?,?,?)").bind(userId, String(body.owner_email).toLowerCase(), body.owner_name, timestamp, timestamp),
      env.DB.prepare("INSERT INTO roles (id,tenant_id,code,name,description,is_system,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").bind(roleId, tenantId, "owner", "Firma Sahibi", "Tüm tenant yetkilerine sahiptir.", 1, timestamp, timestamp),
      env.DB.prepare("INSERT INTO memberships (id,tenant_id,user_id,role_id,title,status,created_at,updated_at) VALUES (?,?,?,?,?,'active',?,?)").bind(membershipId, tenantId, userId, roleId, body.owner_title || "Firma Sahibi", timestamp, timestamp),
      env.DB.prepare("INSERT INTO api_tokens (id,user_id,name,token_hash,created_at) VALUES (?,?,?,?,?)").bind(id("tok_"), userId, "İlk kurulum", tokenHash, timestamp),
    ];
    if (typeof env.DB.batch === "function") await env.DB.batch(statements);
    else for (const statement of statements) await run(statement);
  } catch (error) { return problem(500, "bootstrap_failed", "İlk kurulum tamamlanamadı.", env.EXPOSE_ERRORS === "true" ? String(error) : undefined); }
  return json({ data: { tenant: { id: tenantId, name: body.tenant_name, slug: body.tenant_slug }, user: { id: userId, email: body.owner_email, full_name: body.owner_name }, token: rawToken } }, 201);
}

async function dispatchAuthenticated(request, env, principal, url, segments) {
  if ((url.pathname === "/api/v1/session" || url.pathname === "/api/v1/me") && request.method === "GET") return getSession(principal);
  if (url.pathname === "/api/v1/dashboard" && request.method === "GET") return getDashboard(env, principal);
  if (segments[0] === "api" && segments[1] === "admin" && segments[2] === "backups") return backupRoute(request, env, principal, segments.slice(2));
  if (url.pathname === "/api/v1/files/upload" && request.method === "POST") return uploadFile(request, env, principal);
  if (segments.length === 5 && segments[2] === "files" && segments[4] === "content" && request.method === "GET") return downloadFile(env, principal, segments[3]);
  if (url.pathname === "/api/v1/memberships/invite" && request.method === "POST") return inviteMember(request, env, principal);
  if (segments.length === 5 && segments[2] === "roles" && segments[4] === "permissions") return rolePermissions(request, env, principal, segments[3]);
  if (request.method === "POST" && segments.length === 5 && validId(segments[3])) {
    const [resource, resourceId, action] = [segments[2], segments[3], segments[4]];
    if (resource === "offers" && ["accept", "reject", "convert-to-project"].includes(action)) return offerAction(request, env, principal, resourceId, action);
    if (resource === "projects" && action === "transition") return transitionProject(request, env, principal, resourceId);
    if (resource === "work-items" && action === "approve-revision") return approveWorkItemRevision(request, env, principal, resourceId);
    if (resource === "production-orders" && action === "release") return releaseProductionOrder(request, env, principal, resourceId);
    if (resource === "purchase-requests" && action === "approve") return approvePurchaseRequest(request, env, principal, resourceId);
    if (resource === "leaves" && ["approve", "reject"].includes(action)) return decideLeave(request, env, principal, resourceId, action);
    if (resource === "financial-transactions" && ["approve", "reverse"].includes(action)) return financialAction(request, env, principal, resourceId, action);
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

async function handleApi(request, env) {
  if (!env.DB) return problem(503, "database_unavailable", "DB binding yapılandırılmamış.");
  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  if (url.pathname === "/api/v1/health" && request.method === "GET") return json({ data: { status: "ok", time: now() } });
  if (url.pathname === "/api/v1/bootstrap" && request.method === "POST") return bootstrap(request, env);
  const principal = await authenticate(request, env);
  if (!principal) return problem(401, "unauthorized", "Oturum bulunamadı.", { accepted: ["platform identity", "Bearer token"] });
  if (principal.tenantSelectionRequired) {
    if ((url.pathname === "/api/v1/session" || url.pathname === "/api/v1/me") && request.method === "GET") return getSession(principal);
    return problem(400, "tenant_required", "Birden fazla firma üyeliğiniz var; x-tenant-id seçilmelidir.", { tenants: principal.tenants });
  }
  if (principal.tenantMissing) return problem(400, "tenant_required", "x-tenant-id başlığı zorunludur.");
  if (principal.forbiddenTenant) return problem(403, "tenant_forbidden", "Bu firmaya erişim yetkiniz yok.");

  return withIdempotency(request, env, principal, () => dispatchAuthenticated(request, env, principal, url, segments));
}

async function fetchHandler(request, env) {
  const url = new URL(request.url);
  const isApiRoute = url.pathname.startsWith("/api/v1/") || url.pathname.startsWith("/api/admin/");
  if (request.method === "OPTIONS" && isApiRoute) {
    return new Response(null, { status: 204, headers: { allow: "GET,POST,PUT,PATCH,DELETE,OPTIONS", "access-control-allow-headers": "authorization,content-type,x-tenant-id,x-request-id", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" } });
  }
  if (isApiRoute) {
    try { return await handleApi(request, env); }
    catch (error) {
      console.error("Unhandled API error", error);
      return problem(500, "internal_error", "Beklenmeyen bir sunucu hatası oluştu.", env.EXPOSE_ERRORS === "true" ? String(error?.stack || error) : undefined);
    }
  }

  const response = await env.ASSETS.fetch(request);
  const acceptsHtml = request.headers.get("accept")?.includes("text/html");
  if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) return response;
  const indexUrl = new URL(request.url);
  indexUrl.pathname = "/index.html";
  indexUrl.search = "";
  return env.ASSETS.fetch(new Request(indexUrl, request));
}

async function scheduledHandler(_controller, env, context) {
  const task = (async () => {
    if (!env.DB) return;
    const tenants = await all(env.DB.prepare("SELECT id FROM tenants WHERE status='active' ORDER BY id"));
    for (const tenant of tenants) await writeBackup(env, tenant.id, "scheduler");
  })();
  if (context?.waitUntil) context.waitUntil(task);
  else await task;
}

export const __testing = { authenticate, handleApi, writeBackup, resources };
export default { fetch: fetchHandler, scheduled: scheduledHandler };
