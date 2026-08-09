import assert from "node:assert/strict";
import test from "node:test";
import worker, { __testing } from "../worker/index.js";

const normalize = (sql) => sql.replace(/\s+/g, " ").trim().toLowerCase();

class Statement {
  constructor(db, sql) { this.db = db; this.sql = normalize(sql); this.values = []; }
  bind(...values) { this.values = values; return this; }
  first() { return this.db.first(this.sql, this.values); }
  async all() { return { results: await this.db.all(this.sql, this.values) }; }
  run() { return this.db.run(this.sql, this.values); }
}

class FakeD1 {
  constructor() { this.audit = []; this.backups = []; }
  prepare(sql) { return new Statement(this, sql); }
  async first(sql, values) {
    if (sql.includes("from users where email=")) return values[0] === "owner@a.test" ? { id: "user-a", email: values[0], full_name: "Firma Sahibi", status: "active" } : null;
    if (sql.includes("from memberships m join roles")) {
      if (values[0] !== "user-a" || values[1] !== "tenant-a") return null;
      return { membership_id: "mem-a", tenant_id: "tenant-a", title: "Firma Sahibi", role_id: "role-a", role_code: "owner", role_name: "Firma Sahibi", tenant_name: "Firma A", tenant_slug: "firma-a" };
    }
    if (sql.includes("from projects where id=? and tenant_id=?")) return values[0] === "project-a" && values[1] === "tenant-a" ? { id: "project-a", tenant_id: "tenant-a", code: "A-1", name: "Proje A", updated_at: "2026-08-09" } : null;
    return null;
  }
  async all(sql) {
    if (sql.includes("select id from tenants")) return [{ id: "tenant-a" }];
    return [];
  }
  async run(sql, values) {
    if (sql.startsWith("insert into backup_runs")) this.backups.push({ id: values[0], tenant_id: values[1], status: values[2] });
    if (sql.startsWith("update backup_runs")) this.backups[0] = { ...this.backups[0], status: "failed", error_message: values[0] };
    if (sql.startsWith("insert into audit_logs")) this.audit.push({ tenant_id: values[1], action: values[3], entity_type: values[4] });
    return { success: true, meta: { changes: 1 } };
  }
}

function request(path, tenant = "tenant-a") {
  return new Request(`https://example.test${path}`, { headers: { "x-user-email": "owner@a.test", "x-tenant-id": tenant } });
}

test("exposes the required tenant business resources", () => {
  for (const resource of ["customers","suppliers","projects","offers","project-tasks","work-items","purchase-requests","purchase-orders","production-orders","installations","financial-transactions","invoices","accounts","employees","attendance","leaves","payroll-inputs","files","audit-logs"]) {
    assert.ok(__testing.resources[resource], `${resource} CRUD kaynağı eksik`);
  }
});

test("session is derived from an active tenant membership", async () => {
  const response = await worker.fetch(request("/api/v1/session"), { DB: new FakeD1(), ALLOW_DEV_AUTH: "true" });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.data.tenant.id, "tenant-a");
  assert.equal(payload.data.role.code, "owner");
  assert.deepEqual(payload.data.permissions, ["*"]);
});

test("a known id cannot cross the selected tenant boundary", async () => {
  const response = await worker.fetch(request("/api/v1/projects/project-a", "tenant-b"), { DB: new FakeD1(), ALLOW_DEV_AUTH: "true" });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "tenant_forbidden");
});

test("scheduled backup records a tenant-scoped failure when R2 is absent", async () => {
  const DB = new FakeD1();
  let task;
  await worker.scheduled({}, { DB }, { waitUntil(promise) { task = promise; } });
  await task;
  assert.equal(DB.backups[0].tenant_id, "tenant-a");
  assert.equal(DB.backups[0].status, "failed");
  assert.deepEqual(DB.audit[0], { tenant_id: "tenant-a", action: "backup.failed", entity_type: "backups" });
});
