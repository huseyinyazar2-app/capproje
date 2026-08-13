/**
 * Capproje API contract lives in this file so the UI is independent from the
 * transport and endpoint naming. Override the base URL with VITE_API_URL.
 */
export const API_CONFIG = Object.freeze({
  baseUrl: String(import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, ""),
  timeoutMs: 15000,
  endpoints: Object.freeze({
    session: "/session",
    passwordLogin: "/auth/password/login",
    phoneAuthStart: "/auth/phone/start",
    phoneAuthVerify: "/auth/phone/verify",
    logout: "/auth/logout",
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
    projectCommunications: "/project-communications",
    resourceAssignments: "/resource-assignments",
    materialRequirements: "/material-requirements",
    supplierQuotations: "/supplier-quotations",
    workCenters: "/work-centers",
    bomLines: "/bom-lines",
    productionOperations: "/production-operations",
    productionIssues: "/production-issues",
    notifications: "/notifications",
    search: "/search",
  }),
});

const TENANT_KEY = "capproje.tenant.id";
const DEMO_USER_KEY = "capproje.demo.user-email";
const DEMO_AUTH_ENABLED = import.meta.env.DEV || String(import.meta.env.VITE_ENABLE_DEMO_AUTH) === "true";
let accessToken = null;
const OFFLINE_DB_NAME = "capproje-offline-v1";
const OFFLINE_STORE = "mutations";
const OFFLINE_MAX_ITEMS = 100;
const OFFLINE_MAX_BYTES = 128 * 1024;
const OFFLINE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OFFLINE_CREATE_RESOURCES = new Set([
  "siteSurveys", "surveyMeasurements", "workItems", "projectTasks", "purchases", "production", "installations",
  "attendance", "projectMeetings", "meetingActions", "qualityInspections", "handoverPunchItems",
  "projectCommunications", "resourceAssignments", "materialRequirements",
]);
const offlineQueueListeners = new Set();
let offlineContext = null;
let offlineSyncPromise = null;

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
  projectCommunications: "project-communications",
  resourceAssignments: "resource-assignments",
  materialRequirements: "material-requirements",
  supplierQuotations: "supplier-quotations",
  workCenters: "work-centers",
  bomLines: "bom-lines",
  productionOperations: "production-operations",
  productionIssues: "production-issues",
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
  files: { entityType: "entity_type", entityId: "entity_id", fileName: "file_name", objectKey: "object_key", contentType: "content_type", sizeBytes: "size_bytes", uploadedBy: "uploaded_by", projectId: "project_id", workItemId: "work_item_id", designRevisionId: "design_revision_id", qualityInspectionId: "quality_inspection_id", installationId: "installation_id", spaceName: "space_name", captureStage: "capture_stage", takenAt: "taken_at", photoConsentSnapshot: "photo_consent_snapshot" },
  memberships: { userId: "user_id", roleId: "role_id", roleIds: "role_ids", roleNames: "role_names", fullName: "full_name", temporaryPassword: "temporary_password" },
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
  projectCommunications: { projectId: "project_id", customerId: "customer_id", contactName: "contact_name", occurredAt: "occurred_at", nextFollowUpAt: "next_follow_up_at", ownerUserId: "owner_user_id" },
  resourceAssignments: { projectId: "project_id", employeeId: "employee_id", resourceType: "resource_type", resourceName: "resource_name", plannedStart: "planned_start", plannedEnd: "planned_end", allocationPercent: "allocation_percent" },
  supplierQuotations: { purchaseRequestId: "purchase_request_id", supplierId: "supplier_id", quotationNumber: "quotation_number", quotationDate: "quotation_date", validUntil: "valid_until", unitPrice: "unit_price_minor", total: "total_minor", leadTimeDays: "lead_time_days", paymentTerms: "payment_terms", qualityNote: "quality_note", rejectionReason: "rejection_reason", supplierName: "supplier_name" },
  workCenters: { dailyCapacityMinutes: "daily_capacity_minutes", hourlyCost: "hourly_cost_minor", isOutsourced: "is_outsourced" },
  bomLines: { workItemId: "work_item_id", inventoryItemId: "inventory_item_id", itemCode: "item_code", quantityPerUnit: "quantity_per_unit", scrapRate: "scrap_rate", unitCost: "unit_cost_minor", supplierId: "supplier_id", sortOrder: "sort_order" },
  productionOperations: { productionOrderId: "production_order_id", workCenterId: "work_center_id", plannedMinutes: "planned_minutes", actualMinutes: "actual_minutes", plannedStart: "planned_start", plannedEnd: "planned_end", assigneeUserId: "assignee_user_id", startedAt: "started_at", completedAt: "completed_at" },
  productionIssues: { productionOrderId: "production_order_id", productionOperationId: "production_operation_id", projectId: "project_id", workItemId: "work_item_id", issueNumber: "issue_number", issueType: "issue_type", responsibleUserId: "responsible_user_id", reworkQuantity: "rework_quantity", scrapQuantity: "scrap_quantity", costImpact: "cost_impact_minor", delayDays: "delay_days", rootCause: "root_cause", resolvedAt: "resolved_at", reportedAt: "reported_at" },
  materialRequirements: { projectId: "project_id", workItemId: "work_item_id", inventoryItemId: "inventory_item_id", preferredSupplierId: "preferred_supplier_id", purchaseRequestId: "purchase_request_id", itemCode: "item_code", requiredQuantity: "required_quantity", reservedQuantity: "reserved_quantity", orderedQuantity: "ordered_quantity", receivedQuantity: "received_quantity", neededBy: "needed_by" },
});

