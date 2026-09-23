import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Proje Finansları ekranındaki tahsilat ve ödeme düğmelerinin sözleşmesi.
// `collected` ve `paid` durumları veritabanında baştan beri tanımlıydı ama
// onlara ulaşan hiçbir düğme yoktu; bu dosya o iki düğmenin doğru kayıtta,
// doğru durumda, doğru yetkiyle ve doğru uca gittiğini sabitler.
const liveSource = await readFile(new URL("../src/LiveWorkspace.jsx", import.meta.url), "utf8");
const apiSource = await readFile(new URL("../src/api.js", import.meta.url), "utf8");

function section(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.ok(start >= 0, `${startNeedle} bulunamadı`);
  const end = source.indexOf(endNeedle, start);
  assert.ok(end > start, `${endNeedle} bulunamadı`);
  return source.slice(start, end);
}

// Düğme kuralları JSX dosyasında yaşıyor, node doğrudan içeri alamıyor.
// Kaynaktan kesip derlemek, kuralı metin eşleştirmesiyle değil gerçekten
// çalıştırarak denetlemeyi sağlıyor.
function loadWorkflowActions() {
  const parts = [
    section(apiSource, "const STATUS_VALUES = Object.freeze({", "const reverseStatuses"),
    section(apiSource, "export function statusCodeFor", "export const demoAuthEnabled").replace("export ", ""),
    section(liveSource, "const projectStageLabels = {", "\n"),
    section(liveSource, "const enumLabels = {", "// Denetim kaydı modülü"),
    section(liveSource, "function localizedEnum(value)", "// Sunucudaki üst yetki"),
    section(liveSource, "const capabilityParents = {", "function workflowActions("),
    "return { coreWorkflowActions, hasCapability };",
  ];
  return new Function(parts.join("\n"))();
}

const { coreWorkflowActions } = loadWorkflowActions();
const financeModule = { id: "finance", resource: "finance" };

function sessionWith(...permissions) {
  return { role: { code: "finance" }, permissions };
}
const settler = sessionWith(
  "financial-transactions.read",
  "financial-transactions.approve",
  "financial-transactions.collect",
  "financial-transactions.pay",
  "financial-transactions.reverse",
);
// Yalnız okuma yetkisi olan kullanıcı: kayıtları görür, parayı kapatamaz.
const reader = sessionWith("financial-transactions.read");

function keysFor(row, session = settler) {
  return coreWorkflowActions(financeModule, row, session).map((action) => action.key);
}
function transaction(overrides = {}) {
  return { id: "fin-1", type: "income", status: "Onaylandı", amount: 1200, ...overrides };
}

test("onaylı gelir hareketinde tahsilat, onaylı gider hareketinde ödeme düğmesi çıkar", () => {
  assert.deepEqual(keysFor(transaction({ type: "income" })), ["collect", "reverse"]);
  assert.deepEqual(keysFor(transaction({ type: "expense" })), ["pay", "reverse"]);
});

test("vadesi geçmiş alacak da tek tıkla kapatılabilir", () => {
  // Bütün işin çıkış noktası: vadesi geçmiş alacak listesinden hiçbir kalem
  // düşmüyordu. `overdue` onaylanmış ama vadesi kaçmış kayıttır; sunucu da
  // tahsilat ve ödemeyi `approved` ile `overdue` durumlarında kabul ediyor.
  assert.ok(keysFor(transaction({ type: "income", status: "Gecikti" })).includes("collect"));
  assert.ok(keysFor(transaction({ type: "expense", status: "Gecikti" })).includes("pay"));

  // Ters kayıt ise vadesi geçmiş kayda uygulanmaz; sunucu onu yalnız
  // approved/collected/paid durumunda kabul ediyor.
  assert.deepEqual(keysFor(transaction({ type: "income", status: "Gecikti" })), ["collect"]);
  assert.deepEqual(keysFor(transaction({ type: "expense", status: "Gecikti" })), ["pay"]);
});

test("kapanmış kayıt ters kayıtla düzeltilebilir, ikinci kez kapatılamaz", () => {
  // Tahsil edilmiş kayıt ne düzenlenebiliyor ne siliniyor; yanlış girilmiş bir
  // tahsilatın tek çıkış yolu ters kayıt.
  for (const status of ["Tahsil edildi", "Ödendi"]) {
    assert.deepEqual(keysFor(transaction({ type: "income", status })), ["reverse"]);
    assert.deepEqual(keysFor(transaction({ type: "expense", status })), ["reverse"]);
  }
});

