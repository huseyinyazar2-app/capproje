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
function loadReportHelpers() {
  const parts = [
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
    section(liveSource, "const reportAggregateLabels = {", "const reportValuelessOps"),
    section(liveSource, "// Bir rapor hücresinin kullanıcıya görünen metni", "function ReportCard("),
    "return { reportColumnLabel, reportColumnLabels, sharedColumnLabels, humanizeColumnName, collapseReportColumns, reportPresentedValue, reportCellText, reportHeaderLabel, reportCsvField, buildReportCsv, localizedEnum, formatValue };",
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
  assert.match(reportScreen, /className=\{`live-report-preview \$\{preview\.loading \? "refreshing" : ""\}`\}/);
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

  // Kuruş/lira dönüşümü listelerdeki kuralın aynısı olmalı.
  assert.match(reportLabels, /String\(column\)\.endsWith\("_minor"\)\) return value \/ 100/);
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
  assert.equal(exportedLines[0], '"Proje Kodu","Müşteri","Proje","Aşama","Ara toplam","Teklif tarihi"');
  for (const raw of ["code", "customer_id", "customer_name", "status", "subtotal_minor", "offer_date"]) {
    assert.ok(!exportedLines[0].includes(raw), `başlıkta ham sütun adı kalmış: ${raw}`);
  }

  // Bağlı kayıt tek sütun: ham kimlik dosyaya yazılmaz, _id/_name ikilenmez.
  assert.doesNotMatch(exportedCsv, /cus_[0-9a-f-]{8}/);
  assert.equal(exportedLines[0].match(/Müşteri/g).length, 1, "müşteri sütunu ikilenmemeli");
  assert.equal(exportedCsv.split(",").length, exportedLines[0].split(",").length * 2, "başlık ve satır aynı sütun sayısını taşımalı");

  // Durum Türkçe, para ve tarih ekrandaki biçimde.
  assert.equal(exportedLines[1], '"CP-5","Müşteri 1","Resepsiyon","Talep","1.234,50 TL","09.03.2026"');

  // Aynı kural gruplanmış raporun başlığında da geçerli.
  const grouped = { group: { aggregates: [{ fn: "sum", field: "subtotal_minor", as: "toplam_subtotal_minor" }] } };
  assert.equal(helpers.reportHeaderLabel("projects", grouped, { key: "toplam_subtotal_minor", type: "money" }), "Toplam · Ara toplam");
});

test("ekrandaki hücre metni ile dosyadaki hücre metni tek yerden gelir", () => {
  // Önizleme tablosu da CSV de reportCellText'ten geçiyor.
  assert.match(reportScreen, /: reportCellText\(column, row\)\}<\/td>/);
  assert.match(reportCsvSection, /reportCsvField\(reportCellText\(column, row\)\)/);

  // Durum sütununda rozetin yazdığı metnin aynısı dosyaya yazılır.
  assert.match(liveSource, /return <span className=\{`live-status \$\{statusTone\(children\)\}`\}>\{localizedEnum\(children\) \|\| "—"\}<\/span>;/);
  assert.match(reportCsvSection, /if \(column\.type === "status" && cell\) return localizedEnum\(cell\) \|\| "—";/);
  assert.equal(helpers.reportCellText({ key: "status", type: "status" }, { status: "lead" }), "Talep");

  // Bağlı kayıt adı, para ve tarih de aynı yardımcılardan geçer.
  assert.equal(helpers.reportCellText({ key: "customer_id", type: "text" }, csvRow), "Müşteri 1");
  assert.equal(helpers.reportCellText({ key: "subtotal_minor", type: "money" }, csvRow), "1.234,50 TL");
  assert.equal(helpers.reportCellText({ key: "offer_date", type: "date" }, csvRow), "09.03.2026");
  // Çözülemeyen kimlik dosyada da boş kalır; kırk karakterlik dizi yazılmaz.
  assert.equal(helpers.reportCellText({ key: "customer_id", type: "text" }, { customer_id: "cus_ce699fc4-961a-4697-b610-4ea2d1540cc6" }), "—");
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

test("indirme kaydedilmiş rapora bağlıdır, beklemede görünür, hatası Türkçedir", () => {
  // Kaydedilmemiş taslakta düğme kapalı ve ne yapılacağı yazıyor.
  assert.match(reportScreen, /disabled=\{!reportMeta\.id \|\| Boolean\(exportingId\)\}/);
  assert.match(reportScreen, /Kaydedip indirin/);
  assert.match(reportScreen, /Kaydedilmemiş taslak indirilemez/);
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
  assert.match(download, /tone: "success", message: `Rapor indirildi/);

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
