import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
  assert.match(apiSource, /reportExport: "\/reports\/export"/);
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
  assert.match(reportScreen, /formatValue\(reportCellValue\(column\.key, row\[column\.key\], column\.type\), column\.type, row\)/);
  assert.match(reportScreen, /<Status>\{row\[column\.key\]\}<\/Status>/);

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

test("durum seçenekleri sunucunun alan kataloğundan gelir, tahmin edilmez", () => {
  // Tek doğruluk kaynağı /reports/fields yanıtındaki values dizisi.
  assert.match(reportScreen, /const statusChoicesFor = \(key\) => \(resourceColumns\.find\(\(item\) => item\.key === key\)\?\.values \|\| \[\]\)\.map\(\(value\) => \(\{ value, label: localizedEnum\(value\) \}\)\)/);
  assert.match(reportScreen, /const statusChoices = statusChoicesFor\(item\.field\);/);

  // Yerel tahmin kaynakları rapor kodunda hiç kullanılmamalı.
  for (const source of [reportScreen, reportLabels]) {
    assert.doesNotMatch(source, /STATUS_VALUES|statusOptionsFor|boardColumns/, "durum listesi yerel tahminden üretilmemeli");
  }
  assert.doesNotMatch(apiSource, /export function statusOptionsFor/);

  // Kullanıcıya Türkçe gösterilir, sunucuya ham kod gider.
  assert.match(reportScreen, /statusChoices\.map\(\(option\) => <option key=\{option\.value\} value=\{option\.value\}>\{option\.label\}<\/option>\)/);
  assert.match(reportScreen, /localizedEnum\(value\)/);

  // `in` işlecinde çoklu seçim.
  const multi = section(reportScreen, 'if (item.op === "in") {', "<span>Değerler</span>");
  assert.match(multi, /type === "status" && statusChoices\.length/);
  assert.match(multi, /<input type="checkbox" checked=\{selected\.includes\(option\.value\)\}/);
  assert.match(multi, /selected\.filter\(\(code\) => code !== option\.value\) : \[\.\.\.selected, option\.value\]/);

  // values gelmeyen sütunda alan serbest metin olarak kalır.
  assert.match(reportScreen, /return <label><span>Değer\{unit\}<\/span>\{valueInput\(type, item\.value/);
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
  assert.match(reportScreen, /const csv = await api\.reportCsv\(report\.id\)/);
  assert.match(reportScreen, /new Blob\(\[csv\], \{ type: "text\/csv;charset=utf-8" \}\)/);
  assert.match(reportApi, /async reportCsv\(id\)/);
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
