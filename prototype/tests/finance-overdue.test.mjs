import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import worker from "../worker/index.js";

// Finans ekranının vadesi geçmiş kayıtlarla ilgili sözleşmesi.
//
// `overdue` artık saklanan bir durum değil (göç 0019): vadesi geçmiş olmak,
// onaylı bir kaydın `dueDate` alanından okunan bir olgudur. Bu dosya üç şeyi
// sabitliyor: rozetin gerçekten göründüğünü, rozetin altındaki iş akışını
// bozmadığını ve formun sunucunun kabul etmediği bir durumu hiç sunmadığını.
const liveSource = await readFile(new URL("../src/LiveWorkspace.jsx", import.meta.url), "utf8");
const apiSource = await readFile(new URL("../src/api.js", import.meta.url), "utf8");
const workerSource = await readFile(new URL("../worker/index.js", import.meta.url), "utf8");

function section(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.ok(start >= 0, `${startNeedle} bulunamadı`);
  const end = source.indexOf(endNeedle, start);
  assert.ok(end > start, `${endNeedle} bulunamadı`);
  return source.slice(start, end);
}

// Kural JSX dosyasında yaşıyor, node doğrudan içeri alamıyor. Kaynaktan kesip
// derlemek, kuralı metin eşleştirmesiyle değil gerçekten çalıştırarak
// denetlemeyi sağlıyor.
function loadFinanceScreen() {
  const parts = [
    section(apiSource, "const STATUS_VALUES = Object.freeze({", "function snakeToCamel"),
    section(apiSource, "export function statusCodeFor", "export const demoAuthEnabled").replace("export ", ""),
    section(liveSource, "const WORKSPACE_TIME_ZONE", "// Derleme damgası"),
    section(liveSource, "const projectStageLabels = {", "\n"),
    section(liveSource, "const enumLabels = {", "// Denetim kaydı modülü"),
    section(liveSource, "function localizedEnum(value)", "// Sunucudaki üst yetki"),
    section(liveSource, "function recordValue(record, key)", "function formatValue("),
    section(liveSource, "function statusTone(", "const enumLabels = {"),
    section(liveSource, "const capabilityParents = {", "function workflowActions("),
    "return { isOverdueFinanceRow, statusText, statusTone, workspaceToday, workspaceDayFormatter, coreWorkflowActions };",
  ];
  return new Function(parts.join("\n"))();
}

const screen = loadFinanceScreen();
const financeModule = { id: "finance", resource: "finance" };
const settler = {
  role: { code: "finance" },
  permissions: ["financial-transactions.read", "financial-transactions.approve", "financial-transactions.collect", "financial-transactions.pay", "financial-transactions.reverse"],
};

// Takvimden bağımsız olsun diye günler firmanın saat diliminde, bugüne göre
// sayılıyor. Türkiye 2016'dan beri tek saat diliminde (UTC+3), bu yüzden
// gün ekleme aritmetiği yaz saati sınırına takılmıyor.
const zoneDay = (offsetDays = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(Date.now() + offsetDays * 86_400_000));

const approved = (overrides = {}) => ({ id: "fin-1", type: "income", status: "Onaylandı", amount: 60_000, ...overrides });

// ——— Madde 1: rozet vadeden türetiliyor ———

