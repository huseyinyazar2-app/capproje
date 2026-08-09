/**
 * Capproje API contract lives in this file so the UI is independent from the
 * transport and endpoint naming. Override the base URL with VITE_API_URL.
 */
export const API_CONFIG = Object.freeze({
  baseUrl: String(import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, ""),
  timeoutMs: 15000,
  endpoints: Object.freeze({
    session: "/session",
    dashboard: "/dashboard",
    projects: "/projects",
    offers: "/offers",
    purchases: "/purchase-requests",
    production: "/production-orders",
    installations: "/installations",
    finance: "/financial-transactions",
    accounting: "/invoices",
    hr: "/employees",
    customers: "/customers",
    suppliers: "/suppliers",
    workItems: "/work-items",
    attendance: "/attendance",
    leaves: "/leaves",
    payroll: "/payroll-inputs",
    files: "/files",
    memberships: "/memberships",
    roles: "/roles",
    auditLogs: "/audit-logs",
    offerItems: "/offer-items",
    projectTasks: "/project-tasks",
    purchaseOrders: "/purchase-orders",
    accounts: "/accounts",
    tokens: "/tokens",
    siteSurveys: "/site-surveys",
    surveyMeasurements: "/survey-measurements",
    contracts: "/contracts",
    designRevisions: "/design-revisions",
    progressPayments: "/progress-payments",
    inventoryItems: "/inventory-items",
    stockMovements: "/stock-movements",
    projectMeetings: "/project-meetings",
    meetingActions: "/meeting-actions",
    qualityInspections: "/quality-inspections",
    handovers: "/handovers",
    handoverPunchItems: "/handover-punch-items",
  }),
});

const TENANT_KEY = "capproje.tenant.id";
const DEMO_USER_KEY = "capproje.demo.user-email";
const DEMO_AUTH_ENABLED = import.meta.env.DEV || String(import.meta.env.VITE_ENABLE_DEMO_AUTH) === "true";
let accessToken = null;

export const RESOURCE_SLUGS = Object.freeze({
  dashboard: "dashboard",
  projects: "projects",
  offers: "offers",
  purchases: "purchase-requests",
  production: "production-orders",
  installations: "installations",
  finance: "financial-transactions",
  accounting: "invoices",
  hr: "employees",
  customers: "customers",
  suppliers: "suppliers",
  workItems: "work-items",
  attendance: "attendance",
  leaves: "leaves",
  payroll: "payroll-inputs",
  files: "files",
  memberships: "memberships",
  roles: "roles",
  auditLogs: "audit-logs",
  backups: "backups",
  offerItems: "offer-items",
  projectTasks: "project-tasks",
  purchaseOrders: "purchase-orders",
  accounts: "accounts",
  tokens: "tokens",
  siteSurveys: "site-surveys",
  surveyMeasurements: "survey-measurements",
  contracts: "contracts",
  designRevisions: "design-revisions",
  progressPayments: "progress-payments",
  inventoryItems: "inventory-items",
  stockMovements: "stock-movements",
  projectMeetings: "project-meetings",
  meetingActions: "meeting-actions",
  qualityInspections: "quality-inspections",
  handovers: "handovers",
  handoverPunchItems: "handover-punch-items",
});

