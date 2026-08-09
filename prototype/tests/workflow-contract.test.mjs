import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import worker from "../worker/index.js";

class D1Statement {
  constructor(database, sql) { this.database = database; this.sql = sql; this.values = []; }
  bind(...values) { this.values = values; return this; }
  async first() { return this.database.prepare(this.sql).get(...this.values) || null; }
  async all() { return { results: this.database.prepare(this.sql).all(...this.values) }; }
  async run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

class D1Database {
  constructor(database) { this.database = database; }
  prepare(sql) { return new D1Statement(this.database, sql); }
  async batch(statements) {
    this.database.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

const timestamp = "2026-08-09T10:00:00.000Z";

async function setup() {
  const database = new DatabaseSync(":memory:");
  database.exec(await readFile(new URL("../migrations/0001_tenant_core.sql", import.meta.url), "utf8"));
  database.exec(await readFile(new URL("../migrations/0002_permissions.sql", import.meta.url), "utf8"));
  database.exec(await readFile(new URL("../migrations/0003_workflows.sql", import.meta.url), "utf8"));
  database.prepare("INSERT INTO tenants (id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)").run("tenant-a", "Firma A", "firma-a", timestamp, timestamp);
  database.prepare("INSERT INTO users (id,email,full_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("owner-a", "owner@a.test", "Firma Sahibi", "active", timestamp, timestamp);
  database.prepare("INSERT INTO roles (id,tenant_id,code,name,is_system,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("role-owner", "tenant-a", "owner", "Firma Sahibi", 1, timestamp, timestamp);
  database.prepare("INSERT INTO memberships (id,tenant_id,user_id,role_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("member-a", "tenant-a", "owner-a", "role-owner", "active", timestamp, timestamp);
  database.prepare("INSERT INTO customers (id,tenant_id,code,name,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("customer-a", "tenant-a", "C-1", "Müşteri A", timestamp, timestamp);
  return { database, env: { DB: new D1Database(database), ALLOW_DEV_AUTH: "true" } };
}

function request(path, { method = "POST", body, tenant = "tenant-a", includeTenant = true, email = "owner@a.test" } = {}) {
  const headers = new Headers({ "x-user-email": email });
  if (includeTenant) headers.set("x-tenant-id", tenant);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`https://example.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

test("bootstrap owner can open a session without knowing the tenant id", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec(await readFile(new URL("../migrations/0001_tenant_core.sql", import.meta.url), "utf8"));
  database.exec(await readFile(new URL("../migrations/0002_permissions.sql", import.meta.url), "utf8"));
  database.exec(await readFile(new URL("../migrations/0003_workflows.sql", import.meta.url), "utf8"));
  const env = { DB: new D1Database(database), ALLOW_DEV_AUTH: "true", BOOTSTRAP_SECRET: "secret-for-test" };
  const bootstrapResponse = await worker.fetch(new Request("https://example.test/api/v1/bootstrap", {
    method: "POST",
    headers: { "content-type": "application/json", "x-bootstrap-secret": "secret-for-test" },
    body: JSON.stringify({ tenant_name: "Yeni Firma", tenant_slug: "yeni-firma", owner_email: "owner@a.test", owner_name: "Firma Sahibi" }),
  }), env);
  assert.equal(bootstrapResponse.status, 201);
  const sessionResponse = await worker.fetch(request("/api/v1/session", { method: "GET", includeTenant: false }), env);
  const session = await sessionResponse.json();
  assert.equal(sessionResponse.status, 200);
  assert.equal(session.data.tenant.name, "Yeni Firma");
  assert.equal(session.data.tenant_auto_selected, true);
});

test("session auto-selects the only active tenant and requires selection for multiple memberships", async () => {
  const { database, env } = await setup();
  let response = await worker.fetch(request("/api/v1/session", { method: "GET", includeTenant: false }), env);
  let payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.data.tenant.id, "tenant-a");
  assert.equal(payload.data.tenant_auto_selected, true);

  database.prepare("INSERT INTO tenants (id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)").run("tenant-b", "Firma B", "firma-b", timestamp, timestamp);
  database.prepare("INSERT INTO roles (id,tenant_id,code,name,is_system,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("role-owner-b", "tenant-b", "owner", "Firma Sahibi", 1, timestamp, timestamp);
  database.prepare("INSERT INTO memberships (id,tenant_id,user_id,role_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("member-b", "tenant-b", "owner-a", "role-owner-b", "active", timestamp, timestamp);
  response = await worker.fetch(request("/api/v1/session", { method: "GET", includeTenant: false }), env);
  payload = await response.json();
  assert.equal(payload.data.requires_tenant_selection, true);
  assert.deepEqual(payload.data.tenants.map((tenant) => tenant.id), ["tenant-a", "tenant-b"]);
});

test("offer decisions and conversion are state-idempotent", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO offers (id,tenant_id,customer_id,offer_number,status,grand_total_minor,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run("offer-a", "tenant-a", "customer-a", "T-100", "sent", 125000, timestamp, timestamp);
  let response = await worker.fetch(request("/api/v1/offers/offer-a/accept"), env);
  assert.equal(response.status, 200);
  response = await worker.fetch(request("/api/v1/offers/offer-a/accept"), env);
  assert.equal((await response.json()).meta.replayed, true);
  response = await worker.fetch(request("/api/v1/offers/offer-a/reject", { body: { reason: "Geç" } }), env);
  assert.equal(response.status, 409);
  response = await worker.fetch(request("/api/v1/offers/offer-a/convert-to-project", { body: {} }), env);
  assert.equal(response.status, 201);
  const projectId = (await response.json()).data.id;
  response = await worker.fetch(request("/api/v1/offers/offer-a/convert-to-project", { body: {} }), env);
  assert.equal((await response.json()).data.id, projectId);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM projects WHERE source_offer_id='offer-a'").get().count, 1);
});

test("workflow actions require their dedicated capability and remain tenant scoped", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO users (id,email,full_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("viewer-a", "viewer@a.test", "Görüntüleyici", "active", timestamp, timestamp);
  database.prepare("INSERT INTO roles (id,tenant_id,code,name,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("role-viewer", "tenant-a", "viewer", "Görüntüleyici", timestamp, timestamp);
  database.prepare("INSERT INTO role_permissions (tenant_id,role_id,permission_code) VALUES (?,?,?)").run("tenant-a", "role-viewer", "offers.read");
  database.prepare("INSERT INTO memberships (id,tenant_id,user_id,role_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("viewer-member", "tenant-a", "viewer-a", "role-viewer", "active", timestamp, timestamp);
  database.prepare("INSERT INTO offers (id,tenant_id,customer_id,offer_number,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("offer-a", "tenant-a", "customer-a", "T-101", "sent", timestamp, timestamp);
  const response = await worker.fetch(request("/api/v1/offers/offer-a/accept", { email: "viewer@a.test" }), env);
  assert.equal(response.status, 403);
  assert.equal(database.prepare("SELECT status FROM offers WHERE id='offer-a'").get().status, "sent");
});

test("project transitions reject skipped phases", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-1", "Proje", "lead", timestamp, timestamp);
  let response = await worker.fetch(request("/api/v1/projects/project-a/transition", { body: { status: "discovery" } }), env);
  assert.equal(response.status, 200);
  response = await worker.fetch(request("/api/v1/projects/project-a/transition", { body: { status: "completed" } }), env);
  assert.equal(response.status, 409);
});

test("workflow state rolls back when the audit insert fails", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-FAIL", "Audit rollback", "lead", timestamp, timestamp);
  database.exec("CREATE TRIGGER fail_workflow_audit BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END");
  const response = await worker.fetch(request("/api/v1/projects/project-a/transition", { body: { status: "discovery" } }), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "workflow_commit_failed");
  assert.equal(database.prepare("SELECT status FROM projects WHERE id='project-a'").get().status, "lead");
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM audit_logs").get().count, 0);
});

test("production release requires the current approved work-item revision", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-1", "Proje", "production", timestamp, timestamp);
  database.prepare("INSERT INTO work_items (id,tenant_id,project_id,description,status,revision_no,revision_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run("work-a", "tenant-a", "project-a", "Kapı", "planned", 2, "draft", timestamp, timestamp);
  database.prepare("INSERT INTO production_orders (id,tenant_id,order_number,project_id,work_item_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run("order-a", "tenant-a", "U-1", "project-a", "work-a", "planned", timestamp, timestamp);
  let response = await worker.fetch(request("/api/v1/production-orders/order-a/release"), env);
  assert.equal(response.status, 409);
  response = await worker.fetch(request("/api/v1/work-items/work-a/approve-revision"), env);
  assert.equal(response.status, 200);
  response = await worker.fetch(request("/api/v1/production-orders/order-a/release"), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.work_item_revision_no, 2);
});

test("purchase, leave and finance approvals enforce immutable accounting", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO purchase_requests (id,tenant_id,request_number,description,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("request-a", "tenant-a", "SA-1", "MDF", "pending", timestamp, timestamp);
  database.prepare("INSERT INTO employees (id,tenant_id,employee_number,first_name,last_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run("employee-a", "tenant-a", "E-1", "Ayşe", "Usta", "active", timestamp, timestamp);
  database.prepare("INSERT INTO leave_requests (id,tenant_id,employee_id,leave_type,start_date,end_date,day_count,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run("leave-a", "tenant-a", "employee-a", "annual", "2026-08-10", "2026-08-11", 2, "pending", timestamp, timestamp);
  database.prepare("INSERT INTO financial_transactions (id,tenant_id,transaction_number,type,transaction_date,amount_minor,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run("finance-a", "tenant-a", "F-1", "expense", "2026-08-09", 50000, "pending", timestamp, timestamp);

  assert.equal((await worker.fetch(request("/api/v1/purchase-requests/request-a/approve"), env)).status, 200);
  assert.equal((await worker.fetch(request("/api/v1/leaves/leave-a/reject", { body: { reason: "Kritik montaj haftası" } }), env)).status, 200);
  assert.equal((await worker.fetch(request("/api/v1/financial-transactions/finance-a/approve"), env)).status, 200);
  assert.equal((await worker.fetch(request("/api/v1/financial-transactions/finance-a", { method: "PATCH", body: { amount_minor: 1 } }), env)).status, 409);
  assert.equal((await worker.fetch(request("/api/v1/financial-transactions/finance-a", { method: "DELETE" }), env)).status, 409);
  let response = await worker.fetch(request("/api/v1/financial-transactions/finance-a/reverse", { body: { reason: "Hatalı kayıt" } }), env);
  assert.equal(response.status, 201);
  response = await worker.fetch(request("/api/v1/financial-transactions/finance-a/reverse", { body: { reason: "Hatalı kayıt" } }), env);
  assert.equal(response.status, 200);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM financial_transactions WHERE reversal_of_id='finance-a'").get().count, 1);
});

test("scheduled backups include the latest schema manifest and never mix tenants", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO tenants (id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)").run("tenant-b", "Firma B", "firma-b", timestamp, timestamp);
  database.prepare("INSERT INTO customers (id,tenant_id,code,name,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("customer-b", "tenant-b", "B-1", "Müşteri B", timestamp, timestamp);
  const objects = new Map();
  env.FILES = { async put(key, value) { objects.set(key, String(value)); } };
  let task;
  await worker.scheduled({}, env, { waitUntil(promise) { task = promise; } });
  await task;
  assert.equal(objects.size, 2);
  for (const [key, content] of objects) {
    const lines = content.split("\n").map((line) => JSON.parse(line));
    const manifest = lines[0];
    assert.equal(manifest.schema_version, 3);
    assert.deepEqual(manifest.migrations, ["0001_tenant_core.sql", "0002_permissions.sql", "0003_workflows.sql"]);
    assert.match(key, new RegExp(`^backups/${manifest.tenant_id}/`));
    for (const entry of lines.slice(1)) {
      if (entry.table === "users") continue;
      if (entry.row?.tenant_id !== undefined) assert.equal(entry.row.tenant_id, manifest.tenant_id);
      if (entry.table === "tenants") assert.equal(entry.row.id, manifest.tenant_id);
    }
    const customerNames = lines.filter((entry) => entry.table === "customers").map((entry) => entry.row.name);
    assert.deepEqual(customerNames, [manifest.tenant_id === "tenant-a" ? "Müşteri A" : "Müşteri B"]);
  }
});
