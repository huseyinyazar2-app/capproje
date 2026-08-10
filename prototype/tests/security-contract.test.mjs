import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/index.js";

const normalizeSql = (sql) => sql.replace(/\s+/g, " ").trim().toLowerCase();

test("CORS preflight allows idempotent mutation headers", async () => {
  const response = await worker.fetch(new Request("https://example.test/api/v1/projects", { method: "OPTIONS" }), {});
  assert.equal(response.status, 204);
  assert.match(response.headers.get("access-control-allow-headers") || "", /idempotency-key/i);
});

class FakeStatement {
  constructor(database, sql) {
    this.database = database;
    this.sql = normalizeSql(sql);
    this.bindings = [];
  }

  bind(...bindings) {
    this.bindings = bindings;
    return this;
  }

  async first() {
    return this.database.first(this.sql, this.bindings);
  }

  async all() {
    return { results: this.database.all(this.sql, this.bindings) };
  }

  async run() {
    return this.database.run(this.sql, this.bindings);
  }
}

class FakeD1 {
  constructor() {
    this.users = new Map([
      ["sales@a.test", { id: "user-a", email: "sales@a.test", full_name: "A Satış", status: "active" }],
      ["owner@a.test", { id: "owner-a", email: "owner@a.test", full_name: "A Sahibi", status: "active" }],
    ]);
    this.tenants = new Map([
      ["tenant-a", { id: "tenant-a", name: "Firma A", slug: "firma-a", status: "active" }],
      ["tenant-b", { id: "tenant-b", name: "Firma B", slug: "firma-b", status: "active" }],
    ]);
    this.memberships = [
      { id: "membership-a", tenant_id: "tenant-a", user_id: "user-a", role_id: "role-sales", role_code: "sales", role_name: "Satış", title: "Satış Uzmanı", status: "active" },
      { id: "membership-owner-a", tenant_id: "tenant-a", user_id: "owner-a", role_id: "role-owner", role_code: "owner", role_name: "Firma Sahibi", title: "Firma Sahibi", status: "active" },
    ];
    this.permissions = new Map([
      ["role-sales", ["projects.read", "work-items.read", "employees.read", "customers.read"]],
    ]);
    this.tables = {
      projects: [
        { id: "project-a", tenant_id: "tenant-a", code: "A-1", name: "A Projesi", estimated_cost: 120_000, created_at: "2026-08-09", updated_at: "2026-08-09" },
        { id: "project-b", tenant_id: "tenant-b", code: "B-1", name: "B Projesi", estimated_cost: 880_000, created_at: "2026-08-09", updated_at: "2026-08-09" },
      ],
      work_items: [
        { id: "work-a", tenant_id: "tenant-a", project_id: "project-a", description: "Kapı", unit_cost: 4_250, unit_price: 7_500, created_at: "2026-08-09", updated_at: "2026-08-09" },
      ],
      employees: [
        { id: "employee-a", tenant_id: "tenant-a", employee_number: "A-001", first_name: "Ayşe", last_name: "Usta", salary_amount: 48_500, salary_currency: "TRY", created_at: "2026-08-09", updated_at: "2026-08-09" },
      ],
      customers: [
        { id: "customer-a", tenant_id: "tenant-a", name: "A Müşterisi", created_at: "2026-08-09", updated_at: "2026-08-09" },
      ],
    };
    this.auditLogs = [];
    this.idempotency = new Map();
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }

  first(sql, bindings) {
    if (sql.includes("from users where email=")) {
      return this.users.get(String(bindings[0]).toLowerCase()) || null;
    }
    if (sql.includes("from memberships m join roles")) {
      const [userId, tenantId] = bindings;
      const membership = this.memberships.find((item) => item.user_id === userId && item.tenant_id === tenantId && item.status === "active");
      const tenant = this.tenants.get(tenantId);
      if (!membership || tenant?.status !== "active") return null;
      return {
        membership_id: membership.id,
        tenant_id: tenantId,
        title: membership.title,
        role_id: membership.role_id,
        role_code: membership.role_code,
        role_name: membership.role_name,
        tenant_name: tenant.name,
        tenant_slug: tenant.slug,
      };
    }
    if (sql.includes("from idempotency_records where tenant_id=? and user_id=? and idempotency_key=? and method=? and path=?")) {
      const key = bindings.join("|");
      return this.idempotency.get(key) || null;
    }
    const table = Object.keys(this.tables).find((name) => sql.includes(`from ${name} where id=? and tenant_id=?`));
    if (table) {
      const [id, tenantId] = bindings;
      return this.tables[table].find((row) => row.id === id && row.tenant_id === tenantId) || null;
    }
    return null;
  }

  all(sql, bindings) {
    if (sql.includes("select permission_code from role_permissions")) {
      return (this.permissions.get(bindings[1]) || []).map((permission_code) => ({ permission_code }));
    }
    return [];
  }

