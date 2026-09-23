import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import worker from "../worker/index.js";

// Migration listesi elle sayılmaz; dizin sıralı okunur ki yeni bir migration
// eklendiğinde testler sessizce eski şemayla çalışmasın.
const migrationsDirectory = new URL("../migrations/", import.meta.url);
export async function migrationFiles() {
  return (await readdir(migrationsDirectory)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
}
async function applyMigrations(database) {
  for (const name of await migrationFiles()) {
    database.exec(await readFile(new URL(name, migrationsDirectory), "utf8"));
  }
}

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
  await applyMigrations(database);
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
  await applyMigrations(database);
  const env = { DB: new D1Database(database), ALLOW_DEV_AUTH: "true", BOOTSTRAP_SECRET: "secret-for-test", PASSWORD_AUTH_ENABLED: "true", PASSWORD_AUTH_PEPPER: "test-password-pepper-1234567890" };
  const bootstrapResponse = await worker.fetch(new Request("https://example.test/api/v1/bootstrap", {
    method: "POST",
    headers: { "content-type": "application/json", "x-bootstrap-secret": "secret-for-test" },
    body: JSON.stringify({ tenant_name: "Yeni Firma", tenant_slug: "yeni-firma", owner_email: "owner@a.test", owner_name: "Firma Sahibi", owner_phone: "0555 111 22 33", owner_password: "Test-password-123" }),
  }), env);
  assert.equal(bootstrapResponse.status, 201);
  const sessionResponse = await worker.fetch(request("/api/v1/session", { method: "GET", includeTenant: false }), env);
  const session = await sessionResponse.json();
  assert.equal(sessionResponse.status, 200);
  assert.equal(session.data.tenant.name, "Yeni Firma");
  assert.equal(session.data.tenant_auto_selected, true);
  assert.deepEqual(database.prepare("SELECT code FROM roles WHERE tenant_id=? ORDER BY code").all(session.data.tenant.id).map((row) => row.code), ["architect","finance","hr","installation","owner","production","project_manager","purchasing","read_only"]);
  const readOnlyId = database.prepare("SELECT id FROM roles WHERE tenant_id=? AND code='read_only'").get(session.data.tenant.id).id;
  const readOnlyPermissions = database.prepare("SELECT permission_code FROM role_permissions WHERE role_id=?").all(readOnlyId).map((row) => row.permission_code);
  assert.ok(readOnlyPermissions.includes("projects.read"));
  assert.equal(readOnlyPermissions.includes("hr.sensitive.read"), false);
  assert.notEqual(database.prepare("SELECT password_hash FROM users WHERE email=?").get("owner@a.test").password_hash, "Test-password-123");

  const loginResponse = await worker.fetch(new Request("https://example.test/api/v1/auth/password/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://example.test" },
    body: JSON.stringify({ phone: "0555 111 22 33", password: "Test-password-123" }),
  }), env);
  const cookie = loginResponse.headers.get("set-cookie");
  assert.equal(loginResponse.status, 200);
  assert.match(cookie, /HttpOnly/);
  const passwordSession = await worker.fetch(new Request("https://example.test/api/v1/session", { headers: { cookie: cookie.split(";")[0] } }), env);
  assert.equal(passwordSession.status, 200);
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

