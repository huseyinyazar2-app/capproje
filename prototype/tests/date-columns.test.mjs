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

// Her kaynağın her yazılabilir alanı, ait olduğu tabloyla birlikte. Denetim
// artık sütun adı üzerinden değil tablo+sütun çifti üzerinden yürüyor: aynı ad
// bir tabloda sınıflandırılıp ötekinde unutulabilir.
const writableColumns = () => Object.entries(__testing.resources)
  .flatMap(([slug, config]) => (config.fields || []).map((column) => ({ slug, table: config.table, column })));

test("her kaynağın her yazılabilir tarih benzeri sütunu tablo+sütun olarak çözülebiliyor", () => {
  const unclassified = [];
  for (const { slug, table, column } of writableColumns()) {
    if (!DATE_LIKE_COLUMN.test(column)) continue;
    if (UNCLASSIFIED_ON_PURPOSE.has(column)) continue;
    if (__testing.dateColumnKind(table, column)) continue;
    unclassified.push(`${table}.${column} (${slug})`);
  }
  assert.deepEqual(unclassified, [], "Bu sütunlar tarih benzeri adlandırıldı ama sınıfı çözülemedi; DATE_COLUMN_KINDS içine `sütun` ya da `tablo.sütun` anahtarıyla `date`/`datetime` olarak yazılmalı veya gerekçesiyle muafiyet listesine alınmalı.");

  // Muafiyet listesi de bayatlayabilir: listedeki bir sütun sonradan
  // sınıflandırılırsa ya da kayıt defterinden çıkarsa, iki yer birbirine
  // karşı sessizce yalan söylemeye başlar.
  const byColumn = new Set(writableColumns().map((item) => item.column));
  for (const column of UNCLASSIFIED_ON_PURPOSE.keys()) {
    assert.ok(byColumn.has(column), `${column} artık yazılabilir bir alan değil; muafiyet listesinden çıkarılmalı.`);
    assert.ok(!__testing.dateColumnKinds.has(column), `${column} hem sınıflandırılmış hem muaf görünüyor.`);
  }
});

test("sınıflandırma listesinde karşılığı olmayan anahtar kalmıyor", () => {
  // Liste tersinden de denetleniyor, yoksa kaldırılan bir sütunun sınıfı
  // listede ölü bir satır olarak kalır ve bir gün başka bir şeyi yanlış
  // sınıflandırır.
  const writable = writableColumns();
  const columns = new Set(writable.map((item) => item.column));
  const pairs = new Set(writable.map((item) => `${item.table}.${item.column}`));
  const orphans = [];
  for (const key of __testing.dateColumnKinds.keys()) {
    if (key.includes(".")) { if (!pairs.has(key)) orphans.push(key); continue; }
    if (!columns.has(key)) orphans.push(key);
  }
  // Tek istisna `notifications.due_at`: istemci o kaynağa yazamıyor ama sonek
  // kuralı onu yanlış sınıflayacağı için doğrusu şimdiden yazılı.
  assert.deepEqual(orphans, ["due_at"]);
});

test("ad kalıbı yedeğine muhtaç yazılabilir tek bir sütun yok", () => {
  // `created_at` / `approved_at` gibi istemcinin yazamadığı sütunlar için ad
  // kalıbı yedeği duruyor. Ama yazılabilir bir sütun tipini o yedekten alırsa,
  // yazarken doğrulama ile raporun sınıfı ayrı kaynaklardan gelir: rapor onu
  // tarih sayarken yazma yolu serbest metin sayar.
  const leaning = [];
  for (const { slug, table, column } of writableColumns()) {
    const reported = __testing.reportColumnType(table, column);
    if (reported !== "date" && reported !== "datetime") continue;
    if (__testing.dateColumnKind(table, column)) continue;
    leaning.push(`${table}.${column} (${slug})`);
  }
  assert.deepEqual(leaning, [], "Bu sütunlar raporda tarih sayılıyor ama sınıfı yalnız ad kalıbından geliyor.");
});

