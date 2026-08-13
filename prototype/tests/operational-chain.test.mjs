import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import worker from "../worker/index.js";

const migrationsDirectory = new URL("../migrations/", import.meta.url);
const timestamp = "2026-08-09T10:00:00.000Z";

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

async function setup({ extraUsers = [] } = {}) {
  const database = new DatabaseSync(":memory:");
  for (const name of (await readdir(migrationsDirectory)).filter((item) => /^\d{4}_.+\.sql$/.test(item)).sort()) {
    database.exec(await readFile(new URL(name, migrationsDirectory), "utf8"));
  }
  database.prepare("INSERT INTO tenants (id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)").run("tenant-a", "Firma A", "firma-a", timestamp, timestamp);
  database.prepare("INSERT INTO users (id,email,full_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("owner-a", "owner@a.test", "Firma Sahibi", "active", timestamp, timestamp);
  database.prepare("INSERT INTO roles (id,tenant_id,code,name,is_system,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("role-owner", "tenant-a", "owner", "Firma Sahibi", 1, timestamp, timestamp);
  database.prepare("INSERT INTO memberships (id,tenant_id,user_id,role_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("member-a", "tenant-a", "owner-a", "role-owner", "active", timestamp, timestamp);

  for (const user of extraUsers) {
    database.prepare("INSERT INTO users (id,email,full_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run(user.id, user.email, user.name, "active", timestamp, timestamp);
    database.prepare("INSERT INTO roles (id,tenant_id,code,name,is_system,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(`role-${user.id}`, "tenant-a", user.roleCode, user.roleCode, 0, timestamp, timestamp);
    database.prepare("INSERT INTO memberships (id,tenant_id,user_id,role_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(`member-${user.id}`, "tenant-a", user.id, `role-${user.id}`, "active", timestamp, timestamp);
    for (const code of user.permissions || []) {
      database.prepare("INSERT OR IGNORE INTO role_permissions (tenant_id,role_id,permission_code) VALUES (?,?,?)").run("tenant-a", `role-${user.id}`, code);
    }
  }
  return { database, env: { DB: new D1Database(database), ALLOW_DEV_AUTH: "true" } };
}

function request(path, { method = "POST", body, tenant = "tenant-a", email = "owner@a.test", headers = {} } = {}) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("x-user-email", email);
  requestHeaders.set("x-tenant-id", tenant);
  if (body !== undefined) requestHeaders.set("content-type", "application/json");
  return new Request(`https://example.test${path}`, { method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body) });
}

function seedProductionProject(database) {
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-1", "Proje", "production", timestamp, timestamp);
  database.prepare("INSERT INTO work_items (id,tenant_id,project_id,description,status,revision_no,revision_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run("work-a", "tenant-a", "project-a", "Kapı", "approved", 1, "approved", timestamp, timestamp);
  database.prepare("INSERT INTO production_orders (id,tenant_id,order_number,project_id,work_item_id,quantity,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run("order-a", "tenant-a", "U-1", "project-a", "work-a", 4, "planned", timestamp, timestamp);
}

test("a released production order can be driven to completed and unblocks the installation gate", async () => {
  const { database, env } = await setup();
  seedProductionProject(database);

  assert.equal((await worker.fetch(request("/api/v1/production-orders/order-a/release"), env)).status, 200);

  // Salımdan tamamlanmaya doğrudan geçilemez; ara aşama zorunludur.
  let response = await worker.fetch(request("/api/v1/production-orders/order-a/transition", { body: { status: "completed" } }), env);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "invalid_transition");

  assert.equal((await worker.fetch(request("/api/v1/production-orders/order-a/transition", { body: { status: "in_progress" } }), env)).status, 200);
  assert.equal(database.prepare("SELECT status FROM work_items WHERE id='work-a'").get().status, "production");

  response = await worker.fetch(request("/api/v1/production-orders/order-a/transition", { body: { status: "completed", completed_quantity: 9 } }), env);
  assert.equal(response.status, 422, "planlanandan fazla miktar tamamlanamaz");

  response = await worker.fetch(request("/api/v1/production-orders/order-a/transition", { body: { status: "completed" } }), env);
  assert.equal(response.status, 200);
  const order = database.prepare("SELECT status,completed_quantity,completed_at,completed_by FROM production_orders WHERE id='order-a'").get();
  assert.equal(order.status, "completed");
  assert.equal(order.completed_quantity, 4, "miktar verilmediğinde planlanan miktarın tamamı üretilmiş sayılır");
  assert.equal(order.completed_by, "owner-a");
  assert.ok(order.completed_at);
  assert.equal(database.prepare("SELECT status FROM work_items WHERE id='work-a'").get().status, "completed");

  // Tekrar gönderim durumu bozmaz.
  assert.equal((await worker.fetch(request("/api/v1/production-orders/order-a/transition", { body: { status: "completed" } }), env)).status, 200);

  const commandCenter = await (await worker.fetch(request("/api/v1/projects/project-a/command-center", { method: "GET" }), env)).json();
  assert.equal(commandCenter.data.facts.production_done, 1);
  assert.equal(commandCenter.data.facts.production_total, 1);
  const productionCheck = commandCenter.data.stages.find((stage) => stage.status === "installation").checks.find((check) => check.id === "production_complete");
  assert.equal(productionCheck.passed, true, "üretim tamamlandığında montaj kapısı açılmalı");
});

test("cancelling a production order requires a reason and records it", async () => {
  const { database, env } = await setup();
  seedProductionProject(database);
  let response = await worker.fetch(request("/api/v1/production-orders/order-a/transition", { body: { status: "cancelled" } }), env);
  assert.equal(response.status, 422);
  response = await worker.fetch(request("/api/v1/production-orders/order-a/transition", { body: { status: "cancelled", reason: "Müşteri vazgeçti" } }), env);
  assert.equal(response.status, 200);
  assert.equal(database.prepare("SELECT cancel_reason FROM production_orders WHERE id='order-a'").get().cancel_reason, "Müşteri vazgeçti");
});

test("a failed stock reservation leaves neither the inventory nor the requirement changed", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-1", "Proje", "design", timestamp, timestamp);
  database.prepare("INSERT INTO inventory_items (id,tenant_id,sku,name,unit,on_hand_quantity,reserved_quantity,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run("inv-a", "tenant-a", "MDF-18", "18mm MDF", "plaka", 5, 5, "active", timestamp, timestamp);
  database.prepare("INSERT INTO material_requirements (id,tenant_id,project_id,inventory_item_id,description,required_quantity,unit,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run("mat-a", "tenant-a", "project-a", "inv-a", "MDF", 10, "plaka", "draft", timestamp, timestamp);

  const response = await worker.fetch(request("/api/v1/material-requirements/mat-a/reserve", { body: {} }), env);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "insufficient_stock");

  const inventory = database.prepare("SELECT on_hand_quantity,reserved_quantity FROM inventory_items WHERE id='inv-a'").get();
  assert.equal(inventory.reserved_quantity, 5, "rezerve miktar değişmemeli");
  const requirement = database.prepare("SELECT reserved_quantity,status FROM material_requirements WHERE id='mat-a'").get();
  assert.equal(requirement.reserved_quantity, 0, "stok ayrılamadıysa ihtiyaç kaydı da değişmemeli");
  assert.equal(requirement.status, "draft");
});

test("reserved material can be consumed into production or released back to stock", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-1", "Proje", "production", timestamp, timestamp);
  database.prepare("INSERT INTO inventory_items (id,tenant_id,sku,name,unit,on_hand_quantity,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run("inv-a", "tenant-a", "MDF-18", "18mm MDF", "plaka", 20, "active", timestamp, timestamp);
  database.prepare("INSERT INTO material_requirements (id,tenant_id,project_id,inventory_item_id,description,required_quantity,unit,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run("mat-a", "tenant-a", "project-a", "inv-a", "MDF", 8, "plaka", "draft", timestamp, timestamp);

  assert.equal((await worker.fetch(request("/api/v1/material-requirements/mat-a/reserve", { body: {} }), env)).status, 200);
  assert.equal(database.prepare("SELECT reserved_quantity FROM inventory_items WHERE id='inv-a'").get().reserved_quantity, 8);

  assert.equal((await worker.fetch(request("/api/v1/material-requirements/mat-a/release", { body: { quantity: 3 } }), env)).status, 200);
  assert.equal(database.prepare("SELECT reserved_quantity FROM inventory_items WHERE id='inv-a'").get().reserved_quantity, 5);
  assert.equal(database.prepare("SELECT reserved_quantity,status FROM material_requirements WHERE id='mat-a'").get().status, "shortage");

  assert.equal((await worker.fetch(request("/api/v1/material-requirements/mat-a/consume", { body: {} }), env)).status, 200);
  const inventory = database.prepare("SELECT on_hand_quantity,reserved_quantity FROM inventory_items WHERE id='inv-a'").get();
  assert.equal(inventory.reserved_quantity, 0, "tüketilen malzemenin rezervasyonu kapanmalı");
  assert.equal(inventory.on_hand_quantity, 15, "tüketilen malzeme stoktan düşmeli");
  const requirement = database.prepare("SELECT status,consumed_quantity,reserved_quantity FROM material_requirements WHERE id='mat-a'").get();
  assert.equal(requirement.status, "consumed");
  assert.equal(requirement.consumed_quantity, 5);
  assert.equal(requirement.reserved_quantity, 0);
});

test("stock issue cannot eat into another project's reservation", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO inventory_items (id,tenant_id,sku,name,unit,on_hand_quantity,reserved_quantity,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run("inv-a", "tenant-a", "MDF-18", "18mm MDF", "plaka", 10, 8, "active", timestamp, timestamp);
  database.prepare("INSERT INTO stock_movements (id,tenant_id,movement_number,inventory_item_id,movement_type,movement_date,quantity,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run("mov-a", "tenant-a", "S-1", "inv-a", "issue", "2026-08-09", 5, "draft", timestamp, timestamp);

  let response = await worker.fetch(request("/api/v1/stock-movements/mov-a/post"), env);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "stock_reserved");
  assert.equal(database.prepare("SELECT status FROM stock_movements WHERE id='mov-a'").get().status, "draft");

  // Projeye çıkış rezervasyonu tüketir ve geçerlidir.
  database.prepare("UPDATE stock_movements SET movement_type='project_issue' WHERE id='mov-a'").run();
  response = await worker.fetch(request("/api/v1/stock-movements/mov-a/post"), env);
  assert.equal(response.status, 200);
  const inventory = database.prepare("SELECT on_hand_quantity,reserved_quantity FROM inventory_items WHERE id='inv-a'").get();
  assert.equal(inventory.on_hand_quantity, 5);
  assert.equal(inventory.reserved_quantity, 3);
});

test("an approved purchase request becomes an order and goods receipt updates stock and coverage", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-1", "Proje", "procurement", timestamp, timestamp);
  database.prepare("INSERT INTO suppliers (id,tenant_id,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("sup-a", "tenant-a", "Tedarikçi", "active", timestamp, timestamp);
  database.prepare("INSERT INTO inventory_items (id,tenant_id,sku,name,unit,on_hand_quantity,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run("inv-a", "tenant-a", "MDF-18", "18mm MDF", "plaka", 0, "active", timestamp, timestamp);
  database.prepare("INSERT INTO material_requirements (id,tenant_id,project_id,inventory_item_id,description,required_quantity,unit,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run("mat-a", "tenant-a", "project-a", "inv-a", "MDF", 6, "plaka", "draft", timestamp, timestamp);

  const purchase = await (await worker.fetch(request("/api/v1/material-requirements/mat-a/create-purchase-request", { body: {} }), env)).json();
  const requestId = purchase.data.id;
  database.prepare("UPDATE purchase_requests SET preferred_supplier_id='sup-a' WHERE id=?").run(requestId);

  // Onaylanmadan sipariş açılamaz.
  let response = await worker.fetch(request(`/api/v1/purchase-requests/${requestId}/create-order`, { body: {} }), env);
  assert.equal(response.status, 409);

  assert.equal((await worker.fetch(request(`/api/v1/purchase-requests/${requestId}/approve`), env)).status, 200);
  response = await worker.fetch(request(`/api/v1/purchase-requests/${requestId}/create-order`, { body: {} }), env);
  assert.equal(response.status, 201);
  const order = (await response.json()).data;
  assert.equal(order.status, "ordered");
  assert.equal(order.supplier_id, "sup-a");
  assert.equal(database.prepare("SELECT status FROM purchase_requests WHERE id=?").get(requestId).status, "ordered");

  // Tekrar çağrı aynı siparişi döndürür.
  response = await worker.fetch(request(`/api/v1/purchase-requests/${requestId}/create-order`, { body: {} }), env);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).meta.replayed, true);

  response = await worker.fetch(request(`/api/v1/purchase-orders/${order.id}/receive`, { body: { inventory_item_id: "inv-a", quantity: 6 } }), env);
  assert.equal(response.status, 200);
  assert.equal(database.prepare("SELECT on_hand_quantity FROM inventory_items WHERE id='inv-a'").get().on_hand_quantity, 6);
  assert.equal(database.prepare("SELECT received_quantity FROM material_requirements WHERE id='mat-a'").get().received_quantity, 6);
  assert.equal(database.prepare("SELECT status,received_by FROM purchase_orders WHERE id=?").get(order.id).received_by, "owner-a");
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM stock_movements WHERE source_id=? AND status='posted'").get(order.id).count, 1);
});

test("granular permission codes are honoured and the catalog is served from the database", async () => {
  const { env } = await setup({ extraUsers: [{ id: "user-pm", email: "pm@a.test", name: "Proje Yöneticisi", roleCode: "pm", permissions: ["projects.read", "files.read", "files.write"] }] });
  const as = { email: "pm@a.test" };

  // files.write tek başına yüklemeye yetmeli; önceden yalnız files.manage kabul ediliyordu.
  const catalog = await (await worker.fetch(request("/api/v1/permissions", { method: "GET", ...as }), env)).json();
  assert.ok(catalog.data.some((item) => item.code === "files.write"));
  assert.ok(catalog.data.some((item) => item.code === "project-communications.read"), "katalog veritabanındaki tüm yetkileri içermeli");
  assert.deepEqual(catalog.meta.implied["files.manage"], ["files.read", "files.write", "files.delete"]);

  // files.write tek başına yükleme kapısını geçmeli; hata artık yetkiden değil
  // yapılandırılmamış dosya deposundan gelir.
  const upload = await worker.fetch(request("/api/v1/files/upload", { ...as, body: undefined, method: "POST" }), env);
  assert.equal(upload.status, 503);
  assert.equal((await upload.json()).error.code, "storage_unavailable");

  // Yetkisi olmayan kullanıcı aynı uçtan 403 alır.
  const denied = await worker.fetch(request("/api/v1/files/upload", { email: "owner@a.test", body: undefined, method: "POST" }), { ...env, FILES: undefined });
  assert.notEqual(denied.status, 403, "firma sahibi her zaman geçebilmeli");
});

test("cross-origin mutations are allowed only for explicitly trusted origins", async () => {
  const { env } = await setup();
  const build = () => new Request("https://example.test/api/v1/customers", {
    method: "POST",
    headers: { "content-type": "application/json", "x-user-email": "owner@a.test", "x-tenant-id": "tenant-a", origin: "https://cap.taslak.online" },
    body: JSON.stringify({ name: "Güvenilen kaynak" }),
  });
  assert.equal((await worker.fetch(build(), env)).status, 403);
  assert.equal((await worker.fetch(build(), { ...env, ALLOWED_ORIGINS: "cap.taslak.online" })).status, 200);
});

test("origin checks compare hosts so a missing X-Forwarded-Proto cannot lock out writes", async () => {
  const { env } = await setup();
  // Vekil sunucu şemayı iletmediğinde istek URL'i http, tarayıcı Origin'i https olur.
  const mismatchedScheme = new Request("http://cap.taslak.online/api/v1/customers", {
    method: "POST",
    headers: { "content-type": "application/json", "x-user-email": "owner@a.test", "x-tenant-id": "tenant-a", origin: "https://cap.taslak.online" },
    body: JSON.stringify({ name: "Vekil arkasından" }),
  });
  assert.equal((await worker.fetch(mismatchedScheme, env)).status, 200);
});

test("system roles cannot be granted or edited by a non-owner user manager", async () => {
  const { env } = await setup({ extraUsers: [{ id: "user-hr", email: "hr@a.test", name: "İK", roleCode: "hr_admin", permissions: ["memberships.read", "memberships.write", "roles.read", "roles.write", "roles.manage"] }] });
  const as = { email: "hr@a.test" };

  let response = await worker.fetch(request("/api/v1/memberships", { ...as, body: { user_id: "user-hr", role_id: "role-owner" } }), env);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "privileged_role_forbidden");

  response = await worker.fetch(request("/api/v1/roles", { ...as, body: { code: "admin", name: "Sahte Yönetici" } }), env);
  assert.equal(response.status, 403);

  response = await worker.fetch(request("/api/v1/roles/role-owner/permissions", { ...as, method: "PUT", body: { permissions: [] } }), env);
  assert.equal(response.status, 403);
});

test("membership references are validated and resolved to a readable user", async () => {
  const { env } = await setup();
  let response = await worker.fetch(request("/api/v1/memberships", { body: { user_id: "does-not-exist", role_id: "role-owner" } }), env);
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, "cross_tenant_reference");

  response = await worker.fetch(request("/api/v1/memberships", { method: "GET" }), env);
  const rows = (await response.json()).data;
  assert.equal(rows[0].user_name, "Firma Sahibi");
  assert.equal(rows[0].user_email, "owner@a.test");
});

test("legacy status fields reject values outside the canonical set", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-1", "Proje", "production", timestamp, timestamp);

  let response = await worker.fetch(request("/api/v1/installations", { body: { installation_number: "M-1", project_id: "project-a", status: "Teslim edildi" } }), env);
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, "validation_error");

  response = await worker.fetch(request("/api/v1/installations", { body: { installation_number: "M-1", project_id: "project-a", status: "completed" } }), env);
  assert.equal(response.status, 200);

  // Veritabanı tetikleyicisi de aynı kümeyi zorunlu kılar.
  assert.throws(() => database.prepare("UPDATE installations SET status='rastgele' WHERE id IS NOT NULL").run(), /invalid status/);
});

test("oversized text fields are rejected before reaching the database", async () => {
  const { env } = await setup();
  const response = await worker.fetch(request("/api/v1/customers", { body: { name: "x".repeat(2001) } }), env);
  assert.equal(response.status, 422);
  assert.match((await response.json()).error.message, /en fazla 2000 karakter/);
});

test("list search escapes LIKE wildcards", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO customers (id,tenant_id,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("cus-a", "tenant-a", "Ahmet Yapı", "active", timestamp, timestamp);
  database.prepare("INSERT INTO customers (id,tenant_id,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("cus-b", "tenant-a", "100% Ahşap", "active", timestamp, timestamp);

  let rows = (await (await worker.fetch(request("/api/v1/customers?q=%25", { method: "GET" }), env)).json()).data;
  assert.equal(rows.length, 1, "yüzde işareti joker değil, aranan karakter olmalı");
  assert.equal(rows[0].id, "cus-b");

  rows = (await (await worker.fetch(request("/api/v1/customers?q=Ahmet", { method: "GET" }), env)).json()).data;
  assert.equal(rows.length, 1);
});

test("a stalled idempotency record is released instead of blocking the key forever", async () => {
  const { database, env } = await setup();
  const stale = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  database.prepare("INSERT INTO idempotency_records (id,tenant_id,user_id,idempotency_key,method,path,created_at) VALUES (?,?,?,?,?,?,?)")
    .run("idem-stuck", "tenant-a", "owner-a", "capproje:customers:create:stuck", "POST", "/api/v1/customers", stale);

  const response = await worker.fetch(request("/api/v1/customers", { body: { name: "Yeni Müşteri" }, headers: { "idempotency-key": "capproje:customers:create:stuck" } }), env);
  assert.equal(response.status, 200, "süresi geçmiş yarım kayıt isteği kilitlememeli");
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM customers").get().count, 1);

  // Taze bir yarım kayıt hâlâ eşzamanlılığı korur.
  database.prepare("INSERT INTO idempotency_records (id,tenant_id,user_id,idempotency_key,method,path,created_at) VALUES (?,?,?,?,?,?,?)")
    .run("idem-fresh", "tenant-a", "owner-a", "capproje:customers:create:fresh", "POST", "/api/v1/customers", new Date().toISOString());
  const blocked = await worker.fetch(request("/api/v1/customers", { body: { name: "İkinci" }, headers: { "idempotency-key": "capproje:customers:create:fresh" } }), env);
  assert.equal(blocked.status, 409);
  assert.equal((await blocked.json()).error.code, "idempotency_in_progress");
});

test("an invited user must change the temporary password before writing data", async () => {
  const { database, env } = await setup();
  env.PASSWORD_AUTH_ENABLED = "true";
  env.PASSWORD_AUTH_PEPPER = "test-pepper-at-least-16-characters";

  const invite = await worker.fetch(request("/api/v1/memberships/invite", {
    body: { email: "yeni@a.test", full_name: "Yeni Kullanıcı", phone: "05321234567", temporary_password: "gecici123", role_ids: ["role-owner"] },
  }), env);
  assert.equal(invite.status, 201);
  assert.equal(database.prepare("SELECT must_change_password FROM users WHERE email='yeni@a.test'").get().must_change_password, 1);

  const as = { email: "yeni@a.test" };
  database.prepare("UPDATE users SET status='active' WHERE email='yeni@a.test'").run();
  database.prepare("UPDATE memberships SET status='active' WHERE user_id=(SELECT id FROM users WHERE email='yeni@a.test')").run();

  const session = await (await worker.fetch(request("/api/v1/session", { method: "GET", ...as }), env)).json();
  assert.equal(session.data.must_change_password, true);

  let response = await worker.fetch(request("/api/v1/customers", { ...as, body: { name: "Yazamamalı" } }), env);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "password_change_required");

  response = await worker.fetch(request("/api/v1/auth/password/change", { ...as, body: { current_password: "gecici123", new_password: "yenisifre1" } }), env);
  assert.equal(response.status, 200);
  assert.equal(database.prepare("SELECT must_change_password FROM users WHERE email='yeni@a.test'").get().must_change_password, 0);

  response = await worker.fetch(request("/api/v1/customers", { ...as, body: { name: "Artık yazabilir" } }), env);
  assert.equal(response.status, 200);
});

test("password change rejects weak passwords and a wrong current password", async () => {
  const { database, env } = await setup();
  env.PASSWORD_AUTH_ENABLED = "true";
  env.PASSWORD_AUTH_PEPPER = "test-pepper-at-least-16-characters";
  await worker.fetch(request("/api/v1/memberships/invite", {
    body: { email: "yeni@a.test", full_name: "Yeni", phone: "05321234567", temporary_password: "gecici123", role_ids: ["role-owner"] },
  }), env);
  database.prepare("UPDATE users SET status='active' WHERE email='yeni@a.test'").run();
  database.prepare("UPDATE memberships SET status='active' WHERE user_id=(SELECT id FROM users WHERE email='yeni@a.test')").run();
  const as = { email: "yeni@a.test" };

  let response = await worker.fetch(request("/api/v1/auth/password/change", { ...as, body: { current_password: "gecici123", new_password: "sadeceharf" } }), env);
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, "weak_password");

  response = await worker.fetch(request("/api/v1/auth/password/change", { ...as, body: { current_password: "yanlis123", new_password: "yenisifre1" } }), env);
  assert.equal(response.status, 401);
});

test("signing in on a second device does not close the first one", async () => {
  const { database, env } = await setup();
  env.PASSWORD_AUTH_ENABLED = "true";
  env.PASSWORD_AUTH_PEPPER = "test-pepper-at-least-16-characters";
  await worker.fetch(request("/api/v1/memberships/invite", {
    body: { email: "saha@a.test", full_name: "Saha", phone: "05321112233", temporary_password: "gecici123", role_ids: ["role-owner"] },
  }), env);

  const login = () => worker.fetch(new Request("https://example.test/api/v1/auth/password/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://example.test" },
    body: JSON.stringify({ phone: "05321112233", password: "gecici123" }),
  }), env);

  assert.equal((await login()).status, 200);
  assert.equal((await login()).status, 200);
  const active = database.prepare("SELECT COUNT(*) AS count FROM phone_sessions WHERE revoked_at IS NULL").get().count;
  assert.equal(active, 2, "telefon ve masaüstü aynı anda açık kalabilmeli");
});

