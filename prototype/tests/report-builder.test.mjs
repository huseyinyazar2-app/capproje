import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createRuntime, startSelfHostedServer } from "../server/index.mjs";

const workspaceUrl = new URL("../src/LiveWorkspace.jsx", import.meta.url);
const apiUrl = new URL("../src/api.js", import.meta.url);

const [liveSource, apiSource] = await Promise.all([readFile(workspaceUrl, "utf8"), readFile(apiUrl, "utf8")]);

// Denetimler dosyanın tamamında değil, rapor koduna ait bölümlerde yapılır:
// aynı dosyada elli başka ekran var ve onların kuralları bu ekranı bağlamaz.
function section(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.ok(start >= 0, `${startNeedle} bulunamadı`);
  const end = source.indexOf(endNeedle, start);
  assert.ok(end > start, `${endNeedle} bulunamadı`);
  return source.slice(start, end);
}

const reportScreen = section(liveSource, "const REPORT_PREVIEW_DELAY_MS", "function ProjectCommandCenterModal(");

// Etiket ve sütun yardımcıları JSX dosyasında yaşıyor, node doğrudan içeri
// alamıyor. Kaynaktan kesip derlemek, davranışı metin eşleştirmesiyle değil
// gerçekten çalıştırarak denetlemeyi sağlıyor.
// Etiket, biçim ve durum sözlükleri: iki yükleyicinin ortak temeli.
function reportHelperSources() {
  return [
    // Denetim kaydı kaynak adlarının menü başlığına çevrilmesi `modules`
    // dizisine, o da React bileşenlerine bağlı. Rapor sütunlarında
    // "resourceName" tipi yok; boş sözlük yeterli.
    "const resourceTitles = {};",
    section(apiSource, "export const RESOURCE_SLUGS", "// Rapor kurucusu bu haritayı").replace("export ", ""),
    section(apiSource, "export const FIELD_MAPS", "// Etiket → sunucu durum kodu").replace("export ", ""),
    // Para, sayı ve tarih biçimleri: CSV bunları yeniden kurmamalı, ekranın
    // kullandığı biçimlendiricilerin aynısından geçmeli.
    section(liveSource, "const moneyWhole = new Intl.NumberFormat", "// Derleme damgası"),
    section(liveSource, "const currencyLabels = {", '// "2026-07-22"'),
    section(liveSource, "const isoLike = /^", "const modules = ["),
    section(liveSource, "const field = (name, label", "const operationalViews"),
    section(liveSource, "const identifierField = /(Id|By)$/", "function statusTone("),
    section(liveSource, "const enumLabels = {", "// Denetim kaydı modülü"),
    section(liveSource, "const auditActionLabels = {", "// Sunucudaki üst yetki"),
    section(liveSource, "const reportColumnNameFor", "// Sunucu `definition_json`"),
  ];
}
function loadReportHelpers() {
  const parts = [
    ...reportHelperSources(),
    section(liveSource, "const reportAggregateLabels = {", "const reportOperatorsFor"),
    section(liveSource, "// Bir rapor hücresinin kullanıcıya görünen metni", "function ReportCard("),
    "return { reportColumnLabel, reportColumnLabels, sharedColumnLabels, humanizeColumnName, collapseReportColumns, reportPresentedValue, reportCellText, reportHeaderLabel, reportCsvField, reportCsvCell, reportCsvSafeText, reportCsvCurrency, buildReportCsv, localizedEnum, formatValue };",
  ];
  return new Function(parts.join("\n"))();
}
const helpers = loadReportHelpers();
const reportLabels = section(liveSource, "const reportColumnNameFor", "const auditActionLabels");
const reportApi = section(apiSource, "async reportFields()", "async workflow(");
const liveStyles = section(liveSource, "function LiveStyles()", "\n  `}</style>;");

