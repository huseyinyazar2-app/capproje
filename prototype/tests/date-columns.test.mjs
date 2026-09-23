import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import worker, { __testing } from "../worker/index.js";

// Tarih sütunlarına yazılan değerin gerçekten tarih olduğunun denetimi.
//
// Para, JSON, mantıksal ve numaralandırma sütunlarının hepsinin denetimi vardı;
// tarihin yoktu ve tarih sütunu serbest metin sayılıyordu. `due_date: "0"` API'den
// geçiyor, SQLite'ta `'0' < '2026-09-23'` doğru olduğu için o kayıt vade
// sorgularında sessizce "vadesi geçmiş" tarafına düşüyordu. Süzgeç tarafına
// biçim kalıbı konarak belirti kapatılmıştı; burada kapatılan kök sorundur.
//
// İki şey birlikte ölçülüyor: sınıflandırmanın doğru olması (sütunun gerçekte
// ne tuttuğu) ve sınıflandırmanın yazarken uygulanması.

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

async function setup() {
  const database = new DatabaseSync(":memory:");
  for (const name of (await readdir(migrationsDirectory)).filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort()) {
    database.exec(await readFile(new URL(name, migrationsDirectory), "utf8"));
  }
  database.prepare("INSERT INTO tenants (id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)").run("tenant-a", "Firma A", "firma-a", timestamp, timestamp);
  database.prepare("INSERT INTO users (id,email,full_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("owner-a", "owner@a.test", "Firma Sahibi", "active", timestamp, timestamp);
  database.prepare("INSERT INTO roles (id,tenant_id,code,name,is_system,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("role-owner", "tenant-a", "owner", "Firma Sahibi", 1, timestamp, timestamp);
  database.prepare("INSERT INTO memberships (id,tenant_id,user_id,role_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("member-a", "tenant-a", "owner-a", "role-owner", "active", timestamp, timestamp);
  database.prepare("INSERT INTO customers (id,tenant_id,code,name,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("customer-a", "tenant-a", "C-1", "Müşteri A", timestamp, timestamp);
  database.prepare("INSERT INTO projects (id,tenant_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("project-a", "tenant-a", "P-1", "Otel lobisi", "production", timestamp, timestamp);
  return { database, env: { DB: new D1Database(database), ALLOW_DEV_AUTH: "true" } };
}

function request(path, { method = "POST", body } = {}) {
  const headers = new Headers({ "x-user-email": "owner@a.test", "x-tenant-id": "tenant-a" });
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`https://example.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
const send = (env, path, options) => worker.fetch(request(path, options), env);
const payload = async (response) => ({ status: response.status, body: await response.json().catch(() => null) });

// ——— 1. Sınıflandırma unutulamaz ————————————————————————————————————————

// Yarın eklenen bir tarih sütununun sessizce denetimsiz kalmaması için, adı
// tarih çağrıştıran her yazılabilir sütunun sınıflandırılmış olması şart
// koşuluyor. Kalıp geniş tutuldu: yanlış yakalananlar aşağıda gerekçesiyle
// listeli, yani listeye yeni bir ad eklemek bilinçli bir karar oluyor.
const DATE_LIKE_COLUMN = /(^|_)(date|at|on|start|end|until|deadline|period|birth|expiry|expires|time|due)(_|$)|needed_by|^check_(in|out)$/;

// Bilerek sınıflandırılmayanlar. Hiçbiri takvim günü değil; gün ya da an kuralı
// onlarda yanlış olurdu.
const UNCLASSIFIED_ON_PURPOSE = new Map([
  ["period", "Bordro dönemi `YYYY-AA` tutar; günü yoktur."],
  ["lead_time_days", "Tedarik süresi gün sayısıdır, tarih değil."],
  ["check_in", "Yalnız saat tutar (`08:00`); hangi gün olduğu `work_date` sütununda."],
  ["check_out", "Yalnız saat tutar; hangi gün olduğu `work_date` sütununda."],
]);

test("istemcinin yazabildiği her tarih benzeri sütun açıkça sınıflandırılmıştır", () => {
  const writable = new Map();
  for (const [slug, config] of Object.entries(__testing.resources)) {
    for (const column of config.fields || []) {
      if (!writable.has(column)) writable.set(column, []);
      writable.get(column).push(slug);
    }
  }

  const unclassified = [];
  for (const [column, slugs] of writable) {
    if (!DATE_LIKE_COLUMN.test(column)) continue;
    if (__testing.dateColumnKinds.has(column)) continue;
    if (UNCLASSIFIED_ON_PURPOSE.has(column)) continue;
    unclassified.push(`${column} (${slugs.join(", ")})`);
  }
  assert.deepEqual(unclassified, [], "Bu sütunlar tarih benzeri adlandırıldı ama sınıflandırılmadı; `date`, `datetime` ya da `both` olarak DATE_COLUMN_KINDS içine yazılmalı veya gerekçesiyle muafiyet listesine alınmalı.");

  // Muafiyet listesi de bayatlayabilir: listedeki bir sütun sonradan
  // sınıflandırılırsa ya da kayıt defterinden çıkarsa, iki yer birbirine
  // karşı sessizce yalan söylemeye başlar.
  for (const column of UNCLASSIFIED_ON_PURPOSE.keys()) {
    assert.ok(writable.has(column), `${column} artık yazılabilir bir alan değil; muafiyet listesinden çıkarılmalı.`);
    assert.ok(!__testing.dateColumnKinds.has(column), `${column} hem sınıflandırılmış hem muaf görünüyor.`);
  }

  // Sınıflandırma listesi de tersinden denetleniyor: sadece `notifications.due_at`
  // yazılamayan bir sütun olarak burada duruyor, gerekçesi kodda yazılı.
  const classifiedButUnknown = [...__testing.dateColumnKinds.keys()].filter((column) => !writable.has(column));
  assert.deepEqual(classifiedButUnknown, ["due_at"]);
});

// ——— 2. Sınıf isimden değil, sütunun tuttuğundan türer ————————————————————

test("adı yalan söyleyen sütunlar saklanan değere göre sınıflanır", () => {
  const kinds = __testing.dateColumnKinds;
  // `projects.actual_end_date` adı gün diyor; proje kapanış iş akışı ISO an
  // yazıyor. `production_orders.actual_start`/`actual_end` adında hiçbir ipucu
  // taşımıyor ama aynısını yapıyor. Üçü de gün yazılabilen yollara da sahip.
  assert.equal(kinds.get("actual_end_date"), "both");
  assert.equal(kinds.get("actual_start_date"), "both");
  assert.equal(kinds.get("actual_start"), "both");
  assert.equal(kinds.get("actual_end"), "both");
  // `notifications.due_at` `_at` ile bitiyor ama düz gün tutuyor: projenin
  // `planned_end_date` değeri olduğu gibi kopyalanıyor.
  assert.equal(kinds.get("due_at"), "date");
});

test("rapor motoru sınıflandırmayı tek kaynaktan okur", () => {
  const type = __testing.reportColumnType;
  // Daha önce hiçbir ad kalıbına uymadığı için `text` sayılıyorlardı: üretimin
  // gerçekleşme tarihine göre rapor süzülemiyordu.
  assert.equal(type("actual_start"), "datetime");
  assert.equal(type("actual_end"), "datetime");
  // `_date` soneki yüzünden `date` sayılıyordu; ISO an tutuyor.
  assert.equal(type("actual_end_date"), "datetime");
  // `_at` soneki yüzünden `datetime` sayılıyordu; düz gün tutuyor.
  assert.equal(type("due_at"), "date");

  // Sınıflandırılan her sütun rapor motorunda da tarih sütunu olmalı, yoksa
  // "tek kaynak" yalnız adı olur.
  for (const [column, kind] of __testing.dateColumnKinds) {
    assert.equal(type(column), kind === "date" ? "date" : "datetime", `${column} rapor motorunda yanlış sınıflandı.`);
  }
  // Ad kalıpları sınıflandırılmamış sütunlar için yedek olarak duruyor.
  assert.equal(type("created_at"), "datetime");
  assert.equal(type("period"), "text");
  assert.equal(type("check_in"), "text");
});

// ——— 3. Yazarken doğrulama ————————————————————————————————————————————————

const financeBody = (extra) => ({ transaction_number: `F-${Math.random().toString(36).slice(2, 8)}`, project_id: "project-a", customer_id: "customer-a", type: "income", transaction_date: "2026-08-01", amount_minor: 100_000, ...extra });

test("geçen turun hatası: due_date \"0\" ile finans kaydı açılamaz", async () => {
  const { database, env } = await setup();
  const { status, body } = await payload(await send(env, "/api/v1/financial-transactions", { body: financeBody({ due_date: "0" }) }));
  assert.equal(status, 422);
  assert.equal(body.error.code, "validation_error");
  // Hata alanı adıyla söylüyor; "genel kısıt hatası" uzun bir formda hangi
  // kutunun suçlu olduğunu söylemiyor.
  assert.match(body.error.message, /^due_date /);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM financial_transactions").get().count, 0);
});

test("tarih sütunu kalıba uyan ama takvimde olmayan günü reddeder", async () => {
  const { env } = await setup();
  // Kalıp eşleşmesi yetmez: ikisi de `\d{4}-\d{2}-\d{2}` kalıbına uyuyor.
  for (const value of ["2026-02-30", "2026-13-01", "2025-02-29"]) {
    const { status, body } = await payload(await send(env, "/api/v1/financial-transactions", { body: financeBody({ due_date: value }) }));
    assert.equal(status, 422, `${value} kabul edildi`);
    assert.match(body.error.message, /^due_date /);
  }
  // Artık yılın 29 Şubat'ı gerçek bir gündür ve geçmelidir.
  assert.equal((await send(env, "/api/v1/financial-transactions", { body: financeBody({ due_date: "2024-02-29" }) })).status, 200);
});

test("tarih sütunu serbest metni, sayıyı ve zaman damgasını reddeder", async () => {
  const { env } = await setup();
  for (const value of ["bugün", "0", "01.09.2026", "2026-9-1", "2026-09-23T11:53:29.355Z", 20260923, true]) {
    const { status, body } = await payload(await send(env, "/api/v1/financial-transactions", { body: financeBody({ due_date: value }) }));
    assert.equal(status, 422, `${JSON.stringify(value)} kabul edildi`);
    assert.match(body.error.message, /^due_date /);
  }
  assert.equal((await send(env, "/api/v1/financial-transactions", { body: financeBody({ due_date: "2026-09-23" }) })).status, 200);
});

test("zaman damgası sütunu düz günü reddeder, saat dilimsiz yerel anı kabul eder", async () => {
  const { database, env } = await setup();
  const communication = (occurredAt) => ({ project_id: "project-a", channel: "phone", subject: "Müşteri araması", occurred_at: occurredAt });

  for (const value of ["2026-09-23", "0", "dün", "2026-02-30T10:00:00Z", "2026-09-23T25:00:00Z", "2026-09-23T10:61"]) {
    const { status, body } = await payload(await send(env, "/api/v1/project-communications", { body: communication(value) }));
    assert.equal(status, 422, `${value} kabul edildi`);
    assert.match(body.error.message, /^occurred_at /);
  }

  // Sunucunun yazdığı biçim ve arayüzün `datetime-local` kutusundan gelen
  // saat dilimsiz biçim — ikisi de gerçek yollardır.
  for (const value of ["2026-09-23T11:53:29.355Z", "2026-09-23T11:53", "2026-09-23T11:53:29", "2026-09-23T11:53:29+03:00"]) {
    assert.equal((await send(env, "/api/v1/project-communications", { body: communication(value) })).status, 200, `${value} reddedildi`);
  }
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM project_communications").get().count, 4);
});

test("her ikisi meşru olan sütun hem günü hem anı kabul eder", async () => {
  const { env } = await setup();
  // Üretim emri iş akışı buraya ISO an yazıyor; montaj tarafında aynı sütunlara
  // yazan bir sunucu yolu yok ve oradaki eşleri düz gün.
  const order = (extra) => ({ order_number: `UE-${Math.random().toString(36).slice(2, 8)}`, project_id: "project-a", ...extra });
  assert.equal((await send(env, "/api/v1/production-orders", { body: order({ actual_start: "2026-09-23T11:53:29.355Z" }) })).status, 200);
  assert.equal((await send(env, "/api/v1/production-orders", { body: order({ actual_start: "2026-09-23" }) })).status, 200);
  // Gevşeklik yalnız iki geçerli biçimle sınırlı; çöp yine geçmiyor.
  const { status, body } = await payload(await send(env, "/api/v1/production-orders", { body: order({ actual_start: "0" }) }));
  assert.equal(status, 422);
  assert.match(body.error.message, /^actual_start /);
});

test("boş değer temizlemektir, hata değil", async () => {
  const { database, env } = await setup();
  const created = (await (await send(env, "/api/v1/financial-transactions", { body: financeBody({ transaction_number: "F-TEMIZ", due_date: "2026-09-30" }) })).json()).data;
  assert.equal(created.due_date, "2026-09-30");

  // Arayüzün tarih kutusu silindiğinde boş metin, düzenleme yolu ise null
  // gönderiyor. İkisi de alanı boşaltmalı: reddedilseydi kullanıcı bir kez
  // girdiği tarihi bir daha silemezdi.
  for (const empty of ["", null]) {
    await send(env, `/api/v1/financial-transactions/${created.id}`, { method: "PATCH", body: { due_date: "2026-09-30" } });
    const { status, body } = await payload(await send(env, `/api/v1/financial-transactions/${created.id}`, { method: "PATCH", body: { due_date: empty } }));
    assert.equal(status, 200, `${JSON.stringify(empty)} reddedildi`);
    assert.equal(body.data.due_date, null);
    // Boş metin sütuna olduğu gibi yazılmamalı: `''` de `'2026-09-23'`den
    // küçüktür ve kayıt yine vade sorgularının yanlış tarafına düşer.
    assert.equal(database.prepare("SELECT due_date FROM financial_transactions WHERE id=?").get(created.id).due_date, null);
  }
});

test("doğrulama yalnız gönderilen alanı denetler; eski bozuk satırlar okunmaya devam eder", async () => {
  const { database, env } = await setup();
  // Doğrulama yokken yazılmış bir satır. Göç yazılmadığı sürece böyle satırlar
  // veritabanında durmaya devam edecek; en azından okunabilir kalmalılar.
  database.prepare("INSERT INTO financial_transactions (id,tenant_id,transaction_number,project_id,type,transaction_date,due_date,amount_minor,status,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .run("ft-bozuk", "tenant-a", "F-BOZUK", "project-a", "income", "2026-08-01", "0", 100_000, "draft", "{}", timestamp, timestamp);

  const read = await payload(await send(env, "/api/v1/financial-transactions/ft-bozuk", { method: "GET" }));
  assert.equal(read.status, 200);
  assert.equal(read.body.data.due_date, "0");

  // Başka bir alanı düzenlemek, dokunulmayan bozuk tarih yüzünden engellenmiyor.
  const patched = await payload(await send(env, "/api/v1/financial-transactions/ft-bozuk", { method: "PATCH", body: { description: "Açıklama eklendi" } }));
  assert.equal(patched.status, 200);
  assert.equal(patched.body.data.due_date, "0");

  // Ama o alana yeniden dokunulduğu anda kural işliyor: düzeltilebilir ya da
  // temizlenebilir, bozuk hâlde bırakılamaz.
  assert.equal((await send(env, "/api/v1/financial-transactions/ft-bozuk", { method: "PATCH", body: { due_date: "0" } })).status, 422);
  assert.equal((await send(env, "/api/v1/financial-transactions/ft-bozuk", { method: "PATCH", body: { due_date: "2026-10-01" } })).status, 200);
});

test("iş akışı ucu ile kayıt ucu aynı tarih kuralını uygular", async () => {
  const { env } = await setup();
  const created = (await (await send(env, "/api/v1/financial-transactions", { body: financeBody({ transaction_number: "F-AKIS" }) })).json()).data;
  await send(env, `/api/v1/financial-transactions/${created.id}/approve`, { body: {} });
  // Tahsilat tarihi ucu eskiden yalnız kalıba bakıyordu; 30 Şubat oradan geçip
  // sütuna yazılabiliyordu.
  const rejected = await payload(await send(env, `/api/v1/financial-transactions/${created.id}/collect`, { body: { settled_on: "2026-02-30" } }));
  assert.equal(rejected.status, 422);
  assert.match(rejected.body.error.message, /^settled_on /);
  assert.equal((await send(env, `/api/v1/financial-transactions/${created.id}/collect`, { body: { settled_on: "2026-02-28" } })).status, 200);
});

test("dosya yükleme ucu çekim tarihini CRUD ucuyla aynı kurala göre denetler", async () => {
  const { database, env } = await setup();
  const objects = new Map();
  const withStorage = { ...env, FILES: { async put(key, value) { objects.set(key, value); return { key }; }, async get(key) { return objects.has(key) ? { body: objects.get(key) } : null; }, async delete(key) { objects.delete(key); } } };

  const upload = (takenAt) => {
    const form = new FormData();
    form.set("file", new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }), "montaj.png");
    form.set("entity_type", "projects");
    form.set("entity_id", "project-a");
    form.set("project_id", "project-a");
    form.set("category", "photo");
    form.set("capture_stage", "installation");
    if (takenAt !== undefined) form.set("taken_at", takenAt);
    const headers = new Headers({ "x-user-email": "owner@a.test", "x-tenant-id": "tenant-a" });
    return worker.fetch(new Request("https://example.test/api/v1/files/upload", { method: "POST", headers, body: form }), withStorage);
  };

  // Gevşek `Date.parse` bunu kabul ediyordu; sütunda bu değer tarih
  // sıralamasını bozar ve rapor onu hiçbir güne koyamaz.
  const rejected = await payload(await upload("5 Mart 2020"));
  assert.equal(rejected.status, 422);
  assert.match(rejected.body.error.message, /^taken_at /);

  // Arayüzün `datetime-local` kutusundan gelen biçim geçmeli; yoksa fotoğraf
  // yükleme akışı kırılır.
  assert.equal((await upload("2026-09-23T14:30")).status, 201);
  // Çekim tarihi isteğe bağlı: hiç verilmediğinde yükleme yine çalışır.
  assert.equal((await upload(undefined)).status, 201);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM files").get().count, 2);
});

// ——— 4. Sınıflandırmanın rapor motorundaki karşılığı ——————————————————————

test("gerçekleşme tarihine göre rapor süzülebilir", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO production_orders (id,tenant_id,order_number,project_id,actual_end,status,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run("po-bugun", "tenant-a", "UE-1", "project-a", "2026-09-23T09:00:00.000Z", "completed", "{}", timestamp, timestamp);
  database.prepare("INSERT INTO production_orders (id,tenant_id,order_number,project_id,actual_end,status,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run("po-dun", "tenant-a", "UE-2", "project-a", "2026-09-22T09:00:00.000Z", "completed", "{}", timestamp, timestamp);

  // Saat sabitleniyor: "bugün" testi takvimden bağımsız kalsın.
  const clocked = { ...env, REPORT_CLOCK: "2026-09-23T12:00:00.000Z" };
  const definition = { resource: "production-orders", columns: ["order_number", "actual_end"], filters: [{ field: "actual_end", op: "eq", value: { relative: "today" } }] };
  const { status, body } = await payload(await send(clocked, "/api/v1/reports/run", { body: { definition } }));
  // Sınıflandırma öncesinde bu istek "bu bir tarih sütunu değil" diye 422
  // dönüyordu: `actual_end` hiçbir ad kalıbına uymadığı için `text` sayılıyordu.
  assert.equal(status, 200);
  assert.deepEqual(body.data.rows.map((row) => row.order_number), ["UE-1"]);
  assert.equal(body.data.columns.find((column) => column.key === "actual_end").type, "datetime");
});

// ——— 5. Tanıtım verisi ————————————————————————————————————————————————————

test("tanıtım verisinin ürettiği bütün tarihler yeni denetimden geçer", async () => {
  // Tanıtım betiği veriyi HTTP API üzerinden yazıyor, yani yeni denetim ona da
  // uygulanıyor. Üreteçleri geçmezse tanıtım verisi kurulamaz hâle gelir; bu,
  // bu değişikliğin en büyük regresyon riski.
  const source = await readFile(new URL("../scripts/seed-demo.mjs", import.meta.url), "utf8");
  assert.match(source, /const gun = \(fark\) => new Date\(Date\.now\(\) \+ fark \* 86400000\)\.toISOString\(\)\.slice\(0, 10\)/, "gün üreteci değişmiş; testin ölçtüğü biçim artık geçerli olmayabilir.");
  assert.match(source, /const an = \(fark\) => new Date\(Date\.now\(\) \+ fark \* 86400000\)\.toISOString\(\)\.slice\(0, 16\)/, "an üreteci değişmiş; testin ölçtüğü biçim artık geçerli olmayabilir.");

  const gun = (fark) => new Date(Date.now() + fark * 86400000).toISOString().slice(0, 10);
  const an = (fark) => new Date(Date.now() + fark * 86400000).toISOString().slice(0, 16);

  const { env } = await setup();
  // Betikteki kaymalar -120 ile +120 gün arasında; ay ve yıl sınırlarını da
  // kapsasın diye geniş bir aralık taranıyor.
  for (let fark = -400; fark <= 400; fark += 1) {
    const day = await payload(await send(env, "/api/v1/financial-transactions", { body: financeBody({ transaction_date: gun(fark) }) }));
    assert.equal(day.status, 200, `gun(${fark}) = ${gun(fark)} reddedildi: ${JSON.stringify(day.body)}`);
  }
  for (const fark of [-400, -120, -1, 0, 1, 120, 400]) {
    const moment = await payload(await send(env, "/api/v1/project-communications", { body: { project_id: "project-a", channel: "phone", subject: "Görüşme", occurred_at: an(fark) } }));
    assert.equal(moment.status, 200, `an(${fark}) = ${an(fark)} reddedildi: ${JSON.stringify(moment.body)}`);
  }

  // Betiğin tarih olmayan zaman alanları sınıflandırma dışında kaldığı için
  // denetime hiç girmiyor; girseydi ikisi de reddedilirdi.
  assert.equal(__testing.reportColumnType("check_in"), "text");
  assert.equal(__testing.reportColumnType("period"), "text");
});