test("cookie-authenticated mutations require a same-origin request", async () => {
  const { env } = await setup();
  const crossOrigin = new Request("https://example.test/api/v1/customers", {
    method: "POST",
    headers: { "content-type": "application/json", "x-user-email": "owner@a.test", "x-tenant-id": "tenant-a", origin: "https://kotu.test" },
    body: JSON.stringify({ name: "Sahte" }),
  });
  const response = await worker.fetch(crossOrigin, env);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "origin_forbidden");
});

test("CSV export is gated by the export capability and escapes formula injection", async () => {
  const { database, env } = await setup({ extraUsers: [{ id: "user-view", email: "view@a.test", name: "Okuyucu", roleCode: "viewer", permissions: ["customers.read"] }] });
  database.prepare("INSERT INTO customers (id,tenant_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("cus-a", "tenant-a", "C-1", "=1+1", "active", timestamp, timestamp);

  let response = await worker.fetch(request("/api/v1/customers/export", { method: "GET", email: "view@a.test" }), env);
  assert.equal(response.status, 403);

  response = await worker.fetch(request("/api/v1/customers/export", { method: "GET" }), env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/csv/);
  const csv = await response.text();
  assert.match(csv, /"'=1\+1"/, "formül olarak yorumlanabilecek değerler kaçırılmalı");
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM audit_logs WHERE action='export'").get().count, 1);
});

test("project profitability separates realised cost from open commitment", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,contract_amount_minor,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-1", "Proje", "production", 1_000_000, timestamp, timestamp);
  database.prepare("INSERT INTO suppliers (id,tenant_id,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("sup-a", "tenant-a", "Tedarikçi", "active", timestamp, timestamp);
  database.prepare("INSERT INTO purchase_orders (id,tenant_id,order_number,project_id,supplier_id,grand_total_minor,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run("po-paid", "tenant-a", "PO-1", "project-a", "sup-a", 200_000, "received", timestamp, timestamp);
  database.prepare("INSERT INTO purchase_orders (id,tenant_id,order_number,project_id,supplier_id,grand_total_minor,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run("po-open", "tenant-a", "PO-2", "project-a", "sup-a", 150_000, "ordered", timestamp, timestamp);
  // Faturası kesilmiş sipariş zaten gider hareketi olarak var; taahhüde ikinci kez eklenmemeli.
  database.prepare("INSERT INTO financial_transactions (id,tenant_id,transaction_number,project_id,supplier_id,type,transaction_date,amount_minor,reference,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run("fin-a", "tenant-a", "F-1", "project-a", "sup-a", "expense", "2026-08-09", 200_000, "PO-1", "paid", timestamp, timestamp);

  const data = (await (await worker.fetch(request("/api/v1/projects/project-a/command-center", { method: "GET" }), env)).json()).data;
  assert.equal(data.finance.actualCostMinor, 200_000);
  assert.equal(data.finance.openCommitmentMinor, 150_000, "yalnız faturası kesilmemiş sipariş taahhüt sayılır");
  assert.equal(data.finance.forecastCostMinor, 350_000);
  assert.equal(data.finance.estimatedProfitMinor, 650_000);
  assert.equal(data.finance.realisedProfitMinor, 800_000);
});

test("capacity conflicts are detected from total overlapping allocation, not just pairs", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-1", "Proje", "production", timestamp, timestamp);
  for (const [id, allocation] of [["cap-a", 40], ["cap-b", 40], ["cap-c", 40]]) {
    database.prepare("INSERT INTO resource_assignments (id,tenant_id,project_id,resource_type,resource_name,planned_start,planned_end,allocation_percent,status,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(id, "tenant-a", "project-a", "work_center", "CNC-01", "2026-08-10", "2026-08-15", allocation, "planned", "{}", timestamp, timestamp);
  }
  const dashboard = (await (await worker.fetch(request("/api/v1/dashboard", { method: "GET" }), env)).json()).data;
  assert.equal(dashboard.attention.capacity_conflicts, 1, "üç ayrı %40 atama tek kaynakta çakışma sayılır");
});

test("receivables include approved but uncollected income", async () => {
  const { database, env } = await setup();
  for (const [id, number, status, amount] of [["f1", "F-1", "planned", 10_000], ["f2", "F-2", "approved", 20_000], ["f3", "F-3", "collected", 30_000]]) {
    database.prepare("INSERT INTO financial_transactions (id,tenant_id,transaction_number,type,transaction_date,amount_minor,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(id, "tenant-a", number, "income", "2026-08-09", amount, status, timestamp, timestamp);
  }
  const dashboard = (await (await worker.fetch(request("/api/v1/dashboard", { method: "GET" }), env)).json()).data;
  assert.equal(dashboard.receivables.amount_minor, 30_000, "tahsil edilmemiş gelirlerin tamamı alacaktır");
});

test("every migration statement survives the Turso splitter and applies in isolation", async () => {
  const { migrationFileNames, migrationStatements } = await import("../scripts/migrate-turso.mjs");
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys=ON");
  for (const name of await migrationFileNames()) {
    const statements = await migrationStatements(name);
    assert.ok(statements.length, `${name} en az bir statement üretmeli`);
    for (const statement of statements) {
      // Tetikleyici gövdesi yanlış bölünürse dosyanın kalanı tek statement'a
      // yapışır ve bu çalıştırma sözdizimi hatasıyla düşer.
      try { database.exec(statement); }
      catch (error) { assert.fail(`${name} içindeki statement uygulanamadı: ${error.message}\n${statement.slice(0, 200)}`); }
    }
  }
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM permissions").get().count > 60, true);
  database.close();
});

test("password login is enabled by a valid pepper alone and health reports configuration gaps", async () => {
  const { env } = await setup();
  const health = async (extra) => (await (await worker.fetch(new Request("https://example.test/api/v1/health"), { ...env, ...extra })).json()).data;

  // Yalnızca pepper tanımlıyken giriş açılmalı; ayrı bir bayrak beklemek
  // kurulumu sessizce "giriş yapılamaz" durumda bırakıyordu.
  let data = await health({ PASSWORD_AUTH_PEPPER: "yeterince-uzun-bir-pepper" });
  assert.equal(data.password_auth, true);
  assert.equal(data.bootstrap_ready, false);

  // Kısa pepper yeterli değildir.
  data = await health({ PASSWORD_AUTH_PEPPER: "kisa" });
  assert.equal(data.password_auth, false);

  // Açıkça kapatılabilir.
  data = await health({ PASSWORD_AUTH_PEPPER: "yeterince-uzun-bir-pepper", PASSWORD_AUTH_ENABLED: "false" });
  assert.equal(data.password_auth, false);

  data = await health({ PASSWORD_AUTH_PEPPER: "yeterince-uzun-bir-pepper", BOOTSTRAP_SECRET: "s3cret" });
  assert.equal(data.bootstrap_ready, true);
  assert.equal(data.setup_required, false, "kurulum yapilmis tenant varken false olmali");
});

test("the session cookie adapts to the request scheme so plain-HTTP deployments still work", async () => {
  const { database, env } = await setup();
  env.PASSWORD_AUTH_PEPPER = "test-pepper-at-least-16-characters";
  await worker.fetch(request("/api/v1/memberships/invite", {
    body: { email: "saha@a.test", full_name: "Saha", phone: "05321112233", temporary_password: "gecici123", role_ids: ["role-owner"] },
  }), env);
  database.prepare("UPDATE users SET status='active' WHERE email='saha@a.test'").run();
  database.prepare("UPDATE memberships SET status='active' WHERE user_id=(SELECT id FROM users WHERE email='saha@a.test')").run();

  const login = (origin) => worker.fetch(new Request(`${origin}/api/v1/auth/password/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ phone: "05321112233", password: "gecici123" }),
  }), env);

  const secure = await login("https://cap.example");
  assert.equal(secure.status, 200);
  const secureCookie = secure.headers.getSetCookie()[0];
  assert.match(secureCookie, /^__Host-capproje_session=/);
  assert.match(secureCookie, /Secure/);

  // Düz HTTP'de Secure çerez tarayıcıda saklanmaz; bu yüzden ad ve bayrak değişir.
  const plain = await login("http://cap.example");
  assert.equal(plain.status, 200);
  const plainCookie = plain.headers.getSetCookie()[0];
  assert.match(plainCookie, /^capproje_session=/);
  assert.doesNotMatch(plainCookie, /Secure/);
  assert.match(plainCookie, /HttpOnly/);
  assert.match(plainCookie, /SameSite=Lax/);

  // Her iki çerez adı da kimlik doğrulamada kabul edilmelidir.
  const token = decodeURIComponent(plainCookie.split(";")[0].split("=")[1]);
  for (const name of ["capproje_session", "__Host-capproje_session"]) {
    const session = await worker.fetch(new Request("http://cap.example/api/v1/session", { headers: { cookie: `${name}=${token}` } }), env);
    assert.equal(session.status, 200, `${name} ile oturum okunabilmeli`);
  }

  // Çıkışta iki ad da temizlenir.
  const logout = await worker.fetch(new Request("http://cap.example/api/v1/auth/logout", { method: "POST", headers: { origin: "http://cap.example", cookie: `capproje_session=${token}` } }), env);
  const cleared = logout.headers.getSetCookie();
  assert.equal(cleared.length, 2);
  assert.ok(cleared.every((cookie) => /Max-Age=0/.test(cookie)));
  const afterLogout = await worker.fetch(new Request("http://cap.example/api/v1/session", { headers: { cookie: `capproje_session=${token}` } }), env);
  assert.equal(afterLogout.status, 401, "cikis sonrasi oturum gecersiz olmali");
});

test("a session survives a browser that refuses to store the cookie", async () => {
  const { database, env } = await setup();
  env.PASSWORD_AUTH_PEPPER = "test-pepper-at-least-16-characters";
  await worker.fetch(request("/api/v1/memberships/invite", {
    body: { email: "montaj@a.test", full_name: "Montaj", phone: "05321114455", temporary_password: "gecici123", role_ids: ["role-owner"] },
  }), env);
  database.prepare("UPDATE users SET status='active' WHERE email='montaj@a.test'").run();
  database.prepare("UPDATE memberships SET status='active' WHERE user_id=(SELECT id FROM users WHERE email='montaj@a.test')").run();

  const login = await worker.fetch(new Request("https://cap.example/api/v1/auth/password/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://cap.example" },
    body: JSON.stringify({ phone: "05321114455", password: "gecici123" }),
  }), env);
  assert.equal(login.status, 200);
  const token = (await login.json()).data.session_token;
  assert.ok(token, "giris yaniti yedek oturum jetonunu tasimali");

  // Tarayıcı çerezi hiç saklamamış olsa bile aynı jeton başlıkla çalışmalı.
  const session = await worker.fetch(new Request("https://cap.example/api/v1/session", {
    headers: { "x-session-token": token },
  }), env);
  assert.equal(session.status, 200, "cerez olmadan basliktaki jetonla oturum acilmali");

  // İptal edilmiş bir API anahtarı geçerli tarayıcı oturumunu bloke etmemeli.
  const withStaleBearer = await worker.fetch(new Request("https://cap.example/api/v1/session", {
    headers: { "x-session-token": token, authorization: "Bearer cap_gecersiz_anahtar" },
  }), env);
  assert.equal(withStaleBearer.status, 200, "gecersiz Bearer anahtari cerez/baslik yolunu kapatmamali");

  const rejected = await worker.fetch(new Request("https://cap.example/api/v1/session", {
    headers: { "x-session-token": "cps_sahte" },
  }), env);
  assert.equal(rejected.status, 401, "sahte jeton kabul edilmemeli");

  // Veritabanı yeniden kurulduğunda tarayıcıda kalan firma kimliği geçersizdir.
  // Bu, yetki hatasından ayrı bir koddur; istemci bunu görüp seçimi sıfırlar.
  const stale = await worker.fetch(new Request("https://cap.example/api/v1/session", {
    headers: { "x-session-token": token, "x-tenant-id": "ten_00000000-0000-4000-8000-000000000000" },
  }), env);
  assert.equal(stale.status, 403);
  assert.equal((await stale.json()).error.code, "tenant_forbidden");

  // Firma kimliği gönderilmediğinde sunucu doğru firmayı kendisi seçmelidir.
  const recovered = await worker.fetch(new Request("https://cap.example/api/v1/session", {
    headers: { "x-session-token": token },
  }), env);
  assert.equal(recovered.status, 200, "bayat firma kimligi temizlenince oturum acilmali");
});

test("a user with no membership is told what to do instead of being denied", async () => {
  const { database, env } = await setup();
  env.PASSWORD_AUTH_PEPPER = "test-pepper-at-least-16-characters";
  await worker.fetch(request("/api/v1/memberships/invite", {
    body: { email: "bosta@a.test", full_name: "Uyeliksiz", phone: "05321116677", temporary_password: "gecici123", role_ids: ["role-owner"] },
  }), env);
  database.prepare("UPDATE users SET status='active' WHERE email='bosta@a.test'").run();
  database.prepare("UPDATE memberships SET status='active' WHERE user_id=(SELECT id FROM users WHERE email='bosta@a.test')").run();
  const login = await worker.fetch(new Request("https://cap.example/api/v1/auth/password/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://cap.example" },
    body: JSON.stringify({ phone: "05321116677", password: "gecici123" }),
  }), env);
  const token = (await login.json()).data.session_token;

  database.prepare("DELETE FROM memberships WHERE user_id=(SELECT id FROM users WHERE email='bosta@a.test')").run();
  const session = await worker.fetch(new Request("https://cap.example/api/v1/session", {
    headers: { "x-session-token": token },
  }), env);
  assert.equal(session.status, 403);
  const body = await session.json();
  assert.equal(body.error.code, "no_membership");
  assert.match(body.error.message, /davet/i, "kullaniciya ne yapmasi gerektigi soylenmeli");
});