const FIELD_MAPS = Object.freeze({
  projects: { customerName: "customer_id", projectManager: "manager_user_id", progress: "progress_percent", startDate: "planned_start_date", targetDate: "planned_end_date", contractAmount: "contract_amount_minor", photoConsent: "photo_consent", address: "site_address" },
  offers: { referenceNo: "offer_number", projectName: "project_id", customerName: "customer_id", totalAmount: "grand_total_minor", validUntil: "valid_until", lossReason: "rejection_reason" },
  purchases: { number: "request_number", projectId: "project_id", itemName: "description", supplierName: "preferred_supplier_id", requiredAt: "needed_by", estimatedAmount: "estimated_amount_minor", specification: "notes" },
  production: { code: "order_number", projectId: "project_id", itemName: "work_item_id", workCenter: "workshop", assignee: "assigned_team", plannedStart: "planned_start", plannedEnd: "planned_end", outsourced: "production_type", tradeType: "trade_type", notes: "instructions" },
  installations: { code: "installation_number", projectId: "project_id", teamName: "team_json", scheduledAt: "planned_start", contactName: "acceptance_contact", notes: "issue_notes", siteReadiness: "metadata_json" },
  finance: { projectId: "project_id", transactionNo: "transaction_number", transactionDate: "transaction_date", dueDate: "due_date", amount: "amount_minor" },
  accounting: { documentNo: "invoice_number", customerId: "customer_id", supplierId: "supplier_id", transactionDate: "issue_date", dueDate: "due_date", amount: "grand_total_minor", datasoftStatus: "datasoft_status", description: "notes" },
  hr: { employeeNo: "employee_number", firstName: "first_name", lastName: "last_name", jobTitle: "title", employmentType: "employment_type", startDate: "hire_date", emergencyContact: "emergency_contact", emergencyPhone: "metadata_json", salaryAmount: "salary_amount_minor" },
  customers: { contactName: "contact_name", taxOffice: "tax_office", taxNumber: "tax_number", paymentTerms: "payment_terms", creditLimit: "credit_limit_minor" },
  suppliers: { contactName: "contact_name", taxOffice: "tax_office", taxNumber: "tax_number", paymentTerms: "payment_terms" },
  workItems: { projectId: "project_id", taskId: "task_id", spaceName: "space_name", productType: "product_type", itemCode: "item_code", productionType: "production_type", supplierId: "supplier_id", unitCost: "unit_cost_minor", unitPrice: "unit_price_minor" },
  attendance: { employeeId: "employee_id", workDate: "work_date", checkIn: "check_in", checkOut: "check_out", regularMinutes: "regular_minutes", overtimeMinutes: "overtime_minutes" },
  leaves: { employeeId: "employee_id", leaveType: "leave_type", startDate: "start_date", endDate: "end_date", dayCount: "day_count", approvedBy: "approved_by", approvedAt: "approved_at" },
  payroll: { employeeId: "employee_id", baseSalary: "base_salary_minor", overtimeAmount: "overtime_amount_minor", bonusAmount: "bonus_amount_minor", allowanceAmount: "allowance_amount_minor", deductionAmount: "deduction_amount_minor", advanceAmount: "advance_amount_minor", netPreview: "net_preview_minor" },
  files: { entityType: "entity_type", entityId: "entity_id", fileName: "file_name", objectKey: "object_key", contentType: "content_type", sizeBytes: "size_bytes", uploadedBy: "uploaded_by" },
  memberships: { userId: "user_id", roleId: "role_id", fullName: "full_name" },
  auditLogs: { userId: "user_id", entityType: "entity_type", entityId: "entity_id", requestId: "request_id", ipAddress: "ip_address", changes: "changes_json", createdAt: "created_at" },
  backups: { tenantId: "tenant_id", triggeredBy: "triggered_by", objectKey: "object_key", rowCount: "row_count", errorMessage: "error_message", createdAt: "created_at", completedAt: "completed_at" },
  offerItems: { offerId: "offer_id", parentId: "parent_id", itemCode: "item_code", unitPrice: "unit_price_minor", costPrice: "cost_price_minor", discountRate: "discount_rate", taxRate: "tax_rate", total: "total_minor", sortOrder: "sort_order" },
  projectTasks: { projectId: "project_id", parentId: "parent_id", assigneeUserId: "assignee_user_id", plannedStart: "planned_start", plannedEnd: "planned_end", completedAt: "completed_at", progress: "progress_percent", dependencyIds: "dependency_ids_json" },
  purchaseOrders: { orderNumber: "order_number", requestId: "request_id", projectId: "project_id", supplierId: "supplier_id", orderDate: "order_date", expectedDate: "expected_date", subtotal: "subtotal_minor", taxTotal: "tax_total_minor", grandTotal: "grand_total_minor", deliveryAddress: "delivery_address" },
  accounts: { bankName: "bank_name", openingBalance: "opening_balance_minor", currentBalance: "current_balance_minor" },
  tokens: { expiresAt: "expires_at", lastUsedAt: "last_used_at", revokedAt: "revoked_at", createdAt: "created_at" },
  siteSurveys: { projectId: "project_id", customerId: "customer_id", surveyNumber: "survey_number", surveyDate: "survey_date", surveyorUserId: "surveyor_user_id", customerContact: "customer_contact" },
  surveyMeasurements: { siteSurveyId: "site_survey_id", spaceName: "space_name", elementType: "element_type", itemCode: "item_code", sortOrder: "sort_order" },
  contracts: { contractNumber: "contract_number", projectId: "project_id", customerId: "customer_id", offerId: "offer_id", paymentModel: "payment_model", contractAmount: "contract_amount_minor", advanceRate: "advance_rate", advanceAmount: "advance_amount_minor", retentionRate: "retention_rate", retentionAmount: "retention_amount_minor", warrantyMonths: "warranty_months", warrantyAmount: "warranty_amount_minor", paymentSchedule: "payment_schedule_json", effectiveDate: "effective_date", plannedStartDate: "planned_start_date", plannedEndDate: "planned_end_date", signedByCustomer: "signed_by_customer", signedByCompany: "signed_by_company", photoConsent: "photo_consent", terminationReason: "termination_reason" },
  designRevisions: { projectId: "project_id", workItemId: "work_item_id", revisionNumber: "revision_number", drawingType: "drawing_type", fileId: "file_id", rejectionReason: "rejection_reason", supersedesId: "supersedes_id" },
  progressPayments: { progressNumber: "progress_number", projectId: "project_id", contractId: "contract_id", periodStart: "period_start", periodEnd: "period_end", previousWork: "previous_work_minor", currentWork: "current_work_minor", cumulativeWork: "cumulative_work_minor", deduction: "deduction_minor", retention: "retention_minor", tax: "tax_minor", netPayable: "net_payable_minor", rejectionReason: "rejection_reason", invoiceId: "invoice_id", paymentTransactionId: "payment_transaction_id" },
  inventoryItems: { onHandQuantity: "on_hand_quantity", reservedQuantity: "reserved_quantity", minimumQuantity: "minimum_quantity", averageCost: "average_cost_minor", warehouseLocation: "warehouse_location", preferredSupplierId: "preferred_supplier_id" },
  stockMovements: { movementNumber: "movement_number", inventoryItemId: "inventory_item_id", projectId: "project_id", movementType: "movement_type", movementDate: "movement_date", unitCost: "unit_cost_minor", totalCost: "total_cost_minor", sourceType: "source_type", sourceId: "source_id" },
  projectMeetings: { projectId: "project_id", meetingType: "meeting_type", meetingDate: "meeting_date", facilitatorUserId: "facilitator_user_id", attendees: "attendees_json" },
  meetingActions: { meetingId: "meeting_id", projectId: "project_id", ownerUserId: "owner_user_id", dueDate: "due_date", completedAt: "completed_at" },
  qualityInspections: { inspectionNumber: "inspection_number", projectId: "project_id", workItemId: "work_item_id", productionOrderId: "production_order_id", installationId: "installation_id", inspectionType: "inspection_type", inspectionDate: "inspection_date", inspectorUserId: "inspector_user_id", checklist: "checklist_json", defectNotes: "defect_notes", correctiveAction: "corrective_action", correctiveDueDate: "corrective_due_date" },
  handovers: { handoverNumber: "handover_number", projectId: "project_id", installationId: "installation_id", handoverDate: "handover_date", customerContact: "customer_contact", satisfactionScore: "satisfaction_score", customerSignatureFileId: "customer_signature_file_id", acceptanceNotes: "acceptance_notes" },
  handoverPunchItems: { handoverId: "handover_id", responsibleUserId: "responsible_user_id", dueDate: "due_date", resolvedAt: "resolved_at", acceptedAt: "accepted_at" },
});

