import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import worker from "../worker/index.js";

// Tahsilat/ödeme tarihinin kendi sütunu (göç 0019) ve `overdue` durumunun
// finans hareketlerinden kaldırılması.
//
// İki maddenin de ortak sebebi aynı: bir bilginin nerede durduğu, ondan ne
// sorulabileceğini belirliyor. Tarih `metadata_json` içindeyken rapor motoru
// onu göremiyordu (sütunları `PRAGMA table_info` ile beyaz listeliyor), yani
// "bu ay ne tahsil edildi" sorusu elde veri olduğu hâlde cevapsız kalıyordu.
// `overdue` ise durum sütununda duran ama hiçbir yolun yazmadığı bir koddu;
// yazılabilseydi bile vade uzatıldığında bayatlardı. Tek doğru kaynak
// `due_date`tir.

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

const SETTLEMENT_MIGRATION = "0019_finance_settlement_date.sql";

async function migrationNames() {
  return (await readdir(migrationsDirectory)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
}

// Göçler adıyla değil sırayla uygulanıyor; `until` verilirse o dosyanın
// öncesinde durulur. Geri doldurmanın gerçekten çalıştığını ölçmenin tek
// yolu, veriyi eski şemada üretip göçü ondan sonra uygulamaktır — göç
// uygulanmış bir veritabanına elle JSON yazmak kendi kendini doğrular.
async function applyMigrations(database, { until } = {}) {
  for (const name of await migrationNames()) {
    if (until && name >= until) break;
    database.exec(await readFile(new URL(name, migrationsDirectory), "utf8"));
  }
}

async function applySettlementMigration(database) {
  database.exec(await readFile(new URL(SETTLEMENT_MIGRATION, migrationsDirectory), "utf8"));
}

function seedTenant(database) {
  database.prepare("INSERT INTO tenants (id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)").run("tenant-a", "Firma A", "firma-a", timestamp, timestamp);
  database.prepare("INSERT INTO users (id,email,full_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("owner-a", "owner@a.test", "Firma Sahibi", "active", timestamp, timestamp);
  database.prepare("INSERT INTO roles (id,tenant_id,code,name,is_system,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("role-owner", "tenant-a", "owner", "Firma Sahibi", 1, timestamp, timestamp);
  database.prepare("INSERT INTO memberships (id,tenant_id,user_id,role_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("member-a", "tenant-a", "owner-a", "role-owner", "active", timestamp, timestamp);
  database.prepare("INSERT INTO customers (id,tenant_id,code,name,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("customer-a", "tenant-a", "C-1", "Müşteri A", timestamp, timestamp);
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,contract_amount_minor,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-1", "Otel lobisi", "production", 1_000_000, timestamp, timestamp);
}

function insertTransaction(database, row) {
  const columns = ["id", "tenant_id", "transaction_number", "project_id", "customer_id", "type", "transaction_date", "due_date", "amount_minor", "status", "metadata_json", "created_at", "updated_at"];
  const values = {
    tenant_id: "tenant-a", project_id: "project-a", customer_id: "customer-a", type: "income",
    transaction_date: "2026-08-01", due_date: null, amount_minor: 100_000, status: "approved",
    metadata_json: "{}", created_at: timestamp, updated_at: timestamp, ...row,
  };
  database.prepare(`INSERT INTO financial_transactions (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`).run(...columns.map((column) => values[column]));
}

async function setup() {
  const database = new DatabaseSync(":memory:");
  await applyMigrations(database);
  seedTenant(database);
  return { database, env: { DB: new D1Database(database), ALLOW_DEV_AUTH: "true" } };
}

function request(path, { method = "POST", body, email = "owner@a.test" } = {}) {
  const headers = new Headers({ "x-user-email": email, "x-tenant-id": "tenant-a" });
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`https://example.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
const send = (env, path, options) => worker.fetch(request(path, options), env);

// ——— 1. madde: tarihin kendi sütunu ————————————————————————————————————

test("göç, metadata'daki tahsilat ve ödeme tarihini sütuna taşır ve JSON'daki kopyayı siler", async () => {
  const database = new DatabaseSync(":memory:");
  await applyMigrations(database, { until: SETTLEMENT_MIGRATION });
  seedTenant(database);
  // Eski şemada yazılmış gerçek kayıtlar: göç 0018'in tahsilat ucu tarihi ve
  // kimin kaydettiğini tam olarak bu anahtarlara yazıyordu.
  insertTransaction(database, { id: "inc-1", transaction_number: "F-1", status: "collected", metadata_json: JSON.stringify({ collected_on: "2026-08-05", collected_by: "owner-a", note: "elle girildi" }) });
  insertTransaction(database, { id: "exp-1", transaction_number: "F-2", type: "expense", status: "paid", metadata_json: JSON.stringify({ paid_on: "2026-07-19", paid_by: "owner-a" }) });
  // Tahsilatla ilgisi olmayan kayıt: göç ona dokunmamalı, yoksa geri doldurma
  // "her satırı yeniden yaz" haline gelir.
  insertTransaction(database, { id: "inc-open", transaction_number: "F-3", status: "approved", due_date: "2026-07-01", metadata_json: JSON.stringify({ legacy_status: "planned" }) });

  const before = database.prepare("SELECT COUNT(*) AS count FROM pragma_table_info('financial_transactions') WHERE name IN ('settled_on','settled_by')").get();
  assert.equal(before.count, 0, "sütunlar göçten önce bulunmamalı, yoksa test kendi kendini doğrular");

  await applySettlementMigration(database);

  const read = (id) => database.prepare("SELECT settled_on,settled_by,metadata_json FROM financial_transactions WHERE id=?").get(id);
  const collected = read("inc-1");
  assert.equal(collected.settled_on, "2026-08-05");
  assert.equal(collected.settled_by, "owner-a");
  // JSON'daki kopya silindi ama kaydın geri kalan metadata'sı yerinde duruyor.
  assert.deepEqual(JSON.parse(collected.metadata_json), { note: "elle girildi" });

  const paid = read("exp-1");
  assert.equal(paid.settled_on, "2026-07-19");
  assert.equal(paid.settled_by, "owner-a");
  assert.deepEqual(JSON.parse(paid.metadata_json), {});

  const open = read("inc-open");
  assert.equal(open.settled_on, null);
  assert.equal(open.settled_by, null);
  assert.deepEqual(JSON.parse(open.metadata_json), { legacy_status: "planned" });

  // Tarihe göre sorulan soru artık veritabanının kendi işi: indeks olmadan da
  // cevap doğru olurdu, ama sütunun varlık nedeni bu sorgunun kurulabilmesi.
  const temmuz = database.prepare("SELECT id FROM financial_transactions WHERE tenant_id='tenant-a' AND settled_on BETWEEN '2026-07-01' AND '2026-07-31' ORDER BY settled_on").all();
  assert.deepEqual(temmuz.map((row) => row.id), ["exp-1"]);
});

test("tahsilat ve ödeme tarihi sütuna yazılır, metadata'ya değil", async () => {
  const { database, env } = await setup();
  insertTransaction(database, { id: "inc-1", transaction_number: "F-1", amount_minor: 400_000 });
  insertTransaction(database, { id: "exp-1", transaction_number: "F-2", type: "expense", amount_minor: 120_000 });

  let response = await send(env, "/api/v1/financial-transactions/inc-1/collect", { body: { settled_on: "2026-08-05" } });
  assert.equal(response.status, 200);
  let data = (await response.json()).data;
  assert.equal(data.status, "collected");
  assert.equal(data.settled_on, "2026-08-05");
  assert.equal(data.settled_by, "owner-a");
  // Tahakkuk tarihi kendi anlamını koruyor.
  assert.equal(data.transaction_date, "2026-08-01");
  // Eski yerinde hiçbir kopya kalmıyor: aynı bilginin iki kopyası er geç
  // ayrışır ve hangisinin doğru olduğu sorusu cevapsız kalır.
  assert.deepEqual(data.metadata_json, {});
  const stored = database.prepare("SELECT settled_on,settled_by,metadata_json FROM financial_transactions WHERE id='inc-1'").get();
  assert.equal(stored.settled_on, "2026-08-05");
  assert.equal(stored.settled_by, "owner-a");
  assert.equal(JSON.stringify(JSON.parse(stored.metadata_json)), "{}");

  response = await send(env, "/api/v1/financial-transactions/exp-1/pay", { body: { settled_on: "2026-07-19" } });
  assert.equal(response.status, 200);
  data = (await response.json()).data;
  assert.equal(data.settled_on, "2026-07-19");
  assert.deepEqual(data.metadata_json, {});

  // Kaydeden kişi, kaydı okurken kimlik olarak değil adıyla dönüyor: kırk
  // karakterlik bir kimlik "bu parayı kim kapattı" sorusunu cevaplamıyor.
  const fetched = (await (await send(env, "/api/v1/financial-transactions/inc-1", { method: "GET" })).json()).data;
  assert.equal(fetched.settled_by, "owner-a");
  assert.equal(fetched.settled_by_name, "Firma Sahibi");

  // Denetim kaydı tarihi de taşımaya devam ediyor; sütun onun yerine geçmiyor.
  const audit = database.prepare("SELECT changes_json FROM audit_logs WHERE action='collect' AND entity_id='inc-1'").get();
  assert.equal(JSON.parse(audit.changes_json).settled_on, "2026-08-05");
});

test("settled_on raporlanabilir, süzülebilir ve sıralanabilir bir sütundur", async () => {
  const { database, env } = await setup();
  insertTransaction(database, { id: "inc-1", transaction_number: "F-1", amount_minor: 400_000 });
  insertTransaction(database, { id: "inc-2", transaction_number: "F-2", amount_minor: 60_000 });
  insertTransaction(database, { id: "inc-3", transaction_number: "F-3", amount_minor: 90_000 });
  assert.equal((await send(env, "/api/v1/financial-transactions/inc-1/collect", { body: { settled_on: "2026-08-05" } })).status, 200);
  assert.equal((await send(env, "/api/v1/financial-transactions/inc-2/collect", { body: { settled_on: "2026-08-22" } })).status, 200);
  assert.equal((await send(env, "/api/v1/financial-transactions/inc-3/collect", { body: { settled_on: "2026-07-11" } })).status, 200);

  // Alan kataloğu: rapor kurucusu sütunu görebiliyor ve tipini tarih biliyor.
  const fields = (await (await send(env, "/api/v1/reports/fields", { method: "GET" })).json()).data;
  const financeColumns = fields.find((item) => item.resource === "financial-transactions").columns;
  const settledColumn = financeColumns.find((item) => item.key === "settled_on");
  assert.ok(settledColumn, "settled_on rapor alan kataloğunda olmalı");
  assert.equal(settledColumn.type, "date");
  // `settled_by` bilerek dışarıda: bu kaynakta `approved_by` de dışarıda ve
  // parayı kimin kapattığı istemcinin yazabileceği bir alan olmamalı.
  assert.ok(!financeColumns.some((item) => item.key === "settled_by"), "settled_by istemciye yazdırılmamalı");

  // "Bu ay tahsil edilenler": maddenin çıkış noktası olan soru.
  const report = await (await send(env, "/api/v1/reports/run", {
    body: {
      definition: {
        resource: "financial-transactions",
        columns: ["transaction_number", "settled_on", "amount_minor"],
        filters: [
          { field: "status", op: "eq", value: "collected" },
          { field: "settled_on", op: "between", value: ["2026-08-01", "2026-08-31"] },
        ],
        sort: [{ field: "settled_on", direction: "desc" }],
      },
    },
  })).json();
  assert.deepEqual(report.data.rows.map((row) => row.transaction_number), ["F-2", "F-1"]);
  assert.deepEqual(report.data.rows.map((row) => row.settled_on), ["2026-08-22", "2026-08-05"]);

  // Toplam da doğru: temmuzda kapanan kayıt ağustos toplamına girmiyor.
  const grouped = await (await send(env, "/api/v1/reports/run", {
    body: {
      definition: {
        resource: "financial-transactions",
        filters: [{ field: "settled_on", op: "between", value: ["2026-08-01", "2026-08-31"] }],
        group: { by: ["status"], aggregates: [{ fn: "sum", field: "amount_minor", as: "toplam" }] },
      },
    },
  })).json();
  assert.deepEqual(grouped.data.rows, [{ status: "collected", toplam: 460_000 }]);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM financial_transactions WHERE settled_on IS NOT NULL").get().count, 3);
});

test("settled_by istemciden yazılamaz", async () => {
  const { env } = await setup();
  // Parayı kimin kapattığı denetim bilgisidir; POST gövdesinden gelebilseydi
  // hiç tahsilat yapmamış bir kullanıcının adı kaydın üzerinde kalırdı.
  const response = await send(env, "/api/v1/financial-transactions", {
    body: { transaction_number: "F-9", type: "income", transaction_date: "2026-08-01", amount_minor: 1000, settled_by: "owner-a" },
  });
  assert.equal(response.status, 422);
  assert.match((await response.json()).error.message, /settled_by/);
});

// ——— 2. madde: `overdue` saklanan bir durum olmaktan çıkıyor ———————————

test("göç, elde kalmış overdue finans hareketini approved'a çeker", async () => {
  const database = new DatabaseSync(":memory:");
  await applyMigrations(database, { until: SETTLEMENT_MIGRATION });
  seedTenant(database);
  insertTransaction(database, { id: "inc-overdue", transaction_number: "F-1", status: "overdue", due_date: "2026-07-01" });
  assert.equal(database.prepare("SELECT status FROM financial_transactions WHERE id='inc-overdue'").get().status, "overdue");

  await applySettlementMigration(database);

  const row = database.prepare("SELECT status,due_date,updated_at,metadata_json FROM financial_transactions WHERE id='inc-overdue'").get();
  assert.equal(row.status, "approved");
  // Vade bilgisi yerinde: "vadesi geçmiş" cevabı buradan okunuyor.
  assert.equal(row.due_date, "2026-07-01");
  // Göç bir kullanıcı düzenlemesi değildir; "son güncelleyen" listelerini
  // kaydırmamalı.
  assert.equal(row.updated_at, timestamp);
  assert.equal(JSON.parse(row.metadata_json).legacy_status, "overdue");
});

test("veritabanı artık overdue finans hareketi kabul etmiyor, fatura kabul etmeye devam ediyor", async () => {
  const { database } = await setup();
  // Kuralın veritabanında olması şart: "hiçbir satırda bu durum yok" cümlesi
  // koda bakan birinin varsayımı olarak kalmamalı.
  assert.throws(() => insertTransaction(database, { id: "inc-x", transaction_number: "F-X", status: "overdue" }), /invalid status for financial_transactions/);
  insertTransaction(database, { id: "inc-ok", transaction_number: "F-OK" });
  assert.throws(() => database.prepare("UPDATE financial_transactions SET status='overdue' WHERE id='inc-ok'").run(), /invalid status for financial_transactions/);
  assert.equal(database.prepare("SELECT status FROM financial_transactions WHERE id='inc-ok'").get().status, "approved");

  // Fatura başka bir hikâye: orada `overdue` gerçekten kullanılıyor (fatura o
  // durumda açılabiliyor ve `overdue-receivables` raporu onu süzüyor).
  database.prepare("INSERT INTO invoices (id,tenant_id,invoice_number,direction,issue_date,due_date,grand_total_minor,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run("inv-1", "tenant-a", "FTR-1", "sales", "2026-07-01", "2026-07-15", 50_000, "overdue", timestamp, timestamp);
  assert.equal(database.prepare("SELECT status FROM invoices WHERE id='inv-1'").get().status, "overdue");
});

test("kayıt defteri overdue durumunu tanımıyor", async () => {
  const { env } = await setup();
  const response = await send(env, "/api/v1/financial-transactions", {
    body: { transaction_number: "F-9", type: "income", transaction_date: "2026-08-01", amount_minor: 1000, status: "overdue" },
  });
  assert.equal(response.status, 422);
  const detail = (await response.json()).error.message;
  assert.match(detail, /status yalnız şu değerlerden biri olabilir/);
  assert.ok(!detail.includes("overdue"), `izin verilen değerler arasında overdue kalmamalı: ${detail}`);
});

test("vadesi geçmiş alacak yalnız due_date'ten okunur ve tek tıkla kapanır", async () => {
  const { database, env } = await setup();
  // Vadesi geçmiş (dün), vadesi gelmemiş (yarın) ve vadesiz üç onaylı alacak.
  insertTransaction(database, { id: "inc-late", transaction_number: "F-1", amount_minor: 60_000, due_date: "2020-01-01" });
  insertTransaction(database, { id: "inc-soon", transaction_number: "F-2", amount_minor: 40_000, due_date: "2999-12-31" });
  insertTransaction(database, { id: "inc-nodate", transaction_number: "F-3", amount_minor: 10_000 });
  insertTransaction(database, { id: "exp-late", transaction_number: "F-4", type: "expense", amount_minor: 25_000, due_date: "2020-01-01" });

  const dashboard = async () => (await (await send(env, "/api/v1/dashboard", { method: "GET" })).json()).data;
  let panel = await dashboard();
  assert.equal(panel.receivables.amount_minor, 110_000);
  // Alt toplam yalnız vadesi geçmiş olanı sayıyor; durum kodu diye bir şey yok.
  assert.equal(panel.receivables.overdue_amount_minor, 60_000);
  assert.equal(panel.payables.amount_minor, 25_000);

  // Vadesi geçmiş kayıt `approved` durumundadır ve tahsilat ucu onu kabul eder.
  assert.equal((await send(env, "/api/v1/financial-transactions/inc-late/collect", { body: { settled_on: "2026-08-05" } })).status, 200);
  assert.equal((await send(env, "/api/v1/financial-transactions/exp-late/pay", { body: { settled_on: "2026-08-05" } })).status, 200);

  // Kapanan kayıt alacaktan da vadesi geçmiş alt toplamından da düşer: rapor
  // artık hiç kapanmayan bir alacak göstermiyor.
  panel = await dashboard();
  assert.equal(panel.receivables.amount_minor, 50_000);
  assert.equal(panel.receivables.overdue_amount_minor, 0);
  assert.equal(panel.payables.amount_minor, 0);
});

test("finans hareketlerini toplayan hiçbir sorgu overdue durumunu aramıyor", async () => {
  // Bu koruma davranışla ölçülemiyor: tetikleyici sayesinde hiçbir satır artık
  // bu kodu taşıyamadığı için `IN (...)` listesinde unutulmuş bir 'overdue'
  // toplamları değiştirmez, yalnız yan yana iki "vadesi geçti" tanımı
  // yaşatır — ve ikincisi, kod bir gün geri geldiğinde sessizce yanlış
  // cevap verir. Bu yüzden sorgu metinlerinin kendisi denetleniyor.
  const source = await readFile(new URL("../worker/index.js", import.meta.url), "utf8");
  const queries = source.match(/FROM financial_transactions[^"`]*/g) || [];
  assert.ok(queries.length >= 5, `beklenenden az sorgu tarandı: ${queries.length}`);
  const offenders = queries.filter((query) => query.includes("'overdue'"));
  assert.deepEqual(offenders, [], `finans sorgularında overdue kalmamalı:\n${offenders.join("\n")}`);
});

// ——— Ortak: yedek bütünlüğü ————————————————————————————————————————

test("yedek bildirimi 0019'u de sayar", async () => {
  // Yedek bildirimi hangi şemaya göre alındığını söyler; eksik bir göç adı,
  // geri yükleme sırasında "şema uyuşmuyor" hatasını sessiz bir veri kaybına
  // çevirirdi.
  const source = await readFile(new URL("../worker/index.js", import.meta.url), "utf8");
  const listed = source.match(/const backupMigrations = \[(.*?)\];/s)[1];
  for (const name of await migrationNames()) assert.ok(listed.includes(name), `${name} backupMigrations içinde olmalı`);
});