test("ters kayıt fişinin kendisinde hiçbir düğme çıkmaz", () => {
  // Düzeltme fişi kasadan geçmez; sunucu da üç ucun hepsinde reddediyor.
  const voucher = transaction({ id: "fin-1-rev", reversalOfId: "fin-1", amount: -1200 });
  assert.deepEqual(keysFor(voucher), []);
  assert.deepEqual(keysFor({ ...voucher, type: "expense" }), []);
});

test("gelir kaydında ödeme, gider kaydında tahsilat düğmesi hiç çıkmaz", () => {
  assert.ok(!keysFor(transaction({ type: "income" })).includes("pay"));
  assert.ok(!keysFor(transaction({ type: "expense" })).includes("collect"));
});

test("hakediş, avans ve maliyet tahmini hareketleri bu ekrandan kapatılmaz", () => {
  // Sunucu bu iki türde yönü karşı taraftan (müşteri / tedarikçi) okuyor, ama
  // finans formunda müşteri ve tedarikçi alanı hiç yok: ekrandan açılan her
  // hakediş ve avansın iki tarafı da boş kalır ve yön belirsizdir. Üstüne
  // hakediş kendi zincirinden kapanıyor ve o zincirin "Ödendi" adımı bağladığı
  // finans hareketini `approved` durumunda bekliyor; buradan kapatmak hakedişi
  // kilitlerdi. Maliyet tahmini ise gerçekleşmiş bir para hareketi değil.
  for (const type of ["progress_payment", "advance", "cost_forecast"]) {
    for (const status of ["Onaylandı", "Gecikti"]) {
      const keys = keysFor(transaction({ type, status }));
      assert.ok(!keys.includes("collect"), `${type} türü tahsil edilememeli`);
      assert.ok(!keys.includes("pay"), `${type} türü ödenememeli`);
    }
  }
});

test("tahsilat ve ödeme yalnız kesinleşmiş ya da vadesi geçmiş hareketin durumunda çıkar", () => {
  // Sunucunun kabul ettiği küme `approved` ve `overdue`. Onaylanmamış kayıttan
  // doğrudan tahsilata atlamak onay adımını atlar; `cancelled` hiç olmamış,
  // `reversed` geri alınmış, `collected`/`paid` zaten kapanmıştır.
  const rejected = ["Taslak", "Planlandı", "Onay bekliyor", "Tahsil edildi", "Ödendi", "Ters kaydedildi", "İptal"];
  for (const status of rejected) {
    for (const type of ["income", "expense"]) {
      const keys = keysFor(transaction({ type, status }));
      assert.ok(!keys.includes("collect"), `${status} durumunda tahsilat düğmesi çıkmamalı`);
      assert.ok(!keys.includes("pay"), `${status} durumunda ödeme düğmesi çıkmamalı`);
    }
  }
  // Onay akışı olduğu gibi duruyor.
  assert.deepEqual(keysFor(transaction({ status: "Onay bekliyor" })), ["approve"]);
});

test("yetkisi olmayan kullanıcı tahsilat ve ödeme düğmesini hiç görmez", () => {
  assert.deepEqual(keysFor(transaction({ type: "income" }), reader), []);
  assert.deepEqual(keysFor(transaction({ type: "expense" }), reader), []);

  // Yetkiler ayrı ayrı verilebilir: tahsilat yetkisi ödeme düğmesini açmaz.
  const collectorOnly = sessionWith("financial-transactions.read", "financial-transactions.collect");
  assert.deepEqual(keysFor(transaction({ type: "income" }), collectorOnly), ["collect"]);
  assert.deepEqual(keysFor(transaction({ type: "expense" }), collectorOnly), []);

  const payerOnly = sessionWith("financial-transactions.read", "financial-transactions.pay");
  assert.deepEqual(keysFor(transaction({ type: "expense" }), payerOnly), ["pay"]);
  assert.deepEqual(keysFor(transaction({ type: "income" }), payerOnly), []);

  // Firma sahibi ve yönetici yetkinin tamamına sahiptir.
  assert.deepEqual(keysFor(transaction({ type: "income" }), { role: { code: "owner" }, permissions: [] }), ["collect", "reverse"]);
});