test("sınıflandırma tablo bağlamı olmadan sorgulanamaz", () => {
  // Bağlam verilmediğinde eski davranışa sessizce düşen bir imza, unutulan bir
  // çağrı yerini görünmez yapardı: o sütun yıllarca yanlış sınıfla çalışır ve
  // hiçbir test düşmez. Bu yüzden eksik bağlam gürültülü.
  for (const table of [undefined, null, ""]) {
    assert.throws(() => __testing.dateColumnKind(table, "actual_start"), /tablo bağlamı/);
    assert.throws(() => __testing.reportColumnType(table, "actual_start"), /tablo bağlamı/);
    // Para sütunu tabloya hiç bakmadan cevaplanıyor; kapı ondan önce olmalı.
    assert.throws(() => __testing.reportColumnType(table, "amount_minor"), /tablo bağlamı/);
  }
});

// ——— 2. Sınıf isimden değil, sütunun tuttuğundan türer ————————————————————

test("aynı ad iki tabloda farklı sınıf verir", () => {
  const kind = __testing.dateColumnKind;
  // Üretim emri aşama geçişi bu iki sütuna doğrudan SQL ile `now()` çıktısını
  // yazıyor; tanıtım verisinde ölçülen değer `2026-09-23T13:14:21.472Z`.
  assert.equal(kind("production_orders", "actual_start"), "datetime");
  assert.equal(kind("production_orders", "actual_end"), "datetime");
  // Montajda aynı adlara yazan hiçbir sunucu yolu yok ve komşuları
  // `planned_start` / `planned_end` düz gün.
  assert.equal(kind("installations", "actual_start"), "date");
  assert.equal(kind("installations", "actual_end"), "date");
  // Proje kapanışı `actual_end_date` değerini ISO an olarak yazıyor; ikizi
  // ondan ayrılmıyor.
  assert.equal(kind("projects", "actual_start_date"), "datetime");
  assert.equal(kind("projects", "actual_end_date"), "datetime");

  // Adı yalan söyleyen sütunlar genel kurala bilerek hiç yazılmadı: üçüncü bir
  // tablo aynı adı kullanmaya başlarsa kayıt defteri denetimi onu sınıfsız
  // görüp karar verilmesini istesin, komşusunun sınıfını devralmasın.
  for (const column of ["actual_start", "actual_end", "actual_start_date", "actual_end_date"]) {
    assert.equal(__testing.dateColumnKinds.has(column), false, `${column} genel kurala düşmüş; tablo ayrımı anlamsızlaşır.`);
  }

  // Her tabloda aynı şeyi anlatan sütunlar tablo tablo yazılmıyor; tek kural
  // hepsine yetiyor.
  assert.equal(kind("production_orders", "planned_start"), "date");
  assert.equal(kind("installations", "planned_start"), "date");
  assert.equal(kind("financial_transactions", "due_date"), "date");
  assert.equal(kind("invoices", "due_date"), "date");
  assert.equal(kind("employees", "hire_date"), "date");
  // `notifications.due_at` `_at` ile bitiyor ama düz gün tutuyor: projenin
  // `planned_end_date` değeri olduğu gibi kopyalanıyor.
  assert.equal(kind("notifications", "due_at"), "date");
});

