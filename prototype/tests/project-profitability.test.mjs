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

// Kârlılık görünümü ancak gerçek şemada kanıtlanabilir: iş kuralları SQL'in
// içinde duruyor, bir sahte veritabanı yalnız kendi varsayımlarını doğrulardı.
// Bu yüzden diğer rapor testleri gibi göçler olduğu gibi uygulanır.
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
  seed(database);
  return { database, env: { DB: new D1Database(database), ALLOW_DEV_AUTH: "true", REPORT_CLOCK: "2026-09-23T10:00:00.000Z" } };
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
const runReport = async (env, definition, email) => payload(await send(env, "/api/v1/reports/run", { method: "POST", body: { definition }, email }));

// Elle kurulmuş tek proje. Beklenen rakamlar testin içinde ayrıca elle
// toplanıyor: görünümün SQL'ini aynı SQL ile doğrulamak hiçbir şey kanıtlamaz.
const EXPECTED = {
  contract: 1_000_000,
  expense: 200_000,        // 120.000 (approved) + 80.000 (paid, proje içi)
  material: 90_000,        // yalnız posted project_issue
  issue: 20_000,           // 15.000 (resolved) + 5.000 (open)
  collected: 500_000,      // 400.000 (collected) + 100.000 (paid)
};
EXPECTED.actual = EXPECTED.expense + EXPECTED.material + EXPECTED.issue; // 310.000
EXPECTED.margin = EXPECTED.contract - EXPECTED.actual;                   // 690.000
EXPECTED.marginPercent = 69;