test("düğme metinleri Türkçe, kısa ve durumun adıyla aynı", () => {
  const [collect] = coreWorkflowActions(financeModule, transaction({ type: "income" }), settler);
  const [pay] = coreWorkflowActions(financeModule, transaction({ type: "expense" }), settler);
  assert.equal(collect.label, "Tahsil edildi");
  assert.equal(pay.label, "Ödendi");
  assert.equal(collect.tone, "success");
  assert.equal(pay.tone, "success");
  // Ters kayıttan farklı olarak gerekçe sorulmaz; tahsilat bir düzeltme değil.
  assert.ok(!collect.reasonRequired && !pay.reasonRequired);
  for (const action of [collect, pay]) {
    assert.ok(action.title && action.message, "onay kutusunun başlığı ve açıklaması olmalı");
    assert.ok(action.label.length <= 16, `düğme metni kısa olmalı: ${action.label}`);
  }
});

// `api.workflow` uç adresini kaynağın kendisinden kurar; düğmenin anahtarı
// doğrudan adresin son parçası olduğu için burada gerçekten çalıştırılır.
function loadWorkflowCall() {
  const endpoints = section(apiSource, "endpoints: Object.freeze({", "  }),\n});");
  const method = section(apiSource, "async workflow(resource, resourceId, action, body = {})", "\n};");
  const factory = new Function(
    "request",
    "ApiError",
    "idempotencyKey",
    "mapIncoming",
    `const API_CONFIG = { ${endpoints}}) };\nconst helper = { ${method} };\nreturn helper.workflow;`,
  );
  const calls = [];
  const workflow = factory(
    async (path, options) => {
      calls.push({ path, options });
      return { data: { id: "fin-1", status: "collected" }, meta: null };
    },
    class extends Error {},
    (resource, action) => `capproje:${resource}:${action}:nonce`,
    (_resource, data) => data,
  );
  return { workflow, calls };
}

test("tahsilat ve ödeme düğmeleri kendi iş akışı ucuna gider", async () => {
  const { workflow, calls } = loadWorkflowCall();
  await workflow("finance", "fin-1", "collect");
  await workflow("finance", "fin-2", "pay");

  assert.deepEqual(calls.map((call) => call.path), [
    "/financial-transactions/fin-1/collect",
    "/financial-transactions/fin-2/pay",
  ]);
  for (const call of calls) {
    assert.equal(call.options.method, "POST");
    // Ağ koptuğunda tekrarlanan istek parayı ikinci kez kapatmamalı.
    assert.ok(call.options.headers["Idempotency-Key"], "iş akışı çağrısı idempotency anahtarı taşımalı");
  }
});

test("ekran düğmenin anahtarını doğrudan uç adına çevirir", () => {
  // `onWorkflow` action.key'i olduğu gibi `api.workflow`a veriyor; anahtar ile
  // uç adı ayrışırsa kullanıcı çalışmayan düğme görür.
  assert.match(liveSource, /api\.workflow\(workflow\.action\.targetResource \|\| module\.resource, workflow\.action\.targetId \|\| workflow\.row\.id, workflow\.action\.key/);
  assert.match(apiSource, /\$\{endpoint\}\/\$\{encodeURIComponent\(resourceId\)\}\/\$\{action\}/);
});

test("tahsil edilmiş ve ödenmiş hareket de onaylı hareket gibi silinemez", () => {
  // Bu iki duruma ilk kez ulaşılabiliyor; silme düğmesinin oradan geri
  // gelmemesi gerekiyor, yoksa kapanmış para kaydı silinebilir hale gelirdi.
  assert.match(
    liveSource,
    /module\.id === "finance" && \["approved", "collected", "paid", "reversed"\]\.includes\(statusCodeFor\(module\.id, row\.status\)\)/,
  );
});

test("denetim kaydı tahsilat ve ödemeyi Türkçe gösterir", () => {
  const labels = section(liveSource, "const auditActionLabels = {", "// Sunucudaki üst yetki");
  assert.match(labels, /collect: "Tahsilatı kaydetti"/);
  assert.match(labels, /pay: "Ödemeyi kaydetti"/);
});