test("rapor ekranı menüde Genel grubunda ve yetkiye bağlı", () => {
  assert.match(liveSource, /\{ id: "reports", group: "Genel", title: "Raporlar", icon: \w+, resource: "reports"/);

  // Ana Sayfa'dan hemen sonra gelmeli.
  const dashboard = liveSource.indexOf('{ id: "dashboard", group: "Genel"');
  const reports = liveSource.indexOf('{ id: "reports", group: "Genel"');
  const notifications = liveSource.indexOf('{ id: "notifications", group: "Genel"');
  assert.ok(dashboard >= 0 && reports > dashboard && notifications > reports, "Raporlar, Ana Sayfa ile Bildirimler arasında olmalı");

  // Menü süzmesi okuma yetkisine bakar; rapor ekranı bu kuralın dışına
  // çıkarılmamalı (authenticated/ownerOnly gibi bir kaçış yok).
  assert.match(liveSource, /const visibleModules = modules\.filter\(\(item\) => \{[\s\S]*?return permissionAllows\(session, "read", item\.resource\);/);
  assert.doesNotMatch(liveSource, /\{ id: "reports",[^}]*(authenticated|ownerOnly|specialAccess)/);

  // Yazma ve silme ayrı yetkiler; sözleşmedeki reports.write / reports.delete
  // kodlarına permissionAllows üzerinden çözülür.
  assert.match(reportScreen, /const canWrite = online && permissionAllows\(session, "create", "reports"\)/);
  assert.match(reportScreen, /const canRemove = online && permissionAllows\(session, "delete", "reports"\)/);
  assert.match(reportScreen, /const canExport = online && hasCapability\(session, "export"\)/);
  assert.match(reportScreen, /disabled=\{!canWrite \|\| saving\}/);
  assert.match(reportScreen, /canRemove && mine &&/);
});

test("canlı önizleme geciktirilir ve her tuş vuruşunda istek atmaz", () => {
  const delay = Number(/const REPORT_PREVIEW_DELAY_MS = (\d+)/.exec(reportScreen)?.[1]);
  assert.ok(delay >= 300 && delay <= 500, `önizleme gecikmesi 300-500 ms arasında olmalı, bulunan: ${delay}`);

  const effect = section(reportScreen, "const ticket = previewTicket.current + 1", "}, [definitionKey, online]);");
  assert.match(effect, /setTimeout\(\(\) => \{/);
  assert.ok(effect.indexOf("setTimeout") < effect.indexOf("api.runReport"), "istek zamanlayıcının içinden gitmeli");
  assert.match(effect, /return \(\) => clearTimeout\(timer\);/);
});

test("geç dönen eski önizleme yanıtı yeninin üstüne yazamaz", () => {
  assert.match(reportScreen, /const previewTicket = useRef\(0\)/);
  const effect = section(reportScreen, "const ticket = previewTicket.current + 1", "}, [definitionKey, online]);");
  assert.match(effect, /previewTicket\.current = ticket;/);

  // Hem başarı hem hata yolu kendi sıra numarasını doğrulamalı.
  const guards = effect.match(/if \(previewTicket\.current !== ticket\) return;/g) || [];
  assert.equal(guards.length, 2, "yanıt ve hata yolları ayrı ayrı korunmalı");
  assert.ok(effect.indexOf("if (previewTicket.current !== ticket) return;") < effect.indexOf("setPreview({ loading: false, data: result.data"), "sonuç yazılmadan önce sıra kontrol edilmeli");

  // Geçersiz tanımda da sıra ilerletilir; uçuştaki eski bir yanıt geri gelip
  // ekranı doldurmamalı.
  assert.match(reportScreen, /if \(problem\) \{\s*\n\s*previewTicket\.current \+= 1;/);
});

test("önizleme isteği preview bayrağını taşır ve tanım snake_case kalır", () => {
  assert.match(reportScreen, /api\.runReport\(requestDefinition, \{ preview: true \}\)/);
  assert.match(apiSource, /reportRun: "\/reports\/run"/);
  assert.match(apiSource, /reportFields: "\/reports\/fields"/);
  assert.match(apiSource, /savedReports: "\/saved-reports"/);
  assert.match(reportApi, /async runReport\(definition, \{ preview = false \} = \{\}\)/);
  assert.match(reportApi, /body: \{ definition, preview \}/);

  // Rapor tanımı veritabanı sütun adlarını taşır; camelCase'e çeviren
  // eşleyicilerden geçerse sunucudaki beyaz listeye takılır.
  assert.doesNotMatch(reportApi, /mapOutgoing|mapIncoming/);
  assert.match(reportApi, /definition_json: values\.definition/);

  // Tanım sözleşmedeki alanları kurar.
  assert.match(reportScreen, /resource: draft\.resource,/);
  assert.match(reportScreen, /columns: draft\.group \? \[\] : draft\.columns,/);
  assert.match(reportScreen, /filters: draft\.filters\.filter\(reportFilterReady\)/);
  assert.match(reportScreen, /definition\.group = \{/);
});

test("geçersiz tanımda istek atılmaz, eksik olan Türkçe anlatılır", () => {
  assert.match(reportScreen, /function reportDefinitionProblem\(definition\)/);
  assert.match(reportScreen, /if \(!definition\.resource\) return "Önce raporun okuyacağı kaynağı seçin\.";/);
  assert.match(reportScreen, /return "Önizleme için en az bir sütun seçin\.";/);
  assert.match(reportScreen, /return "Gruplamak için en az bir alan seçin\.";/);

  // Sorun varsa efekt istek kurmadan çıkar.
  const guard = section(reportScreen, "const problem = reportDefinitionProblem(requestDefinition);", "if (!online)");
  assert.match(guard, /return undefined;/);
  assert.doesNotMatch(guard, /api\.runReport/);
});

test("403 ve 422 kullanıcıya ham kod olarak değil Türkçe anlatılır", () => {
  assert.match(reportScreen, /function reportErrorMessage\(error\)/);
  const message = section(reportScreen, "function reportErrorMessage(error)", "function reportAggregateAlias");
  assert.match(message, /error\?\.status === 403[\s\S]*?yetkiniz yok/);
  assert.match(message, /error\?\.status === 422[\s\S]*?Rapor tanımı kabul edilmedi/);

  // Ekranda hata nesnesi değil, bu cümle gösterilir.
  assert.match(reportScreen, /\{reportErrorMessage\(preview\.error\)\}/);
  assert.match(reportScreen, /\{reportErrorMessage\(saveError\)\}/);
  assert.doesNotMatch(reportScreen, /\{preview\.error\.(code|status)\}/);
});

test("önizleme yenilenirken eski sonuç yerinde kalır ve sönükleşir", () => {
  // Eski veri korunarak yalnız loading işaretlenir; tablo sökülüp yeniden
  // kurulmadığı için ekran zıplamaz.
  assert.match(reportScreen, /setPreview\(\(current\) => \(\{ \.\.\.current, loading: true, error: null, notice: null \}\)\);/);
  assert.match(reportScreen, /className=\{`live-report-preview [^`]*\$\{preview\.loading \? "refreshing" : ""\}`\}/);
  assert.match(liveStyles, /\.live-report-preview\.refreshing\{opacity:/);
  assert.match(reportScreen, /live-report-refreshing/);
});

test("biçimlendirme var olan yardımcılarla yapılır, yeni biçimlendirici yazılmaz", () => {
  assert.match(reportScreen, /formatValue\(reportCellValue\(column\.key, cell, column\.type\), column\.type, row\)/);
  assert.match(reportScreen, /<Status>\{cell\}<\/Status>/);
  // Ekrandaki hücre metni ile dosyadaki hücre metni aynı fonksiyondan gelir.
  assert.match(reportScreen, /: reportCellText\(column, row\)\}<\/td>/);

  for (const source of [reportScreen, reportLabels]) {
    assert.doesNotMatch(source, /new Intl\.(NumberFormat|DateTimeFormat)/, "rapor kodu yeni bir biçimlendirici kurmamalı");
    assert.doesNotMatch(source, /toLocaleDateString|toLocaleString\(|toFixed\(/, "para ve tarih biçimi formatValue'dan gelmeli");
    assert.doesNotMatch(source, /minimumFractionDigits|day: "2-digit"/);
  }

  // Kuruş/lira dönüşümü sütunun adına değil sunucunun bildirdiği tipe
  // bağlıdır; gruplu toplamın adı takma addır ve `_minor` ile bitmez.
  assert.match(reportLabels, /if \(type !== "money" \|\| value == null/);
  assert.doesNotMatch(reportLabels, /String\(column\)\.endsWith\("_minor"\)/);
  assert.match(apiSource, /if \(key\.endsWith\("_minor"\) && typeof raw === "number"\) mapped = raw \/ 100/);
});

test("Türkçe sütun etiketleri ekran tanımlarından türetilir, bilinmeyen sütun okunabilir kalır", () => {
  // Etiketler konfigürasyondaki sütun ve form alanı adlarından üretilir;
  // ikinci bir sözlük tutulmaz.
  assert.match(reportLabels, /Object\.entries\(RESOURCE_SLUGS\)\.map\(\(\[key, slug\]\) => \{/);
  assert.match(reportLabels, /FIELD_MAPS\[resourceKey\]\?\.\[uiName\]/);
  assert.match(reportLabels, /for \(const \[name, label\] of config\?\.columns \|\| \[\]\)/);
  assert.match(reportLabels, /for \(const item of config\?\.fields \|\| \[\]\)/);
  assert.match(apiSource, /export const FIELD_MAPS = Object\.freeze\(\{/);

  // Sıra: kaynağın kendi etiketi → ortak teknik sütun → okunabilir yedek.
  assert.match(reportLabels, /return reportColumnLabels\[slug\]\?\.\[column\] \|\| sharedColumnLabels\[column\] \|\| humanizeColumnName\(column\)/);
  assert.match(reportLabels, /function humanizeColumnName\(column\)/);
  assert.match(reportLabels, /replace\(\/_\(minor\|json\)\$\/, ""\)/);
  assert.match(reportLabels, /toLocaleUpperCase\("tr-TR"\)/);
  // Ham sütun adı yine de erişilebilir olmalı ki yanlış etiket fark edilsin.
  assert.match(reportScreen, /<th key=\{column\.key\} title=\{column\.key\}>/);
});

test("süzgeç alanın tipine göre giriş açar", () => {
  assert.match(reportScreen, /const reportOperatorsByType = \{/);
  for (const op of ["eq", "ne", "gt", "gte", "lt", "lte", "between", "contains", "starts", "in", "empty", "not_empty"]) {
    assert.match(reportScreen, new RegExp(`\\b${op}:`), `${op} işleci desteklenmeli`);
  }
  // Tarihte takvim, sayıda sayı girişi.
  assert.match(reportScreen, /type === "date" \|\| type === "datetime" \? "date" : reportNumericTypes\.has\(type\) \? "number" : "text"/);

  // Para süzgecinde kullanıcı lira yazar, sunucuya kuruş gider.
  assert.match(reportScreen, /Math\.round\(Number\(part\) \* 100\)/);
});

test("seçenek listeleri sunucunun alan kataloğundan gelir, tahmin edilmez", () => {
  // Tek doğruluk kaynağı /reports/fields yanıtındaki values dizisi.
  assert.match(reportScreen, /const choicesFor = \(key\) => \(resourceColumns\.find\(\(item\) => item\.key === key\)\?\.values \|\| \[\]\)\.map\(\(value\) => \(\{ value, label: localizedEnum\(value\) \}\)\)/);
  assert.match(reportScreen, /const choices = choicesFor\(item\.field\);/);
  // Durum dışındaki sabit değerli sütunlar da listeden seçilir.
  assert.match(reportScreen, /const operatorsForColumn = \(key, type\) => reportOperatorsFor\(choicesFor\(key\)\.length \? "status" : type\)/);

  // Yerel tahmin kaynakları rapor kodunda hiç kullanılmamalı.
  for (const source of [reportScreen, reportLabels]) {
    assert.doesNotMatch(source, /STATUS_VALUES|statusOptionsFor|boardColumns/, "durum listesi yerel tahminden üretilmemeli");
  }
  assert.doesNotMatch(apiSource, /export function statusOptionsFor/);

  // Kullanıcıya Türkçe gösterilir, sunucuya ham kod gider.
  assert.match(reportScreen, /choices\.map\(\(option\) => <option key=\{option\.value\} value=\{option\.value\}>\{option\.label\}<\/option>\)/);
  assert.match(reportScreen, /localizedEnum\(value\)/);

  // `in` işlecinde çoklu seçim.
  const multi = section(reportScreen, 'if (item.op === "in") {', "<span>Değerler</span>");
  assert.match(multi, /if \(choices\.length\) \{/);
  assert.match(multi, /<input type="checkbox" checked=\{selected\.includes\(option\.value\)\}/);
  assert.match(multi, /selected\.filter\(\(code\) => code !== option\.value\) : \[\.\.\.selected, option\.value\]/);

  // values gelmeyen sütunda alan serbest metin olarak kalır.
  assert.match(reportScreen, /return <label><span>Değer\{unit\}<\/span>\{valueInput\(type, item\.value/);
  assert.match(reportScreen, /type === "status" \? "Durum kodu" : undefined/);
});

test("kaydedilmiş raporlar açılır, kopyalanır, silinir ve CSV olarak indirilir", () => {
  // Kayıt defteri snake_case döndürüyor; ikinci bir okuma yolu tutulmuyor.
  assert.match(reportScreen, /const myReports = saved\.rows\.filter\(\(row\) => row\.owner_user_id === session\?\.user\?\.id\)/);
  assert.doesNotMatch(reportScreen, /row\.ownerUserId|report\.ownerUserId|report\.updatedAt|report\.createdAt/);
  assert.doesNotMatch(reportLabels, /definitionJson/);
  assert.match(reportScreen, /title: "Benim raporlarım"/);
  assert.match(reportScreen, /title: "Paylaşılanlar"/);
  assert.match(reportScreen, /onDuplicate=\{\(report\) => openSaved\(report, \{ asCopy: true \}\)\}/);
  assert.match(reportScreen, /\(kopya\)/);
  assert.match(reportScreen, /await api\.deleteReport\(removeTarget\.id\)/);
  // CSV artık sunucudan hazır metin olarak alınmıyor; dosya, rapor motorunun
  // döndürdüğü satırlardan arayüzde üretiliyor (aşağıdaki CSV testleri).
  assert.match(reportScreen, /const csv = buildReportCsv\(columns, rows,/);
  assert.match(reportScreen, /new Blob\(\[csv\], \{ type: "text\/csv;charset=utf-8" \}\)/);
  assert.match(reportApi, /async exportReport\(savedReportId\)/);
  assert.match(reportApi, /async savedReports\(\)/);
  assert.match(reportApi, /async saveReport\(values, \{ id = null \} = \{\}\)/);
  assert.match(reportApi, /async deleteReport\(id\)/);

  // Tanım sunucudan metin de gelebilir, nesne de.
  assert.match(reportLabels, /function reportDefinitionOf\(report\)/);
  assert.match(reportLabels, /const raw = report\?\.definition_json;/);
  assert.match(reportLabels, /JSON\.parse\(raw\)/);

  // definition_json sunucuda JSON sütunu; gövdeye nesne olarak konur, ikinci
  // kez metne çevrilmez, yoksa çift kodlanır.
  assert.match(reportApi, /definition_json: values\.definition,/);
  assert.doesNotMatch(reportApi, /JSON\.stringify/);
});

test("bağlı kayıt sütunu tek sütun çizilir, ham kimlik gösterilmez", () => {
  // Sunucu customer_id'nin yanına customer_name ekliyor; ikisi ayrı sütun
  // çizilince başlık ikileniyor ve kullanıcı UUID görüyordu.
  const collapsed = helpers.collapseReportColumns([
    { key: "code", type: "text" },
    { key: "customer_id", type: "text" },
    { key: "customer_name", type: "text" },
    { key: "name", type: "text" },
  ]);
  assert.deepEqual(collapsed.map((item) => item.key), ["code", "customer_id", "name"]);
  assert.equal(helpers.reportColumnLabel("projects", "customer_id"), "Müşteri");

  // Değer addan gelir.
  const row = { code: "CP-5", customer_id: "cus_ce699fc4-961a-4697-b610-4ea2d1540cc6", customer_name: "Müşteri 1", name: "Resepsiyon" };
  assert.equal(helpers.reportPresentedValue("customer_id", row), "Müşteri 1");
  assert.equal(helpers.reportPresentedValue("code", row), "CP-5");

  // Ad çözülemediyse ham kimlik değil, boş.
  assert.equal(helpers.reportPresentedValue("customer_id", { customer_id: "cus_ce699fc4-961a-4697-b610-4ea2d1540cc6" }), null);
  assert.equal(helpers.reportPresentedValue("approved_by", { approved_by: "usr_ce699fc4961a4697b6104ea2d1540cc6" }), null);
  // Kaydın kendi kimliği ve normal metinler olduğu gibi kalır.
  assert.equal(helpers.reportPresentedValue("id", { id: "prj_ce699fc4-961a-4697-b610-4ea2d1540cc6" }), "prj_ce699fc4-961a-4697-b610-4ea2d1540cc6");
  assert.equal(helpers.reportPresentedValue("project_id", { project_id: "CP-5" }), "CP-5");
  // Kimlik sütunu seçilmediyse ad sütunu kendi başına kalır.
  assert.deepEqual(helpers.collapseReportColumns([{ key: "customer_name", type: "text" }]).map((item) => item.key), ["customer_name"]);

  assert.match(reportScreen, /const previewColumns = collapseReportColumns\(preview\.data\?\.columns \|\| \[\]\)/);
  assert.match(reportScreen, /const cell = reportPresentedValue\(column\.key, row\);/);
});

test("rapor ekranı yükleme, hata, yetkisizlik ve boş durumlarını ayrı ayrı karşılar", () => {
  assert.match(reportScreen, /saved\.loading \? <LoadingState \/>/);
  assert.match(reportScreen, /saved\.error\?\.status === 403 \|\| saved\.error\?\.code === "forbidden" \? <PermissionDeniedState \/>/);
  assert.match(reportScreen, /<ErrorState error=\{saved\.error\} retry=\{loadSaved\} \/>/);
  assert.match(reportScreen, /catalog\.error\?\.status === 403 \|\| catalog\.error\?\.code === "forbidden" \? <PermissionDeniedState \/>/);
  assert.match(reportScreen, /<ErrorState error=\{catalog\.error\} retry=\{loadCatalog\} \/>/);
  assert.match(reportScreen, /Bu tanıma uyan kayıt yok/);
  assert.match(reportScreen, /Rapor kurulabilecek kaynak yok/);
});

test("rapor ekranı 390 pikselde yatay taşma yapmaz", () => {
  // Önizleme tablosu sayfayı değil kendi kutusunu kaydırır.
  assert.match(reportScreen, /<div className="live-table-wrap"><table className="live-table">/);
  assert.match(liveStyles, /\.live-table-wrap\{overflow:auto\}/);

  // Izgara hücreleri içeriğe göre şişmemeli; select ve input'lar min-width:0
  // olmadan dar ekranda satırı taşırıyor.
  assert.match(liveStyles, /\.live-report-row\{display:grid;grid-template-columns:minmax\(0,/);
  assert.match(liveStyles, /\.live-report-block>label input[^\n]*min-width:0/);
  assert.match(liveStyles, /\.live-report-block\{[^}]*min-width:0/);

  const mobile = liveStyles.slice(liveStyles.indexOf(".live-report-groups,.live-report-builder{padding:14px"));
  assert.ok(liveStyles.slice(0, liveStyles.indexOf(".live-report-groups,.live-report-builder{padding:14px")).lastIndexOf("@media(max-width:720px)") > 0, "mobil kurallar 720 piksel bloğunda olmalı");
  assert.match(mobile, /\.live-report-row\{grid-template-columns:minmax\(0,1fr\) 34px\}/);
  assert.match(mobile, /\.live-report-groups>section>div\{grid-template-columns:1fr\}/);
  assert.match(mobile, /\.live-report-save\{grid-template-columns:1fr\}/);
});

// ——— CSV dökümü ———
// Dosya artık sunucudan hazır metin olarak gelmiyor: rapor motorunun
// döndürdüğü satırlar ekrandakiyle aynı biçimlendiricilerden geçirilip burada
// yazılıyor. Denetim metin eşleştirmesiyle yetinmiyor; CSV üreticisi kaynaktan
// derlenip gerçek satırlarla çalıştırılıyor.
const reportCsvSection = section(liveSource, "// Bir rapor hücresinin kullanıcıya görünen metni", "function ReportCard(");
const csvColumns = [
  { key: "code", type: "text" },
  { key: "customer_id", type: "text" },
  { key: "customer_name", type: "text" },
  { key: "name", type: "text" },
  { key: "status", type: "status" },
  { key: "subtotal_minor", type: "money" },
  { key: "offer_date", type: "date" },
];
// Sunucunun bozuk çıktısındaki satırın aynısı: ham UUID, ikilenen sütun, "lead".
const csvRow = {
  code: "CP-5",
  customer_id: "cus_ce699fc4-961a-4697-b610-4ea2d1540cc6",
  customer_name: "Müşteri 1",
  name: "Resepsiyon",
  status: "lead",
  subtotal_minor: 123450,
  offer_date: "2026-03-09",
  currency: "TRY",
};
const exportedCsv = helpers.buildReportCsv(
  helpers.collapseReportColumns(csvColumns),
  [csvRow],
  (column) => helpers.reportHeaderLabel("projects", null, column),
);
const exportedLines = exportedCsv.replace(/^﻿/, "").split("\r\n");

test("CSV dökümü /reports/run üzerinden alınır, /reports/export çağrılmaz", () => {
  // Sunum tek yerde kalsın diye sunucudaki ikinci CSV katmanı kullanılmıyor.
  assert.doesNotMatch(apiSource, /\/reports\/export/);
  assert.doesNotMatch(apiSource, /reportExport|reportCsv/);
  assert.doesNotMatch(liveSource, /api\.reportCsv|reports\/export/);

  // İstek sözleşmedeki iki alanı taşır: tanım kayıttan okunur, dışa aktarma
  // yetkisi ve denetim kaydı sunucuda çalışır, satır sınırı tam sınıra çıkar.
  assert.match(reportApi, /async exportReport\(savedReportId\)/);
  assert.match(reportApi, /API_CONFIG\.endpoints\.reportRun, \{ method: "POST", body: \{ savedReportId, export: true \}/);
  assert.match(reportScreen, /await api\.exportReport\(stored\.id\)/);

  // Önizleme yolu değişmedi; tanım hâlâ gövdede gidiyor.
  assert.match(reportApi, /body: \{ definition, preview \}/);
});

test("indirilen CSV ekranda görünen tablonun aynısıdır", () => {
  // Excel, BOM taşımayan UTF-8 dosyayı kendi kod sayfasıyla açar ve "Müşteri"
  // bozulur. Sunucunun bugünkü BOM davranışı korunuyor.
  assert.ok(exportedCsv.startsWith("﻿"), "dosya UTF-8 BOM ile başlamalı");

  // Başlıklar ekrandaki Türkçe etiketlerin aynısı; İngilizce sütun adı yok.
  // Birim hücreden başlığa taşındı: hücre sayı kalsın, bilgi kaybolmasın.
  assert.equal(exportedLines[0], '"Proje Kodu","Müşteri","Proje","Aşama","Ara toplam (TL)","Teklif tarihi"');
  for (const raw of ["code", "customer_id", "customer_name", "status", "subtotal_minor", "offer_date"]) {
    assert.ok(!exportedLines[0].includes(raw), `başlıkta ham sütun adı kalmış: ${raw}`);
  }

  // Bağlı kayıt tek sütun: ham kimlik dosyaya yazılmaz, _id/_name ikilenmez.
  assert.doesNotMatch(exportedCsv, /cus_[0-9a-f-]{8}/);
  assert.equal(exportedLines[0].match(/Müşteri/g).length, 1, "müşteri sütunu ikilenmemeli");
  assert.equal(exportedCsv.split(",").length, exportedLines[0].split(",").length * 2, "başlık ve satır aynı sütun sayısını taşımalı");

  // Durum Türkçe; tarih ekrandaki biçimde; tutar hesaplanabilir düz sayı.
  assert.equal(exportedLines[1], '"CP-5","Müşteri 1","Resepsiyon","Talep","1234,50","09.03.2026"');

  // Aynı kural gruplanmış raporun başlığında da geçerli.
  const grouped = { group: { aggregates: [{ fn: "sum", field: "subtotal_minor", as: "toplam_subtotal_minor" }] } };
  assert.equal(helpers.reportHeaderLabel("projects", grouped, { key: "toplam_subtotal_minor", type: "money" }), "Toplam · Ara toplam");
});

test("ekrandaki hücre metni ile dosyadaki hücre metni tek yerden gelir", () => {
  // Önizleme tablosu da CSV de reportCellText'ten geçiyor.
  assert.match(reportScreen, /: reportCellText\(column, row\)\}<\/td>/);
  assert.match(reportCsvSection, /reportCsvField\(reportCsvCell\(column, row\)\)/);
  assert.match(reportCsvSection, /return reportCsvSafeText\(reportCellText\(column, row\)\);/);

  // Durum sütununda rozetin yazdığı metnin aynısı dosyaya yazılır.
  assert.match(liveSource, /return <span className=\{`live-status \$\{statusTone\(children\)\}`\}>\{localizedEnum\(children\) \|\| "—"\}<\/span>;/);
  assert.match(reportCsvSection, /if \(column\.type === "status" && cell\) return localizedEnum\(cell\) \|\| "—";/);
  assert.equal(helpers.reportCellText({ key: "status", type: "status" }, { status: "lead" }), "Talep");

  // Bağlı kayıt adı, para ve tarih de aynı yardımcılardan geçer.
  assert.equal(helpers.reportCellText({ key: "customer_id", type: "text" }, csvRow), "Müşteri 1");
  assert.equal(helpers.reportCsvCell({ key: "customer_id", type: "text" }, csvRow), "Müşteri 1");
  assert.equal(helpers.reportCellText({ key: "offer_date", type: "date" }, csvRow), "09.03.2026");
  assert.equal(helpers.reportCsvCell({ key: "offer_date", type: "date" }, csvRow), "09.03.2026");
  // Ayrıldıkları tek yer sayının görünüşü: ekran okumak, dosya hesaplamak için.
  assert.equal(helpers.reportCellText({ key: "subtotal_minor", type: "money" }, csvRow), "1.234,50 TL");
  assert.equal(helpers.reportCsvCell({ key: "subtotal_minor", type: "money" }, csvRow), "1234,50");
  // Çözülemeyen kimlik ekranda "—", dosyada boş.
  assert.equal(helpers.reportCellText({ key: "customer_id", type: "text" }, { customer_id: "cus_ce699fc4-961a-4697-b610-4ea2d1540cc6" }), "—");
  assert.equal(helpers.reportCsvCell({ key: "customer_id", type: "text" }, { customer_id: "cus_ce699fc4-961a-4697-b610-4ea2d1540cc6" }), "");
});

test("CSV kaçışı virgül, tırnak ve satır sonu taşıyan hücreyi bozmaz", () => {
  // RFC 4180: her alan çift tırnakla sarılır, içteki tırnak ikilenir.
  assert.equal(helpers.reportCsvField('Mermer "A", 3 adet'), '"Mermer ""A"", 3 adet"');
  assert.equal(helpers.reportCsvField("iki\nsatır"), '"iki\nsatır"');
  assert.equal(helpers.reportCsvField(null), '""');

  const csv = helpers.buildReportCsv(
    [{ key: "name", type: "text" }, { key: "description", type: "text" }],
    [{ name: 'Lobi, "A" blok', description: "ilk satır\nikinci satır" }],
    (column) => helpers.reportColumnLabel("projects", column.key),
  );
  const body = csv.replace(/^﻿/, "");
  assert.equal(body.split("\r\n")[1], '"Lobi, ""A"" blok","ilk satır\nikinci satır"');
  // Virgül ve satır sonu alanın içinde kalır: dosya iki satırdır, üç değil.
  assert.equal(body.split("\r\n").filter(Boolean).length, 2);
  // Satırlar sunucunun bugünkü çıktısıyla aynı biçimde biter.
  assert.ok(body.endsWith("\r\n"), "satırlar CRLF ile bitmeli");
});

test("dosya hesaplanabilir: boş hücre boş, sayı ayraçsız ve birimsiz", () => {
  // Ekran okumak, dosya hesaplamak içindir. Uzun tire dosyada sütunu metne
  // çevirir ve süzgeçte çöp olarak görünür; boş hücre boş kalır.
  assert.equal(helpers.reportCsvCell({ key: "name", type: "text" }, { name: null }), "");
  assert.equal(helpers.reportCsvCell({ key: "name", type: "text" }, { name: "" }), "");
  assert.equal(helpers.reportCsvCell({ key: "name", type: "text" }, { name: "null" }), "");
  assert.equal(helpers.reportCsvCell({ key: "offer_date", type: "date" }, {}), "");

  // `1234,50` Türkçe Excel'de sayıdır; `1.234,50` İngilizce yerelde metne
  // düşer. Binlik ayracı ve "TL" eki dosyada yok.
  assert.equal(helpers.reportCsvCell({ key: "subtotal_minor", type: "money" }, { subtotal_minor: 123450678 }), "1234506,78");
  assert.equal(helpers.reportCsvCell({ key: "subtotal_minor", type: "money" }, { subtotal_minor: 150000 }), "1500,00");
  assert.equal(helpers.reportCsvCell({ key: "exchange_rate", type: "number" }, { exchange_rate: 41.25 }), "41,25");
  // Yüzde sütununda da yalnız sayı: ekrandaki "%12" dosyada "12".
  assert.equal(helpers.reportCellText({ key: "progress_percent", type: "percent" }, { progress_percent: 12 }), "%12");
  assert.equal(helpers.reportCsvCell({ key: "progress_percent", type: "percent" }, { progress_percent: 12 }), "12");

  // Birim hücreden başlığa taşındığı için kaybolmamalı: satırlar tek para
  // birimi taşıyorsa başlıkta yazar, karışıksa tek birim yazmak yanlış olur.
  assert.equal(helpers.reportCsvCurrency([{ currency: "TRY" }, {}]), "TL");
  assert.equal(helpers.reportCsvCurrency([{ currency: "EUR" }]), "€");
  assert.equal(helpers.reportCsvCurrency([{ currency: "TRY" }, { currency: "EUR" }]), null);
  const mixed = helpers.buildReportCsv([{ key: "subtotal_minor", type: "money" }], [{ subtotal_minor: 100, currency: "TRY" }, { subtotal_minor: 100, currency: "EUR" }], () => "Ara toplam");
  assert.equal(mixed.replace(/^\ufeff/, "").split("\r\n")[0], '"Ara toplam"');
  assert.match(reportScreen, /Rapor birden fazla para birimi taşıdığı için tutar başlıklarına birim yazılmadı/);
});

test("formül enjeksiyonu kapalı, sayısal sütunlar tırnak almıyor", () => {
  // Excel `=`, `+`, `-`, `@` ile başlayan hücreyi formül olarak çalıştırır;
  // müşteri adını, proje adını ve notları kullanıcı yazıyor, dosyayı açan
  // başkası oluyor.
  for (const value of ["=1+1", "+1", "-1", "@SUM(A1)", "\t=1", " =1+1", "\n=1+1", "\r\n-2+3"]) {
    assert.equal(helpers.reportCsvSafeText(value), `'${value}`, `etkisizleşmedi: ${JSON.stringify(value)}`);
  }
  // Tek tırnak en öne, görünmez karakterlerin de önüne konur.
  assert.ok(helpers.reportCsvSafeText("\t=1").startsWith("'"), "tırnak hücrenin en önünde olmalı");
  // Zararsız metin dokunulmadan kalır.
  for (const value of ["Müşteri 1", "Resepsiyon, \"A\" blok", "2026-03-09", ""]) {
    assert.equal(helpers.reportCsvSafeText(value), value);
  }

  // Kural sütunun tipine bağlı: sayı formül olamaz. Eksi işaretli tutara tırnak
  // koymak bütün tutar sütununu metne çevirir ve toplam alınamaz — düzeltmeye
  // çalıştığımız sorunun ta kendisi.
  assert.equal(helpers.reportCsvCell({ key: "subtotal_minor", type: "money" }, { subtotal_minor: -150000 }), "-1500,00");
  assert.equal(helpers.reportCsvCell({ key: "progress_percent", type: "percent" }, { progress_percent: -12 }), "-12");
  // Kullanıcının yazdığı metinde aynı değer tırnaklanır.
  assert.equal(helpers.reportCsvCell({ key: "name", type: "text" }, { name: "-1500" }), "'-1500");
  assert.equal(helpers.reportCsvCell({ key: "description", type: "text" }, { description: "=HYPERLINK(\"http://x\")" }), "'=HYPERLINK(\"http://x\")");

  // Dosyanın tamamında da doğrulanır: tutar tırnaksız, ad tırnaklı.
  const csv = helpers.buildReportCsv(
    [{ key: "name", type: "text" }, { key: "subtotal_minor", type: "money" }],
    [{ name: "-1500", subtotal_minor: -150000, currency: "TRY" }],
    (column) => helpers.reportColumnLabel("offers", column.key),
  );
  assert.equal(csv.replace(/^\ufeff/, "").split("\r\n")[1], '"\'-1500","-1500,00"');
});

test("indirme kaydedilmiş rapora bağlıdır, beklemede görünür, hatası Türkçedir", () => {
  // Kaydedilmemiş taslakta ve kaydedilmemiş değişiklikte düğme kapalı; ikisinde
  // de ne yapılacağı yazıyor. Dosya kayıtlı tanımdan üretildiği için,
  // kaydedilmemiş bir değişiklikle indirilen dosya ekrandakinden sessizce
  // farklı olurdu.
  assert.match(reportScreen, /disabled=\{!reportMeta\.id \|\| dirty \|\| Boolean\(exportingId\)\}/);
  assert.match(reportScreen, /Kaydedip indirin/);
  assert.match(reportScreen, /Kaydedilmemiş taslak indirilemez/);
  assert.match(reportScreen, /Önce kaydedin: dosya kayıtlı tanımdan üretilir/);
  assert.match(reportScreen, /\{canExport && \(!reportMeta\.id \|\| dirty\) && <p className="live-report-hint">/);

  // Bayrak kullanıcının eylemine bağlı; tanım JSON'u karşılaştırılmıyor
  // (anahtar sırası yanlış alarm verirdi). Taslağı değiştiren her yol tek
  // kapıdan geçer, kaydetme ve kayıttan açma bayrağı indirir.
  assert.match(reportScreen, /const editDraft = \(updater\) => \{ setDirty\(true\); setDraft\(updater\); \};/);
  assert.match(reportScreen, /const patchDraft = \(patch\) => editDraft\(/);
  const builder = section(reportScreen, "function chooseResource(value)", "function startNew()");
  assert.doesNotMatch(builder, /setDraft\(/, "taslağı değiştiren her yol editDraft üzerinden geçmeli");

  // Bayrak yeni rapor, kayıttan açma ve kaydetme sonrasında iner.
  assert.match(section(reportScreen, "function startNew()", "function draftFromDefinition"), /setDirty\(false\);/);
  assert.match(section(reportScreen, "setDraft(draftFromDefinition(definition));", "setSaveError(null);"), /setDirty\(false\);/);
  assert.match(section(reportScreen, "const stored = await api.saveReport(", "loadSaved();"), /setDirty\(false\);[\s\S]*Rapor kaydedildi/);
  assert.match(reportScreen, /if \(!stored\?\.id\) \{ setExportNotice\(\{ tone: "warning", message: "Bu raporu indirmeden önce kaydedin/);

  // Beklemede durumu: hangi raporun hazırlandığı kimlikle tutulur, düğme
  // yazısı değişir ve iş bitince bayrak her koşulda temizlenir.
  assert.match(reportScreen, /const \[exportingId, setExportingId\] = useState\(null\)/);
  assert.match(reportScreen, /busy=\{exportingId === row\.id\} exporting=\{Boolean\(exportingId\)\}/);
  assert.match(reportScreen, /\{busy \? <><span className="live-spinner small" \/> Hazırlanıyor…<\/> : <><DownloadSimple \/> CSV<\/>\}/);
  assert.match(reportScreen, /finally \{\n\s*setExportingId\(null\);/);

  // Hata ham kod olarak değil, ne yapılacağını söyleyen bir cümleyle çıkar.
  assert.match(reportScreen, /setExportNotice\(\{ tone: "warning", message: reportExportErrorMessage\(error\) \}\)/);
  const message = section(reportScreen, "function reportExportErrorMessage(error)", "// Bir rapor hücresinin");
  assert.match(message, /403[\s\S]*?dışa aktarma yetkiniz yok/);
  assert.match(message, /404[\s\S]*?Rapor bulunamadı/);
  assert.match(message, /return reportErrorMessage\(error\);/);
  assert.doesNotMatch(reportScreen, /\{error\.code\}|\{error\.status\}/);
});

test("kırpılmış döküm kullanıcıya söylenir, önizlemede uyarı çıkmaz", () => {
  const download = section(reportScreen, "async function downloadCsv(report)", "// Alan kataloğu gelmeden");
  // Eksik dosyayı sessizce vermek, hata vermekten kötüdür.
  assert.match(download, /result\.meta\?\.truncated/);
  assert.match(download, /tone: "warning", message: `Dosya eksik/);
  assert.match(download, /satır indirildi/);
  assert.match(download, /satır sınırını yükseltin/);
  assert.match(download, /tone: mixedCurrency \? "warning" : "success", message: `Rapor indirildi/);

  // Mesaj kullanıcının baktığı yerde: hem kayıtlı rapor listesinde hem
  // önizleme panelinde aynı kutu gösterilir.
  assert.equal((reportScreen.match(/\{exportNoticeBox\}/g) || []).length, 2);
  assert.match(reportScreen, /exportNotice\.tone === "warning" \? <WarningCircle \/> : <Check \/>/);

  // Önizlemede kırpılma beklenen durumdur; orada ayrı bir uyarı kutusu yok.
  const previewFooter = section(reportScreen, '<footer className="live-table-footer"><span>{preview.meta', "</footer>");
  assert.match(previewFooter, /kırpıldı/);
  assert.doesNotMatch(previewFooter, /Dosya eksik/);
});

// Etiket denetimi kaynak metni üzerinde değil, sunucunun gerçekten döndürdüğü
// sütun listesi üzerinde yapılır: alan kataloğu büyüdüğünde etiketi olmayan
// yeni sütun sessizce İngilizce yedeğe düşmesin.
test("her rapor sütunu Türkçe etikete çözülür, İngilizce yedek kalmaz", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "capproje-report-labels-"));
  const assetsDirectory = path.join(directory, "client");
  await mkdir(assetsDirectory, { recursive: true });
  await writeFile(path.join(assetsDirectory, "index.html"), "<!doctype html><title>Capproje</title>");
  const environment = {
    HOST: "127.0.0.1",
    PORT: "0",
    CAPPROJE_DATA_DIR: path.join(directory, "data"),
    STATIC_ASSETS_DIR: assetsDirectory,
    BOOTSTRAP_SECRET: "bootstrap-secret-for-report-label-scan",
    PASSWORD_AUTH_ENABLED: "true",
    PASSWORD_AUTH_PEPPER: "password-pepper-for-report-label-scan",
    PHONE_AUTH_ENABLED: "false",
    ALLOW_DEV_AUTH: "false",
  };
  const runtime = await createRuntime(environment);
  const server = await startSelfHostedServer(runtime, environment);
  t.after(() => new Promise((resolve) => server.close(async () => { await server.waitForBackgroundTasks(); resolve(); })));
  t.after(() => runtime.sqlite.close());
  t.after(() => rm(directory, { recursive: true, force: true }));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const bootstrap = await fetch(`${baseUrl}/api/v1/bootstrap`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-bootstrap-secret": environment.BOOTSTRAP_SECRET },
    body: JSON.stringify({ tenant_name: "Capproje", tenant_slug: "capproje", owner_email: "owner@example.test", owner_name: "Firma Sahibi", owner_phone: "0533 656 52 55", owner_password: "Test-password-123" }),
  });
  assert.equal(bootstrap.status, 201);
  const login = await fetch(`${baseUrl}/api/v1/auth/password/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone: "0533 656 52 55", password: "Test-password-123" }),
  });
  assert.equal(login.status, 200);
  const cookie = (login.headers.get("set-cookie") || "").split(";")[0];

  const response = await fetch(`${baseUrl}/api/v1/reports/fields`, { headers: { cookie } });
  assert.equal(response.status, 200, "alan kataloğu okunabilmeli");
  const resources = (await response.json()).data;
  assert.ok(Array.isArray(resources) && resources.length >= 20, `beklenenden az kaynak döndü: ${resources?.length}`);
  const columnCount = resources.reduce((total, resource) => total + resource.columns.length, 0);
  assert.ok(columnCount >= 400, `beklenenden az sütun döndü: ${columnCount}`);

  // Sözlükte karşılığı olmayan sütun, ham addan üretilen İngilizce yedeğe düşer.
  const missing = [];
  for (const resource of resources) {
    for (const column of resource.columns) {
      const covered = helpers.reportColumnLabels[resource.resource]?.[column.key] || helpers.sharedColumnLabels[column.key];
      if (!covered) missing.push(`${resource.resource}.${column.key} → "${helpers.reportColumnLabel(resource.resource, column.key)}"`);
    }
  }
  assert.deepEqual(missing, [], `Türkçe etiketi olmayan sütunlar:\n${missing.join("\n")}`);
});

// ——— 2. aşama: hazır raporlar ve göreli tarih ———
// Kurucunun saf yardımcıları (süzgeç hazırlığı, tanım üretimi, göreli tarih,
// kategori gruplaması) da kaynaktan kesilip çalıştırılır: sözleşmedeki
// belirteç biçimi metin eşleştirmesiyle değil, üretilen tanımın kendisiyle
// denetlenir.
function loadBuilderHelpers() {
  const parts = [
    ...reportHelperSources(),
    section(liveSource, "const REPORT_PREVIEW_DELAY_MS", "// Sunucu hataları kullanıcıya"),
    "return { reportExportBusy, reportRelativeRanges, reportRelativeRangeLabels, reportRelativePointOps, reportRelativeToken, reportRelativeDefault, reportRelativeValue, reportRelativeOffset, reportRelativeLabel, reportDraftFilter, reportFilterSummary, reportRequestDefinition, reportFilterReady, reportDefinitionProblem, reportOperatorsByType, reportOperatorLabel, groupBuiltinReports, REPORT_BUILTIN_CATEGORIES, REPORT_RELATIVE_NOTE, emptyReportView, REPORT_VIEW_LAST_COLUMN_NOTE, reportViewOf, reportViewDraft, reportViewAlias, reportViewRequest, reportViewKey, reportViewColumns, reportViewDefinition, reportViewToggleColumn, reportViewAddColumn, reportViewAddAggregate };",
  ];
  return new Function(parts.join("\n"))();
}
const builder = loadBuilderHelpers();

// Sözleşmenin (2. aşama, A bölümü) listesi; sıra da aynı.
const contractRangeNames = ["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "this_quarter", "last_quarter", "this_year", "last_year", "last_7_days", "last_30_days", "last_90_days", "next_7_days", "next_30_days"];
const contractCategories = ["Satış", "Proje", "Finans", "Satın Alma", "Üretim", "Montaj", "İnsan Kaynakları"];
const builtinApi = section(apiSource, "async reportBuiltins()", "async savedReports()");
const builtinCard = section(liveSource, "function BuiltinReportCard(", "function ReportsView(");
const builtinActions = section(reportScreen, "const builtinActions = builtinOpen ? <>", "</> : null;");
const builtinPanel = section(reportScreen, "{!builtinHidden && <section className=\"live-panel\">", "</section>}");

test("hazır raporlar /reports/builtin'den yüklenir ve sabit kategori sırasıyla gruplanır", () => {
  assert.match(apiSource, /reportBuiltins: "\/reports\/builtin"/);
  assert.match(builtinApi, /async reportBuiltins\(\) \{\n\s*const result = await request\(API_CONFIG\.endpoints\.reportBuiltins\);/);
  assert.doesNotMatch(builtinApi, /mapOutgoing|mapIncoming/, "hazır rapor tanımı snake_case kalmalı");
  assert.match(reportScreen, /api\.reportBuiltins\(\)\.then\(\(\{ data \}\) => setBuiltins\(\{ loading: false, rows: data, error: null \}\)\)/);
  assert.match(reportScreen, /useEffect\(\(\) => \{ loadBuiltins\(\); loadCatalog\(\); loadSaved\(\);/);

  // Kategori sırası sözleşmedeki yedi addır, sunucunun sırasına bağlı değildir.
  assert.deepEqual([...builder.REPORT_BUILTIN_CATEGORIES], contractCategories);
  const rows = [
    { id: "hr-1", category: "İnsan Kaynakları", name: "İzin" },
    { id: "fin-1", category: "Finans", name: "Tahsilat" },
    { id: "sales-1", category: "Satış", name: "Teklif dönüşümü" },
    { id: "odd-1", category: "Kalite", name: "Bilinmeyen kategori" },
    { id: "sales-2", category: "Satış", name: "Kaybedilen teklifler" },
    { id: "prod-1", category: "Üretim", name: "Fire" },
  ];
  const groups = builder.groupBuiltinReports(rows);
  assert.deepEqual(groups.map((group) => group.category), ["Satış", "Finans", "Üretim", "İnsan Kaynakları", "Kalite"]);
  // Kategori içinde sunucunun sırası korunur; bilinmeyen kategori atılmaz.
  assert.deepEqual(groups[0].rows.map((row) => row.id), ["sales-1", "sales-2"]);
  assert.equal(groups.flatMap((group) => group.rows).length, rows.length);
  // Boş kategori başlığı çizilmez.
  assert.deepEqual(builder.groupBuiltinReports([]), []);

  // Ekranın en üstünde, kaydedilmiş raporlardan önce.
  assert.ok(reportScreen.indexOf("<h2>Hazır raporlar</h2>") > 0);
  assert.ok(reportScreen.indexOf("<h2>Hazır raporlar</h2>") < reportScreen.indexOf("<h2>Kaydedilmiş raporlar</h2>"), "hazır raporlar kaydedilmiş raporlardan önce gelmeli");
  // Kart ad ve açıklama taşır; kategoriler aynı ızgarayı kullanır.
  assert.match(builtinPanel, /builtinGroups\.map\(\(group\) => <section key=\{group\.category\}><h3>\{group\.category\}<\/h3>/);
  assert.match(builtinCard, /<b>\{report\.name\}<\/b>/);
  assert.match(builtinCard, /\{report\.description && <p>\{report\.description\}<\/p>\}/);

  // Yetkisi hiçbirine yetmiyorsa bölüm hiç çıkmaz; yükleme ve hata ayrı karşılanır.
  assert.match(reportScreen, /const builtinHidden = !builtins\.loading && \(!builtinGroups\.length \|\| builtins\.error\?\.status === 403/);
  assert.match(builtinPanel, /builtins\.loading \? <LoadingState \/> : builtins\.error \? <ErrorState error=\{builtins\.error\} retry=\{loadBuiltins\} \/>/);
});

test("hazır rapor builtinReportId ile önizlenir ve aynı CSV üreticisiyle indirilir", () => {
  // Sözleşme: definition, savedReportId, builtinReportId alanlarından tam olarak biri.
  const run = section(reportApi, "async runBuiltinReport(", "async savedReports()");
  // 3. aşamada imzaya isteğe bağlı `view` eklendi; kaynak alanı hâlâ tek.
  assert.match(run, /async runBuiltinReport\(builtinReportId, \{ preview = false, view \} = \{\}\)/);
  assert.match(run, /body: \{ builtinReportId, preview \}/);
  const exported = section(apiSource, "async exportBuiltinReport(", "async workflow(");
  assert.match(exported, /body: \{ builtinReportId, export: true \}, timeoutMs: 60000/);
  for (const source of [run, exported]) assert.doesNotMatch(source, /definition[,}\s]|savedReportId/, "hazır rapor isteği başka bir kaynak taşımamalı");

  // Kart önizlemeyi açar; önizleme kimlikle çalışır, başlık açık raporu yazar.
  assert.match(builtinCard, /onClick=\{\(\) => onOpen\(report\)\}/);
  assert.match(reportScreen, /onOpen=\{openBuiltin\}/);
  const effect = section(reportScreen, "const ticket = previewTicket.current + 1", "}, [definitionKey, online]);");
  assert.match(effect, /builtinOpen \? api\.runBuiltinReport\(builtinOpen\.id, \{ preview: true, view: builtinView \}\) : api\.runReport\(requestDefinition, \{ preview: true \}\)/);
  assert.match(reportScreen, /const definitionKey = `\$\{builtinOpen\?\.id \|\| ""\}\|/, "hazır rapor açılıp kapanınca önizleme yeniden çalışmalı");
  assert.match(reportScreen, /<small>HAZIR RAPOR[^\n]*<h2>\{builtinOpen\.name\}<\/h2>/);
  // Kurucudaki taslak değişince önizleme taslağa döner.
  assert.match(reportScreen, /const builtinOpen = activeBuiltin && activeBuiltin\.draftKey === draftKey \? activeBuiltin\.report : null;/);
  // Kaydedilen tanım her zaman taslaktır, önizlenen hazır rapor değil.
  assert.match(section(reportScreen, "async function saveReport()", "async function removeReport()"), /definition: draftDefinition,/);

  // İndirme: aynı fonksiyon, aynı üretici, aynı kırpılma uyarısı.
  assert.match(builtinActions, /downloadCsv\(\{ builtinReportId: builtinOpen\.id \}\)/);
  const download = section(reportScreen, "async function downloadCsv(report)", "// Alan kataloğu gelmeden");
  assert.match(download, /builtin \? await api\.exportBuiltinReport\(builtin\.id, \{ view: exportView \}\) : await api\.exportReport\(stored\.id\)/);
  assert.match(download, /const definition = builtin \? builtin\.definition : reportDefinitionOf\(stored\);/);
  assert.match(download, /const csv = buildReportCsv\(columns, rows,/);
  assert.match(download, /result\.meta\?\.truncated/);
  assert.match(download, /setExportingId\(builtin \? `builtin:\$\{builtin\.id\}` : stored\.id\)/);
  // İndirme yetkisi kayıtlı rapordakiyle aynı bayraktan okunur.
  assert.match(builtinActions, /\{canExport && <button/);
});

test("Kopyala ve düzenle tanımı kurucuya kaydedilmemiş yeni rapor olarak yükler", () => {
  const copy = section(reportScreen, "function copyBuiltin(report) {", "\n  }\n") + "\n  }";
  // Fonksiyon bileşenin içinde yaşıyor; durum ayarlayıcıları taklit edilerek
  // gerçekten çalıştırılır.
  const calls = {};
  const set = (name) => (value) => { calls[name] = value; };
  const run = new Function("setNotice", "setDraft", "draftFromDefinition", "setDirty", "setReportMeta", "emptyReportMeta", "setActiveBuiltin", "setSaveError", "builderRef", `${copy}\nreturn copyBuiltin;`);
  const emptyReportMeta = { id: null, name: "", description: "", visibility: "private", ownerUserId: null };
  const copyBuiltin = run(set("notice"), set("draft"), (definition) => ({ fromDefinition: definition }), set("dirty"), set("meta"), emptyReportMeta, set("active"), set("saveError"), { current: null });
  const definition = { resource: "offers", columns: [], filters: [{ field: "offer_date", op: "between", value: { relative: "this_year" } }], group: { by: ["status"], aggregates: [{ fn: "count", as: "adet" }] } };
  copyBuiltin({ id: "offer-conversion", category: "Satış", name: "Teklif dönüşümü", description: "Bu yıl verilen teklifler.", definition });

  assert.deepEqual(calls.draft, { fromDefinition: definition }, "tanım kurucuya yüklenmeli");
  assert.equal(calls.dirty, true, "kopya kaydedilmemiş sayılmalı");
  assert.equal(calls.meta.id, null, "kopya yeni rapordur, hazır raporun kimliğini taşımaz");
  assert.equal(calls.meta.ownerUserId, null);
  assert.equal(calls.meta.visibility, "private");
  assert.equal(calls.meta.name, "Teklif dönüşümü (kopya)");
  assert.equal(calls.meta.description, "Bu yıl verilen teklifler.");
  assert.equal(calls.active, null, "önizleme kurucudaki kopyaya dönmeli");
  assert.match(calls.notice, /kendi raporunuz olarak kaydedebilirsiniz/);

  // Önizleme başlığındaki düğme bu fonksiyonu çağırır; kayıt yolu kimliksiz
  // kaydı POST ile yeni rapor olarak oluşturur.
  assert.match(builtinActions, /onClick=\{\(\) => copyBuiltin\(builtinOpen\)\}><PencilSimple \/> Kopyala ve düzenle<\/button>/);
  assert.match(reportApi, /const result = id\n\s*\? await request\(`\$\{path\}\/\$\{encodeURIComponent\(id\)\}`, \{ method: "PATCH", body \}\)\n\s*: await request\(path, \{ method: "POST"/);
});

test("hazır raporda düzenleme ve silme düğmesi yoktur", () => {
  for (const [name, source] of [["kart", builtinCard], ["önizleme eylemleri", builtinActions], ["hazır rapor bölümü", builtinPanel]]) {
    assert.doesNotMatch(source, /<Trash|onRemove|setRemoveTarget|deleteReport|saveReport|openSaved/, `${name} silme ya da düzenleme yolu açmamalı`);
    assert.doesNotMatch(source, />\s*(Sil|Düzenle|Aç|Kaydet)\s*</, `${name} düzenleme/silme düğmesi taşımamalı`);
  }
  // Tek düzenleme yolu kopyadır.
  assert.equal((builtinActions.match(/<button/g) || []).length, 3, "yalnız CSV indir, Kopyala ve düzenle, Kapat");
  assert.match(builtinActions, /CSV indir/);
  assert.match(builtinActions, /aria-label="Hazır raporu kapat"/);
  // Kart tek düğmedir, içinde başka eylem yok.
  assert.equal((builtinCard.match(/<button/g) || []).length, 1);
  // Hazır rapor açıkken kayıtlı rapora ait indirme düğmesi ve "kaydedin" notu gizlenir.
  assert.match(reportScreen, /\{!builtinOpen && canExport && <button/);
  assert.match(reportScreen, /\{!builtinOpen && <>\{canExport && \(!reportMeta\.id \|\| dirty\) && <p className="live-report-hint">/);
});

test("göreli tarih seçimi sözleşmedeki belirteç biçimini üretir", () => {
  const draft = {
    resource: "offers",
    columns: ["code"],
    filters: [
      { field: "offer_date", op: "between", type: "date", value: { relative: "this_year" } },
      { field: "valid_until", op: "lt", type: "date", value: { relative: "today", offsetDays: -30 }, offsetDirection: "before" },
      { field: "valid_until", op: "gte", type: "date", value: { relative: "today", offsetDays: 7 }, offsetDirection: "after" },
      { field: "created_at", op: "eq", type: "datetime", value: { relative: "today", offsetDays: 0 } },
      // Sabit tarih ve para süzgeci eskisi gibi kalır.
      { field: "offer_date", op: "between", type: "date", value: ["2026-01-01", "2026-03-31"] },
      { field: "subtotal_minor", op: "gte", type: "money", value: "1500" },
    ],
    sort: [],
    group: null,
    limit: 500,
  };
  const definition = builder.reportRequestDefinition(draft);
  // JSON üzerinden karşılaştırılır: kurucuya ait yardımcı alanlar (yön,
  // tip) sunucuya sızmamalı, anahtarlar tam olarak sözleşmedekiler olmalı.
  assert.deepEqual(JSON.parse(JSON.stringify(definition.filters)), [
    { field: "offer_date", op: "between", value: { relative: "this_year" } },
    { field: "valid_until", op: "lt", value: { relative: "today", offsetDays: -30 } },
    { field: "valid_until", op: "gte", value: { relative: "today", offsetDays: 7 } },
    { field: "created_at", op: "eq", value: { relative: "today", offsetDays: 0 } },
    { field: "offer_date", op: "between", value: ["2026-01-01", "2026-03-31"] },
    { field: "subtotal_minor", op: "gte", value: 150000 },
  ]);

  // Varsayılanlar: aralıkta "Bu ay", noktada "Bugün".
  assert.deepEqual(builder.reportRelativeDefault("between"), { relative: "this_month" });
  for (const op of ["eq", "ne", "gt", "gte", "lt", "lte"]) assert.deepEqual(builder.reportRelativeDefault(op), { relative: "today", offsetDays: 0 });
  assert.deepEqual([...builder.reportRelativePointOps].sort(), ["eq", "gt", "gte", "lt", "lte", "ne"]);
  // Gün farkı tam sayı ve -3650..3650 aralığında.
  assert.equal(builder.reportRelativeOffset(7.9), 7);
  assert.equal(builder.reportRelativeOffset(99999), 3650);
  assert.equal(builder.reportRelativeOffset(-99999), -3650);
  assert.equal(builder.reportRelativeOffset("abc"), 0);
  // Belirteç satırı yarım sayılmaz; sabit tarihte boş uç hâlâ yarımdır.
  assert.equal(builder.reportFilterReady({ field: "offer_date", op: "between", value: { relative: "last_month" } }), true);
  assert.equal(builder.reportFilterReady({ field: "offer_date", op: "between", value: ["2026-01-01", ""] }), false);

  // Tarih sütununda nokta işleçlerinin hepsi seçilebilir: hazır raporlar
  // "şundan önce" gibi işleçler kullanıyor.
  for (const type of ["date", "datetime"]) {
    for (const op of ["between", "eq", "ne", "gt", "gte", "lt", "lte"]) assert.ok(builder.reportOperatorsByType[type].includes(op), `${type} ${op} işlecini sunmalı`);
  }
  assert.equal(builder.reportOperatorLabel("lt", "date"), "şundan önce");
  assert.equal(builder.reportOperatorLabel("lt", "money"), "küçüktür");

  // Arayüz: "önce" seçilince gün farkı eksi işaretle gider.
  assert.match(reportScreen, /offsetDays: direction === "before" \? -magnitude : magnitude/);
  // Kip değiştirme ve işleç değiştirme belirteç türünü işlece göre seçer.
  assert.match(reportScreen, /value: relative \? reportRelativeDefault\(item\.op\)/);
  assert.match(reportScreen, /value: relative \? reportRelativeDefault\(op\)/);
});

test("15 göreli aralığın hepsi Türkçe, adlar sözleşmeyle birebir", () => {
  assert.deepEqual(builder.reportRelativeRanges.map(([name]) => name), contractRangeNames);
  assert.deepEqual(builder.reportRelativeRangeLabels, {
    today: "Bugün", yesterday: "Dün", this_week: "Bu hafta", last_week: "Geçen hafta",
    this_month: "Bu ay", last_month: "Geçen ay", this_quarter: "Bu çeyrek", last_quarter: "Geçen çeyrek",
    this_year: "Bu yıl", last_year: "Geçen yıl", last_7_days: "Son 7 gün", last_30_days: "Son 30 gün",
    last_90_days: "Son 90 gün", next_7_days: "Önümüzdeki 7 gün", next_30_days: "Önümüzdeki 30 gün",
  });
  for (const name of contractRangeNames) assert.equal(builder.reportRelativeLabel({ relative: name }), builder.reportRelativeRangeLabels[name]);
  assert.equal(new Set(Object.values(builder.reportRelativeRangeLabels)).size, 15, "iki aralık aynı adı taşımamalı");

  // Nokta belirteci okunur cümleye çevrilir.
  assert.equal(builder.reportRelativeLabel({ relative: "today", offsetDays: 0 }), "Bugün");
  assert.equal(builder.reportRelativeLabel({ relative: "today", offsetDays: 7 }), "Bugünden 7 gün sonra");
  assert.equal(builder.reportRelativeLabel({ relative: "today", offsetDays: -30 }), "Bugünden 30 gün önce");

  // Süzgeç özeti belirteci Türkçe yazar; ham ad ya da `[object Object]` görünmez.
  assert.equal(builder.reportFilterSummary("offers", { field: "offer_date", op: "between", value: { relative: "this_year" } }, "date"), "Teklif tarihi: Bu yıl");
  assert.equal(builder.reportFilterSummary("offers", { field: "offer_date", op: "lt", value: { relative: "today", offsetDays: -30 } }, "date"), "Teklif tarihi şundan önce: Bugünden 30 gün önce");
  assert.equal(builder.reportFilterSummary("offers", { field: "offer_date", op: "between", value: ["2026-01-01", "2026-03-31"] }, "date"), "Teklif tarihi: 01.01.2026 – 31.03.2026");
  for (const name of contractRangeNames) {
    const text = builder.reportFilterSummary("offers", { field: "offer_date", op: "between", value: { relative: name } }, "date");
    assert.doesNotMatch(text, /object|relative|_/, `özet ham kalmış: ${text}`);
  }
  // Önizlemede özet ve "her çalıştırıldığında yeniden hesaplanır" notu gösterilir.
  assert.equal(builder.REPORT_RELATIVE_NOTE, "Göreli tarih raporu her çalıştırıldığında yeniden hesaplanır.");
  assert.match(reportScreen, /reportFilterSummary\(previewResource, item, typeIn\(previewResource, item\.field\)\)/);
  assert.match(reportScreen, /\{previewHasRelative && <small>\{REPORT_RELATIVE_NOTE\}<\/small>\}/);
  assert.match(reportScreen, /\{token && <small className="live-report-hint">[^\n]*\{REPORT_RELATIVE_NOTE\}/);
});

test("belirteçli tanım yüklenince kurucu göreli kipte açılır", () => {
  // Kayıttan ya da hazır rapordan gelen süzgeç satırı taslağa çevrilir.
  const range = builder.reportDraftFilter({ field: "offer_date", op: "between", value: { relative: "this_year" } }, "date");
  assert.deepEqual(range.value, { relative: "this_year" });
  assert.ok(builder.reportRelativeToken(range.value), "taslak göreli kipte olmalı");
  const before = builder.reportDraftFilter({ field: "valid_until", op: "lt", value: { relative: "today", offsetDays: -30 } }, "date");
  assert.equal(before.offsetDirection, "before");
  assert.deepEqual(before.value, { relative: "today", offsetDays: -30 });
  assert.equal(builder.reportDraftFilter({ field: "valid_until", op: "lte", value: { relative: "today", offsetDays: 7 } }, "date").offsetDirection, "after");
  // Katalog tipi yanlış bildirse de belirteç kuruşa bölünüp NaN olmaz.
  assert.deepEqual(builder.reportDraftFilter({ field: "subtotal_minor", op: "between", value: { relative: "this_month" } }, "money").value, { relative: "this_month" });
  // Sabit değerler eskisi gibi: tarih olduğu gibi, tutar liraya.
  assert.deepEqual(builder.reportDraftFilter({ field: "offer_date", op: "between", value: ["2026-01-01", "2026-03-31"] }, "date").value, ["2026-01-01", "2026-03-31"]);
  assert.equal(builder.reportDraftFilter({ field: "subtotal_minor", op: "gte", value: 150000 }, "money").value, 1500);
  // Gidiş dönüş: yüklenen tanım değişmeden geri kaydedilir.
  const loaded = [
    { field: "offer_date", op: "between", value: { relative: "last_quarter" } },
    { field: "valid_until", op: "lt", value: { relative: "today", offsetDays: -30 } },
  ];
  const draft = { resource: "offers", columns: ["code"], filters: loaded.map((item) => builder.reportDraftFilter(item, "date")), sort: [], group: null, limit: 500 };
  assert.deepEqual(JSON.parse(JSON.stringify(builder.reportRequestDefinition(draft).filters)), loaded);

  // Kurucu bu yardımcıdan geçer; kip değerin kendisinden okunur.
  assert.match(reportScreen, /filters: \(Array\.isArray\(definition\.filters\) \? definition\.filters : \[\]\)\.map\(\(item\) => reportDraftFilter\(item, typeIn\(definition\.resource, item\.field\)\)\)/);
  assert.match(reportScreen, /if \(reportDateTypes\.has\(type\) \|\| reportRelativeToken\(item\.value\)\) return dateFilterFields\(/);
  const dateFields = section(reportScreen, "function dateFilterFields(item, index, type) {", "return <div className=\"live-report-date\">");
  // Sabit tarih kutuları yalnız belirteç yokken çizilir.
  assert.ok(dateFields.indexOf("if (!token) {") >= 0 && dateFields.indexOf("if (!token) {") < dateFields.indexOf("valueInput("), "sabit tarih kutusu belirteç dalında olmamalı");
  assert.match(dateFields, /<select value=\{token\.relative\}/);
  // Son savunma: nesne hiçbir metin kutusuna yazılmaz.
  assert.match(reportScreen, /const shown = value != null && typeof value === "object" \? "" : value \?\? "";/);
  assert.match(reportScreen, /aria-checked=\{Boolean\(token\)\}[^\n]*>Göreli<\/button>/);
  assert.match(reportScreen, />Sabit tarih<\/button>/);
});

test("hazır raporlar ve tarih süzgeci 390 pikselde taşmaz", () => {
  // Kategoriler kayıtlı raporlarla aynı ızgarayı kullanır; mobilde tek sütun.
  assert.match(builtinPanel, /<div className="live-report-groups">/);
  const mobileStart = liveStyles.indexOf(".live-report-groups,.live-report-builder{padding:14px");
  const mobile = liveStyles.slice(mobileStart, liveStyles.indexOf("}\n    @media", mobileStart));
  assert.match(mobile, /\.live-report-groups>section>div\{grid-template-columns:1fr\}/);
  // Tarih süzgeci dar ekranda alt alta iner, kaldırma düğmesi sağda kalır.
  assert.match(mobile, /\.live-report-row>\.live-report-date\{grid-column:1\}|,\.live-report-row>\.live-report-date\{grid-column:1\}/);
  assert.match(mobile, /\.live-report-date-pair\{grid-template-columns:1fr\}/);
  // Izgara hücreleri içeriğe göre şişmez; uzun ad ve özet satırı kırılır.
  assert.match(liveStyles, /\.live-report-date\{[^}]*min-width:0/);
  assert.match(liveStyles, /\.live-report-date-pair\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(liveStyles, /\.live-report-segment\{[^}]*max-width:100%/);
  assert.match(liveStyles, /\.live-report-summary>em\{[^}]*overflow-wrap:anywhere/);
  assert.match(liveStyles, /\.live-report-builtin\{[^}]*width:100%/);
  assert.match(liveStyles, /\.live-report-card b\{[^}]*overflow-wrap:anywhere/);
});

// Sunucu gruplu raporda da tutar toplamını kuruş olarak ve `money` tipiyle
// gönderiyor; yalnız sütunun adı takma addır ("toplam"). Adla karar veren
// bölme bu sütunu atlıyor ve tutarlar 100 kat büyük görünüyordu.
test("gruplu raporda tutar toplamı kuruştan liraya çevrilir, karar tipe bağlıdır", () => {
  const groupedRow = { status: "accepted", adet: 3, toplam: 960000000, ortalama_grand_total_minor: "320000000", currency: "TRY" };
  const toplam = { key: "toplam", type: "money" };
  // Ekranda da dosyada da lira.
  assert.equal(helpers.reportCellText(toplam, groupedRow), "9.600.000 TL");
  assert.equal(helpers.reportCsvCell(toplam, groupedRow), "9600000,00");
  // Toplam metin olarak dönse de bölünür.
  assert.equal(helpers.reportCsvCell({ key: "ortalama_grand_total_minor", type: "money" }, groupedRow), "3200000,00");
  // Sayım sayıdır, bölünmez.
  assert.equal(helpers.reportCellText({ key: "adet", type: "number" }, groupedRow), "3");
  assert.equal(helpers.reportCsvCell({ key: "adet", type: "number" }, groupedRow), "3");

  // Düz liste eskisi gibi doğru.
  const flat = { grand_total_minor: 960000000, currency: "TRY" };
  assert.equal(helpers.reportCellText({ key: "grand_total_minor", type: "money" }, flat), "9.600.000 TL");
  assert.equal(helpers.reportCsvCell({ key: "grand_total_minor", type: "money" }, flat), "9600000,00");

  // Tip esas: adı `_minor` ile bitse de tipi para olmayan sütun bölünmez
  // (sunucu bugün böyle göndermiyor; gönderirse adla tahmin yürütülmez).
  assert.equal(helpers.reportCsvCell({ key: "odd_minor", type: "number" }, { odd_minor: 1500 }), "1500");
  // Boş tutar boş kalır, sıfıra dönmez.
  assert.equal(helpers.reportCsvCell(toplam, { toplam: null }), "");
  assert.equal(helpers.reportCellText(toplam, { toplam: null }), "—");

  // Dosyanın tamamı: başlık birimli, hücre lira, sayım bölünmemiş.
  const definition = { group: { by: ["status"], aggregates: [{ fn: "count", as: "adet" }, { fn: "sum", field: "grand_total_minor", as: "toplam" }] } };
  const csv = helpers.buildReportCsv([{ key: "status", type: "status" }, { key: "adet", type: "number" }, toplam], [groupedRow], (column) => helpers.reportHeaderLabel("offers", definition, column));
  const lines = csv.replace(/^\ufeff/, "").split("\r\n");
  assert.match(lines[0], /"Adet","Toplam · [^"]+ \(TL\)"$/);
  assert.equal(lines[1].split(",").slice(1).join(","), '"3","9600000,00"');

  // Süzgeçte de aynı kural: lira yazılır, kuruş gider; kuruş gelir, lira gösterilir.
  assert.deepEqual(builder.reportRequestDefinition({ resource: "offers", columns: ["code"], filters: [{ field: "grand_total_minor", op: "gte", type: "money", value: "1500" }], sort: [], group: null, limit: 500 }).filters[0].value, 150000);
  assert.equal(builder.reportDraftFilter({ field: "grand_total_minor", op: "gte", value: 150000 }, "money").value, 1500);
  assert.equal(builder.reportDraftFilter({ field: "odd_minor", op: "gte", value: 1500 }, "number").value, 1500);
});

test("kaydedilmemiş raporda indirme düğmesi Hazırlanıyor yazmaz", () => {
  // Boştayken kimliksiz rapor: null === null bekleme sanılmamalı.
  assert.equal(builder.reportExportBusy(null, null), false);
  assert.equal(builder.reportExportBusy(null, undefined), false);
  assert.equal(builder.reportExportBusy(undefined, undefined), false);
  assert.equal(builder.reportExportBusy(null, "rep_1"), false);
  // Başka bir raporun indirmesi sürerken de bu rapor beklemede değildir.
  assert.equal(builder.reportExportBusy("rep_2", "rep_1"), false);
  assert.equal(builder.reportExportBusy("builtin:offer-conversion", null), false);
  // Yalnız gerçekten bu rapor indirilirken.
  assert.equal(builder.reportExportBusy("rep_1", "rep_1"), true);
  assert.equal(builder.reportExportBusy("builtin:offer-conversion", "builtin:offer-conversion"), true);

  // Önizleme başlığındaki iki indirme düğmesi de bu yardımcıdan okur; yalın
  // karşılaştırma geri gelmesin.
  assert.match(reportScreen, /\{reportExportBusy\(exportingId, reportMeta\.id\) \? <><span className="live-spinner small" \/> Hazırlanıyor…<\/>/);
  assert.match(builtinActions, /\{reportExportBusy\(exportingId, builtinExportKey\) \? <><span className="live-spinner small" \/> Hazırlanıyor…<\/>/);
  assert.doesNotMatch(reportScreen, /exportingId === reportMeta\.id|exportingId === builtinExportKey/);
});

test("az sütunlu rapor telefonda ekrana sığar, geniş liste kutusunda kayar", async () => {
  const source = await readFile(new URL("../src/LiveWorkspace.jsx", import.meta.url), "utf8");
  // Tabloların 820 px alt sınırı gruplu raporun tutar sütununu telefonda ekran
  // dışına itiyordu. Sınır yalnız az sütunlu raporda kalkar; geniş liste yine
  // kendi kutusunda kayar, sayfa taşmaz.
  assert.match(source, /previewColumns\.length <= 4 \? "compact" : ""/);
  assert.match(source, /\.live-report-preview\.compact \.live-table\{min-width:0\}/);
  assert.doesNotMatch(source, /\.live-report-preview \.live-table\{min-width:0\}/, "sınır bütün raporlarda kaldırılmamalı");
});

// ——— 3. aşama: hazır raporda kişisel sütun görünümü ———
// Saklanan şey sonuç değil farktır: kullanıcı "Ödeneni gizledim" der, sütunların
// tam listesini değil. Denetim, seçicinin ürettiği görünüm nesnesini metin
// eşleştirmesiyle değil, üreten yardımcıları çalıştırarak doğrular.
const viewPicker = section(liveSource, "function ReportViewPicker(", "// Hazır rapor kartı:");
const viewApi = section(apiSource, "async reportViews()", "// Rapor dökümü sunucudan hazır CSV");
const flatRunApi = section(apiSource, "async runReport(definition", "// Hazır raporlar kodda tanımlı");
const savedExportApi = section(apiSource, "async exportReport(savedReportId)", "// Hazır raporun dökümü");

test("sütun seçici sözleşmedeki görünüm biçimini üretir", () => {
  // Boş görünüm saklanmaz: hiçbir fark yoksa istek `null` taşır ve sunucu
  // kayıtlı görünümü yok sayar ("Varsayılana dön" ile aynı istek).
  assert.equal(builder.reportViewRequest(builder.reportViewDraft(null), false), null);
  assert.deepEqual(builder.reportViewDraft(null), builder.emptyReportView);

  // Düz liste: gizleme + ek sütun.
  const flat = builder.reportViewAddColumn(builder.reportViewToggleColumn(builder.reportViewDraft(null), "paid_total_minor", ["code", "paid_total_minor"]).view, "project_id");
  assert.deepEqual(builder.reportViewRequest(flat, false), { hiddenColumns: ["paid_total_minor"], extraColumns: ["project_id"] });

  // Gruplu: gizleme + ek toplam. Takma ad işlev ve alandan türetilir.
  const grouped = builder.reportViewAddAggregate(builder.reportViewDraft({ hiddenColumns: ["adet"] }), "avg", "grand_total_minor", ["status", "adet", "toplam"]);
  assert.deepEqual(builder.reportViewRequest(grouped, true), {
    hiddenColumns: ["adet"],
    extraAggregates: [{ fn: "avg", field: "grand_total_minor", as: "ortalama_grand_total_minor" }],
  });

  // Sözleşme `as` çakışmasını yasaklıyor; çakışan ad sessizce 422'ye gitmez.
  assert.equal(builder.reportViewAlias("sum", "grand_total_minor", []), "toplam_grand_total_minor");
  assert.equal(builder.reportViewAlias("sum", "grand_total_minor", ["toplam_grand_total_minor"]), "toplam_grand_total_minor_2");
  assert.equal(builder.reportViewAlias("count", "", ["adet", "adet_2"]), "adet_3");

  // Sunucudan gelen görünüm metin de nesne de olabilir; bozuk metin çökertmez.
  assert.deepEqual(builder.reportViewOf({ view_json: '{"hiddenColumns":["status"]}' }), { hiddenColumns: ["status"] });
  assert.deepEqual(builder.reportViewOf({ view_json: { hiddenColumns: ["status"] } }), { hiddenColumns: ["status"] });
  assert.equal(builder.reportViewOf({ view_json: "{bozuk" }), null);
  assert.equal(builder.reportViewOf(null), null);

  // Tanınmayan anahtar sunucuda 422; istemci hiç üretmemeli.
  assert.deepEqual(Object.keys(builder.reportViewRequest(builder.reportViewDraft({ hiddenColumns: ["a"], columns: ["b"] }), false)), ["hiddenColumns"]);
});

test("düz listede sütun, gruplu raporda toplam eklenir; her biri yalnız kendi kipinde", () => {
  // Kip raporun kendi tanımından okunur.
  assert.match(reportScreen, /const builtinGrouped = Boolean\(builtinOpen\?\.definition\?\.group\);/);

  // Sözleşme: gruplu raporda ek sütun 422, düz listede ek toplam 422. Yanlış
  // kipteki fark istekten hiç çıkmaz.
  const mixed = builder.reportViewDraft({ hiddenColumns: ["code"], extraColumns: ["project_id"], extraAggregates: [{ fn: "sum", field: "grand_total_minor", as: "toplam_grand_total_minor" }] });
  assert.deepEqual(builder.reportViewRequest(mixed, false), { hiddenColumns: ["code"], extraColumns: ["project_id"] });
  assert.deepEqual(builder.reportViewRequest(mixed, true), { hiddenColumns: ["code"], extraAggregates: [{ fn: "sum", field: "grand_total_minor", as: "toplam_grand_total_minor" }] });

  // Alansız toplam (sayım dışında) sunucuya gitmez.
  assert.deepEqual(builder.reportViewAddAggregate(builder.reportViewDraft(null), "sum", ""), builder.reportViewDraft(null));
  assert.deepEqual(builder.reportViewAddAggregate(builder.reportViewDraft(null), "count", "").extraAggregates, [{ fn: "count", field: "", as: "adet" }]);

  // Seçicide iki kip iki ayrı daldır; kullanıcıya yalnız kendi kipi gösterilir.
  const groupedBranch = section(viewPicker, "(grouped", ": addable.length > 0 &&");
  const flatBranch = section(viewPicker, ": addable.length > 0 &&", "!grouped && !addable.length");
  assert.match(groupedBranch, /Toplam ekle/);
  assert.doesNotMatch(groupedBranch, /Sütun ekle|addable/, "gruplu raporda sütun ekleme sunulmaz");
  assert.match(flatBranch, /Sütun ekle/);
  assert.doesNotMatch(flatBranch, /Toplam ekle|numericColumns/, "düz listede toplam ekleme sunulmaz");
  // Toplama işlevleri kurucuyla aynı sözlükten; beşi de var.
  assert.match(groupedBranch, /Object\.entries\(reportAggregateLabels\)/);
  for (const fn of ["count", "sum", "avg", "min", "max"]) assert.match(reportScreen, new RegExp(`\\b${fn}: "`), `${fn} toplaması listelenmeli`);
  // Sayım alan istemez; diğerleri alansız eklenemez.
  assert.match(groupedBranch, /disabled=\{aggregate\.fn === "count"\}/);
  assert.match(groupedBranch, /disabled=\{aggregate\.fn !== "count" && !aggregate\.field\}/);

  // Eklenebilecek sütunlar alan kataloğundan gelir, listede olanlar düşülür.
  assert.match(reportScreen, /const builtinAddableColumns = builtinResourceColumns\.filter\(\(item\) => !builtinViewColumns\.includes\(item\.key\)\)/);
  assert.match(reportScreen, /const builtinResourceColumns = builtinOpen \? catalog\.resources\.find\(\(item\) => item\.resource === previewResource\)\?\.columns \|\| \[\] : \[\]/);
  assert.match(reportScreen, /const builtinNumericColumns = builtinResourceColumns\.filter\(\(item\) => reportNumericTypes\.has\(item\.type\)\)/);
});

test("önizleme isteği builtinReportId ile görünümü taşır; kayıtlı ve kurucu raporda görünüm gönderilmez", () => {
  // Hazır rapor yolu: kimlik + görünüm.
  const effect = section(reportScreen, "const ticket = previewTicket.current + 1", "}, [definitionKey, online]);");
  assert.match(effect, /api\.runBuiltinReport\(builtinOpen\.id, \{ preview: true, view: builtinView \}\)/);
  assert.match(reportScreen, /const builtinView = builtinOpen \? reportViewRequest\(viewDraft, builtinGrouped\) : undefined;/);
  // Gizlenen sütun tanımı değiştirmediği için önizleme anahtarı görünümü de
  // içermeli; yoksa sütun gizlendiğinde ekran hiç tazelenmez.
  assert.match(reportScreen, /const definitionKey = `\$\{builtinOpen\?\.id \|\| ""\}\|\$\{JSON\.stringify\(requestDefinition\)\}\|\$\{JSON\.stringify\(builtinView\)\}`/);
  // Mevcut gecikme ve yarış koruması aynen kullanılır; ikinci bir yol açılmaz.
  assert.match(effect, /setTimeout\(\(\) => \{/);
  assert.match(effect, /if \(previewTicket\.current !== ticket\) return;/);
  assert.equal((reportScreen.match(/api\.runBuiltinReport\(/g) || []).length, 1, "hazır rapor tek yerden çalıştırılmalı");

  // Sözleşme: `savedReportId` ve gövdeden gelen tanım yollarında görünüm 422.
  assert.doesNotMatch(flatRunApi, /\bview\b/, "kurucu yolunda görünüm gönderilmez");
  assert.doesNotMatch(savedExportApi, /\bview\b/, "kayıtlı rapor dökümünde görünüm gönderilmez");
  assert.match(reportScreen, /api\.runReport\(requestDefinition, \{ preview: true \}\)/);

  // İstemci "gönderilmedi" ile "null gönderildi" arasındaki farkı korur:
  // biri kayıtlı görünümü uygular, öbürü onu yok sayar.
  const run = section(reportApi, "async runBuiltinReport(", "async savedReports()");
  assert.match(run, /view === undefined/);
  assert.match(run, /body: \{ builtinReportId, preview, view \}/);
});

test("CSV dökümü de ekrandaki görünümü taşır", () => {
  const download = section(reportScreen, "async function downloadCsv(report)", "// Alan kataloğu gelmeden");
  assert.match(download, /const exportView = builtin \? reportViewRequest\(viewDraft, Boolean\(builtin\.definition\?\.group\)\) : undefined;/);
  assert.match(download, /api\.exportBuiltinReport\(builtin\.id, \{ view: exportView \}\)/);
  // Başlık da görünüm uygulanmış tanımdan okunur; eklenen toplam dosyada ham
  // takma adıyla çıkmamalı.
  assert.match(download, /const headerDefinition = builtin \? reportViewDefinition\(definition, exportView\) : definition;/);
  assert.match(download, /const csv = buildReportCsv\(columns, rows, \(column\) => reportHeaderLabel\(resource, headerDefinition, column\)\)/);
  // Kırpılma uyarısı ve CSV üreticisi aynen; ikinci bir yol açılmadı.
  assert.match(download, /result\.meta\?\.truncated/);
  assert.equal((reportScreen.match(/const csv = buildReportCsv\(/g) || []).length, 1);

  // Eklenen toplam tanıma katılınca başlık Türkçeleşir.
  const definition = { resource: "offers", group: { by: ["status"], aggregates: [{ fn: "count", as: "adet" }] } };
  const merged = builder.reportViewDefinition(definition, { extraAggregates: [{ fn: "avg", field: "grand_total_minor", as: "ortalama_grand_total_minor" }] });
  assert.equal(helpers.reportHeaderLabel("offers", merged, { key: "ortalama_grand_total_minor", type: "money" }), "Ortalama · Tutar");
  // Ek sütun tanıma katılır ama gizleme tanıma dokunmaz: gruplama aynen kalır,
  // yoksa satırlar birleşir ve rakamlar sessizce değişir.
  assert.deepEqual(builder.reportViewDefinition(definition, { extraAggregates: [] }).group.by, ["status"]);
  assert.deepEqual(builder.reportViewDefinition({ resource: "offers", columns: ["code"] }, { extraColumns: ["status"] }).columns, ["code", "status"]);
  assert.deepEqual(builder.reportViewDefinition({ resource: "offers", columns: ["code", "status"] }, { hiddenColumns: ["status"] }).columns, ["code", "status"]);
});

test("son sütun gizlenemez, sebebi Türkçe söylenir", () => {
  const columns = ["code", "status"];
  const first = builder.reportViewToggleColumn(builder.reportViewDraft(null), "status", columns);
  assert.deepEqual(first.view.hiddenColumns, ["status"]);
  assert.equal(first.problem, null);

  // Kalan tek sütun gizlenmez; görünüm değişmez ve sebep yazılır.
  const last = builder.reportViewToggleColumn(first.view, "code", columns);
  assert.deepEqual(last.view, first.view, "reddedilen gizleme görünümü değiştirmemeli");
  assert.equal(last.problem, builder.REPORT_VIEW_LAST_COLUMN_NOTE);
  assert.match(last.problem, /En az bir sütun görünmeli/);

  // Gizli sütunu geri açmak her zaman serbest.
  assert.deepEqual(builder.reportViewToggleColumn(first.view, "status", columns).view.hiddenColumns, []);

  // Kişinin kendi eklediği sütun gizlenmez, listeden çıkarılır.
  const added = builder.reportViewAddColumn(builder.reportViewDraft(null), "project_id");
  const removed = builder.reportViewToggleColumn(added, "project_id", ["code", "project_id"]);
  assert.deepEqual(removed.view.extraColumns, []);
  assert.deepEqual(removed.view.hiddenColumns, []);
  // Ek toplam da aynı kapıdan kalkar.
  const withAggregate = builder.reportViewAddAggregate(builder.reportViewDraft(null), "sum", "grand_total_minor", ["status"]);
  assert.deepEqual(builder.reportViewToggleColumn(withAggregate, "toplam_grand_total_minor", ["status", "toplam_grand_total_minor"]).view.extraAggregates, []);

  // Sebep ekranda kullanıcıya gösterilir; sessizce yutulmaz.
  assert.match(reportScreen, /setViewState\(\(current\) => \(\{ \.\.\.current, problem: next\.problem, notice: null \}\)\)/);
  assert.match(viewPicker, /\{state\.problem && <p className="live-report-hint danger">\{state\.problem\}<\/p>\}/);

  // Gizlenen sütun seçicide kalır; yoksa geri getirilemezdi.
  assert.deepEqual(builder.reportViewColumns({ resource: "offers", columns: ["code", "status"] }, builder.reportViewDraft({ hiddenColumns: ["status"] })), ["code", "status"]);
  assert.deepEqual(builder.reportViewColumns({ group: { by: ["status"], aggregates: [{ fn: "count", as: "adet" }] } }, builder.reportViewDraft({ extraAggregates: [{ fn: "avg", field: "grand_total_minor", as: "ort" }] })), ["status", "adet", "ort"]);
});

test("/reports/builtin yanıtındaki görünüm açılışta uygulanır, Varsayılana dön temizler", () => {
  assert.match(reportScreen, /api\.reportViews\(\)\.then\(\(\{ data \}\) => setViews\(\{ loading: false, rows: data, error: null \}\)\)/);
  assert.match(reportScreen, /useEffect\(\(\) => \{ loadBuiltins\(\); loadCatalog\(\); loadSaved\(\); loadViews\(\);/);
  assert.match(viewApi, /async reportViews\(\)/);
  assert.match(viewApi, /async saveReportView\(values, \{ id = null \} = \{\}\)/);
  assert.match(viewApi, /async deleteReportView\(id\)/);
  assert.match(viewApi, /builtin_id: values\.builtinId, view_json: values\.view/);
  assert.doesNotMatch(viewApi, /JSON\.stringify/, "view_json sunucuda JSON sütunu; ikinci kez metne çevrilmez");
  assert.match(apiSource, /reportViews: "\/report-views"/);

  // Açılış: kayıt defterindeki satır ya da /reports/builtin yanıtındaki görünüm
  // kendiliğinden uygulanır ve kaydedilmemiş sayılmaz.
  const open = section(reportScreen, "function openBuiltin(report) {", "\n  }\n") + "\n  }";
  const calls = {};
  const set = (name) => (value) => { calls[name] = value; };
  const make = new Function("setActiveBuiltin", "setExportNotice", "views", "reportViewOf", "reportViewDraft", "setViewDraft", "reportViewKey", "setViewBaseline", "setViewState", "previewRef", "draftKey", `${open}\nreturn openBuiltin;`);
  const openBuiltin = make(set("active"), set("exportNotice"), { rows: [] }, builder.reportViewOf, builder.reportViewDraft, set("draft"), builder.reportViewKey, set("baseline"), set("state"), { current: null }, "taslak");
  openBuiltin({ id: "offer-conversion", definition: { resource: "offers", columns: ["code", "paid_total_minor"] }, view: { hiddenColumns: ["paid_total_minor"] } });
  assert.deepEqual(calls.draft.hiddenColumns, ["paid_total_minor"], "sunucudaki görünüm açılışta uygulanmalı");
  assert.equal(calls.baseline, JSON.stringify({ hiddenColumns: ["paid_total_minor"] }), "açılışta kaydedilmemiş değişiklik olmamalı");
  assert.equal(calls.active.report.id, "offer-conversion");

  // Görünümü olmayan rapor varsayılanıyla açılır.
  openBuiltin({ id: "offer-conversion", definition: { resource: "offers", columns: ["code"] }, view: null });
  assert.deepEqual(calls.draft, builder.emptyReportView);
  assert.equal(calls.baseline, "null");

  // Kaydetme: kayıt varsa güncellenir (tekil indeks), yoksa açılır.
  const save = section(reportScreen, "async function saveBuiltinView()", "async function resetBuiltinView()");
  assert.match(save, /api\.saveReportView\(\{ builtinId: builtinOpen\.id, view: builtinView \}, \{ id: viewRow\?\.id \|\| null \}\)/);
  assert.match(save, /if \(!builtinView\) \{ resetBuiltinView\(\); return; \}/, "fark kalmadıysa kayıt silinir");
  assert.match(save, /setViewBaseline\(JSON\.stringify\(builtinView\)\)/);

  // Varsayılana dön: kayıt silinir, taslak ve karşılaştırma anahtarı sıfırlanır.
  const reset = section(reportScreen, "async function resetBuiltinView()", "async function saveReport()");
  assert.match(reset, /await api\.deleteReportView\(viewRow\.id\)/);
  assert.match(reset, /setViewDraft\(reportViewDraft\(null\)\)/);
  assert.match(reset, /setViewBaseline\("null"\)/);
  assert.match(reset, /Rapor ilk hâline döndü/);

  // Kaydedilmemiş değişiklik kullanıcıya belli edilir.
  assert.match(reportScreen, /const viewDirty = Boolean\(builtinOpen\) && JSON\.stringify\(builtinView\) !== viewBaseline;/);
  assert.match(viewPicker, /\{dirty && !ignored \? " · kaydedilmemiş değişiklik" : ""\}/);
  assert.match(viewPicker, /kaydetmezseniz rapor bir dahakine eski görünümüyle açılır/);
  assert.match(viewPicker, /Bu görünümü kaydet/);
  assert.match(viewPicker, /Varsayılana dön/);
  // Uyarlanmış görünüm listede de belli olur.
  assert.match(builtinCard, /\{report\.view && <em>/);
});

test("sütun seçici yalnız hazır raporda çıkar ve 390 pikselde taşmaz", () => {
  // Kendi kaydettiğiniz raporlarda seçici yok: sütunlar zaten kurucudan seçiliyor.
  assert.match(reportScreen, /\{builtinOpen && <ReportViewPicker key=\{builtinOpen\.id\} items=\{builtinViewItems\}/);
  assert.equal((reportScreen.match(/<ReportViewPicker/g) || []).length, 1);
  assert.doesNotMatch(section(reportScreen, '<small>RAPOR KURUCUSU</small>', "live-report-preview-panel"), /ReportViewPicker/);
  // Hazır rapor bölümündeki kartlar ve önizleme eylemleri değişmedi.
  assert.doesNotMatch(builtinActions, /ReportViewPicker/);

  // Etiketler mevcut Türkçe katmandan gelir; ham sütun adı yalnız ipucunda.
  assert.match(reportScreen, /label: previewColumnLabel\(\{ key \}\)/);
  assert.match(viewPicker, /<b title=\{item\.key\}>\{item\.label\}<\/b>/);

  // Dar ekranda kutular tek sütuna iner (live-multi-select mobil kuralı) ve
  // seçici başlığından kapatılabilir.
  assert.match(viewPicker, /aria-expanded=\{open\}/);
  assert.match(viewPicker, /<div className="live-multi-select" role="group" aria-label="Gösterilecek sütunlar">/);
  assert.match(liveStyles, /@media\(max-width:720px\)\{\.live-multi-select\{grid-template-columns:1fr\}/);
  assert.match(liveStyles, /\.live-report-view\{[^}]*min-width:0/);
  assert.match(liveStyles, /\.live-report-view-toggle\{[^}]*min-width:0/);
  assert.match(liveStyles, /\.live-report-view-toggle small\{[^}]*overflow-wrap:anywhere/);
  const mobileStart = liveStyles.indexOf(".live-report-groups,.live-report-builder{padding:14px");
  const mobile = liveStyles.slice(mobileStart, liveStyles.indexOf("}\n    @media", mobileStart));
  assert.match(mobile, /\.live-report-view \.live-report-row\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(mobile, /\.live-report-view\{margin:14px 16px 0\}/);
});

// Ek: kayıtlı görünüm yetkiye takılırsa. Kullanıcı bir sütun ekleyip görünümünü
// kaydettikten sonra o sütunun yetkisi geri alınabilir; sunucu raporu varsayılan
// hâliyle çalıştırır, tercihi silmez ve durumu `meta.viewIgnored` ile bildirir.
test("uygulanmayan görünüm Türkçe anlatılır, tercih silinmez", () => {
  // Alanın varlığına bakılır, değerine değil: ileride başka bir neden kodu gelebilir.
  assert.match(reportScreen, /const builtinViewIgnored = Boolean\(builtinOpen\) && Boolean\(preview\.meta\?\.viewIgnored\);/);
  assert.doesNotMatch(reportScreen, /viewIgnored === "|viewIgnored !== "|sensitive_field_forbidden/, "neden koduna göre dallanılmamalı");
  assert.doesNotMatch(viewPicker, /sensitive_field_forbidden/);

  // Seçici raporun gerçekten dönen sütunlarını gösterir; işaretli ama gelmeyen
  // sütun kullanıcıya olmayan bir veriyi vaat ederdi.
  assert.match(reportScreen, /const builtinViewItems = builtinViewIgnored\n\s*\? previewColumns\.map\(\(column\) => \(\{ key: column\.key, label: previewColumnLabel\(column\), hidden: false, extra: false \}\)\)/);
  assert.match(reportScreen, /ignored=\{builtinViewIgnored\}/);

  // Not Türkçe ve ne olduğunu anlatıyor; ham kod ekrana basılmıyor.
  assert.match(viewPicker, /\{ignored && <p className="live-report-hint danger">/);
  assert.match(viewPicker, /görme yetkiniz olmayan bir sütun var; rapor varsayılan hâliyle açıldı/);
  assert.match(viewPicker, /yetki geri verilirse kendiliğinden yeniden işler/);

  // Tercih kendiliğinden silinmez: bu durumda "Varsayılana dön" çağrılmaz,
  // yalnız kullanıcı isterse basar. Kaydetme ve düzenleme ise kilitlenir.
  assert.doesNotMatch(reportScreen, /viewIgnored[\s\S]{0,200}?resetBuiltinView\(\)/, "görünüm kendiliğinden silinmemeli");
  assert.doesNotMatch(reportScreen, /viewIgnored[\s\S]{0,200}?deleteReportView/);
  assert.match(viewPicker, /disabled=\{ignored\}/);
  assert.match(viewPicker, /\{!ignored && \(grouped/);
  assert.match(viewPicker, /disabled=\{state\.saving \|\| !dirty \|\| ignored\}/);
  assert.match(viewPicker, /disabled=\{state\.saving \|\| \(!saved && !dirty\)\}/, "vazgeçme yolu açık kalmalı");
});

// ——— 4. aşama: komuta merkezinde gizlenen maliyet alanları ———
// Sunucu, `cost.view` yetkisi olmayan kullanıcıya komuta merkezindeki maliyet,
// kâr ve marj alanlarını hiç göndermiyor. Kutuyu yine çizip "0 TL" ya da "%0"
// yazmak kârın gerçekten sıfır olduğunu söylerdi; karar biçimlendirmeden önce
// veriliyor ve burada metin eşleştirmesiyle değil gerçekten çalıştırılarak
// denetleniyor.
const commandCenterModal = section(liveSource, "function ProjectCommandCenterModal(", "const projectFinanceCardFields");
function loadProjectFinanceHelpers() {
  const parts = [
    section(liveSource, "const moneyWhole = new Intl.NumberFormat", "// Derleme damgası"),
    section(liveSource, "const currencyLabels = {", '// "2026-07-22"'),
    section(liveSource, "const projectFinanceCardFields = [", "function RecordDetailModal("),
    "return { projectFinanceCards, projectFinanceCardFields };",
  ];
  return new Function(parts.join("\n"))();
}
const projectFinance = loadProjectFinanceHelpers();

test("komuta merkezi: gelmeyen maliyet alanı için kutu çizilmez", () => {
  // Yetkisiz kullanıcıda yanıt yalnız korumasız sözleşme bedelini taşır.
  assert.deepEqual(projectFinance.projectFinanceCards({ contractValueMinor: 2_500_000 }), []);
  assert.deepEqual(projectFinance.projectFinanceCards({}), []);
  assert.deepEqual(projectFinance.projectFinanceCards(undefined), []);

  // Sunucu yarın başka bir tutarı da kapatırsa liste kendiliğinden kısalmalı:
  // her alan kendi varlığına bakılarak üretiliyor, tek bir yetki bayrağına değil.
  for (const [key] of projectFinance.projectFinanceCardFields) {
    const withoutOne = Object.fromEntries(projectFinance.projectFinanceCardFields.filter(([other]) => other !== key).map(([other]) => [other, 1_000_00]));
    assert.ok(projectFinance.projectFinanceCards(withoutOne).every((card) => card.key !== key), `${key} yokken kutusu çizilmemeli`);
  }
});

test("komuta merkezi: alanlar varken kutu çizilir ve Türkçe biçimlenir", () => {
  const cards = projectFinance.projectFinanceCards({ estimatedProfitMinor: 123_456_789, marginPercent: 12.5 });
  assert.equal(cards.length, projectFinance.projectFinanceCardFields.length);
  const [card] = cards;
  assert.equal(card.key, "estimatedProfitMinor");
  assert.equal(card.label, "TAHMİNİ KÂR");
  assert.equal(card.value, "1.234.567,89 TL");
  assert.equal(card.note, "%12,5 tahmini marj");

  // Gerçekten sıfır olan kâr gizlenen alanla karıştırılmamalı: bu kutu çizilir.
  assert.deepEqual(projectFinance.projectFinanceCards({ estimatedProfitMinor: 0, marginPercent: 0 }), [
    { key: "estimatedProfitMinor", label: "TAHMİNİ KÂR", value: "0 TL", note: "%0 tahmini marj" },
  ]);

  // Yüzde `null` ise sunucu hesaplayabildi ama sözleşme bedeli yok; bu bir
  // yetki durumu değil, söylenmesi gereken bir eksiklik.
  assert.equal(projectFinance.projectFinanceCards({ estimatedProfitMinor: 500_00, marginPercent: null })[0].note, "Sözleşme bedeli bekleniyor");
  // Yüzde hiç gelmediyse alt satır da yok; "%0" yazılmıyor.
  assert.equal(projectFinance.projectFinanceCards({ estimatedProfitMinor: 500_00 })[0].note, null);
});

test("komuta merkezi: kalan kutular boşluk bırakmadan yerleşir", () => {
  // Ekran artık alanları tek tek okumuyor; hepsi üretilen listeden geliyor.
  assert.match(commandCenterModal, /const financeCards = projectFinanceCards\(data\?\.finance\);/);
  assert.doesNotMatch(commandCenterModal, /data\.finance\.|finance\.marginPercent|estimatedProfitMinor \|\| 0/, "alanlar doğrudan okunmamalı");
  assert.doesNotMatch(commandCenterModal, /TAHMİNİ KÂR/, "başlık da listeden gelmeli");

  // Kutu sayısı sütun sayısını belirliyor: kaldırılan kutu arkasında boş göz bırakmaz.
  assert.match(commandCenterModal, /<section className="live-project-summary" style=\{\{ "--live-summary-columns": 2 \+ financeCards\.length \}\}>/);
  assert.match(commandCenterModal, /\{financeCards\.map\(\(card\) => <article key=\{card\.key\}><small>\{card\.label\}<\/small><strong>\{card\.value\}<\/strong>\{card\.note && <p>\{card\.note\}<\/p>\}/);
  assert.match(liveStyles, /\.live-project-summary\{display:grid;grid-template-columns:1\.25fr repeat\(var\(--live-summary-columns,3\),1fr\)/);

  // Dar ekranda yerleşim iki sütuna düşmeye devam etmeli; değişken oradaki
  // kuralı ezmiyor.
  assert.match(liveStyles, /@media\(max-width:720px\)[\s\S]*\.live-project-summary\{grid-template-columns:1fr 1fr\}/);
});
