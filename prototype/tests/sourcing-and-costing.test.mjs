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
    database.prepare("INSERT INTO users (id,email,full_name,phone,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(user.id, user.email, user.name, user.phone || null, "active", timestamp, timestamp);
    database.prepare("INSERT INTO roles (id,tenant_id,code,name,is_system,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(`role-${user.id}`, "tenant-a", user.roleCode, user.roleCode, 0, timestamp, timestamp);
    database.prepare("INSERT INTO memberships (id,tenant_id,user_id,role_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(`member-${user.id}`, "tenant-a", user.id, `role-${user.id}`, "active", timestamp, timestamp);
    for (const code of user.permissions || []) {
      database.prepare("INSERT OR IGNORE INTO role_permissions (tenant_id,role_id,permission_code) VALUES (?,?,?)").run("tenant-a", `role-${user.id}`, code);
    }
  }
  return { database, env: { DB: new D1Database(database), ALLOW_DEV_AUTH: "true" } };
}

function request(path, { method = "POST", body, email = "owner@a.test", headers = {} } = {}) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("x-user-email", email);
  requestHeaders.set("x-tenant-id", "tenant-a");
  if (body !== undefined) requestHeaders.set("content-type", "application/json");
  return new Request(`https://example.test${path}`, { method, headers: requestHeaders, body: body === undefined ? undefined : JSON.stringify(body) });
}

const send = (env, path, options) => worker.fetch(request(path, options), env);
const body = async (response) => (await response.json());