const STATUS_VALUES = Object.freeze({
  projects: { Potansiyel: "lead", Keşif: "discovery", Maliyetlendirme: "estimating", Teklif: "offered", Sözleşme: "contracted", Tasarım: "design", "Satın Alma": "procurement", Üretim: "production", Montaj: "installation", Kabul: "acceptance", Beklemede: "on_hold", Tamamlandı: "completed", İptal: "cancelled" },
  offers: { Taslak: "draft", "Maliyet çalışılıyor": "costing", Sunuldu: "sent", "Revizyon istendi": "revision_requested", "Kabul edildi": "accepted", Kaybedildi: "rejected" },
  purchases: { Taslak: "draft", "Onay bekliyor": "pending", Onaylandı: "approved", "Sipariş verildi": "ordered", "Kısmi teslim": "partial", "Teslim edildi": "received", İptal: "cancelled" },
  production: { Planlandı: "planned", "Malzeme bekliyor": "waiting_material", Üretimde: "in_progress", "Kalite kontrolde": "quality_control", Tamamlandı: "completed", Durduruldu: "paused" },
  installations: { "Keşif gerekli": "survey_needed", "Saha bekleniyor": "site_waiting", Planlandı: "planned", Yolda: "in_transit", Montajda: "in_progress", Eksikli: "incomplete", "Teslim edildi": "completed" },
  finance: { Planlandı: "planned", "Onay bekliyor": "pending", Onaylandı: "approved", "Tahsil edildi": "collected", Ödendi: "paid", Gecikti: "overdue" },
  accounting: { Taslak: "draft", Açık: "open", Kısmi: "partial", Ödendi: "paid", "Tahsil edildi": "collected", Gecikti: "overdue" },
  hr: { Aktif: "active", İzinli: "on_leave", Pasif: "inactive", "İşten ayrıldı": "terminated" },
});