test("phone OTP creates an HttpOnly session and activates an invited membership", async () => {
  const { database, env } = await setup();
  database.prepare("UPDATE users SET phone=?,status='invited' WHERE id=?").run("+905551112233", "owner-a");
  database.prepare("UPDATE memberships SET status='invited' WHERE user_id=?").run("owner-a");
  Object.assign(env, {
    PHONE_AUTH_ENABLED: "true",
    PHONE_AUTH_PEPPER: "test-phone-auth-pepper-1234567890",
    TWILIO_API_KEY: "SKtest",
    TWILIO_API_KEY_SECRET: "secret",
    TWILIO_VERIFY_SERVICE_SID: "VAtest",
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const path = String(url);
    if (path.endsWith("/Verifications")) return Response.json({ status: "pending" });
    if (path.endsWith("/VerificationCheck")) return Response.json({ status: "approved" });
    return new Response(null, { status: 404 });
  };
  try {
    const authHeaders = { "content-type": "application/json", origin: "https://example.test", "cf-connecting-ip": "192.0.2.10" };
    const startResponse = await worker.fetch(new Request("https://example.test/api/v1/auth/phone/start", { method: "POST", headers: authHeaders, body: JSON.stringify({ phone: "0555 111 22 33" }) }), env);
    const start = await startResponse.json();
    assert.equal(startResponse.status, 202);
    assert.match(start.data.challenge_id, /^pha_/);

    const verifyResponse = await worker.fetch(new Request("https://example.test/api/v1/auth/phone/verify", { method: "POST", headers: authHeaders, body: JSON.stringify({ phone: "0555 111 22 33", code: "123456", challenge_id: start.data.challenge_id }) }), env);
    const verified = await verifyResponse.json();
    const cookie = verifyResponse.headers.get("set-cookie");
    assert.equal(verifyResponse.status, 200);
    assert.equal(verified.data.authenticated, true);
    assert.equal("token" in verified.data, false);
    assert.match(cookie, /__Host-capproje_session=/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Lax/);
    assert.equal(database.prepare("SELECT status FROM users WHERE id=?").get("owner-a").status, "active");
    assert.equal(database.prepare("SELECT status FROM memberships WHERE user_id=?").get("owner-a").status, "active");

    const sessionResponse = await worker.fetch(new Request("https://example.test/api/v1/session", { headers: { cookie: cookie.split(";")[0] } }), env);
    assert.equal(sessionResponse.status, 200);
    assert.equal((await sessionResponse.json()).data.user.phone, "+905551112233");

    const logoutResponse = await worker.fetch(new Request("https://example.test/api/v1/auth/logout", { method: "POST", headers: { cookie: cookie.split(";")[0], origin: "https://example.test" } }), env);
    assert.equal(logoutResponse.status, 200);
    assert.match(logoutResponse.headers.get("set-cookie"), /Max-Age=0/);
    const revokedResponse = await worker.fetch(new Request("https://example.test/api/v1/session", { headers: { cookie: cookie.split(";")[0] } }), env);
    assert.equal(revokedResponse.status, 401);
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test("a user can receive multiple roles and session permissions are combined", async () => {
  const { database, env } = await setup();
  env.PASSWORD_AUTH_PEPPER = "test-password-pepper-1234567890";
  database.prepare("INSERT INTO roles (id,tenant_id,code,name,is_system,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("role-project", "tenant-a", "project_manager", "Proje Yöneticisi", 1, timestamp, timestamp);
  database.prepare("INSERT INTO roles (id,tenant_id,code,name,is_system,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("role-finance", "tenant-a", "finance", "Finans", 1, timestamp, timestamp);
  database.prepare("INSERT INTO role_permissions (tenant_id,role_id,permission_code) VALUES (?,?,?)").run("tenant-a", "role-project", "projects.read");
  database.prepare("INSERT INTO role_permissions (tenant_id,role_id,permission_code) VALUES (?,?,?)").run("tenant-a", "role-finance", "financial-transactions.read");

  const response = await worker.fetch(request("/api/v1/memberships/invite", { body: {
    email: "manager@a.test", phone: "0532 111 22 33", full_name: "Proje Yöneticisi", temporary_password: "Test-password-123",
    role_ids: ["role-project", "role-finance"], title: "Proje Yöneticisi",
  } }), env);
  const payload = await response.json();
  assert.equal(response.status, 201);
  assert.deepEqual(payload.data.role_ids, ["role-project", "role-finance"]);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM membership_roles WHERE membership_id=?").get(payload.data.id).count, 2);

  database.prepare("UPDATE users SET status='active' WHERE email=?").run("manager@a.test");
  database.prepare("UPDATE memberships SET status='active' WHERE id=?").run(payload.data.id);
  const sessionResponse = await worker.fetch(request("/api/v1/session", { method: "GET", email: "manager@a.test" }), env);
  const session = await sessionResponse.json();
  assert.equal(sessionResponse.status, 200);
  assert.deepEqual(session.data.roles.map((role) => role.code).sort(), ["finance", "project_manager"]);
  assert.deepEqual(session.data.permissions.sort(), ["financial-transactions.read", "projects.read"]);
});

test("project command center enforces readiness gates and creates stage tasks", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,customer_id,name,status,contract_amount_minor,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-AKIS", "customer-a", "Akıllı Akış", "discovery", 2_000_000, timestamp, timestamp);

  let response = await worker.fetch(request("/api/v1/projects/project-a/command-center", { method: "GET" }), env);
  let payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.data.nextStatus, "estimating");
  assert.equal(payload.data.blockers[0].id, "survey");
  assert.ok(payload.data.stages.some((stage) => stage.status === "production"));

  response = await worker.fetch(request("/api/v1/projects/project-a/transition", { body: { status: "estimating" } }), env);
  payload = await response.json();
  assert.equal(response.status, 409);
  assert.equal(payload.error.code, "project_gate_blocked");
  assert.equal(database.prepare("SELECT status FROM projects WHERE id='project-a'").get().status, "discovery");

  database.prepare("INSERT INTO site_surveys (id,tenant_id,project_id,customer_id,survey_number,survey_date,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run("survey-a", "tenant-a", "project-a", "customer-a", "K-1", "2026-08-09", "approved", timestamp, timestamp);
  response = await worker.fetch(request("/api/v1/projects/project-a/transition", { body: { status: "estimating" } }), env);
  assert.equal(response.status, 200);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM project_tasks WHERE project_id='project-a' AND metadata_json LIKE '%auto_generated%'").get().count, 2);
  response = await worker.fetch(request("/api/v1/notifications", { method: "GET" }), env);
  payload = await response.json();
  assert.equal(payload.meta.unread, 1);
  assert.equal(payload.data[0].project_id, "project-a");
  response = await worker.fetch(request(`/api/v1/notifications/${payload.data[0].id}/read`, { body: {} }), env);
  assert.equal((await response.json()).data.status, "read");
});

test("owner project gate override requires a meaningful audited reason", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-IST", "İstisna", "discovery", timestamp, timestamp);

  let response = await worker.fetch(request("/api/v1/projects/project-a/transition", { body: { status: "estimating", override_reason: "kısa" } }), env);
  assert.equal(response.status, 422);
  response = await worker.fetch(request("/api/v1/projects/project-a/transition", { body: { status: "estimating", override_reason: "Müşteri keşfi yarın imzalayacak" } }), env);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.meta.override_used, true);
  const audit = database.prepare("SELECT changes_json FROM audit_logs WHERE entity_type='projects' AND entity_id='project-a' ORDER BY created_at DESC LIMIT 1").get();
  assert.match(audit.changes_json, /Müşteri keşfi yarın imzalayacak/);
});

test("communication, capacity and global search stay tenant scoped", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,customer_id,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-ARAMA", "customer-a", "Arama Otel Projesi", "design", timestamp, timestamp);

  let response = await worker.fetch(request("/api/v1/project-communications", { body: { project_id: "project-a", customer_id: "customer-a", channel: "whatsapp", direction: "outbound", contact_name: "Otel Müdürü", subject: "Numune onayı", summary: "Ceviz kaplama onaylandı", occurred_at: timestamp, next_follow_up_at: "2026-08-12T09:00:00.000Z", status: "follow_up" } }), env);
  assert.equal(response.status, 200);
  response = await worker.fetch(request("/api/v1/resource-assignments", { body: { project_id: "project-a", resource_type: "team", resource_name: "Montaj Ekibi A", role: "Lobi montajı", planned_start: "2026-08-15", planned_end: "2026-08-20", allocation_percent: 80, status: "confirmed" } }), env);
  assert.equal(response.status, 200);

  response = await worker.fetch(request("/api/v1/search?q=Arama", { method: "GET" }), env);
  const results = (await response.json()).data;
  assert.equal(results.some((item) => item.id === "project-a" && item.module === "projects"), true);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM project_communications WHERE tenant_id='tenant-a' AND project_id='project-a'").get().count, 1);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM resource_assignments WHERE tenant_id='tenant-a' AND project_id='project-a'").get().count, 1);
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

// Tahsilat ve ödeme. `financial_transactions` durum kümesinde `collected` ve
// `paid` baştan beri vardı ama oraya ulaşan hiçbir yol yoktu: POST da PATCH de
// iş akışı kapısına takılıyor, yönlendirici yalnız `approve` ve `reverse`
// tanıyordu. Bu testler yolu ve yolun sınırlarını sabitliyor.
function seedFinanceRole(database) {
  database.prepare("INSERT INTO users (id,email,full_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("finance-a", "finance@a.test", "Finansçı", "active", timestamp, timestamp);
  database.prepare("INSERT INTO roles (id,tenant_id,code,name,is_system,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("role-finance", "tenant-a", "finance", "Finans / Ön Muhasebe", 1, timestamp, timestamp);
  // Yetkiler elle sayılmıyor: rol, bootstrap'in kurduğu gibi şablondan
  // dolduruluyor. Göç yeni kodları şablona yazmamışsa bu testler kırılır ve
  // uç, gerçek bir finans kullanıcısında görünmez kalır.
  database.prepare("INSERT INTO role_permissions (tenant_id,role_id,permission_code) SELECT 'tenant-a','role-finance',j.value FROM role_templates rt JOIN json_each(rt.permissions_json) j WHERE rt.code='finance'").run();
  database.prepare("INSERT INTO memberships (id,tenant_id,user_id,role_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("member-finance", "tenant-a", "finance-a", "role-finance", "active", timestamp, timestamp);
}

function financeInserter(database, tenantId = "tenant-a") {
  const statement = database.prepare("INSERT INTO financial_transactions (id,tenant_id,transaction_number,project_id,customer_id,type,transaction_date,amount_minor,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
  return (id, number, type, status, amount = 10_000, projectId = "project-a") => statement.run(id, tenantId, number, projectId, tenantId === "tenant-a" ? "customer-a" : null, type, "2026-08-01", amount, status, timestamp, timestamp);
}

test("collect and pay close settled finance records and feed the collection reports", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,contract_amount_minor,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-1", "Otel lobisi", "production", 1_000_000, timestamp, timestamp);
  seedFinanceRole(database);
  const insertFinance = financeInserter(database);
  insertFinance("inc-1", "F-1", "income", "approved", 400_000);
  // Vadesi geçmiş alacak: ayrı bir durum değil, vadesi dolmuş onaylı kayıt
  // (göç 0019). Eskiden burada `overdue` yazıyordu; o kod artık ne kayıt
  // defterinde ne veritabanı tetikleyicisinde var.
  database.prepare("INSERT INTO financial_transactions (id,tenant_id,transaction_number,project_id,customer_id,type,transaction_date,due_date,amount_minor,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .run("inc-2", "tenant-a", "F-2", "project-a", "customer-a", "income", "2026-07-01", "2026-07-15", 60_000, "approved", timestamp, timestamp);
  insertFinance("exp-1", "F-3", "expense", "approved", 120_000);

  const catalog = database.prepare("SELECT code FROM permissions").all().map((row) => row.code);
  for (const code of ["financial-transactions.collect", "financial-transactions.pay"]) assert.ok(catalog.includes(code), `${code} permission katalogunda olmalı`);

  // Onaylı ama henüz tahsil edilmemiş gelir tahsilat değil alacaktır; komuta
  // merkezi onu tahsilat sayarsa aynı lira hem beklenen hem girmiş görünür.
  const commandCenter = async () => (await (await worker.fetch(request("/api/v1/projects/project-a/command-center", { method: "GET" }), env)).json()).data;
  assert.equal((await commandCenter()).facts.income_minor, 0);

  let response = await worker.fetch(request("/api/v1/financial-transactions/inc-1/collect", { email: "finance@a.test", body: { payment_method: "havale", reference: "DEK-77", settled_on: "2026-08-05" } }), env);
  assert.equal(response.status, 200);
  let data = (await response.json()).data;
  assert.equal(data.status, "collected");
  assert.equal(data.payment_method, "havale");
  assert.equal(data.reference, "DEK-77");
  // Tarih kendi sütununa yazılıyor (göç 0019), tahakkuk tarihinin
  // (`transaction_date`) üzerine yazılmıyor: o hareketin hangi döneme ait
  // olduğunu söyler ve bütün tarih bazlı raporlar ona dayanıyor.
  assert.equal(data.transaction_date, "2026-08-01");
  assert.equal(data.settled_on, "2026-08-05");
  assert.equal(data.settled_by, "finance-a");
  // Aynı bilgi ikinci bir yerde durmuyor; iki kopya er geç ayrışır.
  assert.deepEqual(data.metadata_json, {});

  const auditRow = database.prepare("SELECT action,entity_type,entity_id,user_id,changes_json FROM audit_logs WHERE action='collect'").get();
  assert.equal(auditRow.entity_type, "financial-transactions");
  assert.equal(auditRow.entity_id, "inc-1");
  assert.equal(auditRow.user_id, "finance-a");
  assert.deepEqual(JSON.parse(auditRow.changes_json), { from: "approved", to: "collected", settled_on: "2026-08-05", payment_method: "havale", reference: "DEK-77" });

  response = await worker.fetch(request("/api/v1/financial-transactions/exp-1/pay", { email: "finance@a.test" }), env);
  assert.equal(response.status, 200);
  data = (await response.json()).data;
  assert.equal(data.status, "paid");
  // Tarih verilmediğinde sunucu bugünü yazar; ödeme de tahsilatla aynı sütun
  // çiftini kullanır, bir hareket ikisinden yalnız birine ulaşabildiği için.
  assert.match(data.settled_on, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(data.settled_by, "finance-a");

  // Vadesi geçmiş alacak da bu uçtan kapanır: kayıt `approved` durumundadır,
  // vadesinin geçmiş olması onu ayrı bir kümeye taşımaz.
  assert.equal((await worker.fetch(request("/api/v1/financial-transactions/inc-2/collect", { email: "finance@a.test" }), env)).status, 200);

  // Aynı kayıt iki kez tahsil edilemez: ikinci istek ne kaydı ne denetim izini
  // değiştirir, ilk tahsilatın ödeme yöntemi de ezilmez.
  response = await worker.fetch(request("/api/v1/financial-transactions/inc-1/collect", { email: "finance@a.test", body: { payment_method: "nakit" } }), env);
  assert.equal(response.status, 200);
  const replay = await response.json();
  assert.equal(replay.meta.replayed, true);
  assert.equal(replay.data.payment_method, "havale");
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE action='collect' AND entity_id='inc-1'").get().count, 1);

  // Tahsil edilen kayıt kârlılık görünümüne gerçekten giriyor ve komuta merkezi
  // artık görünümle aynı şeyi söylüyor.
  const view = database.prepare("SELECT collected_minor,expense_minor FROM project_profitability WHERE id='project-a'").get();
  assert.equal(view.collected_minor, 460_000);
  assert.equal(view.expense_minor, 120_000);
  assert.equal((await commandCenter()).facts.income_minor, view.collected_minor);
});

test("collect and pay refuse the wrong direction, unsettled records and other tenants", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-1", "Otel lobisi", "production", timestamp, timestamp);
  database.prepare("INSERT INTO tenants (id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)").run("tenant-b", "Firma B", "firma-b", timestamp, timestamp);
  seedFinanceRole(database);
  const insertFinance = financeInserter(database);
  insertFinance("inc-approved", "F-1", "income", "approved", 50_000);
  insertFinance("inc-draft", "F-2", "income", "draft", 50_000);
  insertFinance("inc-cancelled", "F-3", "income", "cancelled", 50_000);
  insertFinance("exp-approved", "F-4", "expense", "approved", 50_000);
  insertFinance("forecast-1", "F-5", "cost_forecast", "approved", 50_000);
  insertFinance("inc-reversed", "F-6", "income", "approved", 50_000);
  financeInserter(database, "tenant-b")("inc-other", "F-7", "income", "approved", 50_000, null);

  const call = async (id, action, options = {}) => worker.fetch(request(`/api/v1/financial-transactions/${id}/${action}`, { email: "finance@a.test", ...options }), env);
  const refuses = async (id, action, status, expectedStatus = 409) => {
    const response = await call(id, action);
    assert.equal(response.status, expectedStatus, `${id}/${action} ${expectedStatus} dönmeli`);
    if (status) assert.equal(database.prepare("SELECT status FROM financial_transactions WHERE id=?").get(id).status, status);
  };

  // Tür kuralı: gelir tahsil edilir, gider ödenir. Gideri "tahsil edildi"
  // yapmak anlamsızdır ve tahsilat toplamını gideri kadar şişirirdi.
  await refuses("exp-approved", "collect", "approved");
  await refuses("inc-approved", "pay", "approved");
  // Maliyet tahmini gerçekleşmiş bir hareket değildir; iki uç da kapalı.
  await refuses("forecast-1", "collect", "approved");
  await refuses("forecast-1", "pay", "approved");
  // Kesinleşmemiş ve iptal edilmiş hareket kapanamaz: önce onaylanmalı.
  await refuses("inc-draft", "collect", "draft");
  await refuses("inc-cancelled", "collect", "cancelled");

  // Ters kayıt olmuş asli hareket de, düzeltme fişinin kendisi de tahsil
  // edilemez: ikisi de kasadan geçmedi.
  const reversal = await (await call("inc-reversed", "reverse", { body: { reason: "Hatalı kayıt" } })).json();
  await refuses("inc-reversed", "collect", "reversed");
  await refuses(reversal.meta.reversed_transaction_id, "collect", "approved");

  // Başka firmanın kaydı yok sayılır, yetkisiz kullanıcı kapıda durur.
  await refuses("inc-other", "collect", "approved", 404);
  database.prepare("INSERT INTO users (id,email,full_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("clerk-a", "clerk@a.test", "Kayıt Memuru", "active", timestamp, timestamp);
  database.prepare("INSERT INTO roles (id,tenant_id,code,name,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("role-clerk", "tenant-a", "clerk", "Kayıt Memuru", timestamp, timestamp);
  for (const permission of ["financial-transactions.read", "financial-transactions.write"]) database.prepare("INSERT INTO role_permissions (tenant_id,role_id,permission_code) VALUES (?,?,?)").run("tenant-a", "role-clerk", permission);
  database.prepare("INSERT INTO memberships (id,tenant_id,user_id,role_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("member-clerk", "tenant-a", "clerk-a", "role-clerk", "active", timestamp, timestamp);
  let response = await worker.fetch(request("/api/v1/financial-transactions/inc-approved/collect", { email: "clerk@a.test" }), env);
  assert.equal(response.status, 403);
  assert.equal(database.prepare("SELECT status FROM financial_transactions WHERE id='inc-approved'").get().status, "approved");
  // Reddedilen isteklerin hiçbiri denetim kaydı bırakmadı; yalnız ters kayıt yazdı.
  assert.deepEqual(database.prepare("SELECT DISTINCT action FROM audit_logs ORDER BY action").all().map((row) => row.action), ["reverse"]);

  // Tahsil edilmiş kayıt kesinleşmiştir: tutarı değiştirilemez, silinemez.
  // Düzeltmenin tek yolu ters kayıttır ve o yol açık kalmalıdır.
  assert.equal((await call("inc-approved", "collect")).status, 200);
  assert.equal((await worker.fetch(request("/api/v1/financial-transactions/inc-approved", { method: "PATCH", body: { amount_minor: 1 } }), env)).status, 409);
  assert.equal((await worker.fetch(request("/api/v1/financial-transactions/inc-approved", { method: "DELETE" }), env)).status, 409);
  assert.equal(database.prepare("SELECT amount_minor FROM financial_transactions WHERE id='inc-approved'").get().amount_minor, 50_000);
  response = await call("inc-approved", "reverse", { body: { reason: "Tahsilat yanlış kaydedildi" } });
  assert.equal(response.status, 201);
  assert.equal(database.prepare("SELECT status FROM financial_transactions WHERE id='inc-approved'").get().status, "reversed");
});

// Ters kayıt, düzeltmeyi iki kez saymamalı. Asli kayıt `reversed` olup
// toplamdan düşerken düzeltme fişi eksi tutarıyla toplama giriyordu: 300.000
// onaylı gider ters kaydedildiğinde maliyet sıfıra değil -300.000'e gidiyor,
// proje 600.000 TL daha kârlı görünüyordu. Aynı hata tahsilat, alacak, borç ve
// maliyet kırılımı toplamlarında da vardı; bu test hepsini birden tutuyor.
test("reversing a finance record nets every total back to zero", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,contract_amount_minor,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-1", "Otel lobisi", "production", 1_000_000, timestamp, timestamp);
  database.prepare("INSERT INTO work_items (id,tenant_id,project_id,space_name,description,quantity,unit_cost_minor,status,revision_no,revision_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run("work-a", "tenant-a", "project-a", "Lobi", "Resepsiyon bankosu", 1, 400_000, "planned", 1, "approved", timestamp, timestamp);
  seedFinanceRole(database);
  const insertFinance = financeInserter(database);
  insertFinance("inc-1", "F-1", "income", "approved", 400_000);
  insertFinance("inc-2", "F-2", "income", "approved", 250_000);
  // Gider, satın alma siparişine bağlı: sipariş ters kayıttan sonra yeniden
  // "faturalanmamış taahhüt" olmalı, fişin referansı onu kapatmaya devam
  // etmemeli.
  database.prepare("INSERT INTO suppliers (id,tenant_id,code,name,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("supplier-a", "tenant-a", "S-1", "Tedarikçi A", timestamp, timestamp);
  database.prepare("INSERT INTO purchase_orders (id,tenant_id,order_number,project_id,supplier_id,grand_total_minor,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run("po-1", "tenant-a", "SA-1", "project-a", "supplier-a", 300_000, "ordered", timestamp, timestamp);
  database.prepare("INSERT INTO financial_transactions (id,tenant_id,transaction_number,project_id,work_item_id,supplier_id,reference,type,transaction_date,amount_minor,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").run("exp-1", "tenant-a", "F-3", "project-a", "work-a", "supplier-a", "SA-1", "expense", "2026-08-01", 300_000, "approved", timestamp, timestamp);
  // İş kalemine bağlanmamış genel gider: kırılımda ayrı kovaya düşüyor.
  insertFinance("exp-2", "F-4", "expense", "approved", 100_000);
  assert.equal((await worker.fetch(request("/api/v1/financial-transactions/inc-1/collect", { email: "finance@a.test" }), env)).status, 200);

  const readAll = async () => {
    const dashboard = (await (await worker.fetch(request("/api/v1/dashboard", { method: "GET" }), env)).json()).data;
    const center = (await (await worker.fetch(request("/api/v1/projects/project-a/command-center", { method: "GET" }), env)).json()).data;
    const breakdown = (await (await worker.fetch(request("/api/v1/projects/project-a/cost-breakdown", { method: "GET" }), env)).json()).data;
    return {
      receivables: dashboard.receivables.amount_minor,
      payables: dashboard.payables.amount_minor,
      income: center.facts.income_minor,
      expense: center.facts.expense_minor,
      realisedProfit: center.finance.realisedProfitMinor,
      invoicedPurchase: center.facts.invoiced_purchase_minor,
      openCommitment: center.finance.openCommitmentMinor,
      breakdownActual: breakdown.totals.actual_cost_minor,
      view: { ...database.prepare("SELECT collected_minor,expense_minor,margin_minor FROM project_profitability WHERE id='project-a'").get() },
    };
  };

  const before = await readAll();
  assert.deepEqual(before, {
    receivables: 250_000, payables: 400_000, income: 400_000, expense: 400_000,
    realisedProfit: 600_000, breakdownActual: 400_000,
    invoicedPurchase: 300_000, openCommitment: 0,
    view: { collected_minor: 400_000, expense_minor: 400_000, margin_minor: 600_000 },
  });

  for (const transactionId of ["inc-1", "inc-2", "exp-1", "exp-2"]) {
    const response = await worker.fetch(request(`/api/v1/financial-transactions/${transactionId}/reverse`, { email: "finance@a.test", body: { reason: "Yanlış kaydedildi" } }), env);
    assert.equal(response.status, 201, `${transactionId} ters kaydedilebilmeli`);
  }
  // Fişler kayıt olarak duruyor: iz kaybolmadı, yalnız toplamlara girmiyorlar.
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM financial_transactions WHERE tenant_id='tenant-a' AND reversal_of_id IS NOT NULL").get().count, 4);

  const after = await readAll();
  assert.deepEqual(after, {
    receivables: 0, payables: 0, income: 0, expense: 0,
    realisedProfit: 1_000_000, breakdownActual: 0,
    invoicedPurchase: 0, openCommitment: 300_000,
    view: { collected_minor: 0, expense_minor: 0, margin_minor: 1_000_000 },
  });
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
    assert.deepEqual(manifest.migrations, await migrationFiles());
    assert.equal(manifest.schema_version, manifest.migrations.length);
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

test("request fallback creates at most one daily tenant backup and scheduled reuses it", async () => {
  const { database, env } = await setup();
  const objects = new Map();
  env.FILES = { async put(key, value) { objects.set(key, String(value)); } };
  const pending = [];
  const context = { waitUntil(promise) { pending.push(promise); } };
  const first = await worker.fetch(request("/api/v1/session", { method: "GET" }), env, context);
  assert.equal(first.status, 200);
  await Promise.all(pending.splice(0));
  const second = await worker.fetch(request("/api/v1/session", { method: "GET" }), env, context);
  assert.equal(second.status, 200);
  await Promise.all(pending.splice(0));
  await worker.scheduled({}, env, { waitUntil(promise) { pending.push(promise); } });
  await Promise.all(pending.splice(0));
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM backup_runs WHERE tenant_id='tenant-a' AND backup_date=date('now')").get().count, 1);
  assert.equal(objects.size, 1);
  const manifest = JSON.parse([...objects.values()][0].split("\n")[0]);
  assert.equal(manifest.tenant_id, "tenant-a");
  assert.equal(manifest.schema_version, (await migrationFiles()).length);
});

test("owner can create, rotate and revoke hashed expiring API tokens", async () => {
  const { database, env } = await setup();
  let response = await worker.fetch(request("/api/v1/tokens", { body: { name: "Entegrasyon", expires_in_days: 30 } }), env);
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.match(created.data.token, /^cap_[a-f0-9]{64}$/);
  assert.equal(created.meta.secret_visible_once, true);
  const stored = database.prepare("SELECT token_hash,expires_at FROM api_tokens WHERE id=?").get(created.data.id);
  assert.notEqual(stored.token_hash, created.data.token);
  assert.equal(stored.token_hash.length, 64);
  assert.ok(new Date(stored.expires_at) > new Date());

  response = await worker.fetch(new Request("https://example.test/api/v1/session", { headers: { authorization: `Bearer ${created.data.token}`, "x-tenant-id": "tenant-a" } }), env);
  assert.equal(response.status, 200);
  response = await worker.fetch(request(`/api/v1/tokens/${created.data.id}/rotate`, { body: { expires_in_days: 60 } }), env);
  assert.equal(response.status, 201);
  const rotated = await response.json();
  assert.notEqual(rotated.data.token, created.data.token);
  assert.ok(database.prepare("SELECT revoked_at FROM api_tokens WHERE id=?").get(created.data.id).revoked_at);

  response = await worker.fetch(new Request("https://example.test/api/v1/session", { headers: { authorization: `Bearer ${created.data.token}`, "x-tenant-id": "tenant-a" } }), env);
  assert.equal(response.status, 401);
  response = await worker.fetch(new Request("https://example.test/api/v1/session", { headers: { authorization: `Bearer ${rotated.data.token}`, "x-tenant-id": "tenant-a" } }), env);
  assert.equal(response.status, 200);
  response = await worker.fetch(request(`/api/v1/tokens/${rotated.data.id}/revoke`), env);
  assert.equal(response.status, 200);
  assert.ok(database.prepare("SELECT revoked_at FROM api_tokens WHERE id=?").get(rotated.data.id).revoked_at);

  response = await worker.fetch(request("/api/v1/tokens", { method: "GET" }), env);
  const listed = await response.json();
  assert.equal(listed.data.length, 2);
  assert.equal(listed.data.some((token) => "token" in token || "token_hash" in token), false);
});

test("Capproje survey, contract, design and progress-payment workflows are enforced", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,customer_id,name,status,photo_consent,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-DOM", "customer-a", "Otel Projesi", "contracted", "internal_only", timestamp, timestamp);
  let response = await worker.fetch(request("/api/v1/site-surveys", { body: { project_id: "project-a", customer_id: "customer-a", survey_number: "K-1", survey_date: "2026-08-09", location: "Lobi" } }), env);
  const survey = (await response.json()).data;
  assert.equal(response.status, 200);
  response = await worker.fetch(request("/api/v1/survey-measurements", { body: { site_survey_id: survey.id, space_name: "Lobi", element_type: "door", width: 90, height: 210, quantity: 4, unit: "adet" } }), env);
  const measurement = (await response.json()).data;
  for (const status of ["in_progress", "completed", "approved"]) assert.equal((await worker.fetch(request(`/api/v1/site-surveys/${survey.id}/transition`, { body: { status } }), env)).status, 200);
  assert.equal((await worker.fetch(request(`/api/v1/survey-measurements/${measurement.id}`, { method: "PATCH", body: { quantity: 5 } }), env)).status, 409);

  response = await worker.fetch(request("/api/v1/contracts", { body: { contract_number: "S-1", project_id: "project-a", customer_id: "customer-a", payment_model: "progress_payment", contract_amount_minor: 1_000_000, advance_amount_minor: 100_000, retention_amount_minor: 50_000, warranty_months: 24, photo_consent: "internal_only" } }), env);
  const contract = (await response.json()).data;
  assert.equal((await worker.fetch(request(`/api/v1/contracts/${contract.id}/transition`, { body: { status: "pending_signature" } }), env)).status, 200);
  assert.equal((await worker.fetch(request(`/api/v1/contracts/${contract.id}/transition`, { body: { status: "signed", signed_by_customer: "Otel Yetkilisi", signed_by_company: "Capproje" } }), env)).status, 200);

  response = await worker.fetch(request("/api/v1/design-revisions", { body: { project_id: "project-a", revision_number: 1, drawing_type: "shop_drawing", title: "Lobi Kapıları" } }), env);
  const revision = (await response.json()).data;
  assert.equal((await worker.fetch(request(`/api/v1/design-revisions/${revision.id}/submit`), env)).status, 200);
  assert.equal((await worker.fetch(request(`/api/v1/design-revisions/${revision.id}/approve`, { body: { client_name: "Otel Yetkilisi" } }), env)).status, 200);

  response = await worker.fetch(request("/api/v1/progress-payments", { body: { progress_number: "H-1", project_id: "project-a", contract_id: contract.id, period_start: "2026-08-01", period_end: "2026-08-31", previous_work_minor: 0, current_work_minor: 200_000, cumulative_work_minor: 200_000, retention_minor: 10_000, tax_minor: 38_000, net_payable_minor: 228_000 } }), env);
  const progress = (await response.json()).data;
  assert.equal((await worker.fetch(request(`/api/v1/progress-payments/${progress.id}/submit`), env)).status, 200);
  assert.equal((await worker.fetch(request(`/api/v1/progress-payments/${progress.id}/approve`), env)).status, 200);
  assert.equal(database.prepare("SELECT status FROM progress_payments WHERE id=?").get(progress.id).status, "approved");
});

test("posted stock movements update quantity atomically and reject insufficient stock", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-STK", "Stok Projesi", "production", timestamp, timestamp);
  let response = await worker.fetch(request("/api/v1/inventory-items", { body: { sku: "MDF-18", name: "18mm MDF", unit: "levha", average_cost_minor: 250000 } }), env);
  const item = (await response.json()).data;
  response = await worker.fetch(request("/api/v1/stock-movements", { body: { movement_number: "ST-1", inventory_item_id: item.id, movement_type: "receipt", movement_date: "2026-08-09", quantity: 10, unit_cost_minor: 250000 } }), env);
  const receipt = (await response.json()).data;
  assert.equal((await worker.fetch(request(`/api/v1/stock-movements/${receipt.id}/post`), env)).status, 200);
  assert.equal(database.prepare("SELECT on_hand_quantity FROM inventory_items WHERE id=?").get(item.id).on_hand_quantity, 10);

  response = await worker.fetch(request("/api/v1/stock-movements", { body: { movement_number: "ST-2", inventory_item_id: item.id, project_id: "project-a", movement_type: "project_issue", movement_date: "2026-08-09", quantity: 12, unit_cost_minor: 250000 } }), env);
  const excessive = (await response.json()).data;
  assert.equal((await worker.fetch(request(`/api/v1/stock-movements/${excessive.id}/post`), env)).status, 409);
  assert.equal(database.prepare("SELECT on_hand_quantity FROM inventory_items WHERE id=?").get(item.id).on_hand_quantity, 10);
  assert.equal(database.prepare("SELECT status FROM stock_movements WHERE id=?").get(excessive.id).status, "draft");
});

test("material planning reserves available stock, opens only the shortage purchase request and reports capacity conflicts", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-MAT", "Malzeme Projesi", "design", timestamp, timestamp);
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("project-b", "tenant-a", "P-KAP", "Kapasite Projesi", "production", timestamp, timestamp);

  let response = await worker.fetch(request("/api/v1/inventory-items", { body: { sku: "MDF-18-MAT", name: "18mm MDF", unit: "plaka" } }), env);
  const inventory = (await response.json()).data;
  database.prepare("UPDATE inventory_items SET on_hand_quantity=10 WHERE id=?").run(inventory.id);

  response = await worker.fetch(request("/api/v1/material-requirements", { body: { project_id: "project-a", inventory_item_id: inventory.id, item_code: "MDF-18", description: "Meşe desen MDF", required_quantity: 15, unit: "plaka", needed_by: "2026-08-20" } }), env);
  assert.equal(response.status, 200);
  const requirement = (await response.json()).data;

  response = await worker.fetch(request(`/api/v1/material-requirements/${requirement.id}/reserve`, { body: {} }), env);
  assert.equal(response.status, 200);
  assert.equal(database.prepare("SELECT reserved_quantity FROM inventory_items WHERE id=?").get(inventory.id).reserved_quantity, 10);
  let requirementRow = database.prepare("SELECT reserved_quantity,ordered_quantity,status FROM material_requirements WHERE id=?").get(requirement.id);
  assert.equal(requirementRow.reserved_quantity, 10);
  assert.equal(requirementRow.ordered_quantity, 0);
  assert.equal(requirementRow.status, "shortage");

  response = await worker.fetch(request(`/api/v1/material-requirements/${requirement.id}/create-purchase-request`, { body: {} }), env);
  assert.equal(response.status, 201);
  const purchase = (await response.json()).data;
  assert.equal(purchase.quantity, 5);
  assert.equal(purchase.status, "pending");
  requirementRow = database.prepare("SELECT reserved_quantity,ordered_quantity,status,purchase_request_id FROM material_requirements WHERE id=?").get(requirement.id);
  assert.equal(requirementRow.reserved_quantity, 10);
  assert.equal(requirementRow.ordered_quantity, 5);
  assert.equal(requirementRow.status, "covered");
  assert.equal(requirementRow.purchase_request_id, purchase.id);
  response = await worker.fetch(request(`/api/v1/material-requirements/${requirement.id}/create-purchase-request`, { body: {} }), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).meta.replayed, true);

  for (const [id, projectId, allocation] of [["capacity-a", "project-a", 70], ["capacity-b", "project-b", 50]]) {
    database.prepare("INSERT INTO resource_assignments (id,tenant_id,project_id,resource_type,resource_name,planned_start,planned_end,allocation_percent,status,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(id, "tenant-a", projectId, "work_center", "CNC-01", "2026-08-10", "2026-08-15", allocation, "planned", "{}", timestamp, timestamp);
  }
  response = await worker.fetch(request("/api/v1/dashboard", { method: "GET" }), env);
  assert.equal((await response.json()).data.attention.capacity_conflicts, 1);
  response = await worker.fetch(request("/api/v1/projects/project-a/command-center", { method: "GET" }), env);
  const commandCenter = (await response.json()).data;
  assert.equal(commandCenter.facts.material_requirement_total, 1);
  assert.equal(commandCenter.facts.material_shortage_count, 0);
  assert.equal(commandCenter.facts.capacity_conflict_count, 1);
});

test("contextual media links project evidence safely and enforces photo consent", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,photo_consent,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-FOTO", "Fotoğraf Projesi", "installation", "internal_only", timestamp, timestamp);
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,photo_consent,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run("project-b", "tenant-a", "P-DIGER", "Diğer Proje", "production", "marketing_allowed", timestamp, timestamp);
  database.prepare("INSERT INTO work_items (id,tenant_id,project_id,item_code,description,unit,quantity,status,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run("work-a", "tenant-a", "project-a", "KAPI-01", "Lobi kapısı", "adet", 2, "approved", "{}", timestamp, timestamp);
  database.prepare("INSERT INTO work_items (id,tenant_id,project_id,item_code,description,unit,quantity,status,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run("work-b", "tenant-a", "project-b", "DOLAP-01", "Oda dolabı", "adet", 1, "approved", "{}", timestamp, timestamp);
  const objects = new Map();
  env.FILES = {
    async put(key, value) { objects.set(key, value); },
    async get(key) { return objects.has(key) ? { body: objects.get(key), httpEtag: "test-etag" } : null; },
    async delete(key) { objects.delete(key); },
  };

  const upload = async ({ projectId = "project-a", workItemId = "work-a", visibility = "customer" } = {}) => {
    const form = new FormData();
    form.set("file", new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }), "montaj.jpg");
    form.set("entity_type", "work-items");
    form.set("entity_id", workItemId);
    form.set("project_id", projectId);
    form.set("work_item_id", workItemId);
    form.set("category", "installation_evidence");
    form.set("space_name", "Lobi");
    form.set("capture_stage", "installation");
    form.set("taken_at", "2026-08-10T12:30");
    form.set("visibility", visibility);
    return worker.fetch(new Request("https://example.test/api/v1/files/upload", { method: "POST", headers: { "x-user-email": "owner@a.test", "x-tenant-id": "tenant-a" }, body: form }), env);
  };

  let response = await upload({ workItemId: "work-b" });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, "project_context_mismatch");
  response = await upload({ visibility: "marketing" });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "photo_consent_required");
  assert.equal(objects.size, 0);

  response = await upload();
  assert.equal(response.status, 201);
  const media = (await response.json()).data;
  const stored = database.prepare("SELECT project_id,work_item_id,space_name,capture_stage,visibility,photo_consent_snapshot FROM files WHERE id=?").get(media.id);
  assert.equal(stored.project_id, "project-a");
  assert.equal(stored.work_item_id, "work-a");
  assert.equal(stored.space_name, "Lobi");
  assert.equal(stored.capture_stage, "installation");
  assert.equal(stored.visibility, "customer");
  assert.equal(stored.photo_consent_snapshot, "internal_only");
  assert.equal(objects.size, 1);

  response = await worker.fetch(request(`/api/v1/files/${media.id}/content`, { method: "GET" }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/jpeg");
  assert.match(response.headers.get("content-disposition"), /^inline;/);
  assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; sandbox");
  response = await worker.fetch(request("/api/v1/projects/project-a/command-center", { method: "GET" }), env);
  const commandCenter = (await response.json()).data;
  assert.equal(commandCenter.facts.file_total, 1);
  assert.equal(commandCenter.facts.photo_total, 1);
  assert.equal(commandCenter.recentMedia[0].space_name, "Lobi");
  database.prepare("INSERT INTO files (id,tenant_id,entity_type,entity_id,file_name,object_key,content_type,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run("unsafe-html", "tenant-a", "projects", "project-a", "unsafe.html", "tenant-a/unsafe.html", "text/html", timestamp, timestamp);
  objects.set("tenant-a/unsafe.html", "<script>document.cookie</script>");
  response = await worker.fetch(request("/api/v1/files/unsafe-html/content", { method: "GET" }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/octet-stream");
  assert.match(response.headers.get("content-disposition"), /^attachment;/);
});

test("meeting, quality and signed handover records follow tenant-audited lifecycles", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-TES", "Teslim Projesi", "installation", timestamp, timestamp);
  let response = await worker.fetch(request("/api/v1/project-meetings", { body: { project_id: "project-a", meeting_type: "weekly_production", meeting_date: "2026-08-09", title: "Haftalık Üretim" } }), env);
  const meeting = (await response.json()).data;
  response = await worker.fetch(request("/api/v1/meeting-actions", { body: { meeting_id: meeting.id, project_id: "project-a", title: "Kapı kalite kontrolü", due_date: "2026-08-10" } }), env);
  assert.equal(response.status, 200);
  assert.equal((await worker.fetch(request(`/api/v1/project-meetings/${meeting.id}/transition`, { body: { status: "published" } }), env)).status, 200);

  response = await worker.fetch(request("/api/v1/quality-inspections", { body: { inspection_number: "KK-1", project_id: "project-a", inspection_type: "final", inspection_date: "2026-08-09", checklist_json: [{ item: "ölçü", ok: true }] } }), env);
  const inspection = (await response.json()).data;
  assert.equal((await worker.fetch(request(`/api/v1/quality-inspections/${inspection.id}/transition`, { body: { status: "completed", result: "pass" } }), env)).status, 200);

  database.prepare("INSERT INTO files (id,tenant_id,entity_type,entity_id,file_name,object_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run("signature-a", "tenant-a", "handover", "pending", "imza.png", "tenant-a/signature-a", timestamp, timestamp);
  response = await worker.fetch(request("/api/v1/handovers", { body: { handover_number: "T-1", project_id: "project-a", handover_date: "2026-08-09", customer_contact: "Otel Yetkilisi" } }), env);
  const handover = (await response.json()).data;
  response = await worker.fetch(request(`/api/v1/handovers/${handover.id}/transition`, { body: { status: "accepted", satisfaction_score: 5, customer_signature_file_id: "signature-a" } }), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.satisfaction_score, 5);
});

test("sensitive write fields are server-gated and official finance filtering is scoped", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO users (id,email,full_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("editor-a", "editor@a.test", "Editör", "active", timestamp, timestamp);
  database.prepare("INSERT INTO roles (id,tenant_id,code,name,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("role-editor", "tenant-a", "editor", "Editör", timestamp, timestamp);
  for (const permission of ["projects.read","projects.write","employees.read","employees.write","accounts.read","accounts.write","financial-transactions.read","financial-transactions.write","invoices.read","invoices.write"]) database.prepare("INSERT INTO role_permissions (tenant_id,role_id,permission_code) VALUES (?,?,?)").run("tenant-a", "role-editor", permission);
  database.prepare("INSERT INTO memberships (id,tenant_id,user_id,role_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("member-editor", "tenant-a", "editor-a", "role-editor", "active", timestamp, timestamp);

  assert.equal((await worker.fetch(request("/api/v1/projects", { email: "editor@a.test", body: { code: "P-COST", name: "Gizli", estimated_cost_minor: 1000 } }), env)).status, 403);
  assert.equal((await worker.fetch(request("/api/v1/employees", { email: "editor@a.test", body: { employee_number: "E-2", first_name: "Ali", last_name: "Usta", salary_amount_minor: 1000 } }), env)).status, 403);
  assert.equal((await worker.fetch(request("/api/v1/accounts", { email: "editor@a.test", body: { code: "B-1", name: "Banka", type: "bank", iban: "TR00" } }), env)).status, 403);
  assert.equal((await worker.fetch(request("/api/v1/financial-transactions", { email: "editor@a.test", body: { transaction_number: "F-O", type: "income", transaction_date: "2026-08-09", amount_minor: 1000, official: true } }), env)).status, 403);
  let response = await worker.fetch(request("/api/v1/financial-transactions", { email: "editor@a.test", body: { transaction_number: "F-U", type: "income", transaction_date: "2026-08-09", amount_minor: 1000 } }), env);
  assert.equal(response.status, 200);
  assert.equal(database.prepare("SELECT official FROM financial_transactions WHERE transaction_number='F-U'").get().official, 0);
  response = await worker.fetch(request("/api/v1/financial-transactions", { body: { transaction_number: "F-R", type: "income", transaction_date: "2026-08-09", amount_minor: 2000, official: true } }), env);
  assert.equal(response.status, 200);
  response = await worker.fetch(request("/api/v1/financial-transactions?official=0", { method: "GET" }), env);
  const filtered = await response.json();
  assert.deepEqual(filtered.data.map((row) => row.transaction_number), ["F-U"]);

  const catalog = database.prepare("SELECT code FROM permissions").all().map((row) => row.code);
  for (const code of ["suppliers.delete","projects.transition","cost.view","salary.view","hr.sensitive.read","finance.sensitive.read","backups.manage","tokens.manage","stock-movements.post","handovers.transition"]) assert.ok(catalog.includes(code), `${code} permission katalogunda olmalı`);
});