test("rapor motoru sınıflandırmayı tek kaynaktan okur", () => {
  const type = __testing.reportColumnType;
  // Daha önce hiçbir ad kalıbına uymadığı için `text` sayılıyorlardı: üretimin
  // gerçekleşme tarihine göre rapor süzülemiyordu.
  assert.equal(type("production_orders", "actual_start"), "datetime");
  assert.equal(type("production_orders", "actual_end"), "datetime");
  // Aynı ad, başka tablo, başka tip.
  assert.equal(type("installations", "actual_start"), "date");
  // `_date` soneki yüzünden `date` sayılıyordu; ISO an tutuyor.
  assert.equal(type("projects", "actual_end_date"), "datetime");
  // `_at` soneki yüzünden `datetime` sayılıyordu; düz gün tutuyor.
  assert.equal(type("notifications", "due_at"), "date");

  // Sınıflandırılan her anahtar rapor motorunda da aynı tipi vermeli, yoksa
  // "tek kaynak" yalnız adı olur. Genel anahtarlar hiçbir tablo kuralının
  // gölgelemediği bir tabloyla sorgulanıyor.
  for (const [key, kind] of __testing.dateColumnKinds) {
    const dot = key.indexOf(".");
    const table = dot === -1 ? "tablo_bulunmayan" : key.slice(0, dot);
    const column = dot === -1 ? key : key.slice(dot + 1);
    assert.equal(type(table, column), kind, `${key} rapor motorunda yanlış sınıflandı.`);
  }
  // Ad kalıpları sınıflandırılmamış sütunlar için yedek olarak duruyor.
  assert.equal(type("projects", "created_at"), "datetime");
  assert.equal(type("payroll_inputs", "period"), "text");
  assert.equal(type("attendance", "check_in"), "text");
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

const order = (extra) => ({ order_number: `UE-${Math.random().toString(36).slice(2, 8)}`, project_id: "project-a", ...extra });
const installation = (extra) => ({ installation_number: `MNT-${Math.random().toString(36).slice(2, 8)}`, project_id: "project-a", ...extra });

test("aynı ad iki uçta iki farklı biçim ister", async () => {
  const { env } = await setup();
  // Üretim emri aşama geçişi `actual_start` sütununa ISO an yazıyor. Uç da anı
  // kabul etmezse kendi kodumuz kendi kuralımıza takılırdı.
  assert.equal((await send(env, "/api/v1/production-orders", { body: order({ actual_start: "2026-09-23T11:53:29.355Z" }) })).status, 200);
  // Eskiden `both` olduğu için düz gün de geçiyordu; artık o sütunda gün, iş
  // akışının yazdığı anlarla aynı sütunda karışık biçim demek.
  const orderDay = await payload(await send(env, "/api/v1/production-orders", { body: order({ actual_start: "2026-09-23" }) }));
  assert.equal(orderDay.status, 422);
  assert.match(orderDay.body.error.message, /^actual_start /);
  assert.match(orderDay.body.error.message, /zaman damgası/);

  // Montajda aynı ad düz gün demek: yazan bir sunucu yolu yok, komşuları gün.
  assert.equal((await send(env, "/api/v1/installations", { body: installation({ actual_start: "2026-09-23" }) })).status, 200);
  const installationMoment = await payload(await send(env, "/api/v1/installations", { body: installation({ actual_start: "2026-09-23T11:53:29.355Z" }) }));
  assert.equal(installationMoment.status, 422);
  assert.match(installationMoment.body.error.message, /^actual_start /);
  assert.match(installationMoment.body.error.message, /takvim günü/);
});

test("gün ve an ayrımı yapılan sütunlarda çöp değer yine reddediliyor", async () => {
  const { env } = await setup();
  for (const value of ["0", "bugün", "01.09.2026", "2026-02-30", true]) {
    const production = await payload(await send(env, "/api/v1/production-orders", { body: order({ actual_end: value }) }));
    assert.equal(production.status, 422, `üretim emri ${JSON.stringify(value)} kabul etti`);
    const assembly = await payload(await send(env, "/api/v1/installations", { body: installation({ actual_end: value }) }));
    assert.equal(assembly.status, 422, `montaj ${JSON.stringify(value)} kabul etti`);
  }
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

test("rapor çıktısındaki sütun tipi de kaydın tablosundan geliyor", async () => {
  const { database, env } = await setup();
  database.prepare("INSERT INTO installations (id,tenant_id,installation_number,project_id,actual_start,actual_end,status,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run("ins-1", "tenant-a", "MNT-1", "project-a", "2026-09-22", "2026-09-23", "completed", "{}", timestamp, timestamp);
  database.prepare("INSERT INTO production_orders (id,tenant_id,order_number,project_id,actual_start,status,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run("po-1", "tenant-a", "UE-1", "project-a", "2026-09-22T09:00:00.000Z", "completed", "{}", timestamp, timestamp);

  const typesOf = async (resource, definition) => {
    const { status, body } = await payload(await send(env, "/api/v1/reports/run", { body: { definition: { resource, ...definition } } }));
    assert.equal(status, 200, JSON.stringify(body));
    return Object.fromEntries(body.data.columns.map((column) => [column.key, column.type]));
  };

  // Sütun listesi, gruplama ve toplam — üçü de tipi ayrı yerden soruyor; aynı
  // adın iki tabloda iki tip vermesi üçünde de görünmeli, yoksa arayüz montaj
  // gününü saatiyle birlikte gösterir.
  assert.equal((await typesOf("installations", { columns: ["installation_number", "actual_start"] })).actual_start, "date");
  assert.equal((await typesOf("production-orders", { columns: ["order_number", "actual_start"] })).actual_start, "datetime");
  assert.equal((await typesOf("installations", { group: { by: ["actual_start"] } })).actual_start, "date");
  assert.equal((await typesOf("production-orders", { group: { by: ["actual_start"] } })).actual_start, "datetime");
  assert.equal((await typesOf("installations", { group: { by: ["status"], aggregates: [{ fn: "max", field: "actual_end", as: "son" }] } })).son, "date");
  assert.equal((await typesOf("production-orders", { group: { by: ["status"], aggregates: [{ fn: "max", field: "actual_start", as: "son" }] } })).son, "datetime");

  // Rapor kurucunun alan kataloğu da aynı kaynaktan besleniyor.
  const fields = new Map((await payload(await send(env, "/api/v1/reports/fields", { method: "GET" }))).body.data.map((item) => [item.resource, item.columns]));
  const typeOf = (resource, key) => fields.get(resource).find((column) => column.key === key).type;
  assert.equal(typeOf("installations", "actual_start"), "date");
  assert.equal(typeOf("production-orders", "actual_start"), "datetime");
});

test("görünümden raporlanan kaynakta tablo anahtarı görünümün adıdır", async () => {
  const { env } = await setup();
  const config = __testing.resources["project-profitability"];
  // Kârlılık bir SQL görünümünden (göç 0017) okunuyor; sınıflandırmanın tablo
  // anahtarı da rapor motorunun sütun beyaz listesi de aynı addan, yani
  // görünümün adından türüyor.
  assert.equal(config.table, "project_profitability");
  // Görünümün adı projenin adı değildir: `projects` için yazılan tablo kuralı
  // buraya sızmamalı, çünkü görünüm o sütunu hiç taşımıyor.
  assert.equal(__testing.dateColumnKind("projects", "actual_end_date"), "datetime");
  assert.equal(__testing.dateColumnKind("project_profitability", "actual_end_date"), null);

  const clocked = { ...env, REPORT_CLOCK: "2026-09-23T12:00:00.000Z" };
  const definition = {
    resource: "project-profitability",
    columns: ["code", "status", "contract_amount_minor", "created_at"],
    filters: [{ field: "created_at", op: "between", value: { relative: "this_year" } }],
  };
  const { status, body } = await payload(await send(clocked, "/api/v1/reports/run", { body: { definition } }));
  assert.equal(status, 200);
  assert.deepEqual(body.data.rows.map((row) => row.code), ["P-1"]);
  const types = Object.fromEntries(body.data.columns.map((column) => [column.key, column.type]));
  // `created_at` görünümde de istemcinin yazamadığı bir sütun: tipini ad kalıbı
  // yedeğinden alıyor ve göreli tarih süzgeci bu yüzden çalışıyor.
  assert.equal(types.created_at, "datetime");
  assert.equal(types.contract_amount_minor, "money");
  assert.equal(types.status, "status");
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
  assert.equal(__testing.reportColumnType("attendance", "check_in"), "text");
  assert.equal(__testing.reportColumnType("payroll_inputs", "period"), "text");
});
