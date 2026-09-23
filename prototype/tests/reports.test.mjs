import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

// Depodaki diğer uçtan uca testler gibi gerçek şemaya karşı çalışır: sahte
// nesne yok, göç dosyaları aynen uygulanır. Rapor motorunun bütün kararı
// gerçek sütun adlarına dayandığı için sahte bir şema hiçbir şeyi kanıtlamazdı.
async function setup({ users = [] } = {}) {
  const database = new DatabaseSync(":memory:");
  for (const name of (await readdir(migrationsDirectory)).filter((item) => /^\d{4}_.+\.sql$/.test(item)).sort()) {
    database.exec(await readFile(new URL(name, migrationsDirectory), "utf8"));
  }
  for (const [tenantId, name, slug] of [["tenant-a", "Firma A", "firma-a"], ["tenant-b", "Firma B", "firma-b"]]) {
    database.prepare("INSERT INTO tenants (id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)").run(tenantId, name, slug, timestamp, timestamp);
  }
  database.prepare("INSERT INTO users (id,email,full_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("owner-a", "owner@a.test", "Firma Sahibi", "active", timestamp, timestamp);
  database.prepare("INSERT INTO roles (id,tenant_id,code,name,is_system,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("role-owner", "tenant-a", "owner", "Firma Sahibi", 1, timestamp, timestamp);
  database.prepare("INSERT INTO memberships (id,tenant_id,user_id,role_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("member-a", "tenant-a", "owner-a", "role-owner", "active", timestamp, timestamp);
  for (const user of users) {
    database.prepare("INSERT INTO users (id,email,full_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run(user.id, user.email, user.name || user.id, "active", timestamp, timestamp);
    database.prepare("INSERT INTO roles (id,tenant_id,code,name,is_system,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(`role-${user.id}`, "tenant-a", `rol-${user.id}`, `Rol ${user.id}`, 0, timestamp, timestamp);
    database.prepare("INSERT INTO memberships (id,tenant_id,user_id,role_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(`member-${user.id}`, "tenant-a", user.id, `role-${user.id}`, "active", timestamp, timestamp);
    for (const code of user.permissions || []) {
      database.prepare("INSERT OR IGNORE INTO permissions (code,description) VALUES (?,?)").run(code, code);
      database.prepare("INSERT OR IGNORE INTO role_permissions (tenant_id,role_id,permission_code) VALUES (?,?,?)").run("tenant-a", `role-${user.id}`, code);
    }
  }
  return { database, env: { DB: new D1Database(database), ALLOW_DEV_AUTH: "true" } };
}

function request(path, { method = "GET", body, email = "owner@a.test", tenant = "tenant-a" } = {}) {
  const headers = new Headers();
  headers.set("x-user-email", email);
  headers.set("x-tenant-id", tenant);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`https://example.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

const send = (env, path, options) => worker.fetch(request(path, options), env);
const payload = async (response) => response.json();
const runReport = (env, definition, options = {}) => send(env, "/api/v1/reports/run", { method: "POST", body: { definition, ...(options.preview === undefined ? {} : { preview: options.preview }) }, email: options.email });

function seedProjects(database) {
  database.prepare("INSERT INTO customers (id,tenant_id,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("cus-a", "tenant-a", "Beyaz Otel", "active", timestamp, timestamp);
  database.prepare("INSERT INTO customers (id,tenant_id,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("cus-b", "tenant-a", "Mavi Rezidans", "active", timestamp, timestamp);
  const rows = [
    ["prj-1", "cus-a", "P-1", "Lobi", "production", 100_000, 60_000, "2026-03-31"],
    ["prj-2", "cus-a", "P-2", "Odalar", "production", 250_000, 150_000, "2026-02-28"],
    ["prj-3", "cus-b", "P-3", "Mutfak", "installation", 400_000, 300_000, "2026-01-31"],
  ];
  for (const [id, customer, code, name, status, contract, cost, end] of rows) {
    database.prepare("INSERT INTO projects (id,tenant_id,customer_id,code,name,status,contract_amount_minor,estimated_cost_minor,planned_end_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .run(id, "tenant-a", customer, code, name, status, contract, cost, end, timestamp, timestamp);
  }
  // Başka firmanın verisi: hiçbir rapor yolundan sızmamalı.
  database.prepare("INSERT INTO customers (id,tenant_id,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("cus-x", "tenant-b", "Rakip Müşteri", "active", timestamp, timestamp);
  database.prepare("INSERT INTO projects (id,tenant_id,customer_id,code,name,status,contract_amount_minor,estimated_cost_minor,planned_end_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run("prj-x", "tenant-b", "cus-x", "GIZLI-1", "Rakip Proje", "production", 9_999_999, 8_888_888, "2026-03-31", timestamp, timestamp);
}

function seedEmployees(database) {
  database.prepare("INSERT INTO employees (id,tenant_id,employee_number,first_name,last_name,department,salary_amount_minor,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run("emp-1", "tenant-a", "E-1", "Ayşe", "Usta", "Üretim", 70_000, "active", timestamp, timestamp);
  database.prepare("INSERT INTO employees (id,tenant_id,employee_number,first_name,last_name,department,salary_amount_minor,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run("emp-2", "tenant-a", "E-2", "Mehmet", "Kalfa", "Montaj", 40_000, "active", timestamp, timestamp);
}

const reporter = { id: "reporter", email: "reporter@a.test", name: "Raportör", permissions: ["reports.read", "reports.write", "reports.delete", "projects.read", "employees.read", "customers.read"] };
const payrollReporter = { id: "payroll", email: "payroll@a.test", name: "Bordro", permissions: ["reports.read", "employees.read", "salary.view"] };

test("alan listesi yalnız okunabilir kaynakları ve görülebilir sütunları döner", async () => {
  const { env } = await setup({ users: [reporter, payrollReporter] });

  const limited = (await payload(await send(env, "/api/v1/reports/fields", { email: reporter.email }))).data;
  const slugs = limited.map((item) => item.resource);
  assert.ok(slugs.includes("projects"), "okuma yetkisi olan kaynak listelenmeli");
  assert.ok(slugs.includes("employees"));
  assert.ok(!slugs.includes("invoices"), "okuma yetkisi olmayan kaynak hiç görünmemeli");

  const employees = limited.find((item) => item.resource === "employees").columns.map((column) => column.key);
  assert.ok(!employees.includes("salary_amount_minor"), "salary.view olmadan maaş sütunu seçilebilir alan olarak listelenmemeli");
  assert.ok(!employees.includes("national_id_masked"), "hr.sensitive.read olmadan kimlik alanı listelenmemeli");
  assert.ok(employees.includes("department"));

  const projects = limited.find((item) => item.resource === "projects").columns;
  assert.ok(!projects.some((column) => column.key === "estimated_cost_minor"), "cost.view olmadan maliyet sütunu listelenmemeli");
  assert.deepEqual(projects.find((column) => column.key === "contract_amount_minor"), { key: "contract_amount_minor", type: "money" });
  assert.deepEqual(projects.find((column) => column.key === "planned_end_date"), { key: "planned_end_date", type: "date" });
  assert.deepEqual(projects.find((column) => column.key === "created_at"), { key: "created_at", type: "datetime" });
  // Durum sütunu izin verilen değerleri de taşımalı; arayüz açılır liste açsın
  // diye. Değerler doğrulamada kullanılan kümenin aynısı olmalı.
  const status = projects.find((column) => column.key === "status");
  assert.equal(status.type, "status");
  assert.ok(status.values.includes("production") && status.values.includes("lead"));
  assert.ok(!status.values.includes("Üretim"), "değerler veritabanı kodları olmalı, Türkçe etiketler değil");
  assert.deepEqual(projects.find((column) => column.key === "priority").values, ["low", "normal", "high", "critical"]);
  assert.equal(projects.find((column) => column.key === "code").values, undefined, "kümesi olmayan sütunda values hiç olmamalı");
  assert.deepEqual(projects.find((column) => column.key === "progress_percent"), { key: "progress_percent", type: "percent" });
  assert.deepEqual(projects.find((column) => column.key === "code"), { key: "code", type: "text" });

  // JSON sütunları hiçbir kaynakta seçilebilir alan olarak görünmemeli.
  assert.ok(!limited.some((item) => item.columns.some((column) => column.key.endsWith("_json"))), "JSON sütunları alan listesinde yer almamalı");

  const payrollFields = (await payload(await send(env, "/api/v1/reports/fields", { email: payrollReporter.email }))).data;
  const payrollEmployees = payrollFields.find((item) => item.resource === "employees").columns.map((column) => column.key);
  assert.ok(payrollEmployees.includes("salary_amount_minor"), "salary.view olan kullanıcı maaş sütununu seçebilmeli");
});

test("beyaz liste dışı sütun adı ve SQL enjeksiyonu denemesi 422 ile reddedilir", async () => {
  const { database, env } = await setup({ users: [reporter] });
  seedProjects(database);
  const injection = "name, (SELECT password_hash FROM users LIMIT 1)";

  const attempts = [
    [{ resource: "projects", columns: [injection] }, "columns"],
    [{ resource: "projects", columns: ["code"], filters: [{ field: "1=1 OR code LIKE '%'", op: "eq", value: "x" }] }, "filters"],
    [{ resource: "projects", columns: ["code"], sort: [{ field: injection, direction: "asc" }] }, "sort"],
    [{ resource: "projects", group: { by: [injection], aggregates: [{ fn: "count", as: "adet" }] } }, "group.by"],
    [{ resource: "projects", group: { by: ["status"], aggregates: [{ fn: "sum", field: injection, as: "toplam" }] } }, "aggregates.field"],
    [{ resource: "projects", columns: ["code"], sort: [{ field: "code", direction: "asc; DROP TABLE projects" }] }, "sort.direction"],
    [{ resource: "projects", columns: ["code"], filters: [{ field: "code", op: "eq); DROP TABLE projects --", value: "x" }] }, "op"],
  ];
  for (const [definition, usage] of attempts) {
    const response = await runReport(env, definition, { email: reporter.email });
    assert.equal(response.status, 422, `${usage} için 422 bekleniyordu`);
    const problem = (await payload(response)).error;
    assert.ok(["unknown_report_column", "validation_error", "unsupported_report_operator"].includes(problem.code), `${usage} → ${problem.code}`);
  }

  // Sütun adı hiçbir zaman SQL'e gömülmediği için şema ve veri bozulmadan durmalı.
  assert.equal(database.prepare("SELECT COUNT(*) AS total FROM projects").get().total, 4);

  // Geçerli bir tanım aynı uçtan sorunsuz geçmeli; ret, uç bozuk olduğu için değil.
  const healthy = await runReport(env, { resource: "projects", columns: ["code", "name"] }, { email: reporter.email });
  assert.equal(healthy.status, 200);
});

test("hassas alan seçim, süzme, sıralama, gruplama ve toplamın hepsinde 403 verir", async () => {
  const { database, env } = await setup({ users: [reporter, payrollReporter] });
  seedEmployees(database);
  const column = "salary_amount_minor";

  const forbidden = [
    { resource: "employees", columns: [column] },
    { resource: "employees", columns: ["first_name"], filters: [{ field: column, op: "gt", value: 50_000 }] },
    { resource: "employees", columns: ["first_name"], sort: [{ field: column, direction: "desc" }] },
    { resource: "employees", group: { by: [column], aggregates: [{ fn: "count", as: "adet" }] } },
    { resource: "employees", group: { by: ["department"], aggregates: [{ fn: "sum", field: column, as: "toplam" }] } },
  ];
  for (const definition of forbidden) {
    const response = await runReport(env, definition, { email: reporter.email });
    assert.equal(response.status, 403, `${JSON.stringify(definition)} 403 vermeliydi`);
    assert.equal((await payload(response)).error.code, "sensitive_field_forbidden");
  }

  // cost.view ile korunan sütunlar da aynı beş yolda kapalı olmalı.
  const costFilter = await runReport(env, { resource: "projects", columns: ["code"], filters: [{ field: "estimated_cost_minor", op: "gt", value: 1 }] }, { email: reporter.email });
  assert.equal(costFilter.status, 403);

  // Yetkisi olan kullanıcı için aynı tanımlar çalışmalı; kapı yetkiye bağlı.
  for (const definition of forbidden) {
    const response = await runReport(env, definition, { email: payrollReporter.email });
    assert.equal(response.status, 200, `${JSON.stringify(definition)} salary.view ile çalışmalıydı`);
  }
  const totals = (await payload(await runReport(env, { resource: "employees", group: { by: ["status"], aggregates: [{ fn: "sum", field: column, as: "toplam" }] } }, { email: payrollReporter.email }))).data;
  assert.equal(totals.rows[0].toplam, 110_000);
});

test("rapor sonuçları başka firmanın verisini hiçbir yoldan döndürmez", async () => {
  const { database, env } = await setup({ users: [reporter] });
  seedProjects(database);

  const flat = (await payload(await runReport(env, { resource: "projects", columns: ["code", "name", "customer_id"], limit: 5000 }, { email: reporter.email }))).data;
  assert.equal(flat.rows.length, 3);
  assert.ok(!flat.rows.some((row) => row.code === "GIZLI-1"), "başka firmanın projesi düz listede görünmemeli");

  const grouped = (await payload(await runReport(env, { resource: "projects", group: { by: ["status"], aggregates: [{ fn: "count", as: "adet" }, { fn: "sum", field: "contract_amount_minor", as: "toplam" }] } }, { email: reporter.email }))).data;
  assert.equal(grouped.rows.reduce((total, row) => total + row.adet, 0), 3, "gruplu sayım yalnız kendi firmasını saymalı");
  assert.equal(grouped.rows.reduce((total, row) => total + row.toplam, 0), 750_000);

  // Süzgeçle hedeflense bile sızmamalı.
  const targeted = (await payload(await runReport(env, { resource: "projects", columns: ["code"], filters: [{ field: "code", op: "eq", value: "GIZLI-1" }] }, { email: reporter.email }))).data;
  assert.deepEqual(targeted.rows, []);
});

test("reports.read tek başına yetmez; kaynağın kendi okuma yetkisi de aranır", async () => {
  const onlyReports = { id: "onlyreports", email: "onlyreports@a.test", permissions: ["reports.read"] };
  const noReports = { id: "noreports", email: "noreports@a.test", permissions: ["projects.read"] };
  const { database, env } = await setup({ users: [onlyReports, noReports] });
  seedProjects(database);

  const missingResource = await runReport(env, { resource: "projects", columns: ["code"] }, { email: onlyReports.email });
  assert.equal(missingResource.status, 403, "projects.read olmadan proje raporu çalışmamalı");
  assert.equal((await payload(missingResource)).error.code, "forbidden");

  const missingReports = await runReport(env, { resource: "projects", columns: ["code"] }, { email: noReports.email });
  assert.equal(missingReports.status, 403, "reports.read olmadan rapor çalıştırılamamalı");

  // reports.read, takma ad üzerinden yalnız saved-reports kaynağını açar; başka
  // hiçbir kaynak rapor yetkisiyle görünür hâle gelmemeli.
  const fields = (await payload(await send(env, "/api/v1/reports/fields", { email: onlyReports.email }))).data;
  assert.deepEqual(fields.map((item) => item.resource), ["saved-reports"]);
  assert.equal((await send(env, "/api/v1/reports/fields", { email: noReports.email })).status, 403);

  assert.equal((await runReport(env, { resource: "users", columns: ["email"] }, { email: onlyReports.email })).status, 422, "kayıt defterinde olmayan kaynak reddedilmeli");
});

test("önizleme sınırını sunucu sabitler, üst sınır 5000'de tutulur", async () => {
  const { database, env } = await setup({ users: [reporter] });
  seedProjects(database);
  for (let index = 0; index < 25; index += 1) {
    database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
      .run(`prj-bulk-${index}`, "tenant-a", `B-${index}`, `Toplu ${index}`, "lead", timestamp, timestamp);
  }

  const preview = await payload(await runReport(env, { resource: "projects", columns: ["code"], limit: 5000 }, { email: reporter.email, preview: true }));
  assert.equal(preview.data.rows.length, 20, "önizlemede istemcinin gönderdiği sınıra güvenilmemeli");
  assert.equal(preview.meta.preview, true);
  assert.equal(preview.meta.rowCount, 20);
  assert.equal(preview.meta.truncated, true);

  const full = await payload(await runReport(env, { resource: "projects", columns: ["code"], limit: 999_999 }, { email: reporter.email }));
  assert.equal(full.data.rows.length, 28, "üst sınır aşılmak istense de kayıtların tamamı dönmeli");
  assert.equal(full.meta.truncated, false);

  const bounded = await payload(await runReport(env, { resource: "projects", columns: ["code"], limit: 5 }, { email: reporter.email }));
  assert.equal(bounded.data.rows.length, 5);
  assert.equal(bounded.meta.truncated, true);
});

test("gruplama ve toplamlar doğru sonuç verir, grup anahtarının adı çözülür", async () => {
  const { database, env } = await setup({ users: [reporter] });
  seedProjects(database);

  const grouped = await payload(await runReport(env, {
    resource: "projects",
    filters: [{ field: "status", op: "in", value: ["production", "installation"] }, { field: "planned_end_date", op: "between", value: ["2026-01-01", "2026-03-31"] }],
    group: { by: ["customer_id"], aggregates: [{ fn: "count", as: "adet" }, { fn: "sum", field: "contract_amount_minor", as: "toplam" }, { fn: "max", field: "planned_end_date", as: "son_tarih" }] },
    sort: [{ field: "toplam", direction: "desc" }],
  }, { email: reporter.email }));

  assert.deepEqual(grouped.data.columns.map((column) => column.key), ["customer_id", "customer_name", "adet", "toplam", "son_tarih"]);
  assert.deepEqual(grouped.data.columns.find((column) => column.key === "toplam"), { key: "toplam", type: "money" });
  assert.deepEqual(grouped.data.columns.find((column) => column.key === "adet"), { key: "adet", type: "number" });
  assert.deepEqual(grouped.data.columns.find((column) => column.key === "son_tarih"), { key: "son_tarih", type: "date" });
  assert.deepEqual(grouped.data.rows, [
    { customer_id: "cus-b", customer_name: "Mavi Rezidans", adet: 1, toplam: 400_000, son_tarih: "2026-01-31" },
    { customer_id: "cus-a", customer_name: "Beyaz Otel", adet: 2, toplam: 350_000, son_tarih: "2026-03-31" },
  ]);

  const averaged = await payload(await runReport(env, { resource: "projects", group: { by: ["status"], aggregates: [{ fn: "avg", field: "contract_amount_minor", as: "ortalama" }] }, sort: [{ field: "status", direction: "asc" }] }, { email: reporter.email }));
  assert.deepEqual(averaged.data.rows, [
    { status: "installation", ortalama: 400_000 },
    { status: "production", ortalama: 175_000 },
  ]);

  // Metin sütununda sayısal işlem anlamsızdır; sessizce sıfır dönmemeli.
  const nonsense = await runReport(env, { resource: "projects", group: { by: ["status"], aggregates: [{ fn: "avg", field: "name", as: "ortalama" }] } }, { email: reporter.email });
  assert.equal(nonsense.status, 422);
  assert.equal((await payload(nonsense)).error.code, "non_numeric_aggregate");
  assert.equal((await runReport(env, { resource: "projects", group: { by: ["status"], aggregates: [{ fn: "sum", field: "code", as: "toplam" }] } }, { email: reporter.email })).status, 422);
});

test("düz liste sonucu hassas alanlardan arındırılır ve bağlı kayıt adlarını taşır", async () => {
  const { database, env } = await setup({ users: [reporter] });
  seedProjects(database);

  const flat = await payload(await runReport(env, { resource: "projects", columns: ["code", "customer_id", "status"], sort: [{ field: "code", direction: "asc" }] }, { email: reporter.email }));
  assert.deepEqual(flat.data.columns.map((column) => column.key), ["code", "customer_id", "customer_name", "status"]);
  assert.deepEqual(flat.data.rows[0], { code: "P-1", customer_id: "cus-a", customer_name: "Beyaz Otel", status: "production" });

  // Sütun verilmezse varsayılan liste bile yetkiye göre daraltılmalı.
  const defaults = await payload(await runReport(env, { resource: "projects" }, { email: reporter.email }));
  assert.ok(!defaults.data.columns.some((column) => column.key === "estimated_cost_minor"), "cost.view olmadan maliyet varsayılan sütunlara girmemeli");
  assert.ok(defaults.data.rows.every((row) => row.estimated_cost_minor === undefined));
});

test("kaydedilmiş raporun sahipliği listeleme, güncelleme ve silmede korunur", async () => {
  const other = { id: "other", email: "other@a.test", permissions: ["reports.read", "reports.write", "reports.delete", "projects.read"] };
  const { database, env } = await setup({ users: [reporter, other] });
  seedProjects(database);

  const create = (email, name, visibility) => send(env, "/api/v1/saved-reports", { method: "POST", email, body: { name, visibility, resource: "projects", definition_json: { resource: "projects", columns: ["code", "name"] } } });

  const mine = (await payload(await create(reporter.email, "Özel raporum", "private"))).data;
  assert.match(mine.id, /^rep_/, "kimlik sözleşmedeki rep_ önekini taşımalı");
  assert.equal(mine.owner_user_id, "reporter", "sahip sunucudan yazılmalı");
  assert.equal(mine.visibility, "private");
  assert.deepEqual(mine.definition_json, { resource: "projects", columns: ["code", "name"] });

  const shared = (await payload(await create(reporter.email, "Paylaşılan rapor", "shared"))).data;

  // İstemci sahibi kendisi belirleyememeli.
  const spoof = await send(env, "/api/v1/saved-reports", { method: "POST", email: other.email, body: { name: "Sahte", resource: "projects", owner_user_id: "reporter", definition_json: {} } });
  assert.equal(spoof.status, 422);
  assert.match((await payload(spoof)).error.message, /owner_user_id/);

  const otherList = (await payload(await send(env, "/api/v1/saved-reports", { email: other.email }))).data;
  assert.deepEqual(otherList.map((row) => row.id), [shared.id], "başkasının özel raporu listelenmemeli");

  const ownList = (await payload(await send(env, "/api/v1/saved-reports", { email: reporter.email }))).data;
  assert.equal(ownList.length, 2, "sahibi kendi özel raporunu görmeli");

  assert.equal((await send(env, `/api/v1/saved-reports/${mine.id}`, { email: other.email })).status, 404, "başkasının özel raporu okunamamalı");
  assert.equal((await send(env, `/api/v1/saved-reports/${mine.id}`, { method: "PATCH", email: other.email, body: { name: "Ele geçirildi" } })).status, 404);
  assert.equal((await send(env, `/api/v1/saved-reports/${mine.id}`, { method: "DELETE", email: other.email })).status, 404);
  assert.equal(database.prepare("SELECT name FROM saved_reports WHERE id=?").get(mine.id).name, "Özel raporum");

  // Paylaşılan rapor okunur ama yine yalnız sahibi değiştirebilir.
  assert.equal((await send(env, `/api/v1/saved-reports/${shared.id}`, { email: other.email })).status, 200);
  assert.equal((await send(env, `/api/v1/saved-reports/${shared.id}`, { method: "PATCH", email: other.email, body: { name: "Ele geçirildi" } })).status, 404);
  assert.equal((await send(env, `/api/v1/saved-reports/${shared.id}`, { method: "DELETE", email: other.email })).status, 404);
  assert.equal(database.prepare("SELECT name FROM saved_reports WHERE id=?").get(shared.id).name, "Paylaşılan rapor");

  assert.equal((await send(env, `/api/v1/saved-reports/${mine.id}`, { method: "PATCH", email: reporter.email, body: { name: "Yeni ad" } })).status, 200);
  assert.equal((await send(env, `/api/v1/saved-reports/${mine.id}`, { method: "DELETE", email: reporter.email })).status, 204);

  // Raporun kendisi de bir kaynaktır: rapor motoru üzerinden de sızmamalı.
  const throughEngine = (await payload(await runReport(env, { resource: "saved-reports", columns: ["id", "name"] }, { email: other.email }))).data;
  assert.deepEqual(throughEngine.rows.map((row) => row.id), [shared.id], "özel rapor, rapor motorundan da okunamamalı");
});

test("kaydedilmiş rapor CSV olarak dökülür, yetki ve denetim kaydı aranır", async () => {
  const exporter = { id: "exporter", email: "exporter@a.test", permissions: ["reports.read", "reports.write", "projects.read", "export"] };
  const { database, env } = await setup({ users: [reporter, exporter] });
  seedProjects(database);

  const saved = (await payload(await send(env, "/api/v1/saved-reports", {
    method: "POST", email: exporter.email,
    body: { name: "Üretimdeki işler", resource: "projects", visibility: "shared", definition_json: { resource: "projects", columns: ["code", "name"], filters: [{ field: "status", op: "eq", value: "production" }], sort: [{ field: "code", direction: "asc" }] } },
  }))).data;

  const denied = await send(env, `/api/v1/reports/export?id=${saved.id}`, { email: reporter.email });
  assert.equal(denied.status, 403, "export yetkisi olmadan dökülememeli");

  const response = await send(env, `/api/v1/reports/export?id=${saved.id}`, { email: exporter.email });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/csv/);
  // BOM'u response.text() ayıkladığı için bayt düzeyinde bakılır; Excel
  // UTF-8 CSV'yi yalnız BOM görürse doğru okur.
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], "CSV UTF-8 BOM ile başlamalı");
  const csv = new TextDecoder("utf-8").decode(bytes);
  assert.deepEqual(csv.trim().split("\r\n"), ['"code","name"', '"P-1","Lobi"', '"P-2","Odalar"']);

  const log = database.prepare("SELECT * FROM audit_logs WHERE action='export' AND entity_type='saved-reports'").get();
  assert.ok(log, "dışa aktarma denetim kaydı yazılmalı");
  assert.equal(log.entity_id, saved.id);
  assert.equal(JSON.parse(log.changes_json).row_count, 2);

  assert.equal((await send(env, "/api/v1/reports/export?id=rep_yok", { email: exporter.email })).status, 404);
  assert.equal((await send(env, "/api/v1/reports/export?id=../../etc/passwd", { email: exporter.email })).status, 400);

  // Kaydedilmiş tanım asla olduğu gibi çalıştırılmaz: yetki her dökümde yeniden bakılır.
  database.prepare("UPDATE saved_reports SET definition_json=? WHERE id=?").run(JSON.stringify({ resource: "projects", columns: ["code", "estimated_cost_minor"] }), saved.id);
  const reValidated = await send(env, `/api/v1/reports/export?id=${saved.id}`, { email: exporter.email });
  assert.equal(reValidated.status, 403, "sonradan yetki dışı kalan sütun dökümde de kapalı olmalı");
  assert.equal((await payload(reValidated)).error.code, "sensitive_field_forbidden");
});

test("JSON sütunları beyaz listenin dışındadır, istemci gönderse de girmez", async () => {
  const { database, env } = await setup({ users: [reporter] });
  seedProjects(database);

  const attempts = [
    { resource: "projects", columns: ["code", "metadata_json"] },
    { resource: "projects", columns: ["code"], filters: [{ field: "metadata_json", op: "contains", value: "gizli" }] },
    { resource: "projects", columns: ["code"], sort: [{ field: "metadata_json", direction: "asc" }] },
    { resource: "projects", group: { by: ["metadata_json"], aggregates: [{ fn: "count", as: "adet" }] } },
    { resource: "projects", group: { by: ["status"], aggregates: [{ fn: "max", field: "metadata_json", as: "son" }] } },
  ];
  for (const definition of attempts) {
    const response = await runReport(env, definition, { email: reporter.email });
    assert.equal(response.status, 422, `${JSON.stringify(definition)} reddedilmeliydi`);
    assert.equal((await payload(response)).error.code, "unknown_report_column");
  }

  // Sütun verilmediğinde kurulan varsayılan listeye de girmemeli.
  const defaults = await payload(await runReport(env, { resource: "projects" }, { email: reporter.email }));
  assert.ok(!defaults.data.columns.some((column) => column.key.endsWith("_json")));
});

test("kaydedilmiş raporun kaynağı ve tanımı yazarken doğrulanır", async () => {
  const { database, env } = await setup({ users: [reporter] });
  seedProjects(database);
  const save = (body) => send(env, "/api/v1/saved-reports", { method: "POST", email: reporter.email, body: { name: "Rapor", resource: "projects", ...body } });

  const unknownResource = await save({ resource: "kuzu-cevirme", definition_json: { resource: "kuzu-cevirme", columns: ["code"] } });
  assert.equal(unknownResource.status, 422);
  assert.equal((await payload(unknownResource)).error.code, "unknown_report_resource");

  const unknownColumn = await save({ definition_json: { resource: "projects", columns: ["code", "yok_boyle_sutun"] } });
  assert.equal(unknownColumn.status, 422);
  assert.equal((await payload(unknownColumn)).error.code, "unknown_report_column");

  const sensitive = await save({ definition_json: { resource: "projects", columns: ["code", "estimated_cost_minor"] } });
  assert.equal(sensitive.status, 403, "göremeyeceği sütunla rapor kaydedilememeli");
  assert.equal((await payload(sensitive)).error.code, "sensitive_field_forbidden");

  const nonsense = await save({ definition_json: { resource: "projects", group: { by: ["status"], aggregates: [{ fn: "avg", field: "name", as: "ortalama" }] } } });
  assert.equal(nonsense.status, 422);
  assert.equal((await payload(nonsense)).error.code, "non_numeric_aggregate");

  assert.equal(database.prepare("SELECT COUNT(*) AS total FROM saved_reports").get().total, 0, "geçersiz tanım hiç kaydedilmemeli");

  const created = await save({ definition_json: { resource: "projects", columns: ["code", "name"] } });
  assert.equal(created.status, 200);
  const reportId = (await payload(created)).data.id;

  // Güncelleme de aynı kapıdan geçer; tanıma dokunmayan değişiklik serbest.
  const broken = await send(env, `/api/v1/saved-reports/${reportId}`, { method: "PATCH", email: reporter.email, body: { definition_json: { resource: "projects", columns: ["kotu_sutun"] } } });
  assert.equal(broken.status, 422);
  assert.equal((await send(env, `/api/v1/saved-reports/${reportId}`, { method: "PATCH", email: reporter.email, body: { name: "Yeni ad" } })).status, 200);
  assert.equal(database.prepare("SELECT name,definition_json FROM saved_reports WHERE id=?").get(reportId).definition_json, JSON.stringify({ resource: "projects", columns: ["code", "name"] }));

  // Kaynak iki yerde duruyor; ayrışmaya izin verilmemeli.
  const movedResource = await send(env, `/api/v1/saved-reports/${reportId}`, { method: "PATCH", email: reporter.email, body: { resource: "employees" } });
  assert.equal(movedResource.status, 422, "sütun ile tanımın kaynağı ayrışamamalı");
  assert.equal((await payload(movedResource)).error.code, "report_resource_mismatch");

  const movedTogether = await send(env, `/api/v1/saved-reports/${reportId}`, { method: "PATCH", email: reporter.email, body: { resource: "employees", definition_json: { resource: "employees", columns: ["first_name", "department"] } } });
  assert.equal(movedTogether.status, 200, "kaynak ve tanım birlikte taşınabilmeli");
});

test("durum sütunlarının izin verilen değerleri doğrulamadaki kümeyle aynıdır", async () => {
  const all = { id: "hepsi", email: "hepsi@a.test", permissions: ["reports.read", "projects.read", "invoices.read", "invoices.write", "design-revisions.read", "quality-inspections.read"] };
  const { env } = await setup({ users: [all] });
  const fields = (await payload(await send(env, "/api/v1/reports/fields", { email: all.email }))).data;
  const columnsOf = (resource) => fields.find((item) => item.resource === resource).columns;

  // Kümesi olan durum sütunu değerleri taşır; sunucu bunları gerçekten uygular.
  const invoiceStatus = columnsOf("invoices").find((column) => column.key === "status");
  assert.ok(invoiceStatus.values.includes("paid"));
  const created = await send(env, "/api/v1/invoices", { method: "POST", email: all.email, body: { invoice_number: "F-1", direction: "sales", issue_date: "2026-01-01", status: "uydurma" } });
  assert.equal(created.status, 422, "values listesinde olmayan durum sunucuda da reddedilmeli");

  // status dışındaki sıralı alanlar da kümelerini verir.
  assert.deepEqual(columnsOf("design-revisions").find((column) => column.key === "drawing_type").values, ["2d", "3d", "shop_drawing"]);
  assert.deepEqual(columnsOf("quality-inspections").find((column) => column.key === "result").values, ["pending", "pass", "conditional", "fail"]);

  // Kümesi güvenilir biçimde çıkarılamayan status tipli sütunda alan hiç konmaz.
  assert.equal(columnsOf("invoices").find((column) => column.key === "datasoft_status").values, undefined);
});

test("firma sahibi başkasının özel raporunu görür ve siler, ama değiştiremez", async () => {
  const { database, env } = await setup({ users: [reporter] });
  seedProjects(database);

  const mine = (await payload(await send(env, "/api/v1/saved-reports", {
    method: "POST", email: reporter.email,
    body: { name: "Özel raporum", visibility: "private", resource: "projects", definition_json: { resource: "projects", columns: ["code"] } },
  }))).data;

  // Görmek: hem tekil okuma hem liste hem de rapor motoru üzerinden.
  assert.equal((await send(env, `/api/v1/saved-reports/${mine.id}`, { email: "owner@a.test" })).status, 200);
  const list = (await payload(await send(env, "/api/v1/saved-reports", { email: "owner@a.test" }))).data;
  assert.deepEqual(list.map((row) => row.id), [mine.id], "sahip özel raporu listede görmeli");
  const engine = (await payload(await runReport(env, { resource: "saved-reports", columns: ["id"] }, { email: "owner@a.test" }))).data;
  assert.deepEqual(engine.rows.map((row) => row.id), [mine.id]);

  // Değiştirememek: emeğin altındaki ad sessizce değişmemeli.
  const edit = await send(env, `/api/v1/saved-reports/${mine.id}`, { method: "PATCH", email: "owner@a.test", body: { name: "Sahibin değiştirdiği" } });
  assert.equal(edit.status, 404, "sahip bile başkasının raporunu değiştirememeli");
  assert.equal(database.prepare("SELECT name FROM saved_reports WHERE id=?").get(mine.id).name, "Özel raporum");

  // Silebilmek: ayrılan birinin raporu firmada kilitli kalmamalı.
  assert.equal((await send(env, `/api/v1/saved-reports/${mine.id}`, { method: "DELETE", email: "owner@a.test" })).status, 204);
  assert.equal(database.prepare("SELECT COUNT(*) AS total FROM saved_reports").get().total, 0);
});

test("sahip muafiyeti yalnız saved-reports'a özeldir, diğer kaynakların silme davranışı değişmez", async () => {
  const { database, env } = await setup({ users: [reporter] });
  seedProjects(database);
  // rowScope tanımlamayan bir kaynakta silme eskisi gibi çalışmalı.
  assert.equal((await send(env, "/api/v1/projects/prj-1", { method: "DELETE", email: "owner@a.test" })).status, 204);
  assert.equal(database.prepare("SELECT COUNT(*) AS total FROM projects WHERE tenant_id='tenant-a'").get().total, 2);
  // Başka firmanın kaydı yine görünmez.
  assert.equal((await send(env, "/api/v1/projects/prj-x", { method: "DELETE", email: "owner@a.test" })).status, 404);
});

const postRun = (env, body, email) => send(env, "/api/v1/reports/run", { method: "POST", body, email });
const exporter = { id: "disa-aktaran", email: "disa@a.test", name: "Dışa Aktaran", permissions: ["reports.read", "reports.write", "projects.read", "customers.read", "export"] };

// Önizleme sınırının gerçekten sınır olduğunu görebilmek için 20'den fazla satır gerekir.
function seedManyProjects(database, count) {
  for (let index = 1; index <= count; index += 1) {
    database.prepare("INSERT INTO projects (id,tenant_id,customer_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)")
      .run(`prj-c${index}`, "tenant-a", "cus-a", `C-${String(index).padStart(3, "0")}`, `Çok ${index}`, "production", timestamp, timestamp);
  }
}

const exportLogs = (database) => database.prepare("SELECT * FROM audit_logs WHERE action='export' AND entity_type='saved-reports'").all();

test("kaydedilmiş rapor kimliğiyle çalıştırma satır kapsamına uyar ve kaynağı sütundan alır", async () => {
  const other = { id: "baskasi", email: "baskasi@a.test", name: "Başkası", permissions: ["reports.read", "projects.read", "customers.read"] };
  const { database, env } = await setup({ users: [reporter, other] });
  seedProjects(database);

  const mine = (await payload(await send(env, "/api/v1/saved-reports", {
    method: "POST", email: reporter.email,
    body: { name: "Özel raporum", visibility: "private", resource: "projects", definition_json: { resource: "projects", columns: ["code", "name"], sort: [{ field: "code", direction: "asc" }] } },
  }))).data;

  const owned = await postRun(env, { savedReportId: mine.id }, reporter.email);
  assert.equal(owned.status, 200);
  assert.deepEqual((await payload(owned)).data.rows.map((row) => row.code), ["P-1", "P-2", "P-3"]);

  // Başkasının özel raporu, kimliği bilinse bile çalıştırılamaz.
  const stolen = await postRun(env, { savedReportId: mine.id }, other.email);
  assert.equal(stolen.status, 404, "başkasının özel raporu rapor kimliğiyle de çalıştırılamamalı");
  assert.equal((await payload(stolen)).error.code, "not_found");

  assert.equal((await postRun(env, { savedReportId: "rep_yok" }, reporter.email)).status, 404);
  assert.equal((await postRun(env, { savedReportId: "../../etc/passwd" }, reporter.email)).status, 400);

  // Kaynak iki yerde duruyor; çalıştıran taraf için yetkili olan sütundur.
  // Tanımın içine sonradan başka bir kaynak sızarsa rapor yine kendi
  // tablosundan okumalı.
  database.prepare("UPDATE saved_reports SET definition_json=? WHERE id=?")
    .run(JSON.stringify({ resource: "customers", columns: ["code", "name"], sort: [{ field: "code", direction: "asc" }] }), mine.id);
  const fromColumn = await payload(await postRun(env, { savedReportId: mine.id }, reporter.email));
  assert.deepEqual(fromColumn.data.rows.map((row) => row.name), ["Lobi", "Odalar", "Mutfak"], "kaynak tanımdan değil saved_reports.resource sütunundan gelmeli");
});

test("savedReportId ile definition birlikte gönderilemez", async () => {
  const { database, env } = await setup({ users: [reporter] });
  seedProjects(database);
  const saved = (await payload(await send(env, "/api/v1/saved-reports", {
    method: "POST", email: reporter.email,
    body: { name: "Rapor", resource: "projects", definition_json: { resource: "projects", columns: ["code"] } },
  }))).data;

  const both = await postRun(env, { savedReportId: saved.id, definition: { resource: "projects", columns: ["name"] } }, reporter.email);
  assert.equal(both.status, 422);
  assert.equal((await payload(both)).error.code, "ambiguous_report_source");
  // Hiçbiri gelmediğinde de çalıştırılacak rapor belirsizdir.
  const none = await postRun(env, {}, reporter.email);
  assert.equal(none.status, 422);
  assert.equal((await payload(none)).error.code, "ambiguous_report_source");
});

test("export bayrağı kendi yetkisini arar, tam sınırla çalışır ve denetim kaydı bırakır", async () => {
  const { database, env } = await setup({ users: [reporter, exporter] });
  seedProjects(database);
  seedManyProjects(database, 25);

  const saved = (await payload(await send(env, "/api/v1/saved-reports", {
    method: "POST", email: exporter.email,
    body: { name: "Üretimdekiler", resource: "projects", visibility: "shared", definition_json: { resource: "projects", columns: ["code", "name"], filters: [{ field: "status", op: "eq", value: "production" }] } },
  }))).data;

  // Rapor yetkisi var, dışa aktarma yetkisi yok: veri firma dışına çıkamaz.
  const denied = await postRun(env, { savedReportId: saved.id, export: true }, reporter.email);
  assert.equal(denied.status, 403, "export yetkisi olmadan bayrak kullanılamamalı");
  assert.equal(exportLogs(database).length, 0, "reddedilen istek denetim kaydı bırakmamalı");

  const response = await postRun(env, { savedReportId: saved.id, export: true }, exporter.email);
  assert.equal(response.status, 200);
  const body = await payload(response);
  // Üretimdeki 2 tohum projesi + 25 ek satır; önizleme sınırı (20) uygulanmamalı.
  assert.equal(body.meta.rowCount, 27, "döküm önizleme sınırına düşmemeli");
  assert.equal(body.meta.preview, false);
  assert.equal(body.meta.truncated, false);

  const logs = exportLogs(database);
  assert.equal(logs.length, 1, "döküm tam olarak bir denetim kaydı yazmalı");
  assert.equal(logs[0].entity_id, saved.id);
  assert.equal(logs[0].user_id, exporter.id);
  assert.deepEqual(JSON.parse(logs[0].changes_json), { resource: "projects", row_count: 27 });

  // Bayrak, istemci "önizleme" dese bile önizlemeyi bastırır: yarım dosya
  // indirmek, yanlış dosya indirmektir.
  const forced = await payload(await postRun(env, { savedReportId: saved.id, export: true, preview: true }, exporter.email));
  assert.equal(forced.meta.rowCount, 27);
  assert.equal(forced.meta.preview, false);

  // Bayrak gövdeden gelen tanımla da çalışır; kayıtlı rapor olmadığında iz
  // kimliksiz kalır ama yine bırakılır.
  const inline = await postRun(env, { definition: { resource: "projects", columns: ["code"] }, export: true }, exporter.email);
  assert.equal(inline.status, 200);
  const inlineLog = exportLogs(database).find((log) => log.entity_id === null);
  assert.ok(inlineLog, "gövdeden gelen tanımın dökümü de iz bırakmalı");
  assert.equal(JSON.parse(inlineLog.changes_json).row_count, 28);
});

test("bayraksız çalıştırma eskisi gibi davranır", async () => {
  const { database, env } = await setup({ users: [exporter] });
  seedProjects(database);
  seedManyProjects(database, 25);

  const preview = await payload(await runReport(env, { resource: "projects", columns: ["code"] }, { email: exporter.email, preview: true }));
  assert.equal(preview.data.rows.length, 20, "önizleme sınırı olduğu gibi kalmalı");
  assert.equal(preview.meta.preview, true);
  assert.equal(preview.meta.truncated, true);

  const full = await payload(await runReport(env, { resource: "projects", columns: ["code"] }, { email: exporter.email }));
  assert.equal(full.data.rows.length, 28);
  assert.equal(full.meta.preview, false);

  // Dışa aktarma yetkisi olan kullanıcı bile bayrak koymadan iz bırakmaz:
  // ekrana bakmak dışa aktarmak değildir.
  assert.equal(exportLogs(database).length, 0);
});

test("CSV dökümünde bağlı kaydın adı varken ham kimlik yazılmaz", async () => {
  const { database, env } = await setup({ users: [exporter] });
  seedProjects(database);

  const saved = (await payload(await send(env, "/api/v1/saved-reports", {
    method: "POST", email: exporter.email,
    body: { name: "Müşteriye göre", resource: "projects", definition_json: { resource: "projects", columns: ["code", "customer_id", "manager_user_id", "status"], filters: [{ field: "status", op: "eq", value: "production" }], sort: [{ field: "code", direction: "asc" }] } },
  }))).data;

  const csv = await (await send(env, `/api/v1/reports/export?id=${saved.id}`, { email: exporter.email })).text();
  const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
  assert.deepEqual(lines[0].split(",").map((cell) => cell.replaceAll('"', "")), ["code", "customer_name", "manager_user_id", "status"]);
  assert.ok(!lines[0].includes("customer_id"), "adı yazılan bağlı kaydın kimliği dosyaya girmemeli");
  assert.ok(!lines.some((line) => line.includes("cus-a")), "ham kimlik hiçbir satırda görünmemeli");
  assert.equal(lines[1], '"P-1","Beyaz Otel",,"production"', "adı çözülemeyen kimlik sütunu yerinde kalmalı");
  // Durum kodu ham kalır: bu uç dış sistemler için duruyor, Türkçe etiket
  // sözlüğü istemcide tek kopya halinde bekliyor.
  assert.ok(lines[1].includes('"production"'));
});

test("döküm sınırı: yazılmamış limit tavana çıkar, yazılmış limit korunur", async () => {
  const { database, env } = await setup({ users: [exporter] });
  seedProjects(database);
  seedManyProjects(database, 520);
  const production = { resource: "projects", columns: ["code"], filters: [{ field: "status", op: "eq", value: "production" }] };
  // Tohumdaki 2 üretim projesi + 520 ek satır.
  const total = 522;

  // Ekranda varsayılan sınır yerinde: 500 satırda kesilir ve kesildiği söylenir.
  const onScreen = await payload(await runReport(env, production, { email: exporter.email }));
  assert.equal(onScreen.data.rows.length, 500);
  assert.equal(onScreen.meta.truncated, true);

  // Dosyada ise sınır yazılmadığı sürece tavan geçerli: indiren kişi veriyi
  // ister, sessizce eksik gelen dosya yanlış karara yol açar.
  const downloaded = await payload(await postRun(env, { definition: production, export: true }, exporter.email));
  assert.equal(downloaded.data.rows.length, total, "limit yazılmamış döküm 500'de kesilmemeli");
  assert.ok(downloaded.data.rows.length > 500);
  assert.equal(downloaded.meta.truncated, false);

  // Açık niyet her zaman korunur: kullanıcının yazdığı sınır yok sayılmaz.
  const capped = await payload(await postRun(env, { definition: { ...production, limit: 100 }, export: true }, exporter.email));
  assert.equal(capped.data.rows.length, 100, "tanımdaki limit dökümde de geçerli olmalı");
  assert.equal(capped.meta.truncated, true);

  // Aynı kural CSV ucunda da geçerli; iki döküm yolu ayrışmamalı.
  const savedIds = [];
  for (const [name, definition] of [["Sınırsız", production], ["Yüz satır", { ...production, limit: 100 }]]) {
    savedIds.push((await payload(await send(env, "/api/v1/saved-reports", {
      method: "POST", email: exporter.email, body: { name, resource: "projects", definition_json: definition },
    }))).data.id);
  }
  const dataLines = async (reportId) => (await (await send(env, `/api/v1/reports/export?id=${reportId}`, { email: exporter.email })).text()).trim().split("\r\n").length - 1;
  assert.equal(await dataLines(savedIds[0]), total, "CSV ucu da yazılmamış limitte tavana çıkmalı");
  assert.equal(await dataLines(savedIds[1]), 100);
});

// Hücre içeriğini kullanıcı yazar, dosyayı açan kişi genelde başkasıdır: metin
// hücresi elektronik tabloda formüle dönüşmemeli.
const formulaProjects = [
  ["prj-f1", "F-1", "=1+1"],
  ["prj-f2", "F-2", "+1"],
  ["prj-f3", "F-3", "-1"],
  ["prj-f4", "F-4", "@SUM(A1)"],
  ["prj-f5", "F-5", "\t=1+1"],
  ["prj-f6", "F-6", "Normal Proje"],
];

function seedFormulaProjects(database) {
  for (const [id, code, name] of formulaProjects) {
    database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,contract_amount_minor,planned_end_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(id, "tenant-a", code, name, "production", -150_000, "2026-03-31", timestamp, timestamp);
  }
}

const csvLines = async (response) => (await response.text()).replace(/^﻿/, "").trim().split("\r\n");

test("CSV hücresi elektronik tabloda formüle dönüşmez, sayı ve tarih bozulmaz", async () => {
  const { database, env } = await setup({ users: [exporter] });
  seedFormulaProjects(database);

  const saved = (await payload(await send(env, "/api/v1/saved-reports", {
    method: "POST", email: exporter.email,
    body: { name: "Formül denemesi", resource: "projects", definition_json: { resource: "projects", columns: ["code", "name", "planned_end_date", "contract_amount_minor"], sort: [{ field: "code", direction: "asc" }] } },
  }))).data;

  const lines = await csvLines(await send(env, `/api/v1/reports/export?id=${saved.id}`, { email: exporter.email }));
  assert.deepEqual(lines, [
    '"code","name","planned_end_date","contract_amount_minor"',
    '"F-1","\'=1+1","2026-03-31","-150000"',
    '"F-2","\'+1","2026-03-31","-150000"',
    '"F-3","\'-1","2026-03-31","-150000"',
    '"F-4","\'@SUM(A1)","2026-03-31","-150000"',
    '"F-5","\'\t=1+1","2026-03-31","-150000"',
    '"F-6","Normal Proje","2026-03-31","-150000"',
  ]);
  // Eksi işaretli tutar sayı olarak kalmalı: tek tırnak eklenseydi Excel'de
  // metne döner ve sütun toplanmazdı.
  assert.ok(lines.every((line) => !line.includes(`"'-150000"`)), "sayısal tutar korumaya takılmamalı");
  assert.ok(lines.every((line) => !line.includes(`"'2026-03-31"`)), "tarih korumaya takılmamalı");
});

test("formül koruması genel liste dökümünde de geçerlidir", async () => {
  const { database, env } = await setup({ users: [exporter] });
  seedFormulaProjects(database);

  // Rapor ucu ile liste ucu aynı CSV kapısından geçer; koruma tek yerde durduğu
  // sürece ikisi ayrışamaz.
  const text = (await csvLines(await send(env, "/api/v1/projects/export", { email: exporter.email }))).join("\r\n");
  for (const [, code, name] of formulaProjects.filter(([, , value]) => /^\s*[=+\-@]/.test(value))) {
    assert.ok(text.includes(`"'${name}"`), `${code} hücresi liste dökümünde de etkisizleşmeli`);
    assert.ok(!text.includes(`"${name}"`), `${code} hücresi korumasız biçimde hiç geçmemeli`);
  }
  assert.ok(text.includes('"Normal Proje"'), "normal metin liste dökümünde de bozulmamalı");
  assert.ok(text.includes('"-150000"') && !text.includes(`"'-150000"`), "sayısal tutar liste dökümünde de sayı kalmalı");
  assert.ok(text.includes('"2026-03-31"') && !text.includes(`"'2026-03-31"`), "tarih liste dökümünde de bozulmamalı");
});

// Göreli tarih testleri saatten bağımsızdır: "şimdi" sunucuya enjekte edilir.
// 2026-09-23T10:00Z İstanbul'da çarşamba 13:00'tür; hafta 21 Eylül pazartesi başlar.
const frozenNow = "2026-09-23T10:00:00.000Z";
const datedProjectDays = [
  "2025-12-31", "2026-01-01", "2026-03-31", "2026-04-01", "2026-06-25", "2026-06-26", "2026-06-30", "2026-07-01",
  "2026-08-24", "2026-08-25", "2026-08-31", "2026-09-01", "2026-09-14", "2026-09-16", "2026-09-17", "2026-09-20",
  "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01",
  "2026-10-22", "2026-10-23", "2027-01-01",
];

function seedDatedProjects(database) {
  for (const day of datedProjectDays) {
    database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,planned_end_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)")
      .run(`prj-d-${day}`, "tenant-a", day, `Proje ${day}`, "production", day, timestamp, timestamp);
  }
  // Tarihi boş proje: "eşit değil" süzgecinde kaybolmamalı, aralıklarda görünmemeli.
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
    .run("prj-d-bos", "tenant-a", "tarihsiz", "Tarihsiz", "production", timestamp, timestamp);
}

const datedCodes = async (env, filters, email = reporter.email) => {
  const response = await runReport(env, { resource: "projects", columns: ["code"], filters, sort: [{ field: "code", direction: "asc" }], limit: 5000 }, { email });
  assert.equal(response.status, 200, JSON.stringify(filters));
  return (await payload(response)).data.rows.map((row) => row.code);
};

test("göreli tarih aralıkları İstanbul takvimine göre doğru günleri seçer", async () => {
  const { database, env } = await setup({ users: [reporter] });
  seedDatedProjects(database);
  env.REPORT_CLOCK = frozenNow;

  // Beklenen aralıklar elle yazılmıştır (ilk ve son gün dahil); motorun
  // hesabını tekrar etmez.
  const expectations = {
    today: ["2026-09-23", "2026-09-23"],
    yesterday: ["2026-09-22", "2026-09-22"],
    this_week: ["2026-09-21", "2026-09-27"],
    last_week: ["2026-09-14", "2026-09-20"],
    this_month: ["2026-09-01", "2026-09-30"],
    last_month: ["2026-08-01", "2026-08-31"],
    this_quarter: ["2026-07-01", "2026-09-30"],
    last_quarter: ["2026-04-01", "2026-06-30"],
    this_year: ["2026-01-01", "2026-12-31"],
    last_year: ["2025-01-01", "2025-12-31"],
    last_7_days: ["2026-09-17", "2026-09-23"],
    last_30_days: ["2026-08-25", "2026-09-23"],
    last_90_days: ["2026-06-26", "2026-09-23"],
    next_7_days: ["2026-09-23", "2026-09-29"],
    next_30_days: ["2026-09-23", "2026-10-22"],
  };
  for (const [relative, [first, last]] of Object.entries(expectations)) {
    const codes = await datedCodes(env, [{ field: "planned_end_date", op: "between", value: { relative } }]);
    assert.deepEqual(codes, datedProjectDays.filter((day) => day >= first && day <= last), relative);
  }

  // Sınırlar açıkça: ayın son günü dahil, ertesi ayın ilki hariç; hafta pazartesi başlar.
  const thisMonth = await datedCodes(env, [{ field: "planned_end_date", op: "between", value: { relative: "this_month" } }]);
  assert.ok(thisMonth.includes("2026-09-30") && !thisMonth.includes("2026-10-01") && !thisMonth.includes("2026-08-31"));
  const thisWeek = await datedCodes(env, [{ field: "planned_end_date", op: "between", value: { relative: "this_week" } }]);
  assert.ok(thisWeek.includes("2026-09-21"), "pazartesi haftaya dahil olmalı");
  assert.ok(!thisWeek.includes("2026-09-20"), "önceki pazar bu haftaya girmemeli");
  assert.ok(thisWeek.includes("2026-09-27") && !thisWeek.includes("2026-09-28"), "pazar dahil, ertesi pazartesi hariç");
  const lastQuarter = await datedCodes(env, [{ field: "planned_end_date", op: "between", value: { relative: "last_quarter" } }]);
  assert.ok(lastQuarter.includes("2026-06-30") && !lastQuarter.includes("2026-07-01") && !lastQuarter.includes("2026-03-31"));

  // Sabit tarihli between eskisi gibi iki ucu da kapsar.
  assert.deepEqual(await datedCodes(env, [{ field: "planned_end_date", op: "between", value: ["2026-09-30", "2026-10-01"] }]), ["2026-09-30", "2026-10-01"]);
});

test("zaman damgası sütununda gün sınırı İstanbul gece yarısıdır, UTC değil", async () => {
  const { database, env } = await setup({ users: [reporter] });
  env.REPORT_CLOCK = frozenNow;
  const stamps = [
    ["once", "2026-08-31T20:30:00.000Z"], // İstanbul 31 Ağustos 23:30
    ["sinir", "2026-08-31T21:00:00.000Z"], // İstanbul 1 Eylül 00:00, tam sınır
    ["gece", "2026-08-31T21:30:00Z"], // İstanbul 1 Eylül 00:30, milisaniyesiz saklanmış
    ["son-an", "2026-09-30T20:59:59.999Z"], // İstanbul 30 Eylül 23:59:59
    ["ekim", "2026-09-30T21:00:00.000Z"], // İstanbul 1 Ekim 00:00
    ["dun-gec", "2026-09-22T20:59:00.000Z"], // İstanbul 22 Eylül 23:59
    ["bugun-erken", "2026-09-22T21:00:00.000Z"], // İstanbul 23 Eylül 00:00
  ];
  for (const [code, createdAt] of stamps) {
    database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
      .run(`prj-t-${code}`, "tenant-a", code, code, "production", createdAt, createdAt);
  }
  const codesFor = async (filters) => (await datedCodes(env, filters)).sort();

  assert.deepEqual(await codesFor([{ field: "created_at", op: "between", value: { relative: "this_month" } }]), ["bugun-erken", "dun-gec", "gece", "sinir", "son-an"].sort());
  assert.deepEqual(await codesFor([{ field: "created_at", op: "between", value: { relative: "last_month" } }]), ["once"]);
  assert.deepEqual(await codesFor([{ field: "created_at", op: "between", value: { relative: "today" } }]), ["bugun-erken"]);
  assert.deepEqual(await codesFor([{ field: "created_at", op: "between", value: { relative: "yesterday" } }]), ["dun-gec"]);
  // Nokta belirteci zaman damgasında bütün günü kapsar.
  assert.deepEqual(await codesFor([{ field: "created_at", op: "eq", value: { relative: "today" } }]), ["bugun-erken"]);
  assert.deepEqual(await codesFor([{ field: "created_at", op: "lt", value: { relative: "today", offsetDays: -22 } }]), ["once"], "1 Eylül'den önce yalnız İstanbul'da 31 Ağustos olan kayıt kalmalı");
});

test("gün, sunucunun saat diliminden değil İstanbul'dan okunur", async () => {
  const { database, env } = await setup({ users: [reporter] });
  seedDatedProjects(database);
  const previousZone = process.env.TZ;
  // UTC+14: sunucunun yerel tarihi İstanbul'dan bir gün ileride.
  process.env.TZ = "Pacific/Kiritimati";
  try {
    env.REPORT_CLOCK = frozenNow;
    assert.equal(new Date(frozenNow).getDate(), 24, "deney düzeneği: yerel saat gerçekten ertesi günde olmalı");
    assert.deepEqual(await datedCodes(env, [{ field: "planned_end_date", op: "between", value: { relative: "today" } }]), ["2026-09-23"]);
    // UTC'de hâlâ 23 Eylül, İstanbul'da 24 Eylül 01:30.
    env.REPORT_CLOCK = "2026-09-23T22:30:00.000Z";
    assert.deepEqual(await datedCodes(env, [{ field: "planned_end_date", op: "between", value: { relative: "yesterday" } }]), ["2026-09-23"]);
    // Ay dönümü: UTC'de 30 Eylül, İstanbul'da 1 Ekim.
    env.REPORT_CLOCK = "2026-09-30T21:30:00.000Z";
    const october = await datedCodes(env, [{ field: "planned_end_date", op: "between", value: { relative: "this_month" } }]);
    assert.deepEqual(october, ["2026-10-01", "2026-10-22", "2026-10-23"]);
  } finally {
    if (previousZone === undefined) delete process.env.TZ; else process.env.TZ = previousZone;
  }
});

test("bugün + gün kaydırmasıyla gecikmiş ve yaklaşan işler seçilir", async () => {
  const { database, env } = await setup({ users: [reporter] });
  seedDatedProjects(database);
  env.REPORT_CLOCK = frozenNow;
  const today = (op, offsetDays) => ({ field: "planned_end_date", op, value: offsetDays === undefined ? { relative: "today" } : { relative: "today", offsetDays } });

  const overdue = await datedCodes(env, [today("lt")]);
  assert.deepEqual(overdue, datedProjectDays.filter((day) => day < "2026-09-23"), "bugün dahil olmamalı");
  const upcoming = await datedCodes(env, [today("gte"), today("lte", 7)]);
  assert.deepEqual(upcoming, ["2026-09-23", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30"]);
  assert.deepEqual(await datedCodes(env, [today("eq", -1)]), ["2026-09-22"]);
  assert.deepEqual(await datedCodes(env, [today("gt", 0), today("lt", 5)]), ["2026-09-27"]);
  assert.deepEqual(await datedCodes(env, [today("gt", -2), today("lte", 0)]), ["2026-09-22", "2026-09-23"]);
  // Ay sonunu aşan kaydırma takvimde doğru yere düşer.
  assert.deepEqual(await datedCodes(env, [today("eq", 8)]), ["2026-10-01"]);
  // "Eşit değil" tarihsiz kaydı da getirir; eski ne davranışıyla aynı.
  const notToday = await datedCodes(env, [today("ne")]);
  assert.ok(!notToday.includes("2026-09-23"));
  assert.ok(notToday.includes("tarihsiz"));
  assert.equal(notToday.length, datedProjectDays.length);
});

test("göreli tarihin hatalı kullanımı anlaşılır bir 422 ile reddedilir", async () => {
  const { database, env } = await setup({ users: [reporter] });
  seedDatedProjects(database);
  env.REPORT_CLOCK = frozenNow;
  const attempts = [
    [{ field: "planned_end_date", op: "lt", value: { relative: "this_month" } }, "aralık belirteci karşılaştırmada"],
    [{ field: "planned_end_date", op: "between", value: { relative: "next_month" } }, "bilinmeyen aralık"],
    [{ field: "planned_end_date", op: "eq", value: { relative: "tomorrow" } }, "bilinmeyen nokta"],
    [{ field: "planned_end_date", op: "between", value: { relative: "today", offsetDays: 1 } }, "aralıkta kaydırma"],
    [{ field: "planned_end_date", op: "lt", value: { relative: "today", offsetDays: 3651 } }, "aralık dışı kaydırma"],
    [{ field: "planned_end_date", op: "lt", value: { relative: "today", offsetDays: -3651 } }, "aralık dışı eksi kaydırma"],
    [{ field: "planned_end_date", op: "lt", value: { relative: "today", offsetDays: 1.5 } }, "kesirli kaydırma"],
    [{ field: "planned_end_date", op: "lt", value: { relative: "today", offsetDays: "3" } }, "metin kaydırma"],
    [{ field: "planned_end_date", op: "in", value: { relative: "today" } }, "in işleci"],
    [{ field: "planned_end_date", op: "contains", value: { relative: "today" } }, "contains işleci"],
    [{ field: "planned_end_date", op: "eq", value: { relative: "today", saat: "13:00" } }, "tanınmayan alan"],
    [{ field: "code", op: "eq", value: { relative: "today" } }, "metin sütunu"],
    [{ field: "status", op: "between", value: { relative: "this_month" } }, "durum sütunu"],
    [{ field: "contract_amount_minor", op: "gt", value: { relative: "today" } }, "para sütunu"],
  ];
  for (const [filter, label] of attempts) {
    const response = await runReport(env, { resource: "projects", columns: ["code"], filters: [filter] }, { email: reporter.email });
    assert.equal(response.status, 422, label);
    const { error } = await payload(response);
    assert.equal(error.code, "invalid_relative_date", label);
    assert.ok(error.message && !/undefined|\[object/.test(error.message), `${label} için mesaj okunur olmalı: ${error.message}`);
  }
  // Belirteçler sınırın içinde kalınca geçer.
  assert.equal((await runReport(env, { resource: "projects", columns: ["code"], filters: [{ field: "planned_end_date", op: "lt", value: { relative: "today", offsetDays: -3650 } }] }, { email: reporter.email })).status, 200);
});

test("göreli tarihli tanım kaydedilir ve her çalıştırmada o günün tarihine çözülür", async () => {
  const { database, env } = await setup({ users: [reporter] });
  seedDatedProjects(database);
  env.REPORT_CLOCK = frozenNow;
  const save = (definition) => send(env, "/api/v1/saved-reports", { method: "POST", email: reporter.email, body: { name: "Bu ay bitenler", resource: "projects", definition_json: definition } });

  const definition = { resource: "projects", columns: ["code"], filters: [{ field: "planned_end_date", op: "between", value: { relative: "this_month" } }], sort: [{ field: "code", direction: "asc" }] };
  const created = await save(definition);
  assert.equal(created.status, 200, "motorun kabul ettiği belirteç kayıtta da kabul edilmeli");
  const saved = (await payload(created)).data;
  assert.deepEqual(saved.definition_json, definition, "belirteç sabit tarihe çevrilip saklanmamalı");

  const bad = await save({ resource: "projects", columns: ["code"], filters: [{ field: "code", op: "between", value: { relative: "this_month" } }] });
  assert.equal(bad.status, 422, "motorun reddettiği belirteç kaydedilememeli");
  assert.equal((await payload(bad)).error.code, "invalid_relative_date");

  const september = (await payload(await postRun(env, { savedReportId: saved.id }, reporter.email))).data.rows.map((row) => row.code);
  assert.equal(september[0], "2026-09-01");
  assert.equal(september.at(-1), "2026-09-30");

  // Aynı kayıt bir ay sonra kendiliğinden ekimi gösterir.
  env.REPORT_CLOCK = "2026-10-15T09:00:00.000Z";
  const october = (await payload(await postRun(env, { savedReportId: saved.id }, reporter.email))).data.rows.map((row) => row.code);
  assert.deepEqual(october, ["2026-10-01", "2026-10-22", "2026-10-23"]);
});

test("enjekte saat yalnız geliştirme kimliği açıkken dikkate alınır, üretimde gerçek saat geçerlidir", async () => {
  const { database, env } = await setup({ users: [reporter] });
  // Başlık kimliği kapalıyken de istek yapılabilsin diye gerçek bir API anahtarı.
  const rawToken = "rapor-saat-testi-anahtari";
  database.prepare("INSERT INTO api_tokens (id,user_id,name,token_hash,expires_at,created_at) VALUES (?,?,?,?,?,?)")
    .run("tok-saat", reporter.id, "Saat testi", createHash("sha256").update(rawToken).digest("hex"), null, timestamp);
  const istanbulDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const realToday = istanbulDay();
  for (const [code, day] of [["gecmis", "2000-01-15"], ["bugun", realToday]]) {
    database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,planned_end_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)")
      .run(`prj-saat-${code}`, "tenant-a", code, code, "production", day, timestamp, timestamp);
  }
  const codesWith = async (flags, relative) => {
    const headers = new Headers({ authorization: `Bearer ${rawToken}`, "x-tenant-id": "tenant-a", "content-type": "application/json" });
    const body = JSON.stringify({ definition: { resource: "projects", columns: ["code"], filters: [{ field: "planned_end_date", op: "between", value: { relative } }] } });
    const response = await worker.fetch(new Request("https://example.test/api/v1/reports/run", { method: "POST", headers, body }), { ...env, ...flags });
    assert.equal(response.status, 200);
    return (await payload(response)).data.rows.map((row) => row.code);
  };

  // Karşılaştırma: geliştirme ortamında saat gerçekten 2000 yılına donar.
  assert.deepEqual(await codesWith({ ALLOW_DEV_AUTH: "true", REPORT_CLOCK: "2000-01-15T10:00:00.000Z" }, "this_month"), ["gecmis"]);

  // Üretim: bayrak kapalı ya da hiç yokken REPORT_CLOCK tanımlı olsa bile yok sayılır.
  for (const flags of [{ ALLOW_DEV_AUTH: "false", REPORT_CLOCK: "2000-01-15T10:00:00.000Z" }, { ALLOW_DEV_AUTH: undefined, REPORT_CLOCK: "2000-01-15T10:00:00.000Z" }]) {
    assert.deepEqual(await codesWith(flags, "this_month"), realToday.slice(0, 7) === "2000-01" ? ["gecmis", "bugun"] : ["bugun"], "donmuş saat üretimde sessizce eski ayı göstermemeli");
    const today = await codesWith(flags, "today");
    // Test gece yarısına denk gelirse gün değişmiş olabilir; o durumda boş dönmesi de doğrudur.
    assert.ok(today.length === 1 ? today[0] === "bugun" : istanbulDay() !== realToday, `gerçek bugün seçilmeliydi: ${JSON.stringify(today)}`);
  }
});

test("adından anlaşılmayan tarih, zaman damgası, yüzde ve sayı sütunları doğru tipte sınıflanır", async () => {
  const { env } = await setup();
  const fields = new Map((await payload(await send(env, "/api/v1/reports/fields"))).data.map((item) => [item.resource, item.columns]));
  const typeOf = (resource, key) => fields.get(resource)?.find((column) => column.key === key)?.type;
  const expected = [
    ["project-tasks", "planned_start", "date"], ["project-tasks", "planned_end", "date"],
    ["production-orders", "planned_start", "date"], ["production-orders", "planned_end", "date"],
    // Üretim emri iş akışı bunlara UTC anı yazar; gün sınırı İstanbul'a göre kesilmeli.
    ["production-orders", "actual_start", "datetime"], ["production-orders", "actual_end", "datetime"],
    // Montajda aynı ad düz gün demek: o sütunlara yazan hiçbir sunucu yolu yok
    // ve komşuları `planned_start` / `planned_end` gün tutuyor. Aynı adın iki
    // tabloda iki tip vermesi, sınıflandırmanın tablo+sütunla anahtarlanmasının
    // bütün amacı.
    ["installations", "planned_start", "date"], ["installations", "actual_start", "date"], ["installations", "actual_end", "date"],
    ["resource-assignments", "planned_end", "date"], ["production-operations", "planned_end", "date"],
    ["material-requirements", "needed_by", "date"], ["purchase-requests", "needed_by", "date"],
    ["progress-payments", "period_start", "date"], ["progress-payments", "period_end", "date"],
    ["offers", "valid_until", "date"], ["supplier-quotations", "valid_until", "date"],
    ["supplier-quotations", "lead_time_days", "number"], ["production-issues", "delay_days", "number"],
    // Oranlar 0-100 arası yüzde olarak saklanır (18 = %18).
    ["contracts", "advance_rate", "percent"], ["contracts", "retention_rate", "percent"],
    ["offer-items", "discount_rate", "percent"], ["offer-items", "tax_rate", "percent"], ["bom-lines", "scrap_rate", "percent"],
    // Kur yüzde değil, sayıdır; adı "rate" ile bitse de.
    ["financial-transactions", "exchange_rate", "number"],
    ["suppliers", "rating", "number"], ["handovers", "satisfaction_score", "number"], ["contracts", "warranty_months", "number"],
    ["files", "size_bytes", "number"], ["survey-measurements", "width", "number"], ["survey-measurements", "height", "number"],
    ["survey-measurements", "depth", "number"], ["survey-measurements", "length", "number"], ["work-items", "width", "number"],
    ["bom-lines", "quantity_per_unit", "number"], ["production-operations", "sequence", "number"], ["bom-lines", "sort_order", "number"],
    // Yalnız saat ya da ay tutan sütunlara gün sınırı uygulanmaz.
    ["attendance", "check_in", "text"], ["attendance", "check_out", "text"], ["payroll-inputs", "period", "text"],
  ];
  for (const [resource, key, type] of expected) assert.equal(typeOf(resource, key), type, `${resource}.${key}`);
});

test("planlanan bitişi geçmiş görevler göreli tarihle seçilir", async () => {
  const { database, env } = await setup();
  seedProjects(database);
  env.REPORT_CLOCK = frozenNow;
  const tasks = [
    ["dun-bitmeliydi", "2026-09-22", "in_progress"],
    ["gecen-ay", "2026-08-31", "todo"],
    ["bugun-bitiyor", "2026-09-23", "todo"],
    ["yarin", "2026-09-24", "blocked"],
    ["bitmis-eski", "2026-09-01", "completed"],
    ["tarihsiz", null, "todo"],
  ];
  for (const [title, plannedEnd, status] of tasks) {
    database.prepare("INSERT INTO project_tasks (id,tenant_id,project_id,title,status,planned_end,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)")
      .run(`tsk-${title}`, "tenant-a", "prj-1", title, status, plannedEnd, timestamp, timestamp);
  }
  const response = await runReport(env, {
    resource: "project-tasks", columns: ["title", "planned_end"],
    filters: [{ field: "planned_end", op: "lt", value: { relative: "today" } }, { field: "status", op: "in", value: ["todo", "in_progress", "blocked"] }],
    sort: [{ field: "planned_end", direction: "asc" }],
  });
  assert.equal(response.status, 200);
  const body = await payload(response);
  assert.deepEqual(body.data.rows.map((row) => row.title), ["gecen-ay", "dun-bitmeliydi"]);
  assert.deepEqual(body.data.columns.find((column) => column.key === "planned_end"), { key: "planned_end", type: "date" });

  const upcoming = await payload(await runReport(env, { resource: "project-tasks", columns: ["title"], filters: [{ field: "planned_end", op: "between", value: { relative: "next_7_days" } }], sort: [{ field: "planned_end", direction: "asc" }] }));
  assert.deepEqual(upcoming.data.rows.map((row) => row.title), ["bugun-bitiyor", "yarin"]);
});

test("gün sayısı sütunlarında toplam ve ortalama alınabilir", async () => {
  const { database, env } = await setup();
  seedProjects(database);
  database.prepare("INSERT INTO suppliers (id,tenant_id,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("sup-1", "tenant-a", "Kereste AŞ", "active", timestamp, timestamp);
  database.prepare("INSERT INTO suppliers (id,tenant_id,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("sup-2", "tenant-a", "Cam Ltd", "active", timestamp, timestamp);
  for (const requestId of ["pr-1", "pr-2"]) {
    database.prepare("INSERT INTO purchase_requests (id,tenant_id,request_number,description,created_at,updated_at) VALUES (?,?,?,?,?,?)").run(requestId, "tenant-a", requestId.toUpperCase(), "Kereste", timestamp, timestamp);
  }
  // Bir talebe bir tedarikçi yalnız bir teklif verebilir; ortalama için iki talep gerekir.
  for (const [id, requestId, supplier, days] of [["q-1", "pr-1", "sup-1", 10], ["q-2", "pr-2", "sup-1", 20], ["q-3", "pr-1", "sup-2", 7]]) {
    database.prepare("INSERT INTO supplier_quotations (id,tenant_id,purchase_request_id,supplier_id,lead_time_days,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(id, "tenant-a", requestId, supplier, days, timestamp, timestamp);
  }
  database.prepare("INSERT INTO production_orders (id,tenant_id,order_number,project_id,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("po-1", "tenant-a", "UE-1", "prj-1", timestamp, timestamp);
  for (const [id, type, days] of [["iss-1", "material", 3], ["iss-2", "material", 4], ["iss-3", "machine", 2]]) {
    database.prepare("INSERT INTO production_issues (id,tenant_id,production_order_id,issue_type,description,delay_days,reported_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run(id, "tenant-a", "po-1", type, "Sorun", days, timestamp, timestamp, timestamp);
  }

  const delays = await runReport(env, { resource: "production-issues", group: { by: ["issue_type"], aggregates: [{ fn: "sum", field: "delay_days", as: "toplam_gecikme" }] }, sort: [{ field: "issue_type", direction: "asc" }] });
  assert.equal(delays.status, 200, "gecikme günü sayısal kabul edilmeli");
  const delayBody = await payload(delays);
  assert.deepEqual(delayBody.data.rows, [{ issue_type: "machine", toplam_gecikme: 2 }, { issue_type: "material", toplam_gecikme: 7 }]);
  assert.deepEqual(delayBody.data.columns.find((column) => column.key === "toplam_gecikme"), { key: "toplam_gecikme", type: "number" });

  const leadTimes = await runReport(env, { resource: "supplier-quotations", group: { by: ["supplier_id"], aggregates: [{ fn: "avg", field: "lead_time_days", as: "ort_termin" }] }, sort: [{ field: "ort_termin", direction: "desc" }] });
  assert.equal(leadTimes.status, 200, "termin günü sayısal kabul edilmeli");
  assert.deepEqual((await payload(leadTimes)).data.rows.map(({ supplier_name, ort_termin }) => [supplier_name, ort_termin]), [["Kereste AŞ", 15], ["Cam Ltd", 7]]);
});

test("İstanbul'da gece tamamlanan üretim emri doğru güne düşer", async () => {
  const { database, env } = await setup();
  seedProjects(database);
  env.REPORT_CLOCK = frozenNow;
  // Biçim, üretim emri iş akışının `now()` ile yazdığıyla aynı: milisaniyeli UTC ISO.
  const orders = [
    ["gece-bitti", "2026-09-22T22:30:00.000Z"], // İstanbul 23 Eylül 01:30
    ["dun-aksam", "2026-09-22T20:30:00.000Z"], // İstanbul 22 Eylül 23:30
    ["bugun-ogle", "2026-09-23T09:00:00.000Z"], // İstanbul 23 Eylül 12:00
  ];
  for (const [code, completedAt] of orders) {
    database.prepare("INSERT INTO production_orders (id,tenant_id,order_number,project_id,status,actual_start,actual_end,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(`po-${code}`, "tenant-a", code, "prj-1", "completed", "2026-09-20T06:00:00.000Z", completedAt, timestamp, timestamp);
  }
  const finished = async (value) => (await payload(await runReport(env, { resource: "production-orders", columns: ["order_number"], filters: [{ field: "actual_end", op: "between", value }], sort: [{ field: "order_number", direction: "asc" }] }))).data.rows.map((row) => row.order_number);
  // UTC'de 22 Eylül olan 22:30 anı, İstanbul'da bugündür; `date` sınırı onu düne atardı.
  assert.deepEqual(await finished({ relative: "today" }), ["bugun-ogle", "gece-bitti"]);
  assert.deepEqual(await finished({ relative: "yesterday" }), ["dun-aksam"]);
  // Nokta belirteci de aynı günü görür.
  const sameDay = (await payload(await runReport(env, { resource: "production-orders", columns: ["order_number"], filters: [{ field: "actual_end", op: "eq", value: { relative: "today" } }] }))).data.rows.map((row) => row.order_number).sort();
  assert.deepEqual(sameDay, ["bugun-ogle", "gece-bitti"]);
});

test("memnuniyet puanının ortalaması alınır, sıra alanı sayısal sıralanır", async () => {
  const { database, env } = await setup();
  seedProjects(database);
  for (const [id, project, score] of [["ho-1", "prj-1", 5], ["ho-2", "prj-1", 4], ["ho-3", "prj-3", 3], ["ho-4", "prj-3", null]]) {
    database.prepare("INSERT INTO handovers (id,tenant_id,handover_number,project_id,handover_date,customer_contact,satisfaction_score,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(id, "tenant-a", id.toUpperCase(), project, "2026-09-01", "Müşteri", score, timestamp, timestamp);
  }
  const satisfaction = await runReport(env, { resource: "handovers", group: { by: ["project_id"], aggregates: [{ fn: "avg", field: "satisfaction_score", as: "ort_memnuniyet" }, { fn: "count", as: "adet" }] }, sort: [{ field: "ort_memnuniyet", direction: "desc" }] });
  assert.equal(satisfaction.status, 200, "memnuniyet puanı sayısal kabul edilmeli");
  const body = await payload(satisfaction);
  // Puanı girilmemiş teslim ortalamayı düşürmez; SQL AVG boş değeri saymaz.
  assert.deepEqual(body.data.rows.map(({ project_name, ort_memnuniyet, adet }) => [project_name, ort_memnuniyet, adet]), [["P-1 · Lobi", 4.5, 2], ["P-3 · Mutfak", 3, 2]]);
  assert.deepEqual(body.data.columns.find((column) => column.key === "ort_memnuniyet"), { key: "ort_memnuniyet", type: "number" });

  database.prepare("INSERT INTO production_orders (id,tenant_id,order_number,project_id,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("po-1", "tenant-a", "UE-1", "prj-1", timestamp, timestamp);
  // Değer metin olarak gelse de sütun INTEGER olduğu için sayı saklanır.
  for (const [id, sequence] of [["op-a", "10"], ["op-b", 9], ["op-c", 2]]) {
    database.prepare("INSERT INTO production_operations (id,tenant_id,production_order_id,name,sequence,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run(id, "tenant-a", "po-1", id, sequence, timestamp, timestamp);
  }
  const operations = await payload(await runReport(env, { resource: "production-operations", columns: ["name", "sequence"], sort: [{ field: "sequence", direction: "asc" }] }));
  assert.deepEqual(operations.data.rows.map((row) => row.sequence), [2, 9, 10], "metin sıralaması 10'u 9'dan önce koyardı");
  assert.deepEqual(operations.data.columns.find((column) => column.key === "sequence"), { key: "sequence", type: "number" });
  const afterNine = await payload(await runReport(env, { resource: "production-operations", columns: ["name"], filters: [{ field: "sequence", op: "gt", value: 9 }] }));
  assert.deepEqual(afterNine.data.rows.map((row) => row.name), ["op-a"]);
  // Toplam artık "sayısal değil" diye reddedilmez.
  assert.equal((await runReport(env, { resource: "production-operations", group: { by: ["production_order_id"], aggregates: [{ fn: "max", field: "sequence", as: "son" }, { fn: "sum", field: "sequence", as: "toplam" }] } })).status, 200);
});