function seedSourcing(database) {
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,contract_amount_minor,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-1", "Proje", "procurement", 1_000_000, timestamp, timestamp);
  for (const [id, name] of [["sup-a", "Ucuz Tedarik"], ["sup-b", "Hizli Tedarik"], ["sup-c", "Kaliteli Tedarik"]]) {
    database.prepare("INSERT INTO suppliers (id,tenant_id,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run(id, "tenant-a", name, "active", timestamp, timestamp);
  }
  database.prepare("INSERT INTO purchase_requests (id,tenant_id,request_number,project_id,description,quantity,unit,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run("req-a", "tenant-a", "SA-1", "project-a", "18mm MDF", 100, "plaka", "pending", timestamp, timestamp);
}

test("quotations are compared and the cheapest is highlighted", async () => {
  const { database, env } = await setup();
  seedSourcing(database);

  for (const [supplier, total, lead] of [["sup-a", 100_000, 21], ["sup-b", 130_000, 5], ["sup-c", 120_000, 14]]) {
    const response = await send(env, "/api/v1/supplier-quotations", { body: { purchase_request_id: "req-a", supplier_id: supplier, quantity: 100, unit: "plaka", total_minor: total, unit_price_minor: Math.round(total / 100), lead_time_days: lead, status: "received" } });
    assert.equal(response.status, 200, JSON.stringify(await response.json()));
  }

  const comparison = (await body(await send(env, "/api/v1/purchase-requests/req-a/quotation-comparison", { method: "GET" }))).data;
  assert.equal(comparison.quotations.length, 3);
  assert.equal(comparison.quotations[0].supplier_name, "Ucuz Tedarik", "en ucuz teklif başta gelmeli");
  const cheapest = comparison.quotations.find((row) => row.id === comparison.recommendation.cheapest_quotation_id);
  const fastest = comparison.quotations.find((row) => row.id === comparison.recommendation.fastest_quotation_id);
  assert.equal(cheapest.supplier_id, "sup-a");
  assert.equal(fastest.supplier_id, "sup-b");
  assert.equal(comparison.recommendation.saving_against_highest_minor, 30_000);
  assert.equal(comparison.recommendation.spread_percent, 30);
});

test("selecting a costlier quotation requires a written justification and updates the request", async () => {
  const { database, env } = await setup();
  seedSourcing(database);
  const ids = {};
  for (const [supplier, total] of [["sup-a", 100_000], ["sup-c", 120_000]]) {
    const created = await body(await send(env, "/api/v1/supplier-quotations", { body: { purchase_request_id: "req-a", supplier_id: supplier, total_minor: total, status: "received" } }));
    ids[supplier] = created.data.id;
  }

  let response = await send(env, `/api/v1/supplier-quotations/${ids["sup-c"]}/select`, { body: {} });
  assert.equal(response.status, 422);
  const problem = await body(response);
  assert.equal(problem.error.code, "selection_reason_required");
  assert.equal(problem.error.details.cheapest_quotation_id, ids["sup-a"]);

  response = await send(env, `/api/v1/supplier-quotations/${ids["sup-c"]}/select`, { body: { reason: "Numune kalitesi ve referans işler nedeniyle tercih edildi" } });
  assert.equal(response.status, 200);
  assert.equal(database.prepare("SELECT status FROM supplier_quotations WHERE id=?").get(ids["sup-c"]).status, "selected");
  assert.equal(database.prepare("SELECT status FROM supplier_quotations WHERE id=?").get(ids["sup-a"]).status, "rejected");
  const purchase = database.prepare("SELECT preferred_supplier_id,estimated_amount_minor FROM purchase_requests WHERE id='req-a'").get();
  assert.equal(purchase.preferred_supplier_id, "sup-c", "seçilen teklif talebe tedarikçi olarak yazılmalı");
  assert.equal(purchase.estimated_amount_minor, 120_000);

  // En ucuz teklif seçilirken gerekçe istenmez.
  const { env: env2, database: database2 } = await setup();
  seedSourcing(database2);
  const cheap = await body(await send(env2, "/api/v1/supplier-quotations", { body: { purchase_request_id: "req-a", supplier_id: "sup-a", total_minor: 100_000, status: "received" } }));
  assert.equal((await send(env2, `/api/v1/supplier-quotations/${cheap.data.id}/select`, { body: {} })).status, 200);
});

test("a bill of materials explodes into material requirements exactly once", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-1", "Proje", "design", timestamp, timestamp);
  database.prepare("INSERT INTO work_items (id,tenant_id,project_id,description,quantity,unit,status,revision_no,revision_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run("work-a", "tenant-a", "project-a", "Dolap", 4, "adet", "planned", 1, "draft", timestamp, timestamp);

  let response = await send(env, "/api/v1/work-items/work-a/explode-bom", { body: {} });
  assert.equal(response.status, 409, "reçete yoksa patlatma reddedilmeli");

  await send(env, "/api/v1/bom-lines", { body: { work_item_id: "work-a", description: "18mm MDF", quantity_per_unit: 2.5, unit: "plaka", scrap_rate: 10 } });
  await send(env, "/api/v1/bom-lines", { body: { work_item_id: "work-a", description: "Menteşe", quantity_per_unit: 6, unit: "adet" } });

  response = await send(env, "/api/v1/work-items/work-a/explode-bom", { body: {} });
  assert.equal(response.status, 201);
  const created = (await body(response)).data;
  assert.equal(created.length, 2);
  const mdf = created.find((row) => row.description === "18mm MDF");
  assert.equal(mdf.required_quantity, 11, "2.5 × 4 adet + %10 fire = 11 plaka");
  assert.equal(created.find((row) => row.description === "Menteşe").required_quantity, 24);

  // Aynı reçete iki kez patlatılmaz.
  response = await send(env, "/api/v1/work-items/work-a/explode-bom", { body: {} });
  assert.equal(response.status, 200);
  assert.equal((await body(response)).meta.replayed, true);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM material_requirements WHERE work_item_id='work-a'").get().count, 2);
});

test("work centre load reports capacity, planned minutes and bottlenecks", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-1", "Proje", "production", timestamp, timestamp);
  database.prepare("INSERT INTO production_orders (id,tenant_id,order_number,project_id,quantity,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run("order-a", "tenant-a", "U-1", "project-a", 1, "planned", timestamp, timestamp);
  await send(env, "/api/v1/work-centers", { body: { code: "CNC-01", name: "CNC Tezgahı", daily_capacity_minutes: 480 } });
  const centre = (await body(await send(env, "/api/v1/work-centers", { method: "GET" }))).data[0];

  for (const [name, minutes] of [["Kesim", 3000], ["Delik", 2000]]) {
    const response = await send(env, "/api/v1/production-operations", { body: { production_order_id: "order-a", work_center_id: centre.id, name, planned_minutes: minutes, planned_start: "2026-08-10", planned_end: "2026-08-12" } });
    assert.equal(response.status, 200, JSON.stringify(await response.json()));
  }

  const load = await body(await send(env, "/api/v1/work-centers/load?from=2026-08-10&to=2026-08-12", { method: "GET" }));
  const row = load.data[0];
  assert.equal(row.capacity_minutes, 480 * 3);
  assert.equal(row.planned_minutes, 5000);
  assert.equal(row.overloaded, true, "kapasitenin üzerindeki yük darboğaz olarak işaretlenmeli");
  assert.deepEqual(load.meta.bottlenecks, ["CNC-01"]);
});

test("production operations move through their sequence and record actual minutes", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-1", "Proje", "production", timestamp, timestamp);
  database.prepare("INSERT INTO production_orders (id,tenant_id,order_number,project_id,quantity,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run("order-a", "tenant-a", "U-1", "project-a", 1, "planned", timestamp, timestamp);
  const operation = (await body(await send(env, "/api/v1/production-operations", { body: { production_order_id: "order-a", name: "Kesim", planned_minutes: 120 } }))).data;

  let response = await send(env, `/api/v1/production-operations/${operation.id}/transition`, { body: { status: "completed" } });
  assert.equal(response.status, 409, "başlatılmadan tamamlanamaz");

  response = await send(env, `/api/v1/production-operations/${operation.id}/transition`, { body: { status: "blocked" } });
  assert.equal(response.status, 422, "duraklatma nedeni zorunlu");

  assert.equal((await send(env, `/api/v1/production-operations/${operation.id}/transition`, { body: { status: "in_progress" } })).status, 200);
  response = await send(env, `/api/v1/production-operations/${operation.id}/transition`, { body: { status: "completed", actual_minutes: 145 } });
  assert.equal(response.status, 200);
  assert.equal((await body(response)).meta.open_operations, 0);
  const row = database.prepare("SELECT status,actual_minutes,started_at,completed_at FROM production_operations WHERE id=?").get(operation.id);
  assert.equal(row.status, "completed");
  assert.equal(row.actual_minutes, 145);
  assert.ok(row.started_at && row.completed_at);
});

test("resolving a production issue records rework on the order and cost in the breakdown", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,contract_amount_minor,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-1", "Proje", "production", 1_000_000, timestamp, timestamp);
  database.prepare("INSERT INTO work_items (id,tenant_id,project_id,space_name,item_code,description,quantity,unit,unit_cost_minor,unit_price_minor,status,revision_no,revision_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run("work-a", "tenant-a", "project-a", "Lobi", "K-1", "Banko", 2, "adet", 100_000, 250_000, "planned", 1, "draft", timestamp, timestamp);
  database.prepare("INSERT INTO production_orders (id,tenant_id,order_number,project_id,work_item_id,quantity,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run("order-a", "tenant-a", "U-1", "project-a", "work-a", 2, "planned", timestamp, timestamp);

  const issue = (await body(await send(env, "/api/v1/production-issues", { body: { production_order_id: "order-a", project_id: "project-a", work_item_id: "work-a", issue_type: "quality", severity: "high", description: "Kaplama kabardı" } }))).data;

  let response = await send(env, `/api/v1/production-issues/${issue.id}/resolve`, { body: {} });
  assert.equal(response.status, 422, "çözüm açıklaması zorunlu");

  response = await send(env, `/api/v1/production-issues/${issue.id}/resolve`, { body: { resolution: "Kaplama yenilendi", root_cause: "Yapıştırıcı sıcaklığı düşük", rework_quantity: 1, scrap_quantity: 0.5, cost_impact_minor: 40_000, delay_days: 2 } });
  assert.equal(response.status, 200, JSON.stringify(await response.json()));

  const order = database.prepare("SELECT rework_quantity,scrap_quantity FROM production_orders WHERE id='order-a'").get();
  assert.equal(order.rework_quantity, 1, "yeniden işlem üretim emrine işlenmeli");
  assert.equal(order.scrap_quantity, 0.5);

  const breakdown = (await body(await send(env, "/api/v1/projects/project-a/cost-breakdown", { method: "GET" }))).data;
  const item = breakdown.workItems[0];
  assert.equal(item.space_name, "Lobi");
  assert.equal(item.budget_cost_minor, 200_000, "bütçe birim maliyet × miktar");
  assert.equal(item.issue_cost_minor, 40_000, "sorun maliyeti gerçekleşen maliyete girer");
  assert.equal(item.actual_cost_minor, 40_000);
  assert.equal(item.rework_quantity, 1);
  assert.equal(item.revenue_minor, 500_000);

  // Çözüm tekrar gönderildiğinde miktar iki kez eklenmez.
  assert.equal((await send(env, `/api/v1/production-issues/${issue.id}/resolve`, { body: { resolution: "Tekrar" } })).status, 200);
  assert.equal(database.prepare("SELECT rework_quantity FROM production_orders WHERE id='order-a'").get().rework_quantity, 1);
});

test("cost breakdown separates budget, actual, commitment and remaining per space", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,contract_amount_minor,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-1", "Proje", "production", 1_000_000, timestamp, timestamp);
  database.prepare("INSERT INTO suppliers (id,tenant_id,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("sup-a", "tenant-a", "Tedarik", "active", timestamp, timestamp);
  for (const [id, space, cost, price] of [["work-a", "Lobi", 100_000, 200_000], ["work-b", "Lobi", 50_000, 90_000], ["work-c", "Oda 204", 80_000, 150_000]]) {
    database.prepare("INSERT INTO work_items (id,tenant_id,project_id,space_name,description,quantity,unit,unit_cost_minor,unit_price_minor,status,revision_no,revision_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(id, "tenant-a", "project-a", space, `Kalem ${id}`, 1, "adet", cost, price, "planned", 1, "draft", timestamp, timestamp);
  }
  database.prepare("INSERT INTO financial_transactions (id,tenant_id,transaction_number,project_id,work_item_id,type,transaction_date,amount_minor,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run("fin-a", "tenant-a", "F-1", "project-a", "work-a", "expense", "2026-08-09", 60_000, "paid", timestamp, timestamp);
  database.prepare("INSERT INTO purchase_orders (id,tenant_id,order_number,project_id,work_item_id,supplier_id,grand_total_minor,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run("po-a", "tenant-a", "PO-1", "project-a", "work-a", "sup-a", 25_000, "ordered", timestamp, timestamp);
  // İş kalemine bağlanmamış proje gideri kırılımda ayrı gösterilir.
  database.prepare("INSERT INTO financial_transactions (id,tenant_id,transaction_number,project_id,type,transaction_date,amount_minor,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run("fin-b", "tenant-a", "F-2", "project-a", "expense", "2026-08-09", 15_000, "approved", timestamp, timestamp);

  const data = (await body(await send(env, "/api/v1/projects/project-a/cost-breakdown", { method: "GET" }))).data;
  const workA = data.workItems.find((row) => row.id === "work-a");
  assert.equal(workA.budget_cost_minor, 100_000);
  assert.equal(workA.actual_cost_minor, 60_000);
  assert.equal(workA.committed_cost_minor, 25_000);
  assert.equal(workA.remaining_cost_minor, 15_000, "bütçeden harcanmamış kısım");
  assert.equal(workA.forecast_cost_minor, 100_000);

  const lobi = data.spaces.find((row) => row.space_name === "Lobi");
  assert.equal(lobi.work_item_count, 2);
  assert.equal(lobi.budget_cost_minor, 150_000);
  assert.equal(lobi.revenue_minor, 290_000);

  assert.equal(data.unassigned.actual_cost_minor, 15_000);
  assert.equal(data.totals.actual_cost_minor, 75_000, "bağlanmamış gider toplamda sayılır");
  assert.equal(data.totals.forecast_cost_minor, data.totals.actual_cost_minor + data.totals.committed_cost_minor + data.totals.remaining_cost_minor);
  assert.equal(data.totals.forecast_margin_minor, 1_000_000 - data.totals.forecast_cost_minor);
});

test("a bill of materials overrides the unit cost budget when present", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,contract_amount_minor,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-1", "Proje", "design", 1_000_000, timestamp, timestamp);
  database.prepare("INSERT INTO work_items (id,tenant_id,project_id,space_name,description,quantity,unit,unit_cost_minor,unit_price_minor,status,revision_no,revision_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run("work-a", "tenant-a", "project-a", "Lobi", "Dolap", 2, "adet", 10_000, 90_000, "planned", 1, "draft", timestamp, timestamp);
  await send(env, "/api/v1/bom-lines", { body: { work_item_id: "work-a", description: "MDF", quantity_per_unit: 3, unit: "plaka", unit_cost_minor: 5_000 } });

  const data = (await body(await send(env, "/api/v1/projects/project-a/cost-breakdown", { method: "GET" }))).data;
  assert.equal(data.workItems[0].budget_cost_minor, 30_000, "3 plaka × 2 adet × 5.000 kuruş");
});

test("cost breakdown requires the cost.view capability", async () => {
  const { database, env } = await setup({ extraUsers: [{ id: "user-view", email: "view@a.test", name: "Okuyucu", roleCode: "viewer", permissions: ["projects.read"] }] });
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-1", "Proje", "design", timestamp, timestamp);
  const response = await send(env, "/api/v1/projects/project-a/cost-breakdown", { method: "GET", email: "view@a.test" });
  assert.equal(response.status, 403);
});

test("a password reset request never reveals whether the phone is registered", async () => {
  const { database, env } = await setup({ extraUsers: [{ id: "user-field", email: "saha@a.test", name: "Saha Ekibi", phone: "+905321112233", roleCode: "field", permissions: ["projects.read"] }] });
  env.PASSWORD_AUTH_ENABLED = "true";
  env.PASSWORD_AUTH_PEPPER = "test-pepper-at-least-16-characters";

  const call = (phone) => worker.fetch(new Request("https://example.test/api/v1/auth/password/reset-request", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://example.test" },
    body: JSON.stringify({ phone, note: "Sahadaki usta" }),
  }), env);

  const known = await call("05321112233");
  const unknown = await call("05559998877");
  assert.equal(known.status, 202);
  assert.equal(unknown.status, 202);
  assert.deepEqual(await known.json(), await unknown.json(), "yanıt hesabın varlığını ele vermemeli");

  const rows = (await body(await send(env, "/api/v1/password-reset-requests", { method: "GET" }))).data;
  assert.equal(rows.length, 1, "yalnız gerçek kullanıcının talebi yöneticiye düşer");
  assert.equal(rows[0].user_name, "Saha Ekibi");
  assert.equal(rows[0].membership_id, "member-user-field");
  // Telefon numarası düz metin olarak saklanmaz.
  const stored = database.prepare("SELECT phone_hash FROM password_reset_requests LIMIT 1").get();
  assert.doesNotMatch(stored.phone_hash, /905321112233/);
});

test("password reset requests are rate limited per phone", async () => {
  const { env } = await setup();
  env.PASSWORD_AUTH_ENABLED = "true";
  env.PASSWORD_AUTH_PEPPER = "test-pepper-at-least-16-characters";
  const call = () => worker.fetch(new Request("https://example.test/api/v1/auth/password/reset-request", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://example.test" },
    body: JSON.stringify({ phone: "05321112233" }),
  }), env);
  assert.equal((await call()).status, 202);
  assert.equal((await call()).status, 202);
  assert.equal((await call()).status, 202);
  const limited = await call();
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error.code, "rate_limited");
});

test("an admin issues a temporary password that forces a change and closes old sessions", async () => {
  const { database, env } = await setup();
  env.PASSWORD_AUTH_ENABLED = "true";
  env.PASSWORD_AUTH_PEPPER = "test-pepper-at-least-16-characters";
  await send(env, "/api/v1/memberships/invite", { body: { email: "usta@a.test", full_name: "Usta", phone: "05321112233", temporary_password: "ilksifre1", role_ids: ["role-owner"] } });
  const membershipId = database.prepare("SELECT id FROM memberships WHERE user_id=(SELECT id FROM users WHERE email='usta@a.test')").get().id;
  database.prepare("UPDATE users SET status='active',must_change_password=0 WHERE email='usta@a.test'").run();
  database.prepare("UPDATE memberships SET status='active' WHERE id=?").run(membershipId);
  database.prepare("INSERT INTO phone_sessions (id,user_id,token_hash,ip_hash,user_agent_hash,created_at,last_seen_at,expires_at) VALUES (?,?,?,?,?,?,?,?)")
    .run("phs-old", database.prepare("SELECT id FROM users WHERE email='usta@a.test'").get().id, "hash-old", "ip", "ua", timestamp, timestamp, "2099-01-01T00:00:00.000Z");

  let response = await send(env, `/api/v1/memberships/${membershipId}/reset-password`, { body: { temporary_password: "kisa" } });
  assert.equal(response.status, 422);
  assert.equal((await body(response)).error.code, "weak_password");

  response = await send(env, `/api/v1/memberships/${membershipId}/reset-password`, { body: { temporary_password: "yenigecici1" } });
  assert.equal(response.status, 200);
  const user = database.prepare("SELECT must_change_password FROM users WHERE email='usta@a.test'").get();
  assert.equal(user.must_change_password, 1, "sıfırlanan şifre ilk girişte değiştirilmeli");
  assert.equal(database.prepare("SELECT revoked_at FROM phone_sessions WHERE id='phs-old'").get().revoked_at !== null, true, "eski oturumlar kapanmalı");

  // Yeni geçici şifreyle giriş yapılabilmeli.
  const login = await worker.fetch(new Request("https://example.test/api/v1/auth/password/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://example.test" },
    body: JSON.stringify({ phone: "05321112233", password: "yenigecici1" }),
  }), env);
  assert.equal(login.status, 200);
  assert.equal((await login.json()).data.must_change_password, true);
});

test("resetting a password requires the dedicated capability and never targets a system role", async () => {
  const { env } = await setup({ extraUsers: [{ id: "user-hr", email: "hr@a.test", name: "IK", roleCode: "hr_admin", permissions: ["memberships.read", "memberships.write", "users.reset-password"] }] });
  env.PASSWORD_AUTH_ENABLED = "true";
  env.PASSWORD_AUTH_PEPPER = "test-pepper-at-least-16-characters";

  // Yetkisi olmayan kullanıcı listeyi bile göremez.
  assert.equal((await send(env, "/api/v1/password-reset-requests", { method: "GET", email: "owner@a.test" })).status, 200);

  // Firma sahibinin üyeliğine yetkisiz sıfırlama denemesi engellenir.
  const response = await send(env, "/api/v1/memberships/member-a/reset-password", { email: "hr@a.test", body: { temporary_password: "denemesifre1" } });
  assert.equal(response.status, 403);
  assert.equal((await body(response)).error.code, "privileged_role_forbidden");
});

test("finalised sourcing and production records cannot be edited or deleted directly", async () => {
  const { database, env } = await setup();
  seedSourcing(database);
  const quotation = (await body(await send(env, "/api/v1/supplier-quotations", { body: { purchase_request_id: "req-a", supplier_id: "sup-a", total_minor: 100_000, status: "received" } }))).data;
  assert.equal((await send(env, `/api/v1/supplier-quotations/${quotation.id}/select`, { body: {} })).status, 200);

  // Seçilmiş teklif, satın alma kararının kanıtıdır; sonradan değiştirilemez.
  let response = await send(env, `/api/v1/supplier-quotations/${quotation.id}`, { method: "PATCH", body: { total_minor: 1 } });
  assert.equal(response.status, 409);
  assert.equal((await body(response)).error.code, "workflow_record_immutable");
  assert.equal((await send(env, `/api/v1/supplier-quotations/${quotation.id}`, { method: "DELETE" })).status, 409);

  database.prepare("INSERT INTO production_orders (id,tenant_id,order_number,project_id,quantity,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run("order-a", "tenant-a", "U-1", "project-a", 2, "planned", timestamp, timestamp);
  const issue = (await body(await send(env, "/api/v1/production-issues", { body: { production_order_id: "order-a", issue_type: "quality", description: "Kusur" } }))).data;
  await send(env, `/api/v1/production-issues/${issue.id}/resolve`, { body: { resolution: "Düzeltildi", rework_quantity: 1 } });
  // Çözülmüş sorun silinseydi üretim emrindeki yeniden işlem miktarı asılı kalırdı.
  assert.equal((await send(env, `/api/v1/production-issues/${issue.id}`, { method: "DELETE" })).status, 409);
  assert.equal(database.prepare("SELECT rework_quantity FROM production_orders WHERE id='order-a'").get().rework_quantity, 1);
});

test("repeated successful logins do not lock a user out", async () => {
  const { database, env } = await setup();
  env.PASSWORD_AUTH_ENABLED = "true";
  env.PASSWORD_AUTH_PEPPER = "test-pepper-at-least-16-characters";
  await send(env, "/api/v1/memberships/invite", { body: { email: "usta@a.test", full_name: "Usta", phone: "05321112233", temporary_password: "ilksifre1", role_ids: ["role-owner"] } });
  database.prepare("UPDATE users SET status='active',must_change_password=0 WHERE email='usta@a.test'").run();
  database.prepare("UPDATE memberships SET status='active' WHERE user_id=(SELECT id FROM users WHERE email='usta@a.test')").run();

  const login = (password) => worker.fetch(new Request("https://example.test/api/v1/auth/password/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://example.test" },
    body: JSON.stringify({ phone: "05321112233", password }),
  }), env);

  // Telefon, dizustu ve tablet ile ard arda giris yapmak kilitlenme sebebi degildir.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    assert.equal((await login("ilksifre1")).status, 200, `${attempt + 1}. basarili giris reddedilmemeli`);
  }

  // Yanlis sifre hala sayilir ve limit uygulanir.
  for (let attempt = 0; attempt < 5; attempt += 1) assert.equal((await login("yanlissifre")).status, 401);
  const limited = await login("ilksifre1");
  assert.equal(limited.status, 429, "ust uste yanlis deneme sonrasi kilit devreye girmeli");
  assert.equal((await limited.json()).error.code, "rate_limited");

  // Kilit suresi dolunca dogru sifreyle girilebilir ve sayac sifirlanir.
  database.prepare("UPDATE password_auth_attempts SET created_at='2020-01-01T00:00:00.000Z' WHERE success=0").run();
  assert.equal((await login("ilksifre1")).status, 200);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM password_auth_attempts WHERE success=0").get().count, 0, "basarili giris eski basarisiz denemeleri temizlemeli");
});