test("vadesi geçmiş onaylı hareket listede Gecikti olarak görünür", () => {
  // Ekranın kendi sözü: 15.09.2026 vadeli onaylı alacak, 23.09.2026 günü
  // "Onaylandı" değil "Gecikti" yazmalı. Kullanıcı geciken parayı listeye
  // bakarak görebilmeli.
  const row = approved({ dueDate: "2026-09-15" });
  assert.equal(screen.isOverdueFinanceRow("finance", row, "2026-09-23"), true);
  assert.equal(screen.statusText("finance", approved({ dueDate: zoneDay(-1) })), "Gecikti");

  // Durum sütunu dışındaki bir sütun rozetten etkilenmez.
  assert.equal(screen.statusText("finance", approved({ dueDate: zoneDay(-1), category: "Satış" }), "category"), "Satış");

  // Kural yazıldığı yerde kalmasın: listenin durum hücresi ve kayıt detayı
  // gerçekten bu türetmeden geçmeli, yoksa rozet hiçbir ekranda görünmez.
  assert.match(liveSource, /type === "status" \? <Status>\{statusText\(config\.moduleId, row, key\)\}<\/Status>/);
  assert.match(liveSource, /<Status>\{statusText\(module\.id, data, item\.name\)\}<\/Status>/);
  // Görünümler modülü ancak buradan öğrenebiliyor.
  assert.match(liveSource, /config = \{ \.\.\.config, moduleId: module\.id,/);
});

test("gecikmeyen hiçbir kayıt Gecikti görünmez", () => {
  const cases = [
    ["vadesi yok", approved({}), ""],
    ["vadesi bugün", approved({ dueDate: "2026-09-23" }), "vade günü henüz gecikme değil"],
    ["vadesi ileride", approved({ dueDate: "2026-09-24" }), ""],
    ["henüz onaylanmamış", approved({ status: "Onay bekliyor", dueDate: "2026-09-15" }), "onaysız kayıt gecikmiş sayılmaz"],
    ["taslak", approved({ status: "Taslak", dueDate: "2026-09-15" }), ""],
    ["tahsil edilmiş", approved({ status: "Tahsil edildi", dueDate: "2026-09-15" }), "para girdikten sonra gecikme yok"],
    ["ödenmiş", approved({ status: "Ödendi", dueDate: "2026-09-15" }), ""],
    ["ters kaydedilmiş", approved({ status: "Ters kaydedildi", dueDate: "2026-09-15" }), ""],
    ["iptal", approved({ status: "İptal", dueDate: "2026-09-15" }), ""],
  ];
  for (const [label, row, note] of cases) {
    assert.equal(screen.isOverdueFinanceRow("finance", row, "2026-09-23"), false, `${label}: ${note || "gecikmiş sayılmamalı"}`);
    assert.equal(screen.statusText("finance", row), row.status, `${label}: durum metni değişmemeli`);
  }
});

test("rozet yalnız finans ekranında türetilir", () => {
  // Başka modüllerde `dueDate` başka bir anlam taşır (izin bitişi, punch
  // kalemi son tarihi); orada onaylı bir kaydın vadesi geçmiş olması gecikme
  // değildir ve durumu değiştirilemez.
  const row = approved({ dueDate: "2026-09-15" });
  for (const moduleId of ["accounting", "purchases", "handoverPunchItems", undefined]) {
    assert.equal(screen.isOverdueFinanceRow(moduleId, row, "2026-09-23"), false);
    assert.equal(screen.statusText(moduleId, row), "Onaylandı");
  }
});

test("vade uzatılınca rozet kendiliğinden düşer", () => {
  // Saklanan bir durum olsaydı kayıt "Gecikti" olarak asılı kalır, birinin
  // elle geri alması gerekirdi. Türetilen rozetin bütün değeri bu.
  const row = approved({ dueDate: "2026-09-15" });
  assert.equal(screen.isOverdueFinanceRow("finance", row, "2026-09-23"), true);
  assert.equal(screen.isOverdueFinanceRow("finance", { ...row, dueDate: "2026-10-15" }, "2026-09-23"), false);
});

test("rozet depodaki tehlike biçimini kullanır, yeni bir biçim uydurmaz", () => {
  assert.equal(screen.statusTone("Gecikti"), "danger");
  // Biçimin karşılığı stil sayfasında gerçekten var; aksi hâlde rozet
  // ötekilerden farksız görünürdü.
  assert.match(liveSource, /\.live-status\.danger\{/);
});

test("gün sınırı firmanın saat diliminde çizilir", () => {
  // İstanbul UTC+3: 22 Eylül 21:30 UTC orada 23 Eylül 00:30'dur. Tarayıcının
  // yerel saatiyle ölçülseydi yurt dışındaki bir ortağın ekranında vadesi
  // bugün dolan alacak gecikmiş görünürdü.
  assert.equal(screen.workspaceToday(Date.parse("2026-09-22T21:30:00Z")), "2026-09-23");
  assert.equal(screen.workspaceToday(Date.parse("2026-09-23T20:59:00Z")), "2026-09-23");
  assert.equal(screen.workspaceToday(Date.parse("2026-09-23T21:00:00Z")), "2026-09-24");

  // Ekran ile rapor aynı günü görmeli; dilim iki dosyada ayrışırsa aynı kayıt
  // ekranda gecikmiş, raporda gecikmemiş çıkar.
  const workerZone = workerSource.match(/const REPORT_TIME_ZONE = "([^"]+)"/);
  assert.ok(workerZone, "worker tarafındaki rapor saat dilimi okunamadı");
  assert.match(liveSource, new RegExp(`const WORKSPACE_TIME_ZONE = "${workerZone[1]}"`));
  // Dilimin sabitte yazılı olması yetmez, biçimleyiciye gerçekten verilmiş
  // olmalı. Kaynak da denetleniyor: biçimleyici dilimi almazsa makinenin
  // saatini kullanır ve testi İstanbul saatli bir bilgisayarda çalıştıran
  // kişi hatayı hiç görmez.
  assert.equal(screen.workspaceDayFormatter.resolvedOptions().timeZone, workerZone[1]);
  assert.match(liveSource, /const workspaceDayFormatter = new Intl\.DateTimeFormat\("en-CA", \{ timeZone: WORKSPACE_TIME_ZONE,/);
});

test("rozet sunum katmanında kalır: tahsilat ve ödeme düğmeleri çalışmaya devam eder", () => {
  // Asıl risk buydu: rozet için kaydın durumu değiştirilseydi tahsilat düğmesi
  // kaybolur, geciken para hiç kapatılamazdı.
  const overdueIncome = approved({ dueDate: zoneDay(-8) });
  const overdueExpense = approved({ type: "expense", dueDate: zoneDay(-8) });
  assert.equal(screen.statusText("finance", overdueIncome), "Gecikti");
  assert.deepEqual(screen.coreWorkflowActions(financeModule, overdueIncome, settler).map((item) => item.key), ["collect", "reverse"]);
  assert.deepEqual(screen.coreWorkflowActions(financeModule, overdueExpense, settler).map((item) => item.key), ["pay", "reverse"]);

  // Gecikmeyen onaylı kayıtla birebir aynı düğmeler çıkar: rozet koşulu
  // değiştirmez.
  assert.deepEqual(
    screen.coreWorkflowActions(financeModule, approved({ dueDate: zoneDay(8) }), settler).map((item) => item.key),
    screen.coreWorkflowActions(financeModule, overdueIncome, settler).map((item) => item.key),
  );
});

test("tahsilat koşulu sadeleşti: artık hiç oluşmayan bir durum aranmıyor", () => {
  const financeActions = section(liveSource, 'if (module.id === "finance") {', "return actions;");
  assert.doesNotMatch(financeActions, /"overdue"/);
  assert.match(financeActions, /if \(status === "approved"\) \{/);
  // Ters kayıt koşulu değişmedi.
  assert.match(financeActions, /\["approved", "collected", "paid"\]\.includes\(status\)/);
});

test("finans durum sözlüğünde saklanan bir gecikme kodu kalmadı", () => {
  const financeStatuses = section(apiSource, "  finance: { Taslak:", "\n");
  assert.doesNotMatch(financeStatuses, /overdue/);
  // Faturada `overdue` gerçek bir durum olmaya devam ediyor.
  assert.match(section(apiSource, "  accounting: { Taslak:", "\n"), /Gecikti: "overdue"/);
});

// ——— Madde 2: tahsilat tarihi ekranda ———

test("tahsilat tarihi ve kaydeden kişi çeviri katmanından geçer", () => {
  const { mapIncoming } = new Function([
    section(apiSource, "export const FIELD_MAPS = Object.freeze({", "// Etiket → sunucu durum kodu").replace("export ", ""),
    section(apiSource, "const STATUS_VALUES = Object.freeze({", "function snakeToCamel"),
    section(apiSource, "function snakeToCamel(value)", "function mapOutgoing("),
    "return { mapIncoming };",
  ].join("\n"))();

  const row = mapIncoming("finance", {
    id: "fin-1",
    status: "collected",
    due_date: "2026-09-15",
    settled_on: "2026-09-20",
    settled_by: "usr_0123456789abcdef",
    settled_by_name: "Ayşe Yılmaz",
  });
  assert.equal(row.settledOn, "2026-09-20");
  assert.equal(row.settledBy, "usr_0123456789abcdef");
  assert.equal(row.settledByName, "Ayşe Yılmaz");
  assert.match(apiSource, /settledOn: "settled_on", settledBy: "settled_by"/);
});

test("tahsil edilmiş kaydın detayında tahsilat tarihi ve kaydeden kişi görünür", () => {
  const financeConfig = section(liveSource, "\n  finance: {", "\n  accounting: {");
  assert.match(financeConfig, /detailExtras: \[/);
  assert.match(financeConfig, /field\("settledOn", "Tahsilat \/ ödeme tarihi", "date"\)/);
  assert.match(financeConfig, /field\("settledBy", "Kaydeden"\)/);
  // Formda yer almaz: bu iki alanı iş akışı ucu yazar, kullanıcı yazamaz.
  assert.doesNotMatch(section(financeConfig, "fields: [", "],"), /settled/);

  // Detay penceresi bu alanları gerçekten çiziyor ve boş olanı atıyor.
  const detail = section(liveSource, "function RecordDetailModal(", "function DeleteConfirmModal(");
  assert.match(detail, /config\.detailExtras \|\| \[\]/);
  assert.match(detail, /const shown = presentedValue\(data, item\.name\);/);
  assert.match(detail, /\.\.\.permittedFields, \.\.\.extraFields/);
});

test("tahsilat tarihi rapor kurucusunda da Türkçe etiketle çıkar", () => {
  // Etiket tek yerde yazılır; rapor sözlüğü onu configs'ten okumazsa sütun
  // İngilizce yedeğe ("Settled on") düşer.
  assert.match(liveSource, /for \(const item of config\?\.detailExtras \|\| \[\]\) labels\[reportColumnNameFor\(key, item\.name\)\] \?\?= item\.label;/);
});

test("tahsilat tarihi iş akışı onay panelinde sorulur ve bugünle açılır", () => {
  const [collect] = screen.coreWorkflowActions(financeModule, approved({ type: "income" }), settler);
  const [pay] = screen.coreWorkflowActions(financeModule, approved({ type: "expense" }), settler);
  for (const action of [collect, pay]) {
    assert.equal(action.inputKey, "settled_on", "sunucunun beklediği gövde alanı");
    assert.equal(action.inputType, "date");
    assert.equal(action.inputDefault, screen.workspaceToday(), "alan bugünle dolu açılmalı");
    assert.ok(!action.inputRequired, "boş bırakılırsa sunucu bugünü yazıyor; zorunlu olmamalı");
  }
  assert.equal(collect.inputLabel, "Tahsilat tarihi");
  assert.equal(pay.inputLabel, "Ödeme tarihi");

  // Panel tarih alanını gerçekten tarih olarak çiziyor ve varsayılanı
  // yüklüyor; aksi hâlde alan boş metin kutusu olarak açılırdı.
  const modal = section(liveSource, "function WorkflowConfirmModal(", "// Aynı talebe gelen teklifleri");
  assert.match(modal, /useState\(action\.inputDefault \|\| ""\)/);
  assert.match(modal, /type=\{type === "number" \|\| type === "date" \? type : "text"\}/);
  // Gövdeye yalnız dolu alan yazılır; kullanıcı temizlerse sunucunun kendi
  // varsayılanı geçerli olur.
  assert.match(modal, /if \(action\.inputKey && String\(inputValue\)\.trim\(\)\) body\[action\.inputKey\]/);
});

// ——— Madde 3: ölü seçenekler ———

test("finans formu yalnız sunucunun açtırdığı durumları sunar", () => {
  const creatable = workerSource.match(/"financial-transactions": new Set\(\[([^\]]+)\]\)/);
  assert.ok(creatable, "sunucudaki oluşturma durumu kümesi okunamadı");
  const serverCodes = [...creatable[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(serverCodes, ["draft", "planned", "pending"]);

  const labels = new Function(`${section(apiSource, "const STATUS_VALUES = Object.freeze({", "const reverseStatuses")}\nreturn STATUS_VALUES.finance;`)();
  const expected = serverCodes.map((code) => Object.keys(labels).find((label) => labels[label] === code));
  assert.deepEqual(expected, ["Taslak", "Planlandı", "Onay bekliyor"]);

  const financeConfig = section(liveSource, "\n  finance: {", "\n  accounting: {");
  const options = financeConfig.match(/field\("status", "Durum", "select", \{ options: \[([^\]]*)\] \}\)/);
  assert.ok(options, "finans formundaki durum seçenekleri okunamadı");
  assert.deepEqual(JSON.parse(`[${options[1]}]`), expected, "form, sunucunun kabul etmediği bir durum sunmamalı");
});

test("fatura formundaki durum listesine dokunulmadı", () => {
  // Faturada bu durumlar serbestçe verilebiliyor; oradaki liste finans
  // formuyla aynı kurala tabi değil.
  const accountingConfig = section(liveSource, "\n  accounting: {", "\n  hr: {");
  const options = accountingConfig.match(/field\("status", "Durum", "select", \{ options: \[([^\]]*)\] \}\)/);
  assert.ok(options, "fatura formundaki durum seçenekleri okunamadı");
  assert.deepEqual(JSON.parse(`[${options[1]}]`), ["Taslak", "Açık", "Kısmi", "Ödendi", "Tahsil edildi", "Gecikti"]);
});

// ——— Madde 4: "yalnız vadesi geçmişler" süzgeci ———
//
// Rozet ile süzgeç aynı cümleden doğmak zorunda. Aşağıdaki testler gerçek
// şemaya, gerçek uca ve ekranın kendi kuralına karşı çalışır: sahte bir SQL
// kopyası ya da metin eşleştirmesi, ikisinin ayrıştığı günü yakalayamazdı.

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

const migrationsDirectory = new URL("../migrations/", import.meta.url);
const timestamp = "2026-08-09T10:00:00.000Z";

// İstanbul'da 23.09.2026 öğlen. Gün sınırını ayrıca ölçen test bunu gecenin
// yarısına taşır; geri kalan testler günün ortasında durup sınırdan bağımsız
// kalsın diye bu an seçildi.
const NOON = "2026-09-23T09:00:00.000Z";

async function setupFinance({ clock = NOON } = {}) {
  const database = new DatabaseSync(":memory:");
  for (const name of (await readdir(migrationsDirectory)).filter((item) => /^\d{4}_.+\.sql$/.test(item)).sort()) {
    database.exec(await readFile(new URL(name, migrationsDirectory), "utf8"));
  }
  database.prepare("INSERT INTO tenants (id,name,slug,created_at,updated_at) VALUES (?,?,?,?,?)").run("tenant-a", "Firma A", "firma-a", timestamp, timestamp);
  database.prepare("INSERT INTO users (id,email,full_name,status,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("owner-a", "owner@a.test", "Firma Sahibi", "active", timestamp, timestamp);
  database.prepare("INSERT INTO roles (id,tenant_id,code,name,is_system,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("role-owner", "tenant-a", "owner", "Firma Sahibi", 1, timestamp, timestamp);
  database.prepare("INSERT INTO memberships (id,tenant_id,user_id,role_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").run("member-a", "tenant-a", "owner-a", "role-owner", "active", timestamp, timestamp);
  database.prepare("INSERT INTO customers (id,tenant_id,code,name,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("customer-a", "tenant-a", "C-1", "Müşteri A", timestamp, timestamp);
  for (const [id, code, name] of [["project-a", "P-1", "Lobi"], ["project-b", "P-2", "Odalar"]]) {
    database.prepare("INSERT INTO projects (id,tenant_id,customer_id,code,name,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run(id, "tenant-a", "customer-a", code, name, "production", timestamp, timestamp);
  }
  // `REPORT_CLOCK` yalnız `ALLOW_DEV_AUTH` açıkken dikkate alınıyor; üretimde
  // yanlışlıkla tanımlansa bile gün sınırı gerçek saatten okunur.
  return { database, env: { DB: new D1Database(database), ALLOW_DEV_AUTH: "true", REPORT_CLOCK: clock } };
}

function insertTransaction(database, row) {
  const columns = ["id", "tenant_id", "transaction_number", "project_id", "customer_id", "type", "transaction_date", "due_date", "amount_minor", "official", "status", "category", "metadata_json", "created_at", "updated_at"];
  const values = {
    tenant_id: "tenant-a", project_id: "project-a", customer_id: "customer-a", type: "income",
    transaction_date: "2026-08-01", due_date: null, amount_minor: 100_000, official: 1, status: "approved",
    category: null, metadata_json: "{}", created_at: timestamp, updated_at: timestamp, ...row,
  };
  database.prepare(`INSERT INTO financial_transactions (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`).run(...columns.map((column) => values[column]));
}

function financeRequest(path, { method = "GET", email = "owner@a.test" } = {}) {
  return new Request(`https://example.test${path}`, { method, headers: new Headers({ "x-user-email": email, "x-tenant-id": "tenant-a" }) });
}
const listFinance = async (env, query = "") => (await (await worker.fetch(financeRequest(`/api/v1/financial-transactions${query}`), env)).json());
const idsOf = (payload) => payload.data.map((row) => row.id).sort();

// Bütün hâlleri tek yerde tanımlayıp her testte aynı veriyi kullanıyoruz:
// süzgecin kümesi ile rozetin kümesi ancak aynı satırlar üzerinde
// karşılaştırılabilir.
const OVERDUE_IDS = ["exp-late", "inc-late", "inc-late-unofficial", "inc-stamp-late", "inc-yesterday"];
function seedFinance(database) {
  // Vadesi geçmiş sayılanlar.
  insertTransaction(database, { id: "inc-late", transaction_number: "F-1", due_date: "2026-09-15", amount_minor: 60_000, category: "Satış" });
  insertTransaction(database, { id: "inc-yesterday", transaction_number: "F-2", due_date: "2026-09-22", amount_minor: 15_000 });
  insertTransaction(database, { id: "inc-late-unofficial", transaction_number: "F-3", due_date: "2026-09-10", amount_minor: 5_000, official: 0 });
  // Gider de gecikir: rozet tipe bakmıyor, süzgeç de bakmamalı.
  insertTransaction(database, { id: "exp-late", transaction_number: "F-4", type: "expense", due_date: "2026-09-01", amount_minor: 25_000, project_id: "project-b" });

  // Vadesi geçmiş sayılmayanlar.
  insertTransaction(database, { id: "inc-today", transaction_number: "F-5", due_date: "2026-09-23", amount_minor: 90_000 });
  insertTransaction(database, { id: "inc-future", transaction_number: "F-6", due_date: "2026-12-31", amount_minor: 80_000 });
  insertTransaction(database, { id: "inc-nodate", transaction_number: "F-7", due_date: null, amount_minor: 70_000 });
  for (const [id, status] of [["fin-draft", "draft"], ["fin-planned", "planned"], ["fin-pending", "pending"], ["fin-collected", "collected"], ["fin-reversed", "reversed"], ["fin-cancelled", "cancelled"]]) {
    insertTransaction(database, { id, transaction_number: `F-${id}`, due_date: "2026-09-01", amount_minor: 1_000, status });
  }
  insertTransaction(database, { id: "exp-paid", transaction_number: "F-8", type: "expense", due_date: "2026-09-01", amount_minor: 2_000, status: "paid" });

  // Tarih olmayan vade değerleri. `due_date` yazılırken doğrulanmıyor, yani
  // bunlar gerçekten kaydedilebiliyor: `'' < '2026-09-23'` SQLite'ta doğru
  // olduğu için düz bir karşılaştırma boş vadeyi "gecikmiş" sayar, ekran ise
  // saymaz. Zaman damgalı vade de iki tarafta aynı cevabı vermeli; ekran günü
  // ilk on karakterden okuyor.
  insertTransaction(database, { id: "inc-empty-due", transaction_number: "F-9", due_date: "", amount_minor: 3_000 });
  insertTransaction(database, { id: "inc-zero-due", transaction_number: "F-10", due_date: "0", amount_minor: 3_000 });
  insertTransaction(database, { id: "inc-text-due", transaction_number: "F-11", due_date: "yakında", amount_minor: 3_000 });
  insertTransaction(database, { id: "inc-stamp-late", transaction_number: "F-12", due_date: "2026-09-15T08:00:00Z", amount_minor: 4_000 });
  insertTransaction(database, { id: "inc-stamp-today", transaction_number: "F-13", due_date: "2026-09-23T08:00:00Z", amount_minor: 4_000 });
}

test("süzgeç yalnız vadesi geçmiş hareketleri verir", async () => {
  const { database, env } = await setupFinance();
  seedFinance(database);

  assert.deepEqual(idsOf(await listFinance(env, "?overdue=true&pageSize=100")), OVERDUE_IDS);

  // Sınırın iki yanı: vade günü dolduğu gün henüz gecikme değil, ertesi gün
  // gecikmedir. `<=` yazılsaydı bugün vadesi dolan kayıt da listeye düşerdi.
  const overdue = new Set(idsOf(await listFinance(env, "?overdue=true&pageSize=100")));
  assert.ok(!overdue.has("inc-today"), "vadesi bugün dolan hareket gecikmiş değildir");
  assert.ok(overdue.has("inc-yesterday"), "vadesi dün dolan hareket gecikmiştir");
  assert.ok(!overdue.has("inc-nodate"), "vadesi olmayan hareketi ölçecek tarih yok");
  for (const id of ["fin-draft", "fin-planned", "fin-pending", "fin-collected", "fin-reversed", "fin-cancelled", "exp-paid"]) {
    assert.ok(!overdue.has(id), `${id}: yalnız onaylı hareket gecikmiş sayılır`);
  }
  // Tarih olmayan vade "geçmiş" sayılmaz: ekran da saymıyor, sayılsaydı
  // listede rozetsiz bir satır görünürdü.
  for (const id of ["inc-empty-due", "inc-zero-due", "inc-text-due"]) {
    assert.ok(!overdue.has(id), `${id}: tarih olmayan vade gecikme ölçemez`);
  }
  assert.ok(overdue.has("inc-stamp-late"), "zaman damgalı vade de gün olarak okunur");
  assert.ok(!overdue.has("inc-stamp-today"), "bugün zaman damgalı vade henüz gecikme değil");
  assert.ok(overdue.has("exp-late"), "vadesi geçmiş borç da vadesi geçmiş alacak kadar gerçektir");

  // Süzgeç kapalıyken hiçbir kaydı elemez: aç/kapa anahtarıdır, kapsam
  // daraltması değil.
  const all = await listFinance(env, "?pageSize=100");
  assert.equal(all.meta.total, 19);
  for (const off of ["", "?overdue=false", "?overdue=0", "?overdue="]) {
    assert.equal((await listFinance(env, `${off}${off ? "&" : "?"}pageSize=100`)).meta.total, 19, `${off || "(süzgeçsiz)"}: kapalı süzgeç kayıt elememeli`);
  }
});

test("süzgeç var olan süzgeçlerle birlikte çalışır", async () => {
  const { database, env } = await setupFinance();
  seedFinance(database);

  // Tip: vadesi geçmiş yalnız giderler.
  assert.deepEqual(idsOf(await listFinance(env, "?overdue=true&type=expense&pageSize=100")), ["exp-late"]);
  assert.deepEqual(idsOf(await listFinance(env, "?overdue=true&type=income&pageSize=100")), ["inc-late", "inc-late-unofficial", "inc-stamp-late", "inc-yesterday"]);
  // Resmiyet: sekme çubuğu ile anahtar birlikte kullanılabilmeli.
  assert.deepEqual(idsOf(await listFinance(env, "?overdue=true&official=0&pageSize=100")), ["inc-late-unofficial"]);
  assert.deepEqual(idsOf(await listFinance(env, "?overdue=true&official=1&pageSize=100")), ["exp-late", "inc-late", "inc-stamp-late", "inc-yesterday"]);
  // Proje ve durum süzgeçleri.
  assert.deepEqual(idsOf(await listFinance(env, "?overdue=true&project_id=project-b&pageSize=100")), ["exp-late"]);
  assert.deepEqual(idsOf(await listFinance(env, "?overdue=true&status=approved&pageSize=100")), OVERDUE_IDS);
  assert.deepEqual(idsOf(await listFinance(env, "?overdue=true&status=pending&pageSize=100")), []);
  // Arama kutusu.
  assert.deepEqual(idsOf(await listFinance(env, "?overdue=true&q=Sat%C4%B1%C5%9F&pageSize=100")), ["inc-late"]);
});

test("süzgeç toplam sayıyı ve sayfalamayı da süzer", async () => {
  const { database, env } = await setupFinance();
  seedFinance(database);

  // Sayım ile liste ayrışsaydı sayfa sayısı yalan söylerdi: kullanıcı ikinci
  // sayfayı açar, boş bulurdu.
  const first = await listFinance(env, "?overdue=true&pageSize=2&page=1");
  assert.equal(first.meta.total, OVERDUE_IDS.length);
  assert.equal(first.data.length, 2);
  const second = await listFinance(env, "?overdue=true&pageSize=2&page=2");
  assert.equal(second.meta.total, OVERDUE_IDS.length);
  assert.equal(second.data.length, 2);
  const third = await listFinance(env, "?overdue=true&pageSize=2&page=3");
  assert.equal(third.data.length, 1);
  assert.deepEqual([...first.data, ...second.data, ...third.data].map((row) => row.id).sort(), OVERDUE_IDS);
  // Son sayfadan sonrası boş: sayfa sayısı `meta.total`dan hesaplanıyor ve
  // kullanıcı var olmayan bir sayfaya yönlendirilmiyor.
  assert.equal((await listFinance(env, "?overdue=true&pageSize=2&page=4")).data.length, 0);

  // CSV çıktısı da ekranda görüneni indirir.
  const csv = await (await worker.fetch(financeRequest("/api/v1/financial-transactions/export?overdue=1"), env)).text();
  const numbers = [...csv.matchAll(/"(F-\d+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(numbers, ["F-1", "F-12", "F-2", "F-3", "F-4"]);
});

test("gün sınırı İstanbul'da çizilir, SQLite'ın UTC'sinde değil", async () => {
  // İstanbul'da 23.09.2026 saat 00:30; UTC'de hâlâ 22.09.2026 21:30. Bu üç
  // saatlik aralıkta `date('now')` dünü verir ve vadesi dün dolan alacak
  // "henüz gecikmedi" diye sayılırdı — ekranda ise "Gecikti" yazıyordu.
  const { database, env } = await setupFinance({ clock: "2026-09-22T21:30:00.000Z" });
  seedFinance(database);

  const overdue = new Set(idsOf(await listFinance(env, "?overdue=true&pageSize=100")));
  assert.ok(overdue.has("inc-yesterday"), "22.09 vadeli kayıt, İstanbul 23.09'a geçtiği anda gecikmiştir");
  assert.ok(!overdue.has("inc-today"), "23.09 vadeli kayıt o gün boyunca gecikmiş değildir");

  // Saat İstanbul'da bir gün geri alındığında aynı kayıt listeden düşer: gün
  // sınırı gerçekten enjekte edilen andan okunuyor, sabit bir tarihten değil.
  const { database: earlierDatabase, env: earlier } = await setupFinance({ clock: "2026-09-21T21:30:00.000Z" });
  seedFinance(earlierDatabase);
  const earlierOverdue = new Set(idsOf(await listFinance(earlier, "?overdue=true&pageSize=100")));
  assert.ok(!earlierOverdue.has("inc-yesterday"), "22.09 vadeli kayıt 22.09 günü henüz gecikmemiştir");
  assert.ok(earlierOverdue.has("inc-late"), "15.09 vadeli kayıt her iki anda da gecikmiştir");
});

test("finans sorgularında SQLite'ın UTC günü kullanılmıyor", async () => {
  // Bu koruma davranışla ölçülemez: testi İstanbul saatli bir makinede
  // çalıştıran kişi farkı hiç görmez. `date('now')` finans sorgularına geri
  // sızarsa, gecenin ilk üç saatinde pano ile ekran ayrışır.
  // Satır sonunda kesiliyor: finans alt sorguları kendi satırlarında yazılı ve
  // aynı ifadenin sonraki satırdaki başka bir tablosu (görev, kapasite) buraya
  // karışmamalı.
  const queries = workerSource.match(/FROM financial_transactions[^"`\n]*/g) || [];
  assert.ok(queries.length >= 5, `beklenenden az sorgu tarandı: ${queries.length}`);
  assert.deepEqual(queries.filter((query) => query.includes("date('now')")), []);
});

test("pano ile liste aynı cümleyi kullanır", async () => {
  const { database, env } = await setupFinance({ clock: "2026-09-22T21:30:00.000Z" });
  seedFinance(database);

  const panel = (await (await worker.fetch(financeRequest("/api/v1/dashboard"), env)).json()).data;
  // Vadesi geçen alacak: inc-late (60.000) + inc-yesterday (15.000) +
  // inc-late-unofficial (5.000) + inc-stamp-late (4.000). Gün sınırı UTC'de
  // çizilseydi inc-yesterday düşer, toplam 69.000 çıkardı.
  assert.equal(panel.receivables.overdue_amount_minor, 84_000);
  // Vadesi geçen borç da sayılıyor.
  assert.equal(panel.payables.overdue_amount_minor, 25_000);

  // Toplamlar listedeki satırların tutarlarıyla birebir örtüşmeli: pano ile
  // liste aynı kümeyi görmeli, yalnız biri sayıp öteki listelemeli.
  const rows = (await listFinance(env, "?overdue=true&pageSize=100")).data;
  const sumOf = (type) => rows.filter((row) => row.type === type).reduce((total, row) => total + row.amount_minor, 0);
  assert.equal(panel.receivables.overdue_amount_minor, sumOf("income"));
  assert.equal(panel.payables.overdue_amount_minor, sumOf("expense"));
});

test("sunucu süzgeci ile ekrandaki rozet birebir aynı satırları seçer", async () => {
  // Bu turun asıl sözleşmesi. Aynı satırlar iki yoldan geçiriliyor: biri
  // sunucunun SQL koşulu, öteki ekranın kendi kuralı (`isOverdueFinanceRow`).
  // Kümeler ayrılırsa kullanıcı, rozet taşıyan bir satırı süzgeçte bulamaz ya
  // da süzgeçte rozetsiz satır görür — yani program kendi kendisiyle çelişir.
  const { mapIncoming } = new Function([
    section(apiSource, "export const FIELD_MAPS = Object.freeze({", "// Etiket → sunucu durum kodu").replace("export ", ""),
    section(apiSource, "const STATUS_VALUES = Object.freeze({", "function snakeToCamel"),
    section(apiSource, "function snakeToCamel(value)", "function mapOutgoing("),
    "return { mapIncoming };",
  ].join("\n"))();

  // Gün sınırının iki yanı da denensin diye birkaç farklı an: ikisi gecenin
  // yarısında (İstanbul yeni güne geçmiş, UTC hâlâ dünde), biri öğlen.
  for (const clock of ["2026-09-23T09:00:00.000Z", "2026-09-22T21:30:00.000Z", "2026-09-21T21:00:00.000Z"]) {
    const { database, env } = await setupFinance({ clock });
    seedFinance(database);

    const serverIds = idsOf(await listFinance(env, "?overdue=true&pageSize=100"));
    // Ekranın gördüğü liste: süzgeçsiz çekilip çeviri katmanından geçirilir,
    // sonra satır satır ekranın kendi kuralına sorulur. Gün, sunucuya verilen
    // anın aynısından türetiliyor — iki taraf aynı "şimdi"yi okuyor.
    const screenRows = mapIncoming("finance", (await listFinance(env, "?pageSize=100")).data);
    const today = screen.workspaceToday(Date.parse(clock));
    const badgedIds = screenRows.filter((row) => screen.isOverdueFinanceRow("finance", row, today)).map((row) => row.id).sort();

    assert.deepEqual(badgedIds, serverIds, `${clock}: süzgecin kümesi ile rozetin kümesi aynı olmalı`);
    // Süzgeç açıkken listedeki her satır gerçekten "Gecikti" yazmalı; iki
    // tanımın aynı olduğunun kullanıcıya görünen kanıtı budur.
    const filteredRows = mapIncoming("finance", (await listFinance(env, "?overdue=true&pageSize=100")).data);
    assert.ok(filteredRows.length > 0, `${clock}: karşılaştırılacak satır yok`);
    for (const row of filteredRows) assert.equal(screen.statusText("finance", row, "status", today), "Gecikti", `${row.id}: süzgeçteki her satır rozetli görünmeli`);
  }
});

// ——— Madde 5: süzgecin ekrandaki denetimi ———

test("vadesi geçmiş süzgeci resmiyet sekmesinden ayrı bir denetimdir", () => {
  const financeConfig = section(liveSource, "\n  finance: {", "\n  accounting: {");
  assert.match(financeConfig, /overdueFilter: true/);
  // Yalnız finans modülünde: başka kaynaklarda `dueDate` başka bir şey anlatır.
  assert.equal((liveSource.match(/overdueFilter: true/g) || []).length, 1);

  // Sekme çubuğu hâlâ üç seçenek: dördüncü sekme olsaydı kullanıcı gecikenleri
  // görmek için resmiyet seçiminden vazgeçmek zorunda kalırdı.
  const tabs = section(liveSource, '<div className="live-filter-tabs">', "</div>");
  assert.equal((tabs.match(/<button/g) || []).length, 3);
  assert.doesNotMatch(tabs, /vadesi geçmiş/i);

  // Anahtar ayrı bir denetim, açık/kapalı durumu yardımcı teknolojiye de
  // bildiriliyor.
  assert.match(liveSource, /className=\{`live-filter-toggle\$\{overdueOnly \? " active" : ""\}`\}/);
  assert.match(liveSource, /aria-pressed=\{overdueOnly\}/);
  assert.match(liveSource, /Yalnız vadesi geçmişler/);
  assert.match(liveSource, /\.live-filter-toggle\{/, "anahtarın stili gerçekten tanımlı olmalı");
});

test("süzgeç sunucuya gider, liste ve CSV aynı kümeyi görür", () => {
  assert.match(liveSource, /const overdueFilterOn = Boolean\(config\.overdueFilter && overdueOnly\);/);
  // Süzgeç sunucuda uygulanıyor: gün sınırı orada çiziliyor ve `meta.total` da
  // aynı kümeyi sayıyor. İstemcide satır ayıklansaydı sayfa sayısı yalan söylerdi.
  assert.match(liveSource, /\.\.\.\(overdueFilterOn \? \{ overdue: true \} : \{\}\)/);
  assert.match(workerSource, /derivedFilters: \{ overdue: overdueFinanceCondition \}/, "istemcinin gönderdiği ad ile kaynak tanımındaki ad aynı olmalı");
  // Anahtar değişince liste yeniden yüklenir; yoksa ekran eski kümede kalırdı.
  assert.match(liveSource, /\[module\.id, session\?\.tenant\?\.id, officialFilter, overdueFilterOn, refreshKey\]/);
  assert.match(liveSource, /\.\.\.\(overdueFilterOn \? \{ overdue: "1" \} : \{\}\)/, "CSV ekranda görüneni indirmeli");
});

test("süzgeç açıkken boş liste doğru şeyi anlatır ve sayaç süzgeci yansıtır", () => {
  // Genel "henüz kayıt eklenmemiş" metni burada yanıltıcı olurdu: kullanıcı
  // süzgeci açık unuttuğunu anlamadan verisinin gittiğini sanardı.
  assert.match(liveSource, /overdueFilterOn \? <EmptyState heading="Vadesi geçmiş hareket yok"/);
  assert.match(liveSource, /kayıt\{overdueFilterOn \? " · vadesi geçmiş" : ""\}/);
  const empty = section(liveSource, "function EmptyState(", "function Status(");
  assert.match(empty, /\{heading \|\|/);
  assert.match(empty, /\{note \|\|/);
});
