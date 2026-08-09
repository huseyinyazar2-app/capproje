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

test("offline state is observable and actually disables create, edit and save mutations", () => {
  assert.match(liveSource, /navigator\.onLine/);
  assert.match(liveSource, /addEventListener\(["']offline["']/);
  assert.match(liveSource, /Çevrimdışısınız/);
  assert.match(liveSource, /function ResourceView\(\{[^}]*online[^}]*\}\)/);
  assert.match(liveSource, /canCreate\s*=\s*online\s*&&[^;]*permissionAllows/);
  assert.match(liveSource, /canEdit\s*=\s*online\s*&&[^;]*permissionAllows/);
  assert.match(liveSource, /<ResourceView[^>]*online=\{online\}/);
});

test("create and edit forms are connected to API mutations and backend-compatible permissions", () => {
  assert.match(liveSource, /permissionAllows\(session,\s*["']create["'],\s*module\.resource\)/);
  assert.match(liveSource, /permissionAllows\(session,\s*["']update["'],\s*module\.resource\)/);
  assert.match(liveSource, /await api\.create\(module\.resource,\s*payload\)/);
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