  run(sql, bindings) {
    if (sql.startsWith("insert into idempotency_records")) {
      const [id, tenantId, userId, idempotencyKey, method, path, createdAt] = bindings;
      const key = [tenantId, userId, idempotencyKey, method, path].join("|");
      if (this.idempotency.has(key)) throw new Error("duplicate idempotency key");
      this.idempotency.set(key, { id, tenant_id: tenantId, user_id: userId, idempotency_key: idempotencyKey, method, path, created_at: createdAt, status_code: null, response_body: null });
      return { success: true, changes: 1 };
    }
    if (sql.startsWith("update idempotency_records set status_code=")) {
      const [statusCode, responseBody, completedAt, id, tenantId] = bindings;
      const record = [...this.idempotency.values()].find((item) => item.id === id && item.tenant_id === tenantId);
      if (record) Object.assign(record, { status_code: statusCode, response_body: responseBody, completed_at: completedAt });
      return { success: true, changes: record ? 1 : 0 };
    }
    if (sql.startsWith("insert into customers")) {
      const columnText = sql.match(/insert into customers \(([^)]+)\)/)?.[1] || "";
      const columns = columnText.split(",");
      const row = Object.fromEntries(columns.map((column, index) => [column.trim(), bindings[index]]));
      this.tables.customers.push(row);
      return { success: true, changes: 1 };
    }
    if (sql.startsWith("insert into audit_logs")) {
      const [id, tenant_id, user_id, action, entity_type, entity_id, request_id, ip_address, changes_json, created_at] = bindings;
      this.auditLogs.push({ id, tenant_id, user_id, action, entity_type, entity_id, request_id, ip_address, changes_json, created_at });
      return { success: true, changes: 1 };
    }
    return { success: true, changes: 0 };
  }
}

function makeEnv(database = new FakeD1()) {
  return {
    DB: database,
    ALLOW_DEV_AUTH: "true",
    ASSETS: { fetch: async () => new Response("missing", { status: 404 }) },
  };
}

function apiRequest(path, { email = "sales@a.test", tenant = "tenant-a", method = "GET", body, headers = {} } = {}) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("x-user-email", email);
  requestHeaders.set("x-tenant-id", tenant);
  if (body !== undefined) requestHeaders.set("content-type", "application/json");
  return new Request(`https://example.test${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function responseData(response) {
  const payload = await response.json();
  return payload.data;
}

test("tenant A cannot read a tenant B record even when its identifier is known", async () => {
  const env = makeEnv();
  const response = await worker.fetch(apiRequest("/api/v1/projects/project-b"), env);

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, "not_found");
});

test("the tenant header cannot be spoofed without an active membership", async () => {
  const env = makeEnv();
  const response = await worker.fetch(apiRequest("/api/v1/projects/project-b", { tenant: "tenant-b" }), env);

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "tenant_forbidden");
});

test("read permission alone does not expose cost or salary fields", async () => {
  const env = makeEnv();
  const projectResponse = await worker.fetch(apiRequest("/api/v1/projects/project-a"), env);
  const workItemResponse = await worker.fetch(apiRequest("/api/v1/work-items/work-a"), env);
  const employeeResponse = await worker.fetch(apiRequest("/api/v1/employees/employee-a"), env);

  assert.equal(projectResponse.status, 200);
  assert.equal(workItemResponse.status, 200);
  assert.equal(employeeResponse.status, 200);
  assert.equal("estimated_cost" in (await responseData(projectResponse)), false, "projects.read must not imply projects.view_cost");
  assert.equal("unit_cost" in (await responseData(workItemResponse)), false, "work-items.read must not imply work-items.view_cost");
  assert.equal("salary_amount" in (await responseData(employeeResponse)), false, "employees.read must not imply employees.view_salary");
});

test("a read-only role is denied both create and update operations", async () => {
  const env = makeEnv();
  const createResponse = await worker.fetch(apiRequest("/api/v1/customers", { method: "POST", body: { name: "Yetkisiz" } }), env);
  const updateResponse = await worker.fetch(apiRequest("/api/v1/customers/customer-a", { method: "PUT", body: { name: "Değiştirildi" } }), env);

  assert.equal(createResponse.status, 403);
  assert.equal(updateResponse.status, 403);
  assert.equal(env.DB.tables.customers.length, 1);
  assert.equal(env.DB.tables.customers[0].name, "A Müşterisi");
});

test("a successful mutation writes a tenant-scoped audit record", async () => {
  const env = makeEnv();
  const response = await worker.fetch(apiRequest("/api/v1/customers", {
    email: "owner@a.test",
    method: "POST",
    body: { name: "Yeni Müşteri" },
    headers: { "x-request-id": "request-audit-1" },
  }), env);

  assert.equal(response.status, 200);
  const created = await responseData(response);
  assert.equal(env.DB.auditLogs.length, 1);
  assert.deepEqual(
    {
      tenant_id: env.DB.auditLogs[0].tenant_id,
      user_id: env.DB.auditLogs[0].user_id,
      action: env.DB.auditLogs[0].action,
      entity_type: env.DB.auditLogs[0].entity_type,
      entity_id: env.DB.auditLogs[0].entity_id,
      request_id: env.DB.auditLogs[0].request_id,
    },
    {
      tenant_id: "tenant-a",
      user_id: "owner-a",
      action: "create",
      entity_type: "customers",
      entity_id: created.id,
      request_id: "request-audit-1",
    },
  );
});

test("replaying a POST with the same idempotency key creates one record and one audit event", async () => {
  const env = makeEnv();
  const options = {
    email: "owner@a.test",
    method: "POST",
    body: { name: "Tekil Müşteri" },
    headers: { "idempotency-key": "customer-create-20260809-1" },
  };

  const firstResponse = await worker.fetch(apiRequest("/api/v1/customers", options), env);
  const secondResponse = await worker.fetch(apiRequest("/api/v1/customers", options), env);
  const first = await responseData(firstResponse);
  const second = await responseData(secondResponse);

  assert.equal(firstResponse.status, secondResponse.status);
  assert.equal(second.id, first.id);
  assert.equal(env.DB.tables.customers.filter((row) => row.name === "Tekil Müşteri").length, 1);
  assert.equal(env.DB.auditLogs.filter((row) => row.action === "create" && row.entity_type === "customers").length, 1);
});
