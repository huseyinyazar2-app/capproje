import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const liveSource = await readFile(new URL("../src/LiveWorkspace.jsx", import.meta.url), "utf8");
const apiSource = await readFile(new URL("../src/api.js", import.meta.url), "utf8");

const moduleEndpoints = {
  dashboard: "/dashboard",
  projects: "/projects",
  offers: "/offers",
  purchases: "/purchase-requests",
  production: "/production-orders",
  installations: "/installations",
  finance: "/financial-transactions",
  accounting: "/invoices",
  hr: "/employees",
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("all primary workspace modules map to an API v1 endpoint", () => {
  assert.match(apiSource, /baseUrl:\s*String\([^\n]*["']\/api\/v1["']/);

  for (const [resource, endpoint] of Object.entries(moduleEndpoints)) {
    if (resource !== "dashboard") {
      assert.match(
        liveSource,
        new RegExp(`id:\\s*["']${escapeRegExp(resource)}["'][^}]*resource:\\s*["']${escapeRegExp(resource)}["']`),
        `${resource} must be declared as a navigable resource`,
      );
    }
    assert.match(
      apiSource,
      new RegExp(`${escapeRegExp(resource)}:\\s*["']${escapeRegExp(endpoint)}["']`),
      `${resource} must target ${endpoint}`,
    );
  }
});

test("the workspace has explicit loading, empty, retryable error and permission-denied states", () => {
  assert.match(liveSource, /function LoadingState\s*\(/);
  assert.match(liveSource, /function EmptyState\s*\(/);
  assert.match(liveSource, /function ErrorState\s*\(\{\s*error,\s*retry\s*\}\)/);
  assert.match(liveSource, /onClick=\{retry\}/);
  assert.match(liveSource, /PermissionDeniedState|Yetkiniz yok|erişim yetkiniz yok/i);
  assert.match(liveSource, /(?:status|code)[^\n]*(?:403|forbidden)|(?:403|forbidden)[^\n]*(?:status|code)/i);
});

test("offline state blocks risky mutations while allowing only the safe create queue", () => {
  assert.match(liveSource, /navigator\.onLine/);
  assert.match(liveSource, /addEventListener\(["']offline["']/);
  assert.match(liveSource, /Çevrimdışısınız/);
  assert.match(liveSource, /function ResourceView\(\{[^}]*online[^}]*\}\)/);
  assert.match(liveSource, /offlineCreateAllowed\s*=\s*api\.canQueueOffline\(module\.resource\)/);
  assert.match(liveSource, /canCreate\s*=\s*!module\.readOnly\s*&&\s*\(online\s*\|\|\s*offlineCreateAllowed\)/);
  assert.match(liveSource, /canEdit\s*=\s*online\s*&&[^;]*permissionAllows/);
  assert.match(liveSource, /<ResourceView[^>]*online=\{online\}/);
  assert.match(liveSource, /!online\s*&&\s*\(modal\?\.id\s*\|\|\s*module\.id\s*===\s*"files"\s*\|\|\s*!offlineCreateAllowed\)/);
});

test("create and edit forms are connected to API mutations and backend-compatible permissions", () => {
  assert.match(liveSource, /permissionAllows\(session,\s*["']create["'],\s*module\.resource\)/);
  assert.match(liveSource, /permissionAllows\(session,\s*["']update["'],\s*module\.resource\)/);
  // Oluşturma çağrısı, form açılışında üretilen sabit idempotency anahtarını taşır.
  assert.match(liveSource, /await api\.create\(module\.resource,\s*payload,\s*\{\s*idempotencyKey: modal\?\._idempotencyKey\s*\}\)/);
  assert.match(liveSource, /_idempotencyKey: api\.newIdempotencyKey\(module\.resource\)/);
  assert.match(liveSource, /await api\.update\(module\.resource,\s*modal\.id,\s*payload\)/);
  assert.match(liveSource, /<form onSubmit=\{submit\}>/);
  assert.match(liveSource, /onEdit=\{setModal\}/);

  assert.match(apiSource, /const slug\s*=\s*RESOURCE_SLUGS\[resource\]\s*\|\|\s*resource/);
  assert.match(apiSource, /permission\s*===\s*`\$\{slug\}\.\$\{backendAction\}`/);
  assert.match(apiSource, /backendAction\s*=\s*action\s*===\s*["']create["']\s*\|\|\s*action\s*===\s*["']update["']\s*\?\s*["']write["']/);
  assert.match(apiSource, /session\?\.role\?\.code/);
});

test("frontend field names are adapted to the backend resource contract", () => {
  const combined = `${liveSource}\n${apiSource}`;
  for (const fieldName of [
    "offer_number",
    "request_number",
    "order_number",
    "installation_number",
    "transaction_number",
    "transaction_date",
    "employee_number",
    "first_name",
    "last_name",
  ]) {
    assert.match(combined, new RegExp(`(?:["']${fieldName}["']|\\b${fieldName}\\s*:)`), `${fieldName} needs a UI/API mapping`);
  }
});

test("cost and salary fields are rendered only behind dedicated permissions", () => {
  assert.match(liveSource, /field\(["']estimatedAmount["'][^\n]*permission:\s*\{\s*resource:\s*["']cost["'],\s*action:\s*["']view["']/);
  assert.match(liveSource, /field\(["']salaryAmount["'][^\n]*permission:\s*\{\s*resource:\s*["']salary["'],\s*action:\s*["']view["']/);
  assert.match(liveSource, /visibleFields\s*=\s*config\.fields\.filter\(\(item\)\s*=>\s*!item\.permission\s*\|\|\s*permissionAllows\(session,\s*item\.permission\.action,\s*item\.permission\.resource\)\)/);
  assert.match(apiSource, /permission\s*===\s*`\$\{slug\}\.\$\{backendAction\}`/);
});

test("production login temporarily uses phone and password without Google or browser-stored tokens", () => {
  assert.match(apiSource, /passwordLogin:\s*["']\/auth\/password\/login["']/);
  assert.match(apiSource, /async loginWithPassword/);
  assert.match(liveSource, /TELEFON VE ŞİFREYLE GİRİŞ/);
  assert.match(liveSource, /autoComplete="current-password"/);
  assert.doesNotMatch(liveSource, /SMS kodu gönder/);
  assert.doesNotMatch(liveSource, /signin-with-chatgpt/);
  assert.doesNotMatch(apiSource, /localStorage\.setItem\([^\n]*(?:token|session)/i);
});

test("projects expose a Design 2 style command center with readiness guidance", () => {
  assert.match(apiSource, /async projectCommandCenter\(projectId\)/);
  assert.match(apiSource, /projects\/\$\{encodeURIComponent\(projectId\)\}\/command-center/);
  assert.match(liveSource, /function ProjectCommandCenterModal\s*\(/);
  assert.match(liveSource, /PROJE AŞAMALARI/);
  assert.match(liveSource, /SONRAKİ AŞAMAYA HAZIRLIK/);
  assert.match(liveSource, /SIRADAKİ DOĞRU İŞLER/);
  assert.match(liveSource, /Yönetici istisna gerekçesi/);
});

test("file center captures operational context and previews project evidence", () => {
  for (const field of ["projectId", "workItemId", "designRevisionId", "qualityInspectionId", "installationId", "spaceName", "captureStage", "takenAt"]) {
    assert.match(apiSource, new RegExp(`${field}:\\s*["'][a-z_]+["']`), `${field} API eşlemesi eksik`);
  }
  assert.match(liveSource, /BAĞLAMSAL DOSYA MERKEZİ/);
  assert.match(liveSource, /Mahal \/ konum/);
  assert.match(liveSource, /Kalite kontrolü/);
  assert.match(liveSource, /Pazarlamada kullanılabilir/);
  assert.match(liveSource, /DOSYA KANITI/);
  assert.match(liveSource, /api\.fileContentUrl\(data\.id\)/);
  assert.match(liveSource, /live-file-preview/);
});

test("operational records share accessible list, kanban and calendar views", () => {
  for (const resource of ["projects", "projectTasks", "purchases", "production", "installations", "resourceAssignments"]) {
    assert.match(liveSource, new RegExp(`Object\\.assign\\(configs\\.${resource}, \\{[\\s\\S]*?views: operationalViews`), `${resource} needs operational views`);
  }
  assert.match(liveSource, /function ViewSwitcher\s*\(/);
  assert.match(liveSource, /aria-label="Kayıt görünümü"/);
  assert.match(liveSource, /aria-pressed=\{value === key\}/);
  assert.match(liveSource, /function KanbanView\s*\(/);
  assert.match(liveSource, /function CalendarView\s*\(/);
  assert.match(liveSource, /rangeEndField:\s*"plannedEnd"/);
  assert.match(liveSource, /day >= start && day <= end/);
});

test("field mode provides permission-aware mobile actions and contextual camera capture", () => {
  assert.match(liveSource, /id:\s*"fieldMode"[^}]*resource:\s*"field-mode"[^}]*authenticated:\s*true/);
  assert.match(liveSource, /function FieldMode\s*\(/);
  assert.match(liveSource, /fieldActions\.filter\(\(action\)\s*=>\s*permissionAllows\(session,\s*"create",\s*resourceForAction\(action\)\)\)/);
  assert.match(liveSource, /function QuickPhotoModal\s*\(/);
  assert.match(liveSource, /accept="image\/\*"\s+capture="environment"/);
  assert.match(liveSource, /10\s*\*\s*1024\s*\*\s*1024/);
  assert.match(liveSource, /!online\s*&&\s*!canUseActionOffline\(action\)/);
  assert.match(liveSource, /disabled=\{!online\s*&&\s*!canUseActionOffline\(action\)\}/);
  assert.match(liveSource, /await api\.create\(targetModule\.resource,\s*values\)/);
});

test("sidebar groups are accessible accordions and the workspace uses the walnut palette", () => {
  assert.match(liveSource, /const \[openNavGroup, setOpenNavGroup\]/);
  assert.match(liveSource, /aria-label="Ana menü"/);
  assert.match(liveSource, /className="live-nav-group-toggle"/);
  assert.match(liveSource, /aria-expanded=\{expanded\}/);
  assert.match(liveSource, /aria-controls=\{panelId\}/);
  assert.match(liveSource, /hidden=\{!expanded\}/);
  assert.match(liveSource, /\.live-nav-group-items\[hidden\]\{display:none\}/);
  assert.match(liveSource, /--live-green:#6b432b/);
  assert.match(liveSource, /\.live-sidebar,.live-login>section\{background:#3b261b\}/);
});

test("user invitation selects one or more named roles and form enums are localized", () => {
  assert.match(liveSource, /field\("roleIds",\s*"Roller",\s*"multiselect"/);
  assert.match(liveSource, /optionsResource:\s*"roles"/);
  assert.match(liveSource, /api\.list\(resource,\s*\{\s*pageSize:\s*100\s*\}\)/);
  assert.doesNotMatch(liveSource, /field\("roleId",\s*"Rol ID"/);
  assert.match(apiSource, /roleIds:\s*"role_ids"/);
  for (const label of ["Şirket", "Bireysel", "Otel", "Mimar", "Yıllık izin", "Kredi kartı", "Haftalık proje"]) assert.match(liveSource, new RegExp(label));
  assert.match(liveSource, /<option value=\{option\.value\} key=\{option\.value\}>\{option\.label\}<\/option>/);
});
