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

// Depodaki diğer rapor testleri gibi gerçek göçlere ve gerçek veritabanına
// karşı çalışır: tekil indeks, satır kapsamı ve motorun sütun kapısı ancak
// gerçek şemada kanıtlanabilir.
async function setup({ users = [] } = {}) {
  const database = new DatabaseSync(":memory:");
  for (const name of (await readdir(migrationsDirectory)).filter((item) => /^\d{4}_.+\.sql$/.test(item)).sort()) {
    database.exec(await readFile(new URL(name, migrationsDirectory), "utf8"));
  }
  database.prepare("INSERT INTO tenants (id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)").run("tenant-a", "Firma A", "firma-a", timestamp, timestamp);
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
  // Göreli tarihli hazır raporlar takvimden bağımsız çalışsın.
  return { database, env: { DB: new D1Database(database), ALLOW_DEV_AUTH: "true", REPORT_CLOCK: "2026-09-23T10:00:00.000Z" } };
}

function request(path, { method = "GET", body, email = "owner@a.test" } = {}) {
  const headers = new Headers();
  headers.set("x-user-email", email);
  headers.set("x-tenant-id", "tenant-a");
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`https://example.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

const send = (env, path, options) => worker.fetch(request(path, options), env);
const payload = async (response) => response.json();
const postRun = (env, body, email) => send(env, "/api/v1/reports/run", { method: "POST", body, email });
const runBuiltin = async (env, body, email) => payload(await postRun(env, body, email));
const listBuiltin = async (env, email) => (await payload(await send(env, "/api/v1/reports/builtin", { email }))).data;
const saveView = (env, body, email) => send(env, "/api/v1/report-views", { method: "POST", body, email });
const columnKeys = (result) => result.data.columns.map((column) => column.key);

// Gruplu rapor: GROUP BY sütunu gizlense bile satırların birleşmediğini
// kanıtlayabilmek için kırılımı olan bir tanım gerekiyor.
const GROUPED = "portfolio-by-stage";
// Düz liste: sözleşmedeki gizleme örneğinin (paid_total_minor) geçtiği rapor.
const FLAT = "overdue-receivables";

function seed(database) {
  database.prepare("INSERT INTO customers (id,tenant_id,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("cus-a", "tenant-a", "Beyaz Otel", "active", timestamp, timestamp);
  database.prepare("INSERT INTO customers (id,tenant_id,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("cus-b", "tenant-a", "Mavi Rezidans", "active", timestamp, timestamp);
  const projects = [
    ["prj-1", "cus-a", "P-1", "Lobi", "production", 100_000, 60_000],
    ["prj-2", "cus-a", "P-2", "Odalar", "production", 250_000, 150_000],
    ["prj-3", "cus-b", "P-3", "Mutfak", "installation", 400_000, 300_000],
    ["prj-4", "cus-b", "P-4", "Teras", "installation", 150_000, 90_000],
  ];
  for (const [projectId, customer, code, name, status, contract, cost] of projects) {
    database.prepare("INSERT INTO projects (id,tenant_id,customer_id,code,name,status,contract_amount_minor,estimated_cost_minor,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run(projectId, "tenant-a", customer, code, name, status, contract, cost, timestamp, timestamp);
  }
  const invoices = [
    ["inv-1", "cus-a", "F-1", "2026-08-01", 100_000, 20_000, "open"],
    ["inv-2", "cus-b", "F-2", "2026-07-15", 50_000, 30_000, "partial"],
    ["inv-3", "cus-a", "F-3", "2026-09-01", 70_000, 0, "overdue"],
  ];
  for (const [invoiceId, customer, number, due, grand, paid, status] of invoices) {
    database.prepare("INSERT INTO invoices (id,tenant_id,invoice_number,direction,customer_id,issue_date,due_date,grand_total_minor,paid_total_minor,official,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(invoiceId, "tenant-a", number, "sales", customer, "2026-07-01", due, grand, paid, 1, status, timestamp, timestamp);
  }
}

// Ne maliyet (cost.view) ne de resmî fatura (finance.sensitive.read) yetkisi
// var: eklenen sütunun hassas alan kapısından geçtiği ancak böyle kanıtlanır.
const analyst = { id: "analist", email: "analist@a.test", name: "Analist", permissions: ["reports.read", "projects.read", "customers.read", "invoices.read", "export"] };
const colleague = { id: "meslektas", email: "meslektas@a.test", name: "Meslektaş", permissions: ["reports.read", "projects.read", "customers.read", "invoices.read"] };
// Hiçbir yazma yetkisi yok: kendi ekran tercihini yine de kaydedebilmeli.
const readOnly = { id: "salt-okunur", email: "saltokunur@a.test", name: "Salt Okunur", permissions: ["reports.read", "projects.read"] };

test("görünümsüz çalıştırma, görünümlü çalıştırma ve view:null ile varsayılana dönüş", async () => {
  const { database, env } = await setup({ users: [analyst] });
  seed(database);

  const base = await runBuiltin(env, { builtinReportId: GROUPED }, analyst.email);
  assert.deepEqual(columnKeys(base), ["status", "adet", "toplam_tutar"]);

  const live = await runBuiltin(env, { builtinReportId: GROUPED, view: { hiddenColumns: ["adet"] } }, analyst.email);
  assert.deepEqual(columnKeys(live), ["status", "toplam_tutar"], "gönderilen görünüm kaydetmeden uygulanmalı");
  assert.ok(live.data.rows.every((row) => !("adet" in row)), "gizlenen alan satırda da kalmamalı");

  assert.equal((await saveView(env, { builtin_id: GROUPED, view_json: { hiddenColumns: ["adet"] } }, analyst.email)).status, 200);

  const stored = await runBuiltin(env, { builtinReportId: GROUPED }, analyst.email);
  assert.deepEqual(columnKeys(stored), ["status", "toplam_tutar"], "görünüm gönderilmediğinde kayıtlı olan uygulanmalı");

  const reset = await runBuiltin(env, { builtinReportId: GROUPED, view: null }, analyst.email);
  assert.deepEqual(columnKeys(reset), ["status", "adet", "toplam_tutar"], "view:null kayıtlı görünümü yok saymalı");

  // Kayıtlı görünümü olmayan bir kullanıcı raporu varsayılan hâliyle görür.
  const untouched = await runBuiltin(env, { builtinReportId: GROUPED }, "owner@a.test");
  assert.deepEqual(columnKeys(untouched), ["status", "adet", "toplam_tutar"]);
});

test("gizleme sorguyu değiştirmez: gruplama sütunu gizlense de satır sayısı ve toplamlar aynı kalır", async () => {
  const { database, env } = await setup({ users: [analyst] });
  seed(database);

  const before = await runBuiltin(env, { builtinReportId: GROUPED }, analyst.email);
  // Bu testin bütün anlamı burada: GROUP BY sütunu gizleniyor.
  const after = await runBuiltin(env, { builtinReportId: GROUPED, view: { hiddenColumns: ["status"] } }, analyst.email);

  assert.equal(after.data.rows.length, before.data.rows.length, "gizleme satırları birleştirmemeli");
  assert.equal(after.meta.rowCount, before.meta.rowCount);
  assert.deepEqual(after.data.rows.map((row) => row.adet), before.data.rows.map((row) => row.adet));
  assert.deepEqual(after.data.rows.map((row) => row.toplam_tutar), before.data.rows.map((row) => row.toplam_tutar), "toplamlar birebir aynı kalmalı");
  assert.deepEqual(columnKeys(after), ["adet", "toplam_tutar"]);
  assert.ok(before.data.rows.length > 1, "kırılım gerçekten birden fazla satır üretmeli, yoksa test bir şey kanıtlamaz");

  // Düz listede de aynı şey: gizlenen sütun satır sayısını etkilemez.
  const flatBefore = await runBuiltin(env, { builtinReportId: FLAT }, analyst.email);
  const flatAfter = await runBuiltin(env, { builtinReportId: FLAT, view: { hiddenColumns: ["paid_total_minor"] } }, analyst.email);
  assert.equal(flatAfter.data.rows.length, flatBefore.data.rows.length);
  assert.deepEqual(flatAfter.data.rows.map((row) => row.grand_total_minor), flatBefore.data.rows.map((row) => row.grand_total_minor));
  assert.ok(!columnKeys(flatAfter).includes("paid_total_minor"));
});

test("bağlı kaydın kimliği gizlenince adı da gizlenir", async () => {
  const { database, env } = await setup({ users: [analyst] });
  seed(database);

  const base = await runBuiltin(env, { builtinReportId: FLAT }, analyst.email);
  assert.ok(columnKeys(base).includes("customer_id") && columnKeys(base).includes("customer_name"));

  // Kullanıcı için bu tek bir sütun ("Müşteri"); kimliği gizleyip adı bırakmak
  // gizlemeyi hiç yapmamakla aynı şey olurdu.
  const hidden = await runBuiltin(env, { builtinReportId: FLAT, view: { hiddenColumns: ["customer_id"] } }, analyst.email);
  assert.ok(!columnKeys(hidden).includes("customer_id"));
  assert.ok(!columnKeys(hidden).includes("customer_name"));
  assert.ok(hidden.data.rows.every((row) => !("customer_name" in row)));
});

test("gruplu rapora toplam, düz listeye sütun eklenir; tersleri 422", async () => {
  const { database, env } = await setup({ users: [analyst] });
  seed(database);

  const grouped = await runBuiltin(env, { builtinReportId: GROUPED, view: { extraAggregates: [{ fn: "avg", field: "contract_amount_minor", as: "ort_tutar" }] } }, analyst.email);
  assert.deepEqual(columnKeys(grouped), ["status", "adet", "toplam_tutar", "ort_tutar"]);
  for (const row of grouped.data.rows) assert.equal(row.ort_tutar, row.toplam_tutar / row.adet, "eklenen ortalama gerçekten hesaplanmalı");

  const flat = await runBuiltin(env, { builtinReportId: FLAT, view: { extraColumns: ["status"] } }, analyst.email);
  assert.ok(columnKeys(flat).includes("status"));
  assert.deepEqual(flat.data.rows.map((row) => row.status).sort(), ["open", "overdue", "partial"]);

  const groupedColumn = await postRun(env, { builtinReportId: GROUPED, view: { extraColumns: ["code"] } }, analyst.email);
  assert.equal(groupedColumn.status, 422, "gruplu raporda satır sütunu eklenemez");
  assert.equal((await payload(groupedColumn)).error.code, "invalid_report_view");

  const flatAggregate = await postRun(env, { builtinReportId: FLAT, view: { extraAggregates: [{ fn: "count", as: "adet" }] } }, analyst.email);
  assert.equal(flatAggregate.status, 422, "düz listeye toplam eklenemez");
  assert.equal((await payload(flatAggregate)).error.code, "invalid_report_view");
});

test("eklenen sütun motorun kendi kapısından geçer: hassas alan 403, beyaz liste dışı ad 422", async () => {
  const { database, env } = await setup({ users: [analyst] });
  seed(database);

  // Maaşı göremeyen maaş toplamını da alamamalı; aynı kural maliyette de geçerli.
  const cost = await postRun(env, { builtinReportId: GROUPED, view: { extraAggregates: [{ fn: "sum", field: "estimated_cost_minor", as: "maliyet" }] } }, analyst.email);
  assert.equal(cost.status, 403, "cost.view olmadan maliyet toplamı eklenemez");
  assert.equal((await payload(cost)).error.code, "sensitive_field_forbidden");

  const official = await postRun(env, { builtinReportId: FLAT, view: { extraColumns: ["official"] } }, analyst.email);
  assert.equal(official.status, 403, "finance.sensitive.read olmadan resmî alanı eklenemez");
  assert.equal((await payload(official)).error.code, "sensitive_field_forbidden");

  const unknown = await postRun(env, { builtinReportId: FLAT, view: { extraColumns: ["gizli_sutun"] } }, analyst.email);
  assert.equal(unknown.status, 422, "beyaz liste dışı ad sessizce atılmamalı");
  assert.equal((await payload(unknown)).error.code, "unknown_report_column");

  const nonNumeric = await postRun(env, { builtinReportId: GROUPED, view: { extraAggregates: [{ fn: "sum", field: "code", as: "sacma" }] } }, analyst.email);
  assert.equal(nonNumeric.status, 422);
  assert.equal((await payload(nonNumeric)).error.code, "non_numeric_aggregate");

  const collision = await postRun(env, { builtinReportId: GROUPED, view: { extraAggregates: [{ fn: "count", as: "adet" }] } }, analyst.email);
  assert.equal(collision.status, 422, "var olan başlıkla çakışan toplam reddedilmeli");
  assert.equal((await payload(collision)).error.code, "duplicate_report_alias");
});

test("boş görünüm ve tanınmayan anahtar 422 ile reddedilir", async () => {
  const { database, env } = await setup({ users: [analyst] });
  seed(database);

  const empty = await postRun(env, { builtinReportId: GROUPED, view: { hiddenColumns: ["status", "adet", "toplam_tutar"] } }, analyst.email);
  assert.equal(empty.status, 422, "hiç sütun kalmayan görünüm kabul edilmemeli");
  assert.equal((await payload(empty)).error.code, "invalid_report_view");

  const strange = await postRun(env, { builtinReportId: GROUPED, view: { siralama: ["status"] } }, analyst.email);
  assert.equal(strange.status, 422);
  assert.equal((await payload(strange)).error.code, "invalid_report_view");

  assert.equal((await postRun(env, { builtinReportId: GROUPED, view: [] }, analyst.email)).status, 422);
  assert.equal((await postRun(env, { builtinReportId: GROUPED, view: { hiddenColumns: "status" } }, analyst.email)).status, 422);
});

test("görünüm yalnız hazır raporla birlikte kabul edilir", async () => {
  const { database, env } = await setup({ users: [analyst] });
  seed(database);

  const inline = await postRun(env, { definition: { resource: "projects", columns: ["code", "name"] }, view: { hiddenColumns: ["name"] } }, analyst.email);
  assert.equal(inline.status, 422, "gövdeden gelen tanımda görünüm kabul edilmemeli");
  assert.equal((await payload(inline)).error.code, "unsupported_report_view");

  const saved = await send(env, "/api/v1/saved-reports", { method: "POST", body: { name: "Projeler", resource: "projects", definition_json: { resource: "projects", columns: ["code", "name"] } }, email: "owner@a.test" });
  assert.equal(saved.status, 200);
  const savedId = (await payload(saved)).data.id;
  const withView = await postRun(env, { savedReportId: savedId, view: { hiddenColumns: ["name"] } }, "owner@a.test");
  assert.equal(withView.status, 422, "kendi raporunda sütun kurucudan değiştirilir");
  assert.equal((await payload(withView)).error.code, "unsupported_report_view");
});

test("kaydetme doğrulaması motorun kapısından geçer: açılınca hata verecek görünüm kaydedilemez", async () => {
  const { database, env } = await setup({ users: [analyst] });
  seed(database);

  const missingReport = await saveView(env, { builtin_id: "boyle-bir-rapor-yok", view_json: { hiddenColumns: ["adet"] } }, analyst.email);
  assert.equal(missingReport.status, 422);
  assert.equal((await payload(missingReport)).error.code, "unknown_builtin_report");

  const sensitive = await saveView(env, { builtin_id: GROUPED, view_json: { extraAggregates: [{ fn: "sum", field: "estimated_cost_minor", as: "maliyet" }] } }, analyst.email);
  assert.equal(sensitive.status, 403, "kaydedilemeyecek olan, çalıştırılamayan ile aynı olmalı");

  const emptyView = await saveView(env, { builtin_id: GROUPED, view_json: { hiddenColumns: ["status", "adet", "toplam_tutar"] } }, analyst.email);
  assert.equal(emptyView.status, 422);

  const typo = await saveView(env, { builtin_id: GROUPED, view_json: { hiddenColumns: ["toplam_tutarr"] } }, analyst.email);
  assert.equal(typo.status, 422, "yanlış yazılmış sütun adı sessizce hiçbir şey gizlememeli");
  assert.equal((await payload(typo)).error.code, "unknown_report_column");

  const wrongShape = await saveView(env, { builtin_id: GROUPED, view_json: { extraColumns: ["code"] } }, analyst.email);
  assert.equal(wrongShape.status, 422, "gruplu rapora sütun ekleyen görünüm kaydedilememeli");
});

test("aynı hazır rapor için ikinci görünüm kaydı açılamaz", async () => {
  const { database, env } = await setup({ users: [analyst] });
  seed(database);

  const first = await saveView(env, { builtin_id: GROUPED, view_json: { hiddenColumns: ["adet"] } }, analyst.email);
  assert.equal(first.status, 200);
  const viewId = (await payload(first)).data.id;

  const second = await saveView(env, { builtin_id: GROUPED, view_json: { hiddenColumns: ["toplam_tutar"] } }, analyst.email);
  assert.equal(second.status, 409, "tekil indeks ikinci kaydı engellemeli");
  assert.equal((await payload(second)).error.code, "constraint_error");

  // İstemcinin yolu güncellemedir; aynı satır üstüne yazılır.
  const updated = await send(env, `/api/v1/report-views/${viewId}`, { method: "PATCH", body: { view_json: { hiddenColumns: ["toplam_tutar"] } }, email: analyst.email });
  assert.equal(updated.status, 200);
  assert.deepEqual((await payload(updated)).data.view_json, { hiddenColumns: ["toplam_tutar"] });

  // Başka bir rapor için ayrı kayıt açılabilmeli.
  assert.equal((await saveView(env, { builtin_id: FLAT, view_json: { hiddenColumns: ["paid_total_minor"] } }, analyst.email)).status, 200);
});

test("başkasının görünümü listelenemez, okunamaz, değiştirilemez ve silinemez — firma sahibi dahil", async () => {
  const { database, env } = await setup({ users: [analyst, colleague] });
  seed(database);

  const created = await saveView(env, { builtin_id: GROUPED, view_json: { hiddenColumns: ["adet"] } }, analyst.email);
  assert.equal(created.status, 200);
  const record = (await payload(created)).data;
  const viewId = record.id;
  assert.equal(record.user_id, analyst.id, "user_id sunucudan yazılmalı");

  for (const email of [colleague.email, "owner@a.test"]) {
    const listed = await payload(await send(env, "/api/v1/report-views", { email }));
    assert.deepEqual(listed.data, [], `${email} başkasının görünümünü listede görmemeli`);
    assert.equal((await send(env, `/api/v1/report-views/${viewId}`, { email })).status, 404);
    assert.equal((await send(env, `/api/v1/report-views/${viewId}`, { method: "PATCH", body: { view_json: { hiddenColumns: [] } }, email })).status, 404);
    assert.equal((await send(env, `/api/v1/report-views/${viewId}`, { method: "DELETE", email })).status, 404);
  }

  // Firma sahibi aynı raporu varsayılan hâliyle görmeye devam eder.
  const ownerList = await listBuiltin(env, "owner@a.test");
  assert.equal(ownerList.find((report) => report.id === GROUPED).view, null);
  assert.deepEqual(columnKeys(await runBuiltin(env, { builtinReportId: GROUPED }, "owner@a.test")), ["status", "adet", "toplam_tutar"]);

  // Sahibi hâlâ kendi kaydına erişebiliyor ve silebiliyor.
  assert.equal((await send(env, `/api/v1/report-views/${viewId}`, { email: analyst.email })).status, 200);
  assert.equal((await send(env, `/api/v1/report-views/${viewId}`, { method: "DELETE", email: analyst.email })).status, 204);
  assert.deepEqual(columnKeys(await runBuiltin(env, { builtinReportId: GROUPED }, analyst.email)), ["status", "adet", "toplam_tutar"]);
});

test("kaydedilen görünüm hazır rapor listesinde döner ve sonraki çalıştırmada kendiliğinden uygulanır", async () => {
  const { database, env } = await setup({ users: [analyst] });
  seed(database);

  const view = { hiddenColumns: ["paid_total_minor"], extraColumns: ["status"] };
  assert.equal((await saveView(env, { builtin_id: FLAT, view_json: view }, analyst.email)).status, 200);

  const listed = await listBuiltin(env, analyst.email);
  const card = listed.find((report) => report.id === FLAT);
  assert.deepEqual(card.view, view, "kart kendi görünümünü taşımalı");
  assert.ok(listed.filter((report) => report.id !== FLAT).every((report) => report.view === null), "görünümü olmayan kartta null olmalı");
  // Hazır raporun kendisi kodda kalır: listede hâlâ varsayılan tanım döner.
  assert.deepEqual(card.definition.columns, ["invoice_number", "customer_id", "due_date", "grand_total_minor", "paid_total_minor"]);

  const result = await runBuiltin(env, { builtinReportId: FLAT }, analyst.email);
  assert.ok(!columnKeys(result).includes("paid_total_minor"));
  assert.ok(columnKeys(result).includes("status"));
});

test("CSV dökümünde de görünüm uygulanır", async () => {
  const { database, env } = await setup({ users: [analyst] });
  seed(database);

  assert.equal((await saveView(env, { builtin_id: FLAT, view_json: { hiddenColumns: ["paid_total_minor"] } }, analyst.email)).status, 200);

  const exported = await runBuiltin(env, { builtinReportId: FLAT, export: true }, analyst.email);
  assert.ok(!columnKeys(exported).includes("paid_total_minor"), "döküm ekrandakiyle aynı sütunları taşımalı");
  assert.ok(exported.data.rows.every((row) => !("paid_total_minor" in row)));
  assert.equal(exported.data.rows.length, 3);

  // Döküm izi, görünümden bağımsız olarak hazır raporun kimliğiyle yazılır.
  const audit = database.prepare("SELECT entity_type,entity_id,changes_json FROM audit_logs WHERE action='export'").get();
  assert.equal(audit.entity_type, "builtin-reports");
  assert.equal(audit.entity_id, FLAT);
  assert.equal(JSON.parse(audit.changes_json).row_count, 3, "denetim kaydı gerçek satır sayısını yazmalı");

  // Gönderilen görünüm dökümde de geçerli.
  const live = await runBuiltin(env, { builtinReportId: FLAT, export: true, view: { hiddenColumns: ["due_date"] } }, analyst.email);
  assert.ok(!columnKeys(live).includes("due_date"));
  assert.ok(columnKeys(live).includes("paid_total_minor"), "gönderilen görünüm kayıtlının yerine geçmeli");
});

test("salt okunur rol kendi görünümünü kaydedebilir, düzenleyebilir ve silebilir", async () => {
  const { database, env } = await setup({ users: [readOnly] });
  seed(database);

  // Yeni bir yetki kodu yok: reports.read hem okumaya hem kendi tercihini
  // yazmaya yetiyor, çünkü bu bir rapor yazma işi değil ekran tercihi.
  assert.ok(!readOnly.permissions.some((code) => code.endsWith(".write") || code.endsWith(".delete")));

  const created = await saveView(env, { builtin_id: GROUPED, view_json: { hiddenColumns: ["adet"] } }, readOnly.email);
  assert.equal(created.status, 200, "salt okunur rol kendi görünümünü kaydedebilmeli");
  const viewId = (await payload(created)).data.id;

  assert.equal((await send(env, `/api/v1/report-views/${viewId}`, { method: "PATCH", body: { view_json: { hiddenColumns: ["toplam_tutar"] } }, email: readOnly.email })).status, 200);
  assert.equal((await send(env, `/api/v1/report-views/${viewId}`, { method: "DELETE", email: readOnly.email })).status, 204);

  // Rapor yetkisi hiç olmayan biri görünüm de kaydedemez.
  const outsider = { id: "yabanci", email: "yabanci@a.test", permissions: ["projects.read"] };
  const { env: strangerEnv } = await setup({ users: [outsider] });
  assert.equal((await saveView(strangerEnv, { builtin_id: GROUPED, view_json: {} }, outsider.email)).status, 403);
});

test("kayıtlı görünüm yetkiye takılırsa rapor varsayılan hâliyle açılır, tercih silinmez", async () => {
  const costAnalyst = { id: "maliyetci", email: "maliyetci@a.test", name: "Maliyetçi", permissions: ["reports.read", "projects.read", "customers.read", "cost.view"] };
  const { database, env } = await setup({ users: [costAnalyst] });
  seed(database);

  const view = { extraAggregates: [{ fn: "sum", field: "estimated_cost_minor", as: "maliyet" }] };
  const saved = await saveView(env, { builtin_id: GROUPED, view_json: view }, costAnalyst.email);
  assert.equal(saved.status, 200);
  const viewId = (await payload(saved)).data.id;

  const granted = await runBuiltin(env, { builtinReportId: GROUPED }, costAnalyst.email);
  assert.ok(columnKeys(granted).includes("maliyet"));
  assert.equal(granted.meta.viewIgnored, undefined, "yetki yerindeyken bayrak konmamalı");

  // Yetki geri alınıyor: görünüm kaydedildiğinde geçerliydi, artık değil.
  const revoke = () => database.prepare("DELETE FROM role_permissions WHERE tenant_id=? AND role_id=? AND permission_code=?").run("tenant-a", `role-${costAnalyst.id}`, "cost.view");
  revoke();

  const response = await postRun(env, { builtinReportId: GROUPED }, costAnalyst.email);
  assert.equal(response.status, 200, "rapor büsbütün açılmaz olmamalı");
  const fallback = await payload(response);
  assert.deepEqual(columnKeys(fallback), ["status", "adet", "toplam_tutar"], "varsayılan hâliyle açılmalı");
  assert.equal(fallback.meta.viewIgnored, "sensitive_field_forbidden", "neden varsayılana düşüldüğü söylenmeli");

  // Tercih silinmiyor: yetki geri verilirse kendiliğinden işlemeli.
  assert.equal(database.prepare("SELECT COUNT(*) AS total FROM report_views WHERE id=?").get(viewId).total, 1);
  assert.deepEqual((await listBuiltin(env, costAnalyst.email)).find((report) => report.id === GROUPED).view, view, "kayıtlı görünüm listede durmalı");

  // Açıkça gönderilen aynı görünüm sessizce yutulmaz.
  const explicit = await postRun(env, { builtinReportId: GROUPED, view }, costAnalyst.email);
  assert.equal(explicit.status, 403, "açık istek 403 ile geri çevrilmeli");
  assert.equal((await payload(explicit)).error.code, "sensitive_field_forbidden");

  // Yetki geri veriliyor.
  database.prepare("INSERT INTO role_permissions (tenant_id,role_id,permission_code) VALUES (?,?,?)").run("tenant-a", `role-${costAnalyst.id}`, "cost.view");
  const restored = await runBuiltin(env, { builtinReportId: GROUPED }, costAnalyst.email);
  assert.ok(columnKeys(restored).includes("maliyet"), "tercih kendiliğinden yeniden işlemeli");
  assert.equal(restored.meta.viewIgnored, undefined);

  // Geri çekilme yalnız yetki hatasında: kaynağı hiç okuyamayan kullanıcıda
  // temeldeki raporun kendi 403'ü olduğu gibi dönmeli.
  revoke();
  database.prepare("DELETE FROM role_permissions WHERE tenant_id=? AND role_id=? AND permission_code=?").run("tenant-a", `role-${costAnalyst.id}`, "projects.read");
  assert.equal((await postRun(env, { builtinReportId: GROUPED }, costAnalyst.email)).status, 403);
});

test("görünüm başka firmaya sızmaz ve raporun kendi satır kapsamını genişletmez", async () => {
  const { database, env } = await setup({ users: [analyst] });
  seed(database);
  database.prepare("INSERT INTO tenants (id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)").run("tenant-b", "Firma B", "firma-b", timestamp, timestamp);
  database.prepare("INSERT INTO customers (id,tenant_id,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("cus-x", "tenant-b", "Rakip", "active", timestamp, timestamp);
  database.prepare("INSERT INTO projects (id,tenant_id,customer_id,code,name,status,contract_amount_minor,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run("prj-x", "tenant-b", "cus-x", "GIZLI-1", "Rakip Proje", "production", 9_999_999, timestamp, timestamp);
  // Başka firmanın kullanıcısına ait bir görünüm kaydı.
  database.prepare("INSERT INTO report_views (id,tenant_id,user_id,builtin_id,view_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
    .run("rvw-x", "tenant-b", analyst.id, GROUPED, JSON.stringify({ hiddenColumns: ["status"] }), timestamp, timestamp);

  assert.deepEqual((await payload(await send(env, "/api/v1/report-views", { email: analyst.email }))).data, [], "başka firmanın kaydı görünmemeli");
  const result = await runBuiltin(env, { builtinReportId: GROUPED }, analyst.email);
  assert.deepEqual(columnKeys(result), ["status", "adet", "toplam_tutar"], "başka firmadaki görünüm uygulanmamalı");
  assert.equal(result.data.rows.reduce((total, row) => total + row.toplam_tutar, 0), 900_000, "başka firmanın tutarı toplama girmemeli");
});
