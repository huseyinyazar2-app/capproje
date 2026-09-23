import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