function seed(database) {
  const insertCustomer = database.prepare("INSERT INTO customers (id,tenant_id,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)");
  insertCustomer.run("cus-a", "tenant-a", "Beyaz Otel", "active", timestamp, timestamp);
  insertCustomer.run("cus-b", "tenant-b", "Öteki Firma Müşterisi", "active", timestamp, timestamp);

  const insertProject = database.prepare("INSERT INTO projects (id,tenant_id,code,customer_id,name,manager_user_id,status,contract_amount_minor,estimated_cost_minor,progress_percent,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
  insertProject.run("prj-1", "tenant-a", "P-1", "cus-a", "Lobi ve resepsiyon", "owner-a", "production", EXPECTED.contract, 600_000, 45, timestamp, timestamp);
  insertProject.run("prj-2", "tenant-a", "P-2", "cus-a", "Hiç hareketi olmayan proje", null, "design", 500_000, 0, 0, timestamp, timestamp);
  // Sözleşme bedeli henüz girilmemiş proje: yüzde hesaplanamaz, ama satır
  // kaybolmamalı ve sorgu hata vermemeli.
  insertProject.run("prj-3", "tenant-a", "P-3", "cus-a", "Bedeli girilmemiş proje", null, "estimating", null, null, 0, timestamp, timestamp);
  insertProject.run("prj-b1", "tenant-b", "B-1", "cus-b", "Öteki firmanın projesi", null, "production", 2_000_000, 0, 0, timestamp, timestamp);

  const insertTransaction = database.prepare("INSERT INTO financial_transactions (id,tenant_id,transaction_number,project_id,type,transaction_date,amount_minor,official,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
  // Sayılanlar.
  insertTransaction.run("fin-1", "tenant-a", "F-1", "prj-1", "expense", "2026-03-01", 120_000, 1, "approved", timestamp, timestamp);
  // Proje içi (resmi olmayan) gider de sayılır: rapor işin gerçek kârlılığını
  // soruyor, resmi defterde ne göründüğünü değil.
  insertTransaction.run("fin-2", "tenant-a", "F-2", "prj-1", "expense", "2026-03-02", 80_000, 0, "paid", timestamp, timestamp);
  insertTransaction.run("fin-3", "tenant-a", "F-3", "prj-1", "income", "2026-03-03", 400_000, 1, "collected", timestamp, timestamp);
  insertTransaction.run("fin-4", "tenant-a", "F-4", "prj-1", "income", "2026-03-04", 100_000, 1, "paid", timestamp, timestamp);
  // Sayılmayanlar: kesinleşmemiş, geri alınmış, iptal edilmiş ve tahmin.
  insertTransaction.run("fin-5", "tenant-a", "F-5", "prj-1", "expense", "2026-03-05", 50_000, 1, "draft", timestamp, timestamp);
  insertTransaction.run("fin-6", "tenant-a", "F-6", "prj-1", "expense", "2026-03-06", 40_000, 1, "cancelled", timestamp, timestamp);
  insertTransaction.run("fin-7", "tenant-a", "F-7", "prj-1", "expense", "2026-03-07", 30_000, 1, "reversed", timestamp, timestamp);
  insertTransaction.run("fin-8", "tenant-a", "F-8", "prj-1", "cost_forecast", "2026-03-08", 300_000, 1, "approved", timestamp, timestamp);
  insertTransaction.run("fin-9", "tenant-a", "F-9", "prj-1", "income", "2026-03-09", 70_000, 1, "pending", timestamp, timestamp);
  // Hakediş ve avans tahsilata girmez: ikisi de faturaya, fatura da finans
  // hareketine dönüşür, iki kez saymak olurdu.
  insertTransaction.run("fin-10", "tenant-a", "F-10", "prj-1", "progress_payment", "2026-03-10", 250_000, 1, "paid", timestamp, timestamp);
  insertTransaction.run("fin-11", "tenant-a", "F-11", "prj-1", "advance", "2026-03-11", 150_000, 1, "collected", timestamp, timestamp);
  // Bedeli girilmemiş projenin tek gideri.
  insertTransaction.run("fin-12", "tenant-a", "F-12", "prj-3", "expense", "2026-03-12", 10_000, 1, "approved", timestamp, timestamp);
  // Firma izolasyonu: başka firmanın kaydı, tenant-a'nın projesini gösteriyor.
  insertTransaction.run("fin-x", "tenant-b", "F-X", "prj-1", "expense", "2026-03-13", 999_000, 1, "approved", timestamp, timestamp);
  insertTransaction.run("fin-y", "tenant-b", "F-Y", "prj-1", "income", "2026-03-14", 888_000, 1, "collected", timestamp, timestamp);

  const insertItem = database.prepare("INSERT INTO inventory_items (id,tenant_id,sku,name,unit,created_at,updated_at) VALUES (?,?,?,?,?,?,?)");
  insertItem.run("inv-a", "tenant-a", "MDF-18", "MDF 18mm", "adet", timestamp, timestamp);
  insertItem.run("inv-b", "tenant-b", "MDF-18", "MDF 18mm", "adet", timestamp, timestamp);
  const insertMovement = database.prepare("INSERT INTO stock_movements (id,tenant_id,movement_number,inventory_item_id,project_id,movement_type,movement_date,quantity,unit_cost_minor,total_cost_minor,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
  insertMovement.run("stk-1", "tenant-a", "S-1", "inv-a", "prj-1", "project_issue", "2026-03-01", 10, 9_000, 90_000, "posted", timestamp, timestamp);
  insertMovement.run("stk-2", "tenant-a", "S-2", "inv-a", "prj-1", "project_issue", "2026-03-02", 5, 6_000, 30_000, "cancelled", timestamp, timestamp);
  insertMovement.run("stk-3", "tenant-a", "S-3", "inv-a", "prj-1", "project_issue", "2026-03-03", 2, 7_000, 14_000, "draft", timestamp, timestamp);
  // Projeden iade ve depoya giriş projenin maliyeti değildir.
  insertMovement.run("stk-4", "tenant-a", "S-4", "inv-a", "prj-1", "project_return", "2026-03-04", 1, 10_000, 10_000, "posted", timestamp, timestamp);
  insertMovement.run("stk-5", "tenant-a", "S-5", "inv-a", "prj-1", "receipt", "2026-03-05", 3, 8_000, 24_000, "posted", timestamp, timestamp);
  insertMovement.run("stk-x", "tenant-b", "S-X", "inv-b", "prj-1", "project_issue", "2026-03-06", 7, 11_000, 77_000, "posted", timestamp, timestamp);

  const insertOrder = database.prepare("INSERT INTO production_orders (id,tenant_id,order_number,project_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)");
  insertOrder.run("pro-a", "tenant-a", "U-1", "prj-1", "in_progress", timestamp, timestamp);
  insertOrder.run("pro-b", "tenant-b", "U-X", "prj-b1", "in_progress", timestamp, timestamp);
  const insertIssue = database.prepare("INSERT INTO production_issues (id,tenant_id,production_order_id,project_id,issue_type,severity,description,reported_at,cost_impact_minor,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
  insertIssue.run("iss-1", "tenant-a", "pro-a", "prj-1", "quality", "high", "Kapak yüzeyi hatalı", timestamp, 15_000, "resolved", timestamp, timestamp);
  insertIssue.run("iss-2", "tenant-a", "pro-a", "prj-1", "material", "normal", "Eksik kenar bandı", timestamp, 5_000, "open", timestamp, timestamp);
  insertIssue.run("iss-3", "tenant-a", "pro-a", "prj-1", "other", "low", "Yanlışlıkla açılmış kayıt", timestamp, 99_000, "cancelled", timestamp, timestamp);
  insertIssue.run("iss-x", "tenant-b", "pro-b", "prj-1", "quality", "high", "Öteki firmanın sorunu", timestamp, 777_000, "open", timestamp, timestamp);
}

test("gerçekleşen maliyet, marj ve tahsilat elle hesaplanan değerlerle birebir aynıdır", async () => {
  const { env } = await setup();
  const result = await payload(await send(env, "/api/v1/project-profitability/prj-1"));
  const row = result.data;

  assert.equal(row.contract_amount_minor, EXPECTED.contract);
  assert.equal(row.estimated_cost_minor, 600_000);
  // Taslak, iptal, ters kayıt ve tahmin girmedi.
  assert.equal(row.expense_minor, EXPECTED.expense);
  // İptal ve taslak stok çıkışı, iade ve depo girişi girmedi.
  assert.equal(row.material_cost_minor, EXPECTED.material);
  // İptal edilmiş üretim sorunu girmedi.
  assert.equal(row.issue_cost_minor, EXPECTED.issue);
  // Hakediş ve avans tahsilata girmedi.
  assert.equal(row.collected_minor, EXPECTED.collected);

  assert.equal(row.actual_cost_minor, EXPECTED.actual);
  assert.equal(row.margin_minor, EXPECTED.margin);
  assert.equal(row.margin_percent, EXPECTED.marginPercent);
  // Görünüm proje başına tek satır verir ve satırın kimliği projenin kimliğidir.
  assert.equal(row.id, "prj-1");
  assert.equal(row.project_id, "prj-1");
  assert.equal(row.customer_name, "Beyaz Otel");
  assert.equal(row.manager_user_name, "Firma Sahibi");
});

test("hiç hareketi olmayan proje satırda kalır ve sıfır gösterir", async () => {
  const { env } = await setup();
  const result = await payload(await send(env, "/api/v1/project-profitability?project_id=prj-2"));
  assert.equal(result.data.length, 1);
  const row = result.data[0];
  for (const column of ["expense_minor", "collected_minor", "material_cost_minor", "issue_cost_minor", "actual_cost_minor"]) {
    assert.equal(row[column], 0, `${column} sıfır olmalı`);
  }
  assert.equal(row.margin_minor, 500_000);
  assert.equal(row.margin_percent, 100);
});

test("sözleşme bedeli olmayan projede marj yüzdesi NULL döner, sorgu hata vermez", async () => {
  const { env } = await setup();
  const row = (await payload(await send(env, "/api/v1/project-profitability/prj-3"))).data;
  assert.equal(row.contract_amount_minor, 0);
  assert.equal(row.estimated_cost_minor, 0);
  assert.equal(row.actual_cost_minor, 10_000);
  assert.equal(row.margin_minor, -10_000);
  // "Marjı %0" ile "marjı bilinmiyor" aynı şey değildir.
  assert.equal(row.margin_percent, null);
});

test("başka firmanın hareketleri toplamlara karışmaz", async () => {
  const { env } = await setup();
  const row = (await payload(await send(env, "/api/v1/project-profitability/prj-1"))).data;
  // tenant-b, aynı proje kimliğini gösteren gider, tahsilat, stok çıkışı ve
  // üretim sorunu kaydetti; hiçbiri tenant-a'nın toplamına girmemeli.
  assert.equal(row.expense_minor, EXPECTED.expense);
  assert.equal(row.collected_minor, EXPECTED.collected);
  assert.equal(row.material_cost_minor, EXPECTED.material);
  assert.equal(row.issue_cost_minor, EXPECTED.issue);
  assert.equal(row.actual_cost_minor, EXPECTED.actual);

  const list = await payload(await send(env, "/api/v1/project-profitability"));
  assert.deepEqual(list.data.map((item) => item.id).sort(), ["prj-1", "prj-2", "prj-3"]);
});

test("maliyet yetkisi olmayan kullanıcı marjı listede, raporda, süzgeçte ve sıralamada göremez", async () => {
  const { env } = await setup({ users: [{ id: "usr-satis", email: "satis@a.test", name: "Satışçı", permissions: ["projects.read", "reports.read", "export"] }] });
  const email = "satis@a.test";
  // Tahsilat da korumalı: bu kaynağın yetki kapısı `projects.read` olduğu için
  // tek koruma noktası `cost.view`. Böylece finans yetkisi olmayan biri bu
  // kaynaktan proje ekranında zaten görmediği hiçbir tutarı öğrenemiyor.
  const hidden = ["expense_minor", "material_cost_minor", "issue_cost_minor", "actual_cost_minor", "margin_minor", "margin_percent", "estimated_cost_minor", "collected_minor"];

  const row = (await payload(await send(env, "/api/v1/project-profitability/prj-1", { email }))).data;
  for (const column of hidden) assert.equal(column in row, false, `${column} listede görünmemeli`);
  // Korumasız kalan tek tutar sözleşme bedelidir.
  assert.equal(row.contract_amount_minor, EXPECTED.contract);

  // Rapor kurucusunda seçilebilir sütun olarak da listelenmez.
  const fields = (await payload(await send(env, "/api/v1/reports/fields", { email }))).data;
  const entry = fields.find((item) => item.resource === "project-profitability");
  assert.ok(entry, "kaynak rapor kurucusunda görünmeli");
  const offered = entry.columns.map((column) => column.key);
  for (const column of hidden) assert.equal(offered.includes(column), false, `${column} rapor kurucusunda sunulmamalı`);
  assert.ok(offered.includes("contract_amount_minor"));
  // Durum süzgeci gerçek proje aşama kodlarını sunar, serbest metne düşmez.
  assert.ok(entry.columns.find((column) => column.key === "status")?.values?.includes("production"));

  // Sütun, süzgeç, sıralama ve toplam: dördü de aynı kapıdan 403 döner, çünkü
  // süzmek ve sıralamak da değeri ele verir.
  const cases = [
    { columns: ["code", "margin_minor"] },
    { filters: [{ field: "margin_minor", op: "lt", value: 0 }] },
    { columns: ["code", "collected_minor"] },
    { sort: [{ field: "margin_percent", direction: "asc" }] },
    { group: { by: ["status"], aggregates: [{ fn: "sum", field: "actual_cost_minor", as: "toplam" }] } },
  ];
  for (const extra of cases) {
    const response = await send(env, "/api/v1/reports/run", { method: "POST", body: { definition: { resource: "project-profitability", ...extra } }, email });
    assert.equal(response.status, 403, `${JSON.stringify(extra)} 403 dönmeli`);
    assert.equal((await payload(response)).error.code, "sensitive_field_forbidden");
  }

  // Sütun seçilmediğinde motor yalnız görülebilir sütunları döndürür.
  const result = await runReport(env, { resource: "project-profitability" }, email);
  for (const column of hidden) assert.equal(result.data.columns.some((item) => item.key === column), false);
});

test("salt okunur kaynakta oluşturma, güncelleme ve silme 405 döner", async () => {
  const { env } = await setup();
  const cases = [
    ["/api/v1/project-profitability", "POST", { code: "P-9" }],
    ["/api/v1/project-profitability/prj-1", "PATCH", { margin_minor: 1 }],
    ["/api/v1/project-profitability/prj-1", "DELETE", undefined],
  ];
  for (const [path, method, body] of cases) {
    const response = await send(env, path, { method, body });
    assert.equal(response.status, 405, `${method} ${path} 405 dönmeli`);
    assert.equal((await payload(response)).error.code, "read_only");
  }
  // Satır gerçekten yerinde durmalı: 405 sessiz bir silmeyi örtmemeli.
  assert.equal((await payload(await send(env, "/api/v1/project-profitability/prj-1"))).data.margin_minor, EXPECTED.margin);
});

test("rapor motoru görünümü sıradan bir kaynak gibi çalıştırır ve müşteri adını çözer", async () => {
  const { env } = await setup();
  const result = await runReport(env, {
    resource: "project-profitability",
    columns: ["code", "customer_id", "contract_amount_minor", "actual_cost_minor", "margin_minor", "margin_percent"],
    sort: [{ field: "margin_minor", direction: "asc" }],
  });
  // Marja göre artan: zarar eden proje en üstte, en kârlı en altta.
  assert.deepEqual(result.data.rows.map((row) => row.code), ["P-3", "P-2", "P-1"]);
  assert.equal(result.data.rows[0].margin_minor, -10_000);
  assert.equal(result.data.rows[2].margin_minor, EXPECTED.margin);
  assert.equal(result.data.rows[2].margin_percent, EXPECTED.marginPercent);
  // Kimliğin yanında ad da gelir (dosyaya yalnız ad yazılır).
  assert.equal(result.data.rows[2].customer_name, "Beyaz Otel");
  assert.ok(result.data.columns.some((column) => column.key === "customer_name"));
  assert.equal(result.data.columns.find((column) => column.key === "margin_percent").type, "percent");
  assert.equal(result.data.columns.find((column) => column.key === "margin_minor").type, "money");

  // Gruplama da olduğu gibi çalışır: motorda tek satır değişmedi.
  const grouped = await runReport(env, {
    resource: "project-profitability",
    group: { by: ["customer_id"], aggregates: [{ fn: "sum", field: "actual_cost_minor", as: "toplam_maliyet" }, { fn: "count", as: "adet" }] },
  });
  assert.equal(grouped.data.rows.length, 1);
  assert.equal(grouped.data.rows[0].toplam_maliyet, EXPECTED.actual + 10_000);
  assert.equal(grouped.data.rows[0].adet, 3);
});

test("kaydedilmiş kârlılık raporu CSV olarak dökülür ve ham müşteri kimliği yazılmaz", async () => {
  const { env } = await setup();
  const created = await payload(await send(env, "/api/v1/saved-reports", {
    method: "POST",
    body: {
      name: "Kârlılık",
      resource: "project-profitability",
      definition_json: JSON.stringify({
        resource: "project-profitability",
        columns: ["code", "customer_id", "margin_minor"],
        sort: [{ field: "code", direction: "asc" }],
      }),
    },
  }));
  assert.ok(created.data?.id, "rapor kaydedilebilmeli");

  const response = await send(env, `/api/v1/reports/export?id=${created.data.id}`);
  assert.equal(response.status, 200);
  const lines = (await response.text()).trim().split("\n");
  // Müşteri kimliği sütunu düşürüldü, yerine adı yazıldı: dosyayı açan insana
  // UUID göstermenin hiçbir karşılığı yok.
  assert.deepEqual(lines[0].trim().split(","), ['"code"', '"customer_name"', '"margin_minor"']);
  assert.equal(lines[1].trim(), `"P-1","Beyaz Otel","${EXPECTED.margin}"`);
});

test("görünüm yedeğe tablo olarak girmez ama göç dosyası yedek sürümüne girer", async () => {
  const source = await readFile(new URL("../worker/index.js", import.meta.url), "utf8");
  const backupTables = source.match(/const backupTables = \[(.*?)\];/s)[1];
  // Türetilmiş veri yedeğe yazılmaz: kaynağı zaten yedekleniyor ve görünüme
  // geri yüklenemez. Yedek yazıcısı backupTables üzerinden gittiği için
  // görünümün orada olmaması onu tamamen dışarıda bırakır.
  assert.equal(backupTables.includes("project_profitability"), false);
  const backupMigrations = source.match(/const backupMigrations = \[(.*?)\];/s)[1];
  assert.ok(backupMigrations.includes("0017_project_profitability.sql"));
});

// Kârlılık görünümünde marjı `cost.view` arkasına koymak, aynı rakamın başka
// bir uçtan okunabildiği sürece anlamsız: komuta merkezi hesaplanmış bir özet
// döndürdüğü için `serializeRow`'un hassas alan kapısından hiç geçmiyordu.
test("komuta merkezi maliyet, taahhüt, kâr ve marjı cost.view olmayan kullanıcıya hiç göndermez", async () => {
  const { env } = await setup({ users: [{ id: "usr-uretim", email: "uretim@a.test", name: "Üretim Sorumlusu", permissions: ["projects.read"] }] });
  const hiddenFacts = ["expense_minor", "income_minor", "committed_purchase_minor", "invoiced_purchase_minor"];
  const hiddenFinance = ["actualCostMinor", "openCommitmentMinor", "forecastCostMinor", "estimatedProfitMinor", "realisedProfitMinor", "marginPercent"];

  const full = (await payload(await send(env, "/api/v1/projects/prj-1/command-center"))).data;
  // Yetkili kullanıcıda alanlar yerinde ve doğru: onaylı/ödenmiş gider 200.000,
  // açık taahhüt yok, dolayısıyla gerçekleşen ve tahmini kâr aynı.
  assert.equal(full.facts.expense_minor, EXPECTED.expense);
  assert.equal(full.facts.income_minor, EXPECTED.collected);
  assert.equal(full.finance.contractValueMinor, EXPECTED.contract);
  assert.equal(full.finance.actualCostMinor, EXPECTED.expense);
  assert.equal(full.finance.openCommitmentMinor, 0);
  assert.equal(full.finance.forecastCostMinor, EXPECTED.expense);
  assert.equal(full.finance.realisedProfitMinor, EXPECTED.contract - EXPECTED.expense);
  assert.equal(full.finance.estimatedProfitMinor, EXPECTED.contract - EXPECTED.expense);
  assert.equal(full.finance.marginPercent, 80);

  const limited = (await payload(await send(env, "/api/v1/projects/prj-1/command-center", { email: "uretim@a.test" }))).data;
  // Alan `null` değil, hiç yok: arayüz yokluğu görüp kutuyu çizmeyecek.
  for (const key of hiddenFacts) assert.equal(key in limited.facts, false, `facts.${key} gitmemeli`);
  for (const key of hiddenFinance) assert.equal(key in limited.finance, false, `finance.${key} gitmemeli`);
  // Sözleşme bedeli proje ekranında zaten görünüyor, burada da kalır.
  assert.equal(limited.finance.contractValueMinor, EXPECTED.contract);
  // Proje kaydının kendi maliyet alanı da (serializeRow) düşmüş olmalı.
  assert.equal("estimated_cost_minor" in limited.project, false);

  // Sayılar yerinde: süzme yanıtın sınırında yapıldığı için aşama kapıları
  // maliyeti göremeyen kullanıcı için farklı davranmaz.
  assert.equal(limited.facts.work_item_total, full.facts.work_item_total);
  assert.equal(limited.readiness, full.readiness);
  assert.deepEqual(limited.stages.map((stage) => stage.score), full.stages.map((stage) => stage.score));
  assert.deepEqual(limited.blockers.map((item) => item.id), full.blockers.map((item) => item.id));
});