// Etiket → sunucu durum kodu. Kodlar worker/index.js içindeki statusEnums ve
// 0012 migration'ındaki tetikleyicilerle birebir aynı kümedir.
const STATUS_VALUES = Object.freeze({
  projects: { Potansiyel: "lead", Keşif: "discovery", Maliyetlendirme: "estimating", Teklif: "offered", Sözleşme: "contracted", Tasarım: "design", "Satın Alma": "procurement", Üretim: "production", Montaj: "installation", Kabul: "acceptance", Beklemede: "on_hold", Tamamlandı: "completed", Kaybedildi: "lost", İptal: "cancelled" },
  offers: { Taslak: "draft", "Maliyet çalışılıyor": "costing", Sunuldu: "sent", "Onay bekliyor": "pending", "Revizyon istendi": "revision_requested", "Kabul edildi": "accepted", Kaybedildi: "rejected", "Süresi doldu": "expired", İptal: "cancelled" },
  purchases: { Taslak: "draft", "Onay bekliyor": "pending", Onaylandı: "approved", Reddedildi: "rejected", "Sipariş verildi": "ordered", "Kısmi teslim": "partial", "Teslim edildi": "received", İptal: "cancelled" },
  purchaseOrders: { Taslak: "draft", "Sipariş verildi": "ordered", "Kısmi teslim": "partial", "Teslim alındı": "received", İptal: "cancelled" },
  production: { Taslak: "draft", Planlandı: "planned", "Üretime salındı": "released", "Malzeme bekliyor": "waiting_material", Üretimde: "in_progress", "Kalite kontrolde": "quality_control", Durduruldu: "paused", Tamamlandı: "completed", İptal: "cancelled" },
  installations: { "Keşif gerekli": "survey_needed", "Saha bekleniyor": "site_waiting", Planlandı: "planned", Yolda: "in_transit", Montajda: "in_progress", Eksikli: "incomplete", "Teslim edildi": "completed", İptal: "cancelled" },
  finance: { Taslak: "draft", Planlandı: "planned", "Onay bekliyor": "pending", Onaylandı: "approved", "Tahsil edildi": "collected", Ödendi: "paid", Gecikti: "overdue", "Ters kaydedildi": "reversed", İptal: "cancelled" },
  accounting: { Taslak: "draft", Açık: "open", Kısmi: "partial", Ödendi: "paid", "Tahsil edildi": "collected", Gecikti: "overdue", İptal: "cancelled" },
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

function mapOutgoing(resource, value, { keepNull = false } = {}) {
  const fieldMap = FIELD_MAPS[resource] || {};
  const result = {};
  for (const [uiKey, raw] of Object.entries(value || {})) {
    if (raw === undefined) continue;
    // Düzenlemede boş bırakılan alan gerçekten temizlenmelidir; önceden boş
    // değerler atlandığı için bir kez girilen veri asla silinemiyordu.
    if (raw === "" || raw === null) {
      if (!keepNull) continue;
      const clearKey = fieldMap[uiKey] || uiKey.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      result[clearKey] = null;
      continue;
    }
    const apiKey = fieldMap[uiKey] || uiKey.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    let mapped = raw;
    if (apiKey.endsWith("_minor")) mapped = Math.round(Number(raw) * 100);
    else if (["progress_percent", "revision"].includes(apiKey)) mapped = Number(raw);
    else if (["quantity", "required_quantity", "allocation_percent"].includes(apiKey)) mapped = Number(raw);
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

    // Statik barındırma tüm yolları index.html'e yönlendirdiğinde API çağrıları
    // 200 + HTML döner. Bunu başarı saymak uygulamayı sessizce bozuyordu.
    if (response.ok && !contentType.includes("application/json") && !contentType.includes("text/csv") && !options.allowNonJson) {
      throw new ApiError("Sunucu API yanıtı yerine sayfa içeriği döndürdü. Uygulamanın API adresi yapılandırmasını kontrol edin.", {
        status: response.status,
        code: "API_NOT_REACHABLE",
      });
    }

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

function offlineRecordId(prefix = "offline") {
  const nonce = typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${nonce}`;
}

function offlineScope(context = offlineContext) {
  return context?.tenantId && context?.userId ? `${context.tenantId}:${context.userId}` : null;
}

function openOfflineDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new ApiError("Bu cihaz çevrimdışı işlem kuyruğunu desteklemiyor.", { code: "OFFLINE_STORAGE_UNAVAILABLE" }));
      return;
    }
    const request = indexedDB.open(OFFLINE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OFFLINE_STORE)) {
        const store = db.createObjectStore(OFFLINE_STORE, { keyPath: "id" });
        store.createIndex("scope", "scope", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new ApiError("Çevrimdışı işlem kuyruğu açılamadı.", { code: "OFFLINE_STORAGE_ERROR" }));
  });
}

async function offlineStoreRequest(mode, operation) {
  const db = await openOfflineDb();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(OFFLINE_STORE, mode);
      const request = operation(transaction.objectStore(OFFLINE_STORE));
      let result;
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(new ApiError("Çevrimdışı işlem kuyruğu güncellenemedi.", { code: "OFFLINE_STORAGE_ERROR" }));
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(new ApiError("Çevrimdışı işlem kuyruğu güncellenemedi.", { code: "OFFLINE_STORAGE_ERROR" }));
      transaction.onabort = () => reject(new ApiError("Çevrimdışı işlem kuyruğu güncellenemedi.", { code: "OFFLINE_STORAGE_ERROR" }));
    });
  } finally {
    db.close();
  }
}

const readScopedOfflineMutations = (scope) => offlineStoreRequest("readonly", (store) => store.index("scope").getAll(scope));
const putOfflineMutation = (item) => offlineStoreRequest("readwrite", (store) => store.put(item));
const deleteOfflineMutation = (id) => offlineStoreRequest("readwrite", (store) => store.delete(id));

async function scopedOfflineMutations() {
  const scope = offlineScope();
  if (!scope) return [];
  const nowMs = Date.now();
  const all = await readScopedOfflineMutations(scope);
  const expired = all.filter((item) => item.expiresAt <= nowMs);
  await Promise.all(expired.map((item) => deleteOfflineMutation(item.id)));
  return all.filter((item) => item.expiresAt > nowMs).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

async function offlineQueueSnapshot() {
  if (!offlineScope()) return { items: [], pending: 0, failed: 0, syncing: false };
  const items = await scopedOfflineMutations();
  return {
    items,
    pending: items.filter((item) => item.status === "pending" || item.status === "syncing").length,
    failed: items.filter((item) => item.status === "failed").length,
    syncing: items.some((item) => item.status === "syncing"),
  };
}

async function notifyOfflineQueue() {
  try {
    const snapshot = await offlineQueueSnapshot();
    offlineQueueListeners.forEach((listener) => listener(snapshot));
    return snapshot;
  } catch (error) {
    const snapshot = { items: [], pending: 0, failed: 0, syncing: false, error };
    offlineQueueListeners.forEach((listener) => listener(snapshot));
    return snapshot;
  }
}

async function queueOfflineCreate(resource, values, path, body, key) {
  const scope = offlineScope();
  if (!scope) throw new ApiError("Çevrimdışı kayıt için aktif kullanıcı ve firma bilgisi bulunamadı.", { code: "OFFLINE_CONTEXT_REQUIRED" });
  const items = await scopedOfflineMutations();
  if (items.length >= OFFLINE_MAX_ITEMS) throw new ApiError("Çevrimdışı kuyruk dolu. Bağlantı kurup bekleyen kayıtları eşitleyin.", { code: "OFFLINE_QUEUE_FULL" });
  const serialized = JSON.stringify(body);
  const bytes = typeof TextEncoder === "function" ? new TextEncoder().encode(serialized).byteLength : serialized.length;
  if (bytes > OFFLINE_MAX_BYTES) throw new ApiError("Bu kayıt çevrimdışı kuyruk için çok büyük.", { code: "OFFLINE_PAYLOAD_TOO_LARGE" });
  const nowIso = new Date().toISOString();
  const item = {
    id: offlineRecordId(), localId: offlineRecordId("local"), scope, tenantId: offlineContext.tenantId, userId: offlineContext.userId,
    resource, action: "create", method: "POST", path, body, idempotencyKey: key, status: "pending", attempts: 0,
    createdAt: nowIso, expiresAt: Date.now() + OFFLINE_TTL_MS, errorCode: null, errorMessage: null,
  };
  await putOfflineMutation(item);
  await notifyOfflineQueue();
  return { id: item.localId, ...values, _offlineQueued: true, _offlineQueueId: item.id, createdAt: nowIso };
}

async function syncOfflineMutations() {
  if (offlineSyncPromise) return offlineSyncPromise;
  if (typeof navigator !== "undefined" && !navigator.onLine) return { synced: 0, remaining: (await offlineQueueSnapshot()).items.length };
  const scopeAtStart = offlineScope();
  if (!scopeAtStart) return { synced: 0, remaining: 0 };
  offlineSyncPromise = (async () => {
    let synced = 0;
    const items = await scopedOfflineMutations();
    for (const item of items) {
      if (offlineScope() !== scopeAtStart) break;
      await putOfflineMutation({ ...item, status: "syncing", attempts: item.attempts + 1, errorCode: null, errorMessage: null });
      await notifyOfflineQueue();
      try {
        await request(item.path, { method: item.method, body: item.body, tenantId: item.tenantId, headers: { "Idempotency-Key": item.idempotencyKey } });
        await deleteOfflineMutation(item.id);
        synced += 1;
      } catch (error) {
        const retryable = ["OFFLINE", "NETWORK_ERROR", "TIMEOUT", "idempotency_in_progress"].includes(error.code) || error.status === 401 || error.status >= 500;
        await putOfflineMutation({ ...item, status: retryable ? "pending" : "failed", attempts: item.attempts + 1, errorCode: error.code, errorMessage: error.message });
        if (retryable) break;
      }
    }
    const snapshot = await notifyOfflineQueue();
    return { synced, remaining: snapshot.items.length, failed: snapshot.failed };
  })();
  try {
    return await offlineSyncPromise;
  } finally {
    offlineSyncPromise = null;
    await notifyOfflineQueue();
  }
}

export const api = {
  config: API_CONFIG,
  canQueueOffline(resource, action = "create") {
    return action === "create" && OFFLINE_CREATE_RESOURCES.has(resource);
  },
  setOfflineContext(context) {
    offlineContext = context?.tenantId && context?.userId ? { tenantId: String(context.tenantId), userId: String(context.userId) } : null;
    return notifyOfflineQueue();
  },
  subscribeOfflineQueue(listener) {
    offlineQueueListeners.add(listener);
    notifyOfflineQueue();
    return () => offlineQueueListeners.delete(listener);
  },
  offlineQueue() {
    return offlineQueueSnapshot();
  },
  syncOfflineQueue() {
    return syncOfflineMutations();
  },
  async retryOfflineQueue(id = null) {
    const items = await scopedOfflineMutations();
    const retryItems = items.filter((item) => (!id || item.id === id) && item.status === "failed");
    await Promise.all(retryItems.map((item) => putOfflineMutation({ ...item, status: "pending", errorCode: null, errorMessage: null })));
    await notifyOfflineQueue();
    return syncOfflineMutations();
  },
  async discardOfflineMutation(id) {
    const item = (await scopedOfflineMutations()).find((candidate) => candidate.id === id);
    if (!item) return offlineQueueSnapshot();
    await deleteOfflineMutation(item.id);
    return notifyOfflineQueue();
  },
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
  async startPhoneAuth(phone) {
    return (await request(API_CONFIG.endpoints.phoneAuthStart, { method: "POST", body: { phone } })).data;
  },
  async loginWithPassword({ phone, password }) {
    return unwrap(await request(API_CONFIG.endpoints.passwordLogin, { method: "POST", body: { phone, password } }));
  },
  async verifyPhoneAuth({ phone, code, challengeId }) {
    return (await request(API_CONFIG.endpoints.phoneAuthVerify, { method: "POST", body: { phone, code, challenge_id: challengeId } })).data;
  },
  async logout() {
    if (!DEMO_AUTH_ENABLED) {
      await request(API_CONFIG.endpoints.logout, { method: "POST" });
      storageSet(TENANT_KEY, null);
    }
    accessToken = null;
    await this.setOfflineContext(null);
    if (DEMO_AUTH_ENABLED) storageSet(DEMO_USER_KEY, null);
  },
  async session() {
    return (await request(API_CONFIG.endpoints.session)).data;
  },
  async dashboard() {
    return mapIncoming("dashboard", (await request(API_CONFIG.endpoints.dashboard)).data);
  },
  async projectCostBreakdown(projectId) {
    const { data } = await request(`/projects/${encodeURIComponent(projectId)}/cost-breakdown`);
    return data;
  },
  async quotationComparison(purchaseRequestId) {
    const { data } = await request(`/purchase-requests/${encodeURIComponent(purchaseRequestId)}/quotation-comparison`);
    return data;
  },
  async workCenterLoad(query = {}) {
    const result = await request(withQuery("/work-centers/load", query));
    return { data: result.data || [], meta: result.meta || null };
  },
  async passwordResetRequests() {
    return (await request("/password-reset-requests")).data || [];
  },
  async requestPasswordReset({ phone, note }) {
    return (await request("/auth/password/reset-request", { method: "POST", body: { phone, note } })).data;
  },
  async resetMemberPassword(membershipId, temporaryPassword) {
    return (await request(`/memberships/${encodeURIComponent(membershipId)}/reset-password`, { method: "POST", body: { temporary_password: temporaryPassword } })).data;
  },
  async projectCommandCenter(projectId) {
    const data = (await request(`/projects/${encodeURIComponent(projectId)}/command-center`)).data;
    return { ...mapIncoming("dashboard", data), project: mapIncoming("projects", data.project) };
  },
  async globalSearch(query) {
    return mapIncoming("dashboard", (await request(withQuery(API_CONFIG.endpoints.search, { q: query }))).data);
  },
  async notifications() {
    const result = await request(API_CONFIG.endpoints.notifications);
    return { ...result, data: mapIncoming("dashboard", result.data) };
  },
  async markNotification(notificationId, status = "read") {
    return (await request(`/notifications/${encodeURIComponent(notificationId)}/read`, { method: "POST", body: { status } })).data;
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
  newIdempotencyKey(resource, action = "create") {
    return idempotencyKey(resource, action);
  },
  async create(resource, values, options = {}) {
    const endpoint = API_CONFIG.endpoints[resource];
    if (!endpoint) throw new ApiError(`Bilinmeyen kaynak: ${resource}`, { code: "UNKNOWN_RESOURCE" });
    const createEndpoint = resource === "memberships" ? "/memberships/invite" : endpoint;
    const body = mapOutgoing(resource, values);
    // Anahtar form açılışında üretilip tekrar gönderimlerde korunur; böylece
    // çift tıklama veya yeniden deneme ikinci bir kayıt oluşturmaz.
    const key = options.idempotencyKey || idempotencyKey(resource, "create");
    if (typeof navigator !== "undefined" && !navigator.onLine && this.canQueueOffline(resource)) {
      return queueOfflineCreate(resource, values, createEndpoint, body, key);
    }
    try {
      return mapIncoming(resource, (await request(createEndpoint, { method: "POST", body, headers: { "Idempotency-Key": key } })).data);
    } catch (error) {
      if (this.canQueueOffline(resource) && ["OFFLINE", "NETWORK_ERROR", "TIMEOUT"].includes(error.code)) {
        return queueOfflineCreate(resource, values, createEndpoint, body, key);
      }
      throw error;
    }
  },
  async update(resource, id, values, options = {}) {
    const endpoint = API_CONFIG.endpoints[resource];
    if (!endpoint) throw new ApiError(`Bilinmeyen kaynak: ${resource}`, { code: "UNKNOWN_RESOURCE" });
    return mapIncoming(resource, (await request(`${endpoint}/${encodeURIComponent(id)}`, { method: "PATCH", body: mapOutgoing(resource, values, { keepNull: options.keepNull !== false }) })).data);
  },
  async permissionCatalog() {
    const result = await request("/permissions");
    return { data: result.data || [], meta: result.meta || null };
  },
  async changePassword({ currentPassword, newPassword }) {
    return (await request("/auth/password/change", { method: "POST", body: { current_password: currentPassword, new_password: newPassword } })).data;
  },
  async listSessions() {
    return (await request("/sessions")).data;
  },
  async revokeSession(sessionId = "others") {
    await request(`/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
  },
  exportUrl(resource, query = {}) {
    const endpoint = API_CONFIG.endpoints[resource];
    if (!endpoint) throw new ApiError(`Bilinmeyen kaynak: ${resource}`, { code: "UNKNOWN_RESOURCE" });
    return resolvePath(withQuery(`${endpoint}/export`, query));
  },
  async exportCsv(resource, query = {}) {
    const endpoint = API_CONFIG.endpoints[resource];
    if (!endpoint) throw new ApiError(`Bilinmeyen kaynak: ${resource}`, { code: "UNKNOWN_RESOURCE" });
    const response = await request(withQuery(`${endpoint}/export`, query));
    return typeof response.data === "string" ? response.data : String(response.data ?? "");
  },
  async referenceOptions(resource, { search = "", pageSize = 20 } = {}) {
    const { data } = await this.list(resource, search ? { q: search, pageSize } : { pageSize });
    return Array.isArray(data) ? data : [];
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
  fileContentUrl(fileId) {
    return resolvePath(`/files/${encodeURIComponent(fileId)}/content`);
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