const reverseStatuses = Object.fromEntries(Object.entries(STATUS_VALUES).map(([resource, values]) => [resource, Object.fromEntries(Object.entries(values).map(([label, value]) => [value, label]))]));

function snakeToCamel(value) {
  return value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function mapIncoming(resource, value) {
  if (Array.isArray(value)) return value.map((item) => mapIncoming(resource, item));
  if (!value || typeof value !== "object") return value;
  const reverseFields = Object.fromEntries(Object.entries(FIELD_MAPS[resource] || {}).map(([ui, apiName]) => [apiName, ui]));
  const result = {};
  for (const [key, raw] of Object.entries(value)) {
    const uiKey = reverseFields[key] || snakeToCamel(key.replace(/_minor$/, ""));
    let mapped = raw;
    if (key.endsWith("_minor") && typeof raw === "number") mapped = raw / 100;
    if (key === "status") mapped = reverseStatuses[resource]?.[raw] || raw;
    if (key === "team_json" && Array.isArray(raw)) mapped = raw.join(", ");
    result[uiKey] = mapIncoming(resource, mapped);
  }
  return result;
}

function mapOutgoing(resource, value) {
  const fieldMap = FIELD_MAPS[resource] || {};
  const result = {};
  for (const [uiKey, raw] of Object.entries(value || {})) {
    if (raw === "" || raw == null) continue;
    const apiKey = fieldMap[uiKey] || uiKey.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    let mapped = raw;
    if (apiKey.endsWith("_minor")) mapped = Math.round(Number(raw) * 100);
    else if (["progress_percent", "revision"].includes(apiKey)) mapped = Number(raw);
    else if (["quantity"].includes(apiKey)) mapped = Number(raw);
    if (apiKey === "status") mapped = STATUS_VALUES[resource]?.[raw] || raw;
    if (apiKey === "production_type") mapped = raw === "Dış imalat" ? "external" : raw === "İç üretim" ? "internal" : raw;
    if (apiKey === "type" && resource === "finance") mapped = raw === "Gelir" ? "income" : raw === "Gider" ? "expense" : raw === "Hakediş" ? "progress_payment" : raw === "Avans" ? "advance" : raw === "Maliyet tahmini" ? "cost_forecast" : raw;
    if (apiKey === "direction" && resource === "accounting") mapped = raw === "Satış" ? "sales" : raw === "Alış" ? "purchase" : raw;
    if (apiKey === "team_json") mapped = Array.isArray(raw) ? raw : String(raw).split(",").map((item) => item.trim()).filter(Boolean);
    if (apiKey === "dependency_ids_json") mapped = Array.isArray(raw) ? raw : String(raw).split(",").map((item) => item.trim()).filter(Boolean);
    if (["attendees_json", "checklist_json", "payment_schedule_json"].includes(apiKey) && !Array.isArray(raw)) {
      try { mapped = JSON.parse(String(raw)); }
      catch { mapped = String(raw).split(",").map((item) => item.trim()).filter(Boolean); }
    }
    if (apiKey === "metadata_json" && typeof raw !== "object") mapped = { note: raw };
    result[apiKey] = mapped;
  }
  return result;
}

export class ApiError extends Error {
  constructor(message, { status = 0, code = "API_ERROR", details = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function storageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // Storage can be disabled. The current HTTP-only-cookie session still works.
  }
}

function resolvePath(path) {
  if (/^https?:\/\//.test(path)) return path;
  if (path.startsWith("/api/")) return path;
  return `${API_CONFIG.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function unwrap(payload) {
  if (payload && typeof payload === "object" && "data" in payload) return payload.data;
  return payload;
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), options.timeoutMs || API_CONFIG.timeoutMs);
  const tenantId = options.tenantId || storageGet(TENANT_KEY);
  const demoUserEmail = DEMO_AUTH_ENABLED ? storageGet(DEMO_USER_KEY) || import.meta.env.VITE_DEMO_USER_EMAIL : null;
  const headers = new Headers(options.headers || {});

  headers.set("Accept", "application/json");
  if (options.body != null && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (tenantId) headers.set("X-Tenant-Id", tenantId);
  if (demoUserEmail) headers.set("X-User-Email", demoUserEmail);

  try {
    const response = await fetch(resolvePath(path), {
      ...options,
      headers,
      credentials: "include",
      body:
        options.body == null || options.body instanceof FormData || typeof options.body === "string"
          ? options.body
          : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : await response.text();

    if (!response.ok) {
      const problem = payload?.error && typeof payload.error === "object" ? payload.error : payload;
      const message = problem?.message || (typeof payload?.error === "string" ? payload.error : null) || `İstek tamamlanamadı (${response.status}).`;
      throw new ApiError(message, {
        status: response.status,
        code: problem?.code || `HTTP_${response.status}`,
        details: problem?.details || payload?.errors || null,
      });
    }

    return {
      data: unwrap(payload),
      meta: payload?.meta || null,
      response,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.name === "AbortError") {
      throw new ApiError("Sunucu zamanında yanıt vermedi.", { code: "TIMEOUT" });
    }
    throw new ApiError(
      navigator.onLine ? "Sunucuya ulaşılamadı. Bağlantıyı kontrol edip tekrar deneyin." : "İnternet bağlantısı yok.",
      { code: navigator.onLine ? "NETWORK_ERROR" : "OFFLINE" },
    );
  } finally {
    window.clearTimeout(timer);
  }
}

function withQuery(path, query = {}) {
  const search = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== "" && value != null) search.set(key, String(value));
  });
  const suffix = search.toString();
  return suffix ? `${path}?${suffix}` : path;
}

function idempotencyKey(resource, action) {
  const nonce = typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `capproje:${resource}:${action}:${nonce}`;
}

export const api = {
  config: API_CONFIG,
  setToken(token) {
    // Deliberately memory-only. Production auth should use an HttpOnly cookie
    // or an ephemeral platform token; persistent browser storage exposes tokens
    // to any script running on the origin.
    accessToken = token || null;
  },
  setTenant(tenantId) {
    storageSet(TENANT_KEY, tenantId);
  },
  setDemoUser(email) {
    if (DEMO_AUTH_ENABLED) storageSet(DEMO_USER_KEY, email);
  },
  getTenant() {
    return storageGet(TENANT_KEY);
  },
  async login(credentials) {
    if (!DEMO_AUTH_ENABLED) {
      throw new ApiError("Kurumsal oturum açma sayfasını kullanın.", { status: 401, code: "AUTH_PROVIDER_REQUIRED" });
    }
    this.setDemoUser(credentials.email);
    if (credentials.tenantId) this.setTenant(credentials.tenantId);
    return this.session();
  },
  async logout() {
    accessToken = null;
    if (DEMO_AUTH_ENABLED) storageSet(DEMO_USER_KEY, null);
  },
  async session() {
    return (await request(API_CONFIG.endpoints.session)).data;
  },
  async dashboard() {
    return mapIncoming("dashboard", (await request(API_CONFIG.endpoints.dashboard)).data);
  },
  async list(resource, query) {
    const endpoint = API_CONFIG.endpoints[resource];
    if (!endpoint) throw new ApiError(`Bilinmeyen kaynak: ${resource}`, { code: "UNKNOWN_RESOURCE" });
    const normalizedQuery = { ...query };
    if ("search" in normalizedQuery) {
      normalizedQuery.q = normalizedQuery.search;
      delete normalizedQuery.search;
    }
    const result = await request(withQuery(endpoint, normalizedQuery));
    return { ...result, data: mapIncoming(resource, result.data) };
  },
  async get(resource, id) {
    const endpoint = API_CONFIG.endpoints[resource];
    if (!endpoint) throw new ApiError(`Bilinmeyen kaynak: ${resource}`, { code: "UNKNOWN_RESOURCE" });
    return mapIncoming(resource, (await request(`${endpoint}/${encodeURIComponent(id)}`)).data);
  },
  async create(resource, values) {
    const endpoint = API_CONFIG.endpoints[resource];
    if (!endpoint) throw new ApiError(`Bilinmeyen kaynak: ${resource}`, { code: "UNKNOWN_RESOURCE" });
    const createEndpoint = resource === "memberships" ? "/memberships/invite" : endpoint;
    return mapIncoming(resource, (await request(createEndpoint, { method: "POST", body: mapOutgoing(resource, values) })).data);
  },
  async update(resource, id, values) {
    const endpoint = API_CONFIG.endpoints[resource];
    if (!endpoint) throw new ApiError(`Bilinmeyen kaynak: ${resource}`, { code: "UNKNOWN_RESOURCE" });
    return mapIncoming(resource, (await request(`${endpoint}/${encodeURIComponent(id)}`, { method: "PATCH", body: mapOutgoing(resource, values) })).data);
  },
  async remove(resource, id) {
    const endpoint = API_CONFIG.endpoints[resource];
    if (!endpoint) throw new ApiError(`Bilinmeyen kaynak: ${resource}`, { code: "UNKNOWN_RESOURCE" });
    return (await request(`${endpoint}/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey(resource, "delete") },
    })).data;
  },
  async uploadFile({ file, ...fields }) {
    const body = new FormData();
    body.set("file", file);
    const mapped = mapOutgoing("files", fields);
    Object.entries(mapped).forEach(([key, value]) => body.set(key, typeof value === "string" ? value : JSON.stringify(value)));
    return mapIncoming("files", (await request("/files/upload", { method: "POST", body })).data);
  },
  async getRolePermissions(roleId) {
    return (await request(`/roles/${encodeURIComponent(roleId)}/permissions`)).data;
  },
  async updateRolePermissions(roleId, permissions) {
    return (await request(`/roles/${encodeURIComponent(roleId)}/permissions`, { method: "PUT", body: { permissions } })).data;
  },
  async listBackups() {
    return mapIncoming("backups", (await request("/api/admin/backups")).data);
  },
  async createBackup() {
    return mapIncoming("backups", (await request("/api/admin/backups", { method: "POST" })).data);
  },
  async listTokens() {
    return mapIncoming("tokens", (await request("/tokens")).data);
  },
  async createToken(values) {
    return mapIncoming("tokens", (await request("/tokens", { method: "POST", body: { name: values.name, expires_in_days: Number(values.expiresInDays || 90) } })).data);
  },
  async tokenAction(tokenId, action, values = {}) {
    return mapIncoming("tokens", (await request(`/tokens/${encodeURIComponent(tokenId)}/${action}`, { method: "POST", body: values })).data);
  },
  async workflow(resource, resourceId, action, body = {}) {
    const endpoint = API_CONFIG.endpoints[resource];
    if (!endpoint) throw new ApiError(`Bilinmeyen iş akışı kaynağı: ${resource}`, { code: "UNKNOWN_RESOURCE" });
    const result = await request(`${endpoint}/${encodeURIComponent(resourceId)}/${action}`, {
      method: "POST",
      body,
      headers: { "Idempotency-Key": idempotencyKey(resource, action) },
    });
    return { data: mapIncoming(resource, result.data), meta: result.meta };
  },
};

export function permissionAllows(session, action, resource) {
  const role = String(session?.role?.code || session?.user?.role?.code || session?.user?.role || session?.role || "").toLowerCase();
  if (["owner", "admin", "super_admin"].includes(role)) return true;
  const permissions = session?.permissions || session?.user?.permissions || [];
  const normalized = permissions.map((permission) =>
    typeof permission === "string"
      ? permission.toLowerCase()
      : `${permission.resource || ""}:${permission.action || ""}`.toLowerCase(),
  );
  const slug = RESOURCE_SLUGS[resource] || resource;
  let backendAction = action === "create" || action === "update" ? "write" : action === "view_cost" || action === "view_salary" ? "view" : action;
  let permissionSlug = slug;
  if (action !== "read" && resource === "files") backendAction = "manage";
  if (action !== "read" && resource === "memberships") { permissionSlug = "users"; backendAction = "manage"; }
  if (action !== "read" && resource === "roles") backendAction = "manage";
  return normalized.some((permission) =>
    permission === "*" ||
    permission === `${resource}.${action}` ||
    permission === `${slug}.${backendAction}` ||
    permission === `${permissionSlug}.*` ||
    permission === `${permissionSlug}.${backendAction}` ||
    permission === `${permissionSlug}:*` ||
    permission === `${permissionSlug}:${backendAction}` ||
    permission === `${backendAction}:${permissionSlug}`,
  );
}

export const demoAuthEnabled = DEMO_AUTH_ENABLED;
