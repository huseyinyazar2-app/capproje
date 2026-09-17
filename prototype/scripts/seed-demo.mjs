#!/usr/bin/env node
/**
 * Tanıtım için gerçekçi ve birbirine bağlı örnek veri üretir.
 *
 * Boş bir kurulumda hiçbir ekranda kayıt olmadığı için programın ne yaptığı
 * anlaşılmıyor. Bu betik bir marangoz atölyesinin gerçek iş akışını taklit eder:
 * müşteriden keşfe, tekliften sözleşmeye, üretimden montaja ve teslime kadar
 * aynı projelerin izini her ekranda bırakır. Kayıtlar birbirine bağlıdır;
 * projeden görevine, görevinden malzemesine tıklayarak gidilebilir.
 *
 * Kullanımı:
 *   CAPPROJE_URL=https://ornek.com CAPPROJE_TOKEN=cap_... node scripts/seed-demo.mjs
 *
 * Aynı veriyi ikinci kez yazmaz: var olan kaydı numarasından bulup kullanır,
 * bu yüzden yarıda kalırsa tekrar çalıştırmak güvenlidir.
 */

import { deflateSync } from "node:zlib";

const BASE = `${(process.env.CAPPROJE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "")}/api/v1`;
const TOKEN = process.env.CAPPROJE_TOKEN;
if (!TOKEN) {
  console.error("CAPPROJE_TOKEN gerekli. Yönetim → API Erişim Anahtarları ekranından bir anahtar üretin.");
  process.exit(1);
}

const headers = { "content-type": "application/json", authorization: `Bearer ${TOKEN}` };
const sayac = new Map();
const hatalar = [];
let atlanan = 0;

function say(kaynak) {
  sayac.set(kaynak, (sayac.get(kaynak) || 0) + 1);
}

async function istek(yol, secenekler = {}) {
  const yanit = await fetch(`${BASE}/${yol}`, { ...secenekler, headers: { ...headers, ...secenekler.headers } });
  const metin = await yanit.text();
  if (!yanit.ok) return { ok: false, status: yanit.status, metin };
  return { ok: true, veri: metin ? JSON.parse(metin).data : null };
}

// Var olan kaydı numarasından bulur. Betik ikinci kez çalıştığında aynı
// kayıtları yeniden üretmek yerine mevcutlarını kullanır.
async function bul(kaynak, anahtar) {
  if (!anahtar) return null;
  // Liste ucu arama terimini `q` ile alır.
  const yanit = await istek(`${kaynak}?q=${encodeURIComponent(anahtar)}&pageSize=5`);
  if (!yanit.ok) return null;
  return yanit.veri?.find((satir) => Object.values(satir).some((deger) => deger === anahtar)) || null;
}

// Alt kayıtların (metraj satırı, reçete satırı, operasyon…) kendi numarası
// yoktur; ikinci çalıştırmada çoğalmamaları için üst kayda göre kontrol edilir.
async function varMi(kaynak, alan, deger) {
  if (!deger) return true;
  const yanit = await istek(`${kaynak}?${alan}=${encodeURIComponent(deger)}&pageSize=1`);
  return yanit.ok && (yanit.veri?.length || 0) > 0;
}

const anahtarAlanlari = [
  "code", "offer_number", "order_number", "request_number", "installation_number", "transaction_number",
  "employee_number", "survey_number", "contract_number", "invoice_number", "progress_number", "movement_number",
  "inspection_number", "handover_number", "quotation_number", "issue_number", "sku", "title",
];

async function olustur(kaynak, govde) {
  const yanit = await istek(kaynak, { method: "POST", body: JSON.stringify(govde) });
  if (yanit.ok) { say(kaynak); return yanit.veri; }
  const anahtar = anahtarAlanlari.map((alan) => govde[alan]).find(Boolean);
  const mevcut = await bul(kaynak, anahtar);
  if (mevcut) return mevcut;
  // Numarası olmayan alt kayıtlar (metraj satırı, reçete satırı) aranamıyor;
  // 409 bunların ikinci kez yazılmaya çalışıldığını gösterir.
  if (yanit.status === 409) { atlanan += 1; return null; }
  hatalar.push(`${kaynak} · ${anahtar || "?"} · ${yanit.status} ${yanit.metin.slice(0, 160)}`);
  return null;
}

async function akis(kaynak, kayitId, eylem, govde = {}) {
  if (!kayitId) return null;
  const yanit = await istek(`${kaynak}/${kayitId}/${eylem}`, { method: "POST", body: JSON.stringify(govde) });
  if (yanit.ok) return yanit.veri;
  // Betik ikinci kez çalıştığında kayıt zaten hedef durumdadır; sunucu bunu
  // 409 ile reddeder. Bu bir hata değil, yapılacak iş kalmamasıdır.
  if (yanit.status === 409) { atlanan += 1; return null; }
  hatalar.push(`${kaynak}/${eylem} · ${yanit.status} ${yanit.metin.slice(0, 160)}`);
  return null;
}

const gun = (fark) => new Date(Date.now() + fark * 86400000).toISOString().slice(0, 10);
const an = (fark) => new Date(Date.now() + fark * 86400000).toISOString().slice(0, 16);
const lira = (tutar) => Math.round(tutar * 100);
const sec = (dizi, indeks) => dizi[indeks % dizi.length];

// --- Fotoğraf üretimi ---------------------------------------------------
// Dosyalar ekranının boş kalmaması için küçük, düz renkli PNG'ler üretilir.
function png(genislik, yukseklik, [kirmizi, yesil, mavi]) {
  const crcTablosu = Array.from({ length: 256 }, (_, indeks) => {
    let deger = indeks;
    for (let bit = 0; bit < 8; bit += 1) deger = deger & 1 ? 0xedb88320 ^ (deger >>> 1) : deger >>> 1;
    return deger >>> 0;
  });
  const crc = (tampon) => {
    let deger = 0xffffffff;
    for (const bayt of tampon) deger = crcTablosu[(deger ^ bayt) & 0xff] ^ (deger >>> 8);
    return (deger ^ 0xffffffff) >>> 0;
  };
  const parca = (tur, veri) => {
    const uzunluk = Buffer.alloc(4);
    uzunluk.writeUInt32BE(veri.length);
    const govde = Buffer.concat([Buffer.from(tur, "ascii"), veri]);
    const kontrol = Buffer.alloc(4);
    kontrol.writeUInt32BE(crc(govde));
    return Buffer.concat([uzunluk, govde, kontrol]);
  };
  const baslik = Buffer.alloc(13);
  baslik.writeUInt32BE(genislik, 0);
  baslik.writeUInt32BE(yukseklik, 4);
  baslik[8] = 8;
  baslik[9] = 2;
  const satirlar = [];
  for (let satir = 0; satir < yukseklik; satir += 1) {
    const tampon = Buffer.alloc(1 + genislik * 3);
    for (let sutun = 0; sutun < genislik; sutun += 1) {
      const kayma = 1 + sutun * 3;
      const golge = Math.round((satir / yukseklik) * 28);
      tampon[kayma] = Math.max(0, kirmizi - golge);
      tampon[kayma + 1] = Math.max(0, yesil - golge);
      tampon[kayma + 2] = Math.max(0, mavi - golge);
    }
    satirlar.push(tampon);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    parca("IHDR", baslik),
    parca("IDAT", deflateSync(Buffer.concat(satirlar))),
    parca("IEND", Buffer.alloc(0)),
  ]);
}

async function fotograf({ ad, aciklama, projeId, mahal, asama, renk, tur = "projects", kayitId }) {
  const form = new FormData();
  form.set("file", new Blob([png(480, 320, renk)], { type: "image/png" }), ad);
  form.set("entity_type", tur);
  form.set("entity_id", kayitId || projeId);
  form.set("category", "photo");
  form.set("project_id", projeId);
  form.set("description", aciklama);
  if (mahal) form.set("space_name", mahal);
  form.set("capture_stage", asama);
  form.set("visibility", "internal");
  const yanit = await fetch(`${BASE}/files/upload`, { method: "POST", headers: { authorization: `Bearer ${TOKEN}` }, body: form });
  if (yanit.ok) { say("files"); return (await yanit.json()).data; }
  hatalar.push(`files · ${ad} · ${yanit.status} ${(await yanit.text()).slice(0, 160)}`);
  return null;
}

// --- Sabit veriler ------------------------------------------------------

const musteriler = [
  { code: "MUS-001", name: "Marmara Otelcilik A.Ş.", type: "hotel", contact_name: "Burak Şen", phone: "05442223344", email: "burak@marmaraotel.com", city: "İzmir", tax_office: "Alsancak", payment_terms: "%40 peşin, kalanı teslimde", credit_limit_minor: lira(1500000) },
  { code: "MUS-002", name: "Anadolu Yapı Mimarlık", type: "architect", contact_name: "Elif Kaya", phone: "05331112233", email: "elif@anadoluyapi.com", city: "İstanbul", tax_office: "Maslak", payment_terms: "30 gün vadeli", credit_limit_minor: lira(800000) },
  { code: "MUS-003", name: "Ayşe Demir", type: "individual", contact_name: "Ayşe Demir", phone: "05553334455", city: "Ankara", payment_terms: "%50 peşin" },
  { code: "MUS-004", name: "Vadi Konutları Yapı Koop.", type: "company", contact_name: "Serkan Yıldız", phone: "05064445566", email: "serkan@vadikonutlari.com", city: "Bursa", tax_office: "Nilüfer", payment_terms: "Hakedişli", credit_limit_minor: lira(3000000) },
  { code: "MUS-005", name: "Beyaz Ev İnşaat Ltd. Şti.", type: "company", contact_name: "Murat Aksoy", phone: "05325556677", email: "murat@beyazevinsaat.com", city: "İstanbul", tax_office: "Beykoz", payment_terms: "45 gün vadeli", credit_limit_minor: lira(1200000) },
  { code: "MUS-006", name: "Çınar Eğitim Vakfı", type: "company", contact_name: "Nurten Aslan", phone: "05366667788", email: "nurten@cinarvakfi.org", city: "Ankara", tax_office: "Çankaya", payment_terms: "Peşin" },
  { code: "MUS-007", name: "Nazar Gıda İşletmeleri", type: "company", contact_name: "Emre Doğan", phone: "05377778899", email: "emre@nazarcafe.com", city: "İzmir", tax_office: "Konak", payment_terms: "%30 peşin" },
  { code: "MUS-008", name: "Gökçe Gayrimenkul A.Ş.", type: "company", contact_name: "Pelin Yücel", phone: "05388889900", email: "pelin@gokcegyo.com", city: "İstanbul", tax_office: "Şişli", payment_terms: "60 gün vadeli", credit_limit_minor: lira(2000000) },
  { code: "MUS-009", name: "Selvi Site Yönetimi", type: "company", contact_name: "Hüseyin Tan", phone: "05399990011", city: "Kocaeli", payment_terms: "Peşin" },
  { code: "MUS-010", name: "Deniz Turizm İşletmeleri", type: "hotel", contact_name: "Gamze Arı", phone: "05300001122", email: "gamze@denizturizm.com", city: "Muğla", tax_office: "Bodrum", payment_terms: "%50 peşin" },
];

const tedarikciler = [
  { code: "TED-001", name: "Kastamonu Entegre Bayi", category: "Levha", contact_name: "Hakan Arslan", phone: "05321119988", email: "hakan@kastamonubayi.com", city: "İstanbul", payment_terms: "45 gün", rating: 5 },
  { code: "TED-002", name: "Blum Türkiye Yetkili Satıcı", category: "Hırdavat", contact_name: "Deniz Ak", phone: "05322228877", email: "deniz@blumbayi.com", city: "İstanbul", payment_terms: "30 gün", rating: 5 },
  { code: "TED-003", name: "Öz Mermer Tezgah", category: "Tezgah", contact_name: "Mustafa Can", phone: "05333337766", city: "Afyon", payment_terms: "Peşin", rating: 4 },
  { code: "TED-004", name: "Anadolu Cam ve Ayna", category: "Cam", contact_name: "Sibel Uz", phone: "05344446655", city: "Bursa", payment_terms: "30 gün", rating: 4 },
  { code: "TED-005", name: "Yıldız Boya ve Cila", category: "Kimyasal", contact_name: "Okan Er", phone: "05355556544", city: "İzmir", payment_terms: "Peşin", rating: 3 },
  { code: "TED-006", name: "Ege Metal Aksesuar", category: "Metal", contact_name: "Cem Balcı", phone: "05366665433", city: "İzmir", payment_terms: "60 gün", rating: 4 },
];

const personeller = [
  { employee_number: "PRS-001", first_name: "Ahmet", last_name: "Yılmaz", department: "Üretim", title: "Atölye Şefi", employment_type: "full_time", hire_date: "2018-03-11", phone: "05341112200", email: "ahmet@ozturkahsap.com", salary_amount_minor: lira(62000) },
  { employee_number: "PRS-002", first_name: "Fatma", last_name: "Koç", department: "Tasarım", title: "İç Mimar", employment_type: "full_time", hire_date: "2021-09-01", phone: "05341112201", email: "fatma@ozturkahsap.com", salary_amount_minor: lira(54000) },
  { employee_number: "PRS-003", first_name: "Hasan", last_name: "Aydın", department: "Montaj", title: "Montaj Ustası", employment_type: "full_time", hire_date: "2020-06-15", phone: "05341112202", salary_amount_minor: lira(48000) },
  { employee_number: "PRS-004", first_name: "Zeynep", last_name: "Erdoğan", department: "Satın Alma", title: "Satın Alma Sorumlusu", employment_type: "full_time", hire_date: "2022-02-07", phone: "05341112203", email: "zeynep@ozturkahsap.com", salary_amount_minor: lira(51000) },
  { employee_number: "PRS-005", first_name: "Mert", last_name: "Şahin", department: "Üretim", title: "CNC Operatörü", employment_type: "full_time", hire_date: "2021-11-22", phone: "05341112204", salary_amount_minor: lira(46000) },
  { employee_number: "PRS-006", first_name: "Selin", last_name: "Kurt", department: "Muhasebe", title: "Ön Muhasebe Sorumlusu", employment_type: "full_time", hire_date: "2019-08-05", phone: "05341112205", email: "selin@ozturkahsap.com", salary_amount_minor: lira(49000) },
  { employee_number: "PRS-007", first_name: "Emre", last_name: "Polat", department: "Montaj", title: "Montaj Elemanı", employment_type: "full_time", hire_date: "2023-04-17", phone: "05341112206", salary_amount_minor: lira(38000) },
  { employee_number: "PRS-008", first_name: "Derya", last_name: "Güneş", department: "Kalite", title: "Kalite Kontrol Sorumlusu", employment_type: "full_time", hire_date: "2022-10-03", phone: "05341112207", email: "derya@ozturkahsap.com", salary_amount_minor: lira(47000) },
  { employee_number: "PRS-009", first_name: "Oğuz", last_name: "Çelik", department: "Üretim", title: "Cilacı", employment_type: "contract", hire_date: "2024-01-15", phone: "05341112208", salary_amount_minor: lira(41000) },
  { employee_number: "PRS-010", first_name: "Melis", last_name: "Arda", department: "Satış", title: "Proje Satış Uzmanı", employment_type: "full_time", hire_date: "2023-07-24", phone: "05341112209", email: "melis@ozturkahsap.com", salary_amount_minor: lira(52000) },
];

const isMerkezleri = [
  { code: "IM-01", name: "Panel Ebatlama", category: "Kesim", daily_capacity_minutes: 480, hourly_cost_minor: lira(420), is_outsourced: 0, notes: "Yatay panel testere" },
  { code: "IM-02", name: "CNC İşleme", category: "CNC", daily_capacity_minutes: 480, hourly_cost_minor: lira(650), is_outsourced: 0, notes: "Nesting ve delik programı" },
  { code: "IM-03", name: "Kenar Bantlama", category: "Bantlama", daily_capacity_minutes: 480, hourly_cost_minor: lira(380), is_outsourced: 0 },
  { code: "IM-04", name: "Montaj Hattı", category: "Montaj", daily_capacity_minutes: 960, hourly_cost_minor: lira(340), is_outsourced: 0, notes: "İki vardiya" },
  { code: "IM-05", name: "Cila ve Boya Kabini", category: "Yüzey", daily_capacity_minutes: 420, hourly_cost_minor: lira(520), is_outsourced: 0, notes: "Lake kurutma dahil" },
  { code: "IM-06", name: "Dış İmalat - Cam ve Ayna", category: "Dış imalat", daily_capacity_minutes: 600, hourly_cost_minor: lira(700), is_outsourced: 1 },
];

const stokKartlari = [
  { sku: "LV-SUN-18-BYZ", giris: 620, name: "18 mm Suntalam - Beyaz", category: "Levha", unit: "adet", minimum_quantity: 40, average_cost_minor: lira(890), warehouse_location: "A-01" },
  { sku: "LV-MDF-18-CVZ", giris: 240, name: "18 mm Ceviz Kaplama MDF", category: "Levha", unit: "adet", minimum_quantity: 20, average_cost_minor: lira(1850), warehouse_location: "A-02" },
  { sku: "LV-MDF-08-HAM", giris: 300, name: "8 mm Ham MDF Arkalık", category: "Levha", unit: "adet", minimum_quantity: 30, average_cost_minor: lira(420), warehouse_location: "A-03" },
  { sku: "BN-PVC-22-BYZ", giris: 4200, name: "PVC Kenar Bandı 22 mm Beyaz", category: "Bant", unit: "metre", minimum_quantity: 500, average_cost_minor: lira(9), warehouse_location: "B-01" },
  { sku: "HR-BLM-LGB-500", giris: 480, name: "Blum Legrabox Çekmece Rayı 500 mm", category: "Hırdavat", unit: "takım", minimum_quantity: 60, average_cost_minor: lira(240), warehouse_location: "C-01" },
  { sku: "HR-BLM-CLIP", giris: 1600, name: "Blum Clip Top Menteşe 110°", category: "Hırdavat", unit: "adet", minimum_quantity: 200, average_cost_minor: lira(48), warehouse_location: "C-02" },
  { sku: "TZ-KVR-20-CAL", giris: 60, name: "Kuvars Tezgah 20 mm Calacatta", category: "Tezgah", unit: "m²", minimum_quantity: 4, average_cost_minor: lira(3100), warehouse_location: "D-01" },
  { sku: "KM-LAK-BYZ-MAT", giris: 180, name: "Lake Boya Beyaz Mat", category: "Kimyasal", unit: "kg", minimum_quantity: 25, average_cost_minor: lira(310), warehouse_location: "E-01" },
  { sku: "KM-YAG-DGL", giris: 90, name: "Doğal Ahşap Yağı", category: "Kimyasal", unit: "litre", minimum_quantity: 15, average_cost_minor: lira(480), warehouse_location: "E-02" },
  { sku: "MT-VDA-4X40", giris: 320, name: "Ahşap Vida 4x40 mm", category: "Metal", unit: "paket", minimum_quantity: 50, average_cost_minor: lira(85), warehouse_location: "F-01" },
  { sku: "MT-MNF-15", giris: 2400, name: "Minifix Gövde 15 mm", category: "Metal", unit: "adet", minimum_quantity: 400, average_cost_minor: lira(6), warehouse_location: "F-02" },
  { sku: "CM-RAF-06", giris: 45, name: "Temperli Cam Raf 6 mm", category: "Cam", unit: "m²", minimum_quantity: 6, average_cost_minor: lira(1450), warehouse_location: "G-01" },
];

const hesaplar = [
  { code: "KS-01", name: "Merkez Kasa", type: "cash", currency: "TRY", opening_balance_minor: lira(15000), current_balance_minor: lira(48350) },
  { code: "BN-01", name: "Ziraat Bankası Ticari", type: "bank", currency: "TRY", bank_name: "Ziraat Bankası", iban: "TR33 0001 0012 3456 7890 1234 56", opening_balance_minor: lira(250000), current_balance_minor: lira(1284600) },
  { code: "BN-02", name: "Garanti BBVA Döviz", type: "bank", currency: "USD", bank_name: "Garanti BBVA", iban: "TR62 0006 2000 1234 0000 6543 21", opening_balance_minor: lira(12000), current_balance_minor: lira(18400) },
];

// Aşama zinciri. Sıra numarası, o projede hangi kayıtların açılacağını belirler.
const asamalar = ["lead", "discovery", "estimating", "offered", "contracted", "design", "procurement", "production", "installation", "acceptance", "completed"];
const derinlik = (asama) => asamalar.indexOf(asama);

const projeler = [
  { code: "CP-26001", name: "Marmara Otel Lobi ve Resepsiyon", musteri: 0, asama: "production", tur: "Otel", sehir: "İzmir", adres: "Alsancak Mah. Kıbrıs Şehitleri Cad. No:12, Konak / İzmir", bedel: 2480000, maliyet: 1710000, ilerleme: 62, baslangic: -45, bitis: 25, kapsam: "Lobi bankosu, resepsiyon arkası ceviz duvar paneli ve 18 adet standart oda gardırobu." },
  { code: "CP-26002", name: "Demir Ailesi Mutfak Yenileme", musteri: 2, asama: "design", tur: "Konut", sehir: "Ankara", adres: "Çankaya, Ankara", bedel: 425000, maliyet: 278000, ilerleme: 28, baslangic: -12, bitis: 40, kapsam: "L mutfak, ada tezgah, lake kapak ve Blum mekanizma." },
  { code: "CP-26003", name: "Vadi Konutları 24 Daire Mutfak", musteri: 3, asama: "offered", tur: "Toplu Konut", sehir: "Bursa", adres: "Nilüfer, Bursa", bedel: 9600000, maliyet: 7050000, ilerleme: 8, baslangic: 20, bitis: 150, kapsam: "24 daire için standart mutfak paketi, hakedişli ödeme." },
  { code: "CP-26004", name: "Anadolu Yapı Ofis Bölme Sistemleri", musteri: 1, asama: "installation", tur: "Ofis", sehir: "İstanbul", adres: "Maslak, Sarıyer / İstanbul", bedel: 1340000, maliyet: 920000, ilerleme: 88, baslangic: -70, bitis: 6, kapsam: "Ahşap bölme paneller, 12 kişilik toplantı masası ve akustik duvar kaplaması." },
  { code: "CP-26005", name: "Kaya Rezidans Giyinme Odası", musteri: 1, asama: "discovery", tur: "Konut", sehir: "İstanbul", adres: "Bebek, Beşiktaş / İstanbul", bedel: 0, ilerleme: 4, baslangic: 10, bitis: 70, kapsam: "Keşif randevusu alındı, ölçü bekleniyor." },
  { code: "CP-26006", name: "Marmara Otel Restoran Mobilyaları", musteri: 0, asama: "completed", tur: "Otel", sehir: "İzmir", adres: "Alsancak, Konak / İzmir", bedel: 1870000, maliyet: 1290000, ilerleme: 100, baslangic: -120, bitis: -3, kapsam: "48 kişilik restoran masa ve sandalye seti, servis üniteleri." },
  { code: "CP-26007", name: "Beyaz Ev Villa Mutfak ve Banyo", musteri: 4, asama: "procurement", tur: "Villa", sehir: "İstanbul", adres: "Beykoz, İstanbul", bedel: 1150000, maliyet: 790000, ilerleme: 41, baslangic: -30, bitis: 55, kapsam: "Villa mutfağı, iki banyo dolabı ve giyinme odası." },
  { code: "CP-26008", name: "Çınar İlkokulu Sınıf Mobilyaları", musteri: 5, asama: "contracted", tur: "Eğitim", sehir: "Ankara", adres: "Çankaya, Ankara", bedel: 680000, maliyet: 470000, ilerleme: 15, baslangic: -8, bitis: 75, kapsam: "18 derslik için sıra, dolap ve öğretmen masası." },
  { code: "CP-26009", name: "Nazar Cafe ve Restoran Ahşap İşleri", musteri: 6, asama: "acceptance", tur: "Ticari", sehir: "İzmir", adres: "Konak, İzmir", bedel: 940000, maliyet: 645000, ilerleme: 95, baslangic: -95, bitis: 2, kapsam: "Bar tezgahı, duvar rafları, sabit oturma üniteleri." },
  { code: "CP-26010", name: "Gökçe Plaza Toplantı Odaları", musteri: 7, asama: "estimating", tur: "Ofis", sehir: "İstanbul", adres: "Şişli, İstanbul", bedel: 1620000, maliyet: 1120000, ilerleme: 12, baslangic: 5, bitis: 95, kapsam: "Altı toplantı odası için masa, kredenz ve akustik panel." },
  { code: "CP-26011", name: "Selvi Apartmanı Merdiven Korkuluğu", musteri: 8, asama: "lead", tur: "Konut", sehir: "Kocaeli", adres: "İzmit, Kocaeli", bedel: 0, ilerleme: 0, baslangic: 15, bitis: 60, kapsam: "Site yönetiminden gelen talep; ahşap küpeşte ve korkuluk yenileme." },
  { code: "CP-26012", name: "Deniz Otel Spa Bölümü Ahşap Kaplama", musteri: 9, asama: "lost", tur: "Otel", sehir: "Muğla", adres: "Bodrum, Muğla", bedel: 0, ilerleme: 5, baslangic: -55, bitis: -20, kapsam: "Spa alanı için ısıl işlem görmüş ahşap kaplama. Fiyat nedeniyle kaybedildi." },
];

// --- Proje zinciri ------------------------------------------------------

// Aşama kapıları sağlanmışsa normal geçiş yapılır. Sağlanmıyorsa (örneğin
// kaybedilen projede hiç sözleşme yoktur) yönetici gerekçesiyle geçilir;
// gerçek hayatta da istisna böyle işletilir.
async function asamaIlerlet(projeId, hedef) {
  const govde = JSON.stringify({ status: hedef });
  const ilk = await istek(`projects/${projeId}/transition`, { method: "POST", body: govde });
  if (ilk.ok) return;
  const ikinci = await istek(`projects/${projeId}/transition`, {
    method: "POST",
    body: JSON.stringify({ status: hedef, override_reason: "Tanıtım veri seti hazırlanırken aşama zinciri yönetici onayıyla kuruldu." }),
  });
  if (ikinci.ok) return;
  if (ikinci.status === 409) { atlanan += 1; return; }
  hatalar.push(`transition/${hedef} · ${ikinci.status} ${ikinci.metin.slice(0, 120)}`);
}

const mahaller = ["Lobi", "Mutfak", "Toplantı Odası", "Giyinme Odası", "Banyo", "Resepsiyon", "Bar", "Derslik"];
const cizimTurleri = ["2d", "3d", "shop_drawing"];

// Ekip. Kayıtlara gerçek bir sorumlu atanabilmesi için projelerden ÖNCE kurulur;
// "Takip sorumlusu" alanının boş kalması tanıtımda kimsenin işine yaramıyor.
const ekip = [
  { full_name: "Fatma Koç", email: "fatma@ozturkahsap.com", phone: "05341112201", title: "İç Mimar", rol: "architect" },
  { full_name: "Melis Arda", email: "melis@ozturkahsap.com", phone: "05341112209", title: "Proje Satış Uzmanı", rol: "project_manager" },
  { full_name: "Zeynep Erdoğan", email: "zeynep@ozturkahsap.com", phone: "05341112203", title: "Satın Alma Sorumlusu", rol: "purchasing" },
  { full_name: "Selin Kurt", email: "selin@ozturkahsap.com", phone: "05341112205", title: "Ön Muhasebe Sorumlusu", rol: "finance" },
  { full_name: "Ahmet Yılmaz", email: "ahmet@ozturkahsap.com", phone: "05341112200", title: "Atölye Şefi", rol: "production" },
  { full_name: "Hasan Aydın", email: "hasan@ozturkahsap.com", phone: "05341112202", title: "Montaj Ustası", rol: "installation" },
  { full_name: "Derya Güneş", email: "derya@ozturkahsap.com", phone: "05341112207", title: "Kalite Kontrol Sorumlusu", rol: "hr" },
  { full_name: "Emre Polat", email: "emre@ozturkahsap.com", phone: "05341112206", title: "Montaj Elemanı", rol: "read_only" },
];

async function ekipKur() {
  const roller = await istek("roles?pageSize=50");
  const rolBul = (kod) => roller.veri?.find((rol) => rol.code === kod)?.id;
  for (const uye of ekip) {
    const rolId = rolBul(uye.rol);
    if (!rolId) continue;
    const yanit = await istek("memberships/invite", {
      method: "POST",
      body: JSON.stringify({
        full_name: uye.full_name, email: uye.email, phone: uye.phone, title: uye.title,
        role_ids: [rolId], temporary_password: "Capproje2026!Gecici",
      }),
    });
    if (yanit.ok) say("memberships");
    else if (yanit.status === 409) atlanan += 1;
    else hatalar.push(`memberships · ${uye.full_name} · ${yanit.status} ${yanit.metin.slice(0, 160)}`);
  }
  // Kimlikler listeden okunur: betik ikinci kez çalıştığında davet 409 döner ve
  // kullanıcı kimliği yanıtta gelmez.
  const uyelikler = await istek("memberships?pageSize=100");
  const kimlik = {};
  for (const uye of ekip) {
    const satir = uyelikler.veri?.find((item) => item.user_email === uye.email);
    if (!satir?.user_id) continue;
    kimlik[uye.rol] = satir.user_id;
    // Davet edilen üye "invited" durumunda kalır ve hiçbir kayda sorumlu olarak
    // atanamaz. Tanıtım verisinde ekibin işe başlamış olması gerekiyor.
    if (satir.status !== "active") {
      await istek(`memberships/${satir.id}`, { method: "PATCH", body: JSON.stringify({ status: "active" }) });
    }
  }
  return kimlik;
}

async function projeYaz({ proje, sira, musteriKayit, tedarikciKayit, personelKayit, merkezKayit, stokKayit, hesapKayit, ekipKayit }) {
  const musteri = musteriKayit[proje.musteri];
  const kayip = proje.asama === "lost";
  const d = kayip ? 3 : derinlik(proje.asama);

  const kayit = await olustur("projects", {
    code: proje.code, name: proje.name, customer_id: musteri?.id, project_type: proje.tur, city: proje.sehir,
    site_address: proje.adres, status: "lead", priority: sec(["normal", "high", "normal", "low"], sira),
    manager_user_id: ekipKayit?.project_manager, architect_user_id: ekipKayit?.architect,
    planned_start_date: gun(proje.baslangic), planned_end_date: gun(proje.bitis),
    contract_amount_minor: proje.bedel ? lira(proje.bedel) : undefined,
    estimated_cost_minor: proje.maliyet ? lira(proje.maliyet) : undefined,
    progress_percent: proje.ilerleme, description: proje.kapsam, photo_consent: sec(["internal_only", "marketing_allowed", "not_requested"], sira),
  });
  if (!kayit) return;
  const projeId = kayit.id;
  const mahal = sec(mahaller, sira);

  // Her projede iletişim günlüğü ve görev olur; bunlar aşamadan bağımsızdır.
  const projeDoluMu = await varMi("project-communications", "project_id", projeId);
  if (!projeDoluMu) await olustur("project-communications", {
    project_id: projeId, customer_id: musteri?.id, channel: sec(["phone", "email", "meeting", "whatsapp", "site"], sira),
    direction: "inbound", contact_name: musteri?.contact_name || "Müşteri yetkilisi",
    subject: `${proje.name} · ilk görüşme`, summary: "Müşteri kapsamı ve beklenen teslim tarihini aktardı.",
    decision: "Keşif randevusu planlanacak.", occurred_at: an(proje.baslangic - 2),
    next_follow_up_at: an(proje.baslangic + 3), status: "open", owner_user_id: ekipKayit?.project_manager,
  });
  if (!projeDoluMu) await olustur("project-tasks", {
    project_id: projeId, title: `${proje.name} · müşteri dosyasını hazırla`, description: "Sözleşme, çizim ve yazışmaları proje klasörüne topla.",
    department: "Proje", status: d >= 4 ? "completed" : "todo", priority: "normal", assignee_user_id: ekipKayit?.project_manager,
    planned_start: gun(proje.baslangic), planned_end: gun(proje.baslangic + 5), progress_percent: d >= 4 ? 100 : 20,
  });
  if (!projeDoluMu) await fotograf({
    ad: `${proje.code.toLowerCase()}-saha.png`, aciklama: `${proje.name} · mevcut durum fotoğrafı`,
    projeId, mahal, asama: d >= 7 ? "production" : d >= 1 ? "discovery" : "other",
    renk: sec([[150, 110, 70], [120, 130, 95], [160, 140, 110], [100, 105, 120]], sira),
  });

  // Keşif ve metraj
  let kesif = null;
  if (d >= 1) {
    kesif = await olustur("site-surveys", {
      project_id: projeId, customer_id: musteri?.id, survey_number: `KSF-${proje.code.slice(3)}`,
      survey_date: gun(proje.baslangic + 2), location: proje.adres,
      customer_contact: musteri?.contact_name || "Müşteri yetkilisi", status: "draft", surveyor_user_id: ekipKayit?.architect,
      notes: "Mevcut ölçüler alındı, elektrik ve tesisat çıkışları işaretlendi.",
    });
    if (kesif) {
      if (!(await varMi("survey-measurements", "site_survey_id", kesif.id))) for (const [indeks, olcu] of [
        { space_name: mahal, element_type: "Alt dolap", item_code: "AD-01", description: "Tezgah altı dolap grubu", width: 3600, height: 850, depth: 600, quantity: 1, unit: "metre", material: "Suntalam", finish: "Lake" },
        { space_name: mahal, element_type: "Üst dolap", item_code: "UD-01", description: "Duvar üstü dolap", width: 3600, height: 720, depth: 350, quantity: 1, unit: "metre", material: "Suntalam", finish: "Lake" },
        { space_name: mahal, element_type: "Tezgah", item_code: "TZ-01", description: "Kuvars tezgah ve damlalık", width: 3600, height: 20, depth: 600, quantity: 2.4, unit: "m²", material: "Kuvars", finish: "Mat" },
      ].entries()) {
        await olustur("survey-measurements", { site_survey_id: kesif.id, sort_order: indeks + 1, notes: "Duvar gönyesi 3 mm sapmalı.", ...olcu });
      }
      if (d >= 2) {
        await akis("site-surveys", kesif.id, "transition", { status: "in_progress" });
        await akis("site-surveys", kesif.id, "transition", { status: "completed" });
        await akis("site-surveys", kesif.id, "transition", { status: "approved" });
      }
    }
  }

  // Teklif ve kalemleri
  let teklif = null;
  if (d >= 2) {
    const araToplam = proje.bedel ? proje.bedel / 1.2 : 250000;
    teklif = await olustur("offers", {
      project_id: projeId, customer_id: musteri?.id, offer_number: `TKL-${proje.code.slice(3)}`,
      revision: d >= 4 ? 1 : 0, offer_date: gun(proje.baslangic + 8), valid_until: gun(proje.baslangic + 38),
      currency: "TRY", subtotal_minor: lira(araToplam), tax_total_minor: lira(araToplam * 0.2),
      grand_total_minor: lira(araToplam * 1.2), payment_terms: musteri?.payment_terms || "%50 peşin",
      delivery_terms: "Montaj dahil, anahtar teslim", status: d >= 3 ? "sent" : "draft",
      notes: `${proje.kapsam} Fiyatlar 30 gün geçerlidir.`,
    });
    if (teklif) {
      if (!(await varMi("offer-items", "offer_id", teklif.id))) for (const [indeks, kalem] of [
        { item_code: "AD-01", description: "Tezgah altı dolap grubu", unit: "metre", quantity: 6, oran: 0.34 },
        { item_code: "UD-01", description: "Duvar üstü dolap grubu", unit: "metre", quantity: 6, oran: 0.22 },
        { item_code: "TZ-01", description: "Kuvars tezgah ve damlalık", unit: "m²", quantity: 2.4, oran: 0.24 },
        { item_code: "HR-01", description: "Blum mekanizma ve montaj işçiliği", unit: "takım", quantity: 12, oran: 0.2 },
      ].entries()) {
        const satirToplam = araToplam * kalem.oran;
        await olustur("offer-items", {
          offer_id: teklif.id, item_code: kalem.item_code, description: kalem.description, unit: kalem.unit,
          quantity: kalem.quantity, unit_price_minor: lira(satirToplam / kalem.quantity),
          cost_price_minor: lira((satirToplam / kalem.quantity) * 0.68), tax_rate: 20,
          total_minor: lira(satirToplam), sort_order: indeks + 1,
        });
      }
      if (kayip) await akis("offers", teklif.id, "reject", { reason: "Rakip firma %12 daha düşük fiyat verdi; müşteri bütçe sınırını aşamadı." });
      else if (d >= 4) await akis("offers", teklif.id, "accept", {});
    }
  }

  // Sözleşme, hakediş, fatura ve finans
  let sozlesme = null;
  if (d >= 4) {
    sozlesme = await olustur("contracts", {
      contract_number: `SZL-${proje.code.slice(3)}`, project_id: projeId, customer_id: musteri?.id, offer_id: teklif?.id,
      payment_model: proje.bedel > 2000000 ? "progress_payment" : "advance_balance", currency: "TRY",
      contract_amount_minor: lira(proje.bedel), advance_rate: 40, advance_amount_minor: lira(proje.bedel * 0.4),
      retention_rate: 5, retention_amount_minor: lira(proje.bedel * 0.05), warranty_months: 24,
      effective_date: gun(proje.baslangic + 12), planned_start_date: gun(proje.baslangic + 15), planned_end_date: gun(proje.bitis),
      signed_by_customer: musteri?.contact_name, signed_by_company: "Mehmet Öztürk", photo_consent: "internal_only",
      status: "draft", notes: "Montaj ve nakliye fiyata dahildir.",
    });
    if (sozlesme) {
      await akis("contracts", sozlesme.id, "transition", { status: "pending_signature" });
      await akis("contracts", sozlesme.id, "transition", { status: "signed" });
      if (d >= 5) await akis("contracts", sozlesme.id, "transition", { status: "active" });
    }

    const avans = await olustur("financial-transactions", {
      transaction_number: `FN-${proje.code.slice(3)}-01`, project_id: projeId, account_id: hesapKayit[1]?.id,
      customer_id: musteri?.id, type: "income", category: "Sözleşme avansı", transaction_date: gun(proje.baslangic + 14),
      amount_minor: lira(proje.bedel * 0.4), currency: "TRY", official: 1, payment_method: "havale",
      reference: `SZL-${proje.code.slice(3)}`, description: "%40 sözleşme avansı tahsil edildi.", status: "pending",
    });
    if (avans) await akis("financial-transactions", avans.id, "approve", {});

    // Proje içi (gayri resmi) maliyet takibi. Resmi defterle karışmaz; "Proje
    // Finansları" ekranı öntanımlı olarak bu tarafı gösterir.
    for (const [indeks, hareket] of [
      { type: "cost_forecast", category: "Malzeme", description: "Levha, kenar bandı ve mekanizma tahmini", oran: 0.34 },
      { type: "cost_forecast", category: "İşçilik", description: "Atölye ve montaj işçilik tahmini", oran: 0.21 },
      { type: "expense", category: "Nakliye", description: "Şantiye sevkiyatı ve hamaliye", oran: 0.03 },
    ].entries()) {
      await olustur("financial-transactions", {
        transaction_number: `FN-${proje.code.slice(3)}-PI${indeks + 1}`, project_id: projeId,
        type: hareket.type, category: hareket.category, transaction_date: gun(proje.baslangic + 20 + indeks * 4),
        amount_minor: lira(Math.round((proje.maliyet || proje.bedel || 100000) * hareket.oran)),
        currency: "TRY", official: 0, description: hareket.description, status: "planned",
      });
    }

    const fatura = await olustur("invoices", {
      invoice_number: `FTR-${proje.code.slice(3)}-01`, direction: "sales", project_id: projeId, customer_id: musteri?.id,
      issue_date: gun(proje.baslangic + 14), due_date: gun(proje.baslangic + 44), currency: "TRY",
      subtotal_minor: lira(proje.bedel * 0.4 / 1.2), tax_total_minor: lira((proje.bedel * 0.4 / 1.2) * 0.2),
      grand_total_minor: lira(proje.bedel * 0.4), paid_total_minor: d >= 9 ? lira(proje.bedel * 0.4) : 0,
      official: 1, status: d >= 9 ? "paid" : "open", notes: "Avans faturası",
    });

    if (sozlesme) {
      const hakedis = await olustur("progress-payments", {
        progress_number: `HKD-${proje.code.slice(3)}-01`, project_id: projeId, contract_id: sozlesme.id,
        period_start: gun(proje.baslangic + 15), period_end: gun(proje.baslangic + 45), currency: "TRY",
        previous_work_minor: 0, current_work_minor: lira(proje.bedel * 0.35),
        cumulative_work_minor: lira(proje.bedel * 0.35), retention_minor: lira(proje.bedel * 0.35 * 0.05),
        net_payable_minor: lira(proje.bedel * 0.35 * 0.95), status: "draft",
        notes: "İlk dönem imalat hakedişi.",
      });
      if (hakedis && d >= 6) {
        await akis("progress-payments", hakedis.id, "submit", {});
        if (d >= 7) await akis("progress-payments", hakedis.id, "approve", {});
        if (d >= 9 && fatura) await akis("progress-payments", hakedis.id, "invoice", { invoice_id: fatura.id });
      }
    }

    // Ekip ve kapasite planı
    if (!(await varMi("resource-assignments", "project_id", projeId))) for (const [indeks, kaynak] of [
      { resource_type: "employee", resource_name: `${personelKayit[0]?.first_name} ${personelKayit[0]?.last_name}`, employee_id: personelKayit[0]?.id, role: "Atölye sorumlusu", allocation_percent: 45 },
      { resource_type: "team", resource_name: "Montaj Ekibi A", role: "Saha montajı", allocation_percent: 60 },
      { resource_type: "work_center", resource_name: "CNC İşleme", role: "Panel işleme", allocation_percent: 35 },
    ].entries()) {
      await olustur("resource-assignments", {
        project_id: projeId, planned_start: gun(proje.baslangic + 15 + indeks * 5), planned_end: gun(proje.baslangic + 35 + indeks * 5),
        status: d >= 8 ? "completed" : "active", notes: "Haftalık plan toplantısında güncellenir.", ...kaynak,
      });
    }
  }

  // Toplantı ve aksiyonlar
  if (d >= 4 && !(await varMi("project-meetings", "project_id", projeId))) {
    const toplanti = await olustur("project-meetings", {
      project_id: projeId, meeting_type: sec(["weekly_project", "coordination", "site", "weekly_production"], sira),
      meeting_date: gun(proje.baslangic + 18), title: `${proje.name} · başlangıç toplantısı`, facilitator_user_id: ekipKayit?.project_manager,
      attendees_json: JSON.stringify(["Mehmet Öztürk", "Fatma Koç", musteri?.contact_name || "Müşteri"]),
      summary: "Kapsam, teslim takvimi ve malzeme seçimleri karara bağlandı.", status: "draft",
    });
    if (toplanti) {
      await akis("project-meetings", toplanti.id, "transition", { status: "published" });
      if (!(await varMi("meeting-actions", "meeting_id", toplanti.id))) for (const aksiyon of [
        { title: "Lake renk kartelasını müşteriye gönder", priority: "high", status: d >= 5 ? "completed" : "open" },
        { title: "Tezgah ölçüsünü yerinde teyit et", priority: "normal", status: d >= 6 ? "completed" : "open" },
      ]) {
        await olustur("meeting-actions", {
          meeting_id: toplanti.id, project_id: projeId, description: "Toplantıda karara bağlandı.",
          due_date: gun(proje.baslangic + 25), owner_user_id: ekipKayit?.architect, ...aksiyon,
        });
      }
    }
  }

  // Tasarım revizyonları ve iş kalemleri
  const isKalemleri = [];
  if (d >= 5) {
    const revizyonVar = await varMi("design-revisions", "project_id", projeId);
    for (const [indeks, tur] of (revizyonVar ? [] : cizimTurleri.entries())) {
      const revizyon = await olustur("design-revisions", {
        project_id: projeId, revision_number: indeks + 1, drawing_type: tur,
        title: `${proje.name} · ${tur === "2d" ? "yerleşim planı" : tur === "3d" ? "görsel sunum" : "imalat çizimi"}`,
        status: "draft", notes: "Müşteri onayına sunulacak sürüm.",
      });
      if (revizyon && d >= 6) {
        await akis("design-revisions", revizyon.id, "submit", {});
        await akis("design-revisions", revizyon.id, "approve", {});
      }
    }

    const mevcutKalemler = await istek(`work-items?project_id=${projeId}&pageSize=20`);
    if (mevcutKalemler.ok && mevcutKalemler.veri?.length) isKalemleri.push(...mevcutKalemler.veri);
    else for (const [indeks, kalem] of [
      { space_name: mahal, product_type: "Alt dolap", item_code: "AD-01", description: "Tezgah altı dolap grubu", width: 3600, height: 850, depth: 600, unit: "metre", quantity: 6, material: "Suntalam", finish: "Lake beyaz mat", birim: 34000 },
      { space_name: mahal, product_type: "Üst dolap", item_code: "UD-01", description: "Duvar üstü dolap grubu", width: 3600, height: 720, depth: 350, unit: "metre", quantity: 6, material: "Suntalam", finish: "Lake beyaz mat", birim: 22000 },
      { space_name: mahal, product_type: "Tezgah", item_code: "TZ-01", description: "Kuvars tezgah ve damlalık", width: 3600, height: 20, depth: 600, unit: "m²", quantity: 2.4, material: "Kuvars", finish: "Mat", birim: 48000 },
    ].entries()) {
      const { birim, ...alanlar } = kalem;
      const isKalemi = await olustur("work-items", {
        project_id: projeId, production_type: indeks === 2 ? "external" : "internal",
        supplier_id: indeks === 2 ? tedarikciKayit[2]?.id : undefined,
        unit_cost_minor: lira(birim * 0.68), unit_price_minor: lira(birim),
        status: d >= 7 ? "production" : "approved", ...alanlar,
      });
      if (isKalemi) {
        isKalemleri.push(isKalemi);
        // Üretime salım, onaylı bir revizyon ister.
        if (d >= 6) await akis("work-items", isKalemi.id, "approve-revision", {});
        if (!(await varMi("bom-lines", "work_item_id", isKalemi.id))) for (const [sayi, recete] of [
          { inventory_item_id: stokKayit[0]?.id, item_code: "LV-SUN-18-BYZ", description: "18 mm suntalam", quantity_per_unit: 1.4, unit: "adet", scrap_rate: 8 },
          { inventory_item_id: stokKayit[3]?.id, item_code: "BN-PVC-22-BYZ", description: "PVC kenar bandı", quantity_per_unit: 12, unit: "metre", scrap_rate: 5 },
          { inventory_item_id: stokKayit[5]?.id, item_code: "HR-BLM-CLIP", description: "Menteşe", quantity_per_unit: 4, unit: "adet", scrap_rate: 0 },
        ].entries()) {
          await olustur("bom-lines", { work_item_id: isKalemi.id, sort_order: sayi + 1, notes: "Fire payı dahil", ...recete });
        }
      }
    }
  }

  // Malzeme planı, satın alma, teklif karşılaştırma ve stok
  if (d >= 6) {
    const ihtiyac = (await varMi("material-requirements", "project_id", projeId)) ? null : await olustur("material-requirements", {
      project_id: projeId, work_item_id: isKalemleri[0]?.id, inventory_item_id: stokKayit[0]?.id,
      preferred_supplier_id: tedarikciKayit[0]?.id, item_code: "LV-SUN-18-BYZ", description: "18 mm suntalam levha",
      required_quantity: 42, unit: "adet", needed_by: gun(proje.baslangic + 40), status: "draft",
      notes: "Reçeteden fire payıyla hesaplandı.",
    });
    if (ihtiyac) await akis("material-requirements", ihtiyac.id, "reserve", {});

    const talep = await olustur("purchase-requests", {
      request_number: `STA-${proje.code.slice(3)}-01`, project_id: projeId, needed_by: gun(proje.baslangic + 38),
      priority: "high", description: "18 mm ceviz kaplama MDF levha", quantity: 40, unit: "adet",
      estimated_amount_minor: lira(74000), currency: "TRY", preferred_supplier_id: tedarikciKayit[0]?.id,
      status: "pending", notes: "Damar yönü tek parti olmalı.",
    });
    if (talep) {
      const teklifler = [
        { supplier_id: tedarikciKayit[0]?.id, quotation_number: `TT-${proje.code.slice(3)}-A`, unit: "adet", quantity: 40, unit_price_minor: lira(1850), total_minor: lira(74000), lead_time_days: 7, payment_terms: "45 gün", quality_note: "Bayi stoğunda mevcut." },
        { supplier_id: tedarikciKayit[4]?.id, quotation_number: `TT-${proje.code.slice(3)}-B`, unit: "adet", quantity: 40, unit_price_minor: lira(1790), total_minor: lira(71600), lead_time_days: 14, payment_terms: "Peşin", quality_note: "Farklı parti, damar uyumu riskli." },
        { supplier_id: tedarikciKayit[5]?.id, quotation_number: `TT-${proje.code.slice(3)}-C`, unit: "adet", quantity: 40, unit_price_minor: lira(1920), total_minor: lira(76800), lead_time_days: 4, payment_terms: "30 gün", quality_note: "En kısa termin." },
      ];
      const teklifKayit = [];
      for (const satir of teklifler) {
        teklifKayit.push(await olustur("supplier-quotations", {
          purchase_request_id: talep.id, quotation_date: gun(proje.baslangic + 30),
          valid_until: gun(proje.baslangic + 60), currency: "TRY", status: "received", ...satir,
        }));
      }
      if (teklifKayit[0]) {
        await akis("supplier-quotations", teklifKayit[0].id, "select", { reason: "Damar uyumu ve termin nedeniyle en düşük teklif yerine bayi tercih edildi." });
      }
      await akis("purchase-requests", talep.id, "approve", {});
      const siparis = await akis("purchase-requests", talep.id, "create-order", { supplier_id: tedarikciKayit[0]?.id });
      if (siparis?.id && d >= 7) {
        await akis("purchase-orders", siparis.id, "receive", { inventory_item_id: stokKayit[1]?.id, quantity: 40 });
      }
    }

    // Onay bekleyen ikinci bir talep: ana sayfadaki "satın alma onayı" kutusu ve
    // listedeki onay düğmesi karşılıksız kalmasın.
    await olustur("purchase-requests", {
      request_number: `STA-${proje.code.slice(3)}-02`, project_id: projeId, needed_by: gun(proje.baslangic + 52),
      priority: "normal", description: "Blum Legrabox çekmece rayı 500 mm", quantity: 36, unit: "takım",
      estimated_amount_minor: lira(8640), currency: "TRY", preferred_supplier_id: tedarikciKayit[1]?.id,
      status: "pending", notes: "Çekmece adedi tasarım onayından sonra kesinleşti.",
    });

    const hareket = await olustur("stock-movements", {
      movement_number: `STK-${proje.code.slice(3)}-01`, inventory_item_id: stokKayit[0]?.id, project_id: projeId,
      movement_type: "project_issue", movement_date: gun(proje.baslangic + 42), quantity: 24,
      unit_cost_minor: lira(890), total_cost_minor: lira(21360), status: "draft",
      reference: proje.code, notes: "Üretim için depodan çıkış.",
    });
    if (hareket) await akis("stock-movements", hareket.id, "post", {});
  }

  // Üretim, operasyonlar, sorunlar ve kalite
  if (d >= 7) {
    for (const [indeks, isKalemi] of isKalemleri.slice(0, 2).entries()) {
      const emir = await olustur("production-orders", {
        order_number: `URT-${proje.code.slice(3)}-0${indeks + 1}`, project_id: projeId, work_item_id: isKalemi.id,
        production_type: "internal", trade_type: "internal", workshop: sec(["Atölye 1", "Atölye 2"], indeks),
        assigned_team: sec(["Panel ekibi", "Montaj ekibi"], indeks),
        planned_start: gun(proje.baslangic + 45 + indeks * 6), planned_end: gun(proje.baslangic + 58 + indeks * 6),
        quantity: 6, status: "planned", instructions: "Damar yönü kontrol edilecek, kenar bandı 22 mm.",
      });
      if (!emir) continue;
      await akis("production-orders", emir.id, "release", {});
      const operasyonlar = [
        { sequence: 1, name: "Panel ebatlama", work_center_id: merkezKayit[0]?.id, planned_minutes: 180 },
        { sequence: 2, name: "CNC delik ve kanal", work_center_id: merkezKayit[1]?.id, planned_minutes: 240 },
        { sequence: 3, name: "Kenar bantlama", work_center_id: merkezKayit[2]?.id, planned_minutes: 150 },
        { sequence: 4, name: "Gövde montajı", work_center_id: merkezKayit[3]?.id, planned_minutes: 300 },
        { sequence: 5, name: "Lake ve cila", work_center_id: merkezKayit[4]?.id, planned_minutes: 420 },
      ];
      const operasyonKayit = [];
      const operasyonVar = await varMi("production-operations", "production_order_id", emir.id);
      for (const operasyon of operasyonlar) {
        if (operasyonVar) { operasyonKayit.push(null); continue; }
        operasyonKayit.push(await olustur("production-operations", {
          production_order_id: emir.id, planned_start: gun(proje.baslangic + 45 + operasyon.sequence),
          planned_end: gun(proje.baslangic + 46 + operasyon.sequence), status: "pending",
          description: "Standart imalat adımı.", assignee_user_id: ekipKayit?.production, ...operasyon,
        }));
      }
      // İlk emir üretimde ilerlemiş, ikincisi yeni başlamış olsun.
      const tamamlanan = indeks === 0 ? (d >= 8 ? 5 : 3) : 1;
      for (const [sayi, operasyon] of operasyonKayit.entries()) {
        if (!operasyon || sayi >= tamamlanan) continue;
        await akis("production-operations", operasyon.id, "transition", { status: "in_progress" });
        await akis("production-operations", operasyon.id, "transition", { status: "completed", actual_minutes: operasyonlar[sayi].planned_minutes + sec([-20, 15, 0, 35], sayi) });
      }
      if (indeks === 0 && !(await varMi("production-issues", "production_order_id", emir.id))) {
        const sorun = await olustur("production-issues", {
          production_order_id: emir.id, project_id: projeId, work_item_id: isKalemi.id,
          issue_type: sec(["material", "quality", "machine", "drawing"], sira), severity: "normal",
          description: "Kaplama levhanın iki parçasında damar yönü uyuşmadı; iki gövde yeniden kesildi.",
          root_cause: "Farklı parti levha kullanıldı.", status: "open",
        });
        if (sorun && d >= 8) {
          await akis("production-issues", sorun.id, "resolve", { rework_quantity: 2, scrap_quantity: 1, resolution: "Aynı partiden levha getirtildi, iki gövde yeniden üretildi." });
        }
      }
      if (d >= 8) {
        await akis("production-orders", emir.id, "transition", { status: "in_progress" });
        await akis("production-orders", emir.id, "transition", { status: "quality_control" });
        await akis("production-orders", emir.id, "transition", { status: "completed", completed_quantity: 6 });
      } else if (indeks === 0) {
        await akis("production-orders", emir.id, "transition", { status: "in_progress" });
      }

      const kontrol = await olustur("quality-inspections", {
        inspection_number: `KLT-${proje.code.slice(3)}-0${indeks + 1}`, project_id: projeId, work_item_id: isKalemi.id,
        production_order_id: emir.id, inspection_type: indeks === 0 ? "in_process" : "final",
        inspection_date: gun(proje.baslangic + 60 + indeks * 4), result: d >= 8 ? "pass" : "pending", inspector_user_id: ekipKayit?.hr,
        checklist_json: JSON.stringify(["Ölçü toleransı", "Kenar bandı yapışması", "Yüzey kusuru", "Mekanizma çalışması"]),
        defect_notes: indeks === 0 ? "Bir kapakta hafif portakallanma görüldü." : null,
        corrective_action: indeks === 0 ? "Cila tekrarlandı." : null,
        corrective_due_date: gun(proje.baslangic + 64), status: "draft",
      });
      if (kontrol && d >= 8) {
        await akis("quality-inspections", kontrol.id, "transition", { status: "completed" });
        await akis("quality-inspections", kontrol.id, "transition", { status: "closed" });
      }
    }
    if (!projeDoluMu) await fotograf({
      ad: `${proje.code.toLowerCase()}-uretim.png`, aciklama: `${proje.name} · atölyede gövde montajı`,
      projeId, mahal, asama: "production", renk: [120, 95, 62],
    });
  }

  // Montaj
  let montaj = null;
  if (d >= 8) {
    montaj = await olustur("installations", {
      installation_number: `MNT-${proje.code.slice(3)}`, project_id: projeId, location: proje.adres,
      team_json: JSON.stringify(["Hasan Aydın", "Emre Polat"]),
      planned_start: gun(proje.bitis - 14), planned_end: gun(proje.bitis - 2),
      progress_percent: d >= 9 ? 100 : 65, team_lead_user_id: ekipKayit?.installation,
      acceptance_contact: musteri?.contact_name || "Müşteri yetkilisi",
      acceptance_date: d >= 9 ? gun(proje.bitis - 2) : undefined,
      issue_notes: d >= 9 ? "Teslimde iki küçük eksik tespit edildi." : "Elektrik altyapısı bekleniyor.",
    });
    if (!projeDoluMu) await fotograf({
      ad: `${proje.code.toLowerCase()}-montaj.png`, aciklama: `${proje.name} · yerinde montaj`,
      projeId, mahal, asama: "installation", renk: [138, 118, 88],
    });
  }

  // Teslim ve eksikler
  if (d >= 9) {
    const teslim = await olustur("handovers", {
      handover_number: `TSL-${proje.code.slice(3)}`, project_id: projeId, installation_id: montaj?.id,
      handover_date: gun(proje.bitis - 1), customer_contact: musteri?.contact_name || "Müşteri yetkilisi",
      satisfaction_score: d >= 10 ? 5 : 4, status: "draft",
      acceptance_notes: "Kullanım ve bakım bilgileri müşteriye anlatıldı.",
    });
    if (teslim) {
      const eksikler = [
        { title: "Ada tezgah altı aydınlatma kablosu gizlenecek", severity: "normal", description: "Kablo kanalı takılacak." },
        { title: "Sol kapak hizası ayarlanacak", severity: "low", description: "Menteşe ayarı yapılacak." },
      ];
      if (!(await varMi("handover-punch-items", "handover_id", teslim.id))) for (const eksik of eksikler) {
        await olustur("handover-punch-items", {
          handover_id: teslim.id, due_date: gun(proje.bitis + 5), responsible_user_id: ekipKayit?.installation,
          status: d >= 10 ? "accepted" : "open", ...eksik,
        });
      }
      await akis("handovers", teslim.id, "transition", { status: "punch_open" });
      if (d >= 10) {
        const imza = teslim.customer_signature_file_id ? { id: teslim.customer_signature_file_id } : await fotograf({
          ad: `${proje.code.toLowerCase()}-teslim-tutanagi.png`, aciklama: "Müşteri imzalı teslim tutanağı",
          projeId, mahal: null, asama: "handover", renk: [214, 208, 196], tur: "handovers", kayitId: teslim.id,
        });
        await akis("handovers", teslim.id, "transition", { status: "accepted", customer_signature_file_id: imza?.id, satisfaction_score: 5 });
        await akis("handovers", teslim.id, "transition", { status: "closed" });
      }
    }
  }

  // Sözleşme en sonda kapanır: kapanmış sözleşmeye hakediş bağlanamıyor.
  if (d >= 10 && sozlesme) await akis("contracts", sozlesme.id, "transition", { status: "completed" });

  // Aşama zincirini yürüt
  const hedefler = kayip ? ["discovery", "estimating", "offered", "lost"] : asamalar.slice(1, d + 1);
  for (const hedef of hedefler) await asamaIlerlet(projeId, hedef);
}

// --- Firma geneli -------------------------------------------------------

// Depo girişleri projelerden önce yazılır: rezervasyon ve üretime çıkış,
// stokta fiilen mal olmasını gerektiriyor.
async function depoGirisleri(stokKayit) {
  for (const [indeks, stok] of stokKayit.entries()) {
    if (!stok) continue;
    const adet = stokKartlari[indeks]?.giris || 100;
    const giris = await olustur("stock-movements", {
      movement_number: `STK-GRS-${String(indeks + 1).padStart(3, "0")}`, inventory_item_id: stok.id,
      movement_type: "receipt", movement_date: gun(-30 + indeks), quantity: adet,
      unit_cost_minor: stok.average_cost_minor, total_cost_minor: (stok.average_cost_minor || 0) * adet,
      status: "draft", reference: `İrsaliye ${9000 + indeks}`, notes: "Dönem başı mal girişi.",
    });
    if (giris) await akis("stock-movements", giris.id, "post", {});
  }
}


async function firmaGeneli({ personelKayit, stokKayit, tedarikciKayit, ekipKayit }) {
  // Puantaj: son on iş günü, birkaç personel için.
  for (const personel of personelKayit.slice(0, 6)) {
    if (!personel) continue;
    if (await varMi("attendance", "employee_id", personel.id)) continue;
    for (let fark = 1; fark <= 10; fark += 1) {
      const tarih = new Date(Date.now() - fark * 86400000);
      if ([0, 6].includes(tarih.getDay())) continue;
      const mesai = fark % 4 === 0 ? 90 : 0;
      await olustur("attendance", {
        employee_id: personel.id, work_date: tarih.toISOString().slice(0, 10),
        check_in: "08:00", check_out: mesai ? "18:30" : "17:00",
        regular_minutes: 480, overtime_minutes: mesai,
        location: sec(["Atölye", "Atölye", "Şantiye"], fark), source: "manual", status: "present",
      });
    }
  }

  // İzinler
  if (!(await varMi("leaves", "employee_id", personelKayit[2]?.id))) for (const [indeks, izin] of [
    { personel: 2, leave_type: "annual", start_date: gun(6), end_date: gun(10), day_count: 5, reason: "Yıllık izin planı" },
    { personel: 4, leave_type: "excuse", start_date: gun(-3), end_date: gun(-3), day_count: 1, reason: "Sağlık raporu" },
    { personel: 6, leave_type: "annual", start_date: gun(20), end_date: gun(27), day_count: 6, reason: "Ailevi seyahat" },
    { personel: 8, leave_type: "unpaid", start_date: gun(-14), end_date: gun(-12), day_count: 3, reason: "Ücretsiz izin talebi" },
  ].entries()) {
    const { personel, ...alanlar } = izin;
    const kayit = await olustur("leaves", { employee_id: personelKayit[personel]?.id, status: "pending", ...alanlar });
    if (kayit && indeks === 1) await akis("leaves", kayit.id, "approve", {});
    if (kayit && indeks === 3) await akis("leaves", kayit.id, "reject", { reason: "Aynı dönemde iki montaj işi planlı." });
  }

  // Bordro hazırlık: içinde bulunulan ve önceki dönem.
  const donem = (fark) => {
    const tarih = new Date();
    tarih.setMonth(tarih.getMonth() + fark);
    return tarih.toISOString().slice(0, 7);
  };
  for (const personel of personelKayit) {
    if (!personel) continue;
    for (const fark of [-1, 0]) {
      const taban = Number(personel.salary_amount_minor || lira(45000));
      await olustur("payroll-inputs", {
        employee_id: personel.id, period: donem(fark), base_salary_minor: taban,
        overtime_amount_minor: lira(1200 + (taban % 7) * 100), bonus_amount_minor: fark === 0 ? 0 : lira(2500),
        allowance_amount_minor: lira(1800), deduction_amount_minor: lira(650), advance_amount_minor: fark === 0 ? lira(3000) : 0,
        net_preview_minor: Math.round(taban * 0.78), currency: "TRY", status: fark === 0 ? "draft" : "approved",
        notes: fark === 0 ? "Dönem devam ediyor." : "Muhasebeye aktarıldı.",
      });
    }
  }

  // Kasa ve banka hareketleri: gider tarafı da dolsun.
  for (const [indeks, gider] of [
    { category: "Malzeme", description: "Levha alımı", amount: 187000, supplier: 0 },
    { category: "Hırdavat", description: "Blum mekanizma alımı", amount: 64500, supplier: 1 },
    { category: "Kira", description: "Atölye kirası", amount: 95000, supplier: null },
    { category: "Elektrik", description: "Atölye elektrik faturası", amount: 28400, supplier: null },
    { category: "Nakliye", description: "Şantiye sevkiyatı", amount: 19800, supplier: null },
    { category: "Dış imalat", description: "Cam ve ayna imalatı", amount: 42300, supplier: 3 },
  ].entries()) {
    const kayit = await olustur("financial-transactions", {
      transaction_number: `FN-GDR-${String(indeks + 1).padStart(3, "0")}`, type: "expense",
      category: gider.category, transaction_date: gun(-25 + indeks * 3), amount_minor: lira(gider.amount),
      currency: "TRY", official: 1, payment_method: sec(["havale", "nakit", "kredi kartı"], indeks),
      supplier_id: gider.supplier === null ? undefined : tedarikciKayit[gider.supplier]?.id,
      description: gider.description, status: "pending",
    });
    if (kayit && indeks < 4) await akis("financial-transactions", kayit.id, "approve", {});
  }

  // Tedarikçi faturaları
  for (const [indeks, fatura] of [
    { supplier: 0, tutar: 187000, aciklama: "Levha alım faturası" },
    { supplier: 1, tutar: 64500, aciklama: "Hırdavat alım faturası" },
    { supplier: 3, tutar: 42300, aciklama: "Cam ve ayna imalat faturası" },
  ].entries()) {
    await olustur("invoices", {
      invoice_number: `ALS-${String(indeks + 1).padStart(4, "0")}`, direction: "purchase",
      supplier_id: tedarikciKayit[fatura.supplier]?.id, issue_date: gun(-22 + indeks * 4), due_date: gun(8 + indeks * 4),
      currency: "TRY", subtotal_minor: lira(fatura.tutar / 1.2), tax_total_minor: lira((fatura.tutar / 1.2) * 0.2),
      grand_total_minor: lira(fatura.tutar), paid_total_minor: indeks === 0 ? lira(fatura.tutar) : 0,
      official: 1, status: indeks === 0 ? "paid" : "open", notes: fatura.aciklama,
    });
  }

  // Yedek kaydı: Yönetim ekranı boş kalmasın.
  const yedek = await fetch(`${BASE.replace("/api/v1", "")}/api/admin/backups`, { method: "POST", headers });
  if (yedek.ok) say("backups");
}

// --- Çalıştırma ---------------------------------------------------------

// --- Ekip sohbeti ---------------------------------------------------------
// Tanıtımda sohbetin tek ağızdan yazılmış olması işe yaramıyor; mesajların
// gerçekten farklı kişilerden gelmesi için ekip üyelerinin oturumu açılır.
// Davet şifresi geçicidir ve değiştirilmeden yazma yapılamaz, o yüzden önce
// kalıcıya çevrilir. Kalıcı şifre README'de yazılıdır: tanıtımı yapan kişi
// istediği rolle girip ekranların rolden role nasıl değiştiğini gösterebilir.
const DEMO_SIFRE = "Capproje2026!Demo";
const GECICI_SIFRE = "Capproje2026!Gecici";

async function uyeOturumu(telefon) {
  for (const sifre of [DEMO_SIFRE, GECICI_SIFRE]) {
    const giris = await fetch(`${BASE}/auth/password/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: telefon, password: sifre }),
    });
    if (!giris.ok) continue;
    const veri = (await giris.json())?.data;
    const jeton = veri?.session_token;
    if (!jeton) continue;
    if (sifre !== DEMO_SIFRE) {
      await fetch(`${BASE}/auth/password/change`, {
        method: "POST", headers: { "content-type": "application/json", "x-session-token": jeton },
        body: JSON.stringify({ current_password: sifre, new_password: DEMO_SIFRE }),
      });
    }
    return jeton;
  }
  return null;
}

// Kanalın kendi numarası yok; ikinci çalıştırmada çoğalmaması için önce aranır.
async function kanalAc(govde) {
  const mevcut = await bul("chat-channels", govde.name);
  if (mevcut) return mevcut;
  const yanit = await istek("chat-channels", { method: "POST", body: JSON.stringify(govde) });
  if (yanit.ok) { say("chat-channels"); return yanit.veri; }
  hatalar.push(`chat-channels · ${govde.name} · ${yanit.status} ${yanit.metin.slice(0, 160)}`);
  return null;
}

async function mesajYaz(jeton, kanalId, govde) {
  const yanit = await fetch(`${BASE}/chat-messages`, {
    method: "POST",
    headers: jeton
      ? { "content-type": "application/json", "x-session-token": jeton }
      : { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ channel_id: kanalId, ...govde }),
  });
  if (yanit.ok) { say("chat-messages"); return; }
  hatalar.push(`chat-messages · ${yanit.status} ${(await yanit.text()).slice(0, 160)}`);
}

async function sohbetKur() {
  const jetonlar = {};
  for (const uye of ekip) jetonlar[uye.rol] = await uyeOturumu(uye.phone);

  // Mesajlara iliştirilecek gerçek kayıtlar. Tanıtımı yapan kişi sohbetten
  // kaydın üzerine tıklayıp oradan devam edebilsin diye.
  const projeler = (await istek("projects?pageSize=50")).veri || [];
  const projeBul = (kod) => projeler.find((satir) => satir.code === kod);
  const ilk = async (kaynak, projeId) => ((await istek(`${kaynak}?pageSize=5${projeId ? `&project_id=${projeId}` : ""}`)).veri || [])[0];

  // Proje kanalındaki mesajlar o projenin kendi kayıtlarını göstermeli; başka
  // bir projenin dosyasını iliştirmek tanıtımda kafa karıştırır. Teslim ve
  // kalite kaydı ancak ilerlemiş bir projede bulunur, o yüzden kanal kabul
  // aşamasındaki proje üzerine kuruluyor.
  const kanalProje = projeBul("CP-26009") || projeler.find((satir) => satir.status === "acceptance") || projeler[0];
  const talep = await ilk("purchase-requests");
  const emir = await ilk("production-orders");
  const kontrol = await ilk("quality-inspections");
  const hakedis = await ilk("progress-payments");
  const teslim = await ilk("handovers", kanalProje?.id);
  const belge = await ilk("files", kanalProje?.id);

  const bag = (modul, kayit, etiket) => kayit?.id ? { link_module: modul, link_record_id: kayit.id, link_label: etiket } : {};

  const kanallar = [
    {
      govde: { name: "Genel", kind: "team", topic: "Tüm ekip · günlük koordinasyon" },
      mesajlar: [
        { rol: "project_manager", body: "Günaydın. Bu hafta üç projede montaj var, sabah 9'da kısa bir tur yapalım." },
        { rol: "purchasing", body: "Lake levha siparişi bugün çıkıyor. Onaya düşen talep bu:", ...bag("purchases", talep, talep?.request_number) },
        { rol: "finance", body: "Hakediş hazırlandı, müşteriye bu hafta gönderiyorum.", ...bag("progressPayments", hakedis, hakedis?.progress_number) },
        { rol: "project_manager", body: "Eline sağlık. Tahsilat girince finans ekranından işleyelim." },
      ],
    },
    {
      govde: { name: "Üretim & Montaj", kind: "team", topic: "Atölye ve saha ekibi" },
      mesajlar: [
        { rol: "production", body: "Kesim bitti, kenar bantlamaya geçiyoruz. İş emri burada:", ...bag("production", emir, emir?.order_number) },
        { rol: "hr", body: "Final kontrolde iki kapakta portakallanma vardı, cila tekrarlandı. Rapor ekte:", ...bag("qualityInspections", kontrol, kontrol?.inspection_number) },
        { rol: "installation", body: "Sahada elektrik altyapısı hazır değil, montajı iki gün kaydırmamız gerekebilir." },
        { rol: "production", body: "Bizde sıkıntı yok, imalat hazır bekliyor. Tarihi siz verin." },
        { rol: "project_manager", body: "Müşteriyle konuştum, perşembe sabahına aldık. Ekip planını güncelledim." },
      ],
    },
    {
      govde: { name: `${kanalProje?.code || "Proje"} · ${kanalProje?.name || "Proje kanalı"}`, kind: "project", project_id: kanalProje?.id, topic: "Projeye özel yazışma" },
      mesajlar: [
        { rol: "architect", body: "Revize çizimi yükledim, mutfak adası 12 cm kısaldı. Üretim buna göre başlasın.", ...bag("files", belge, belge?.file_name) },
        { rol: "production", body: "Gördüm, reçeteyi güncelliyorum. Kesim listesi bugün çıkar." },
        { rol: "installation", body: "Teslimde iki eksik kalmıştı, ikisi de kapandı.", ...bag("handovers", teslim, teslim?.handover_number) },
        { rol: "project_manager", body: "Teşekkürler. Müşteri memnuniyet puanı 5 geldi, projeyi kapatıyorum." },
      ],
    },
    {
      govde: { name: "Duyurular", kind: "announcement", topic: "Yönetimden ekibe" },
      mesajlar: [
        { rol: "project_manager", body: "Cuma günü atölyede yıllık bakım var, 14:00'ten sonra makineler durdurulacak." },
        { rol: "hr", body: "İzin taleplerinizi bu ay 25'ine kadar sisteme girmenizi rica ederim." },
      ],
    },
  ];

  for (const kanal of kanallar) {
    const kayit = await kanalAc(kanal.govde);
    if (!kayit) continue;
    // Kanalda mesaj varsa ikinci çalıştırmada üzerine yazılmaz.
    if (await varMi("chat-messages", "channel_id", kayit.id)) { atlanan += 1; continue; }
    for (const mesaj of kanal.mesajlar) {
      const { rol, ...govde } = mesaj;
      await mesajYaz(jetonlar[rol], kayit.id, govde);
    }
  }
}

async function main() {
  const oturum = await istek("session");
  if (!oturum.ok) {
    console.error(`Oturum açılamadı (${oturum.status}). CAPPROJE_TOKEN geçerli mi?`);
    process.exit(1);
  }
  console.log(`Firma: ${oturum.veri?.tenant?.name || "?"}\nAdres: ${BASE}\n`);

  console.log("Tanımlar yazılıyor…");
  const musteriKayit = [];
  for (const kayit of musteriler) musteriKayit.push(await olustur("customers", { ...kayit, status: "active" }));
  const tedarikciKayit = [];
  for (const kayit of tedarikciler) tedarikciKayit.push(await olustur("suppliers", { ...kayit, status: "active" }));
  const personelKayit = [];
  for (const kayit of personeller) personelKayit.push(await olustur("employees", { ...kayit, status: "active" }));
  const merkezKayit = [];
  for (const kayit of isMerkezleri) merkezKayit.push(await olustur("work-centers", { ...kayit, status: "active" }));
  const stokKayit = [];
  // `giris` yalnız depo hareketi için; stok kartının alanı değildir.
  for (const { giris, ...kayit } of stokKartlari) stokKayit.push(await olustur("inventory-items", { ...kayit, status: "active" }));
  const hesapKayit = [];
  for (const kayit of hesaplar) hesapKayit.push(await olustur("accounts", { ...kayit, status: "active" }));
  const ekipKayit = await ekipKur();

  await depoGirisleri(stokKayit);

  console.log("Projeler ve bağlı kayıtlar yazılıyor…");
  let sira = 0;
  for (const proje of projeler) {
    sira += 1;
    await projeYaz({ proje, sira, musteriKayit, tedarikciKayit, personelKayit, merkezKayit, stokKayit, hesapKayit, ekipKayit });
    process.stdout.write(`  ${proje.code} ✓\n`);
  }

  console.log("Firma geneli kayıtlar yazılıyor…");
  await firmaGeneli({ personelKayit, stokKayit, tedarikciKayit, ekipKayit });

  console.log("Ekip sohbeti yazılıyor…");
  await sohbetKur();

  console.log("\nÖzet:");
  for (const [kaynak, adet] of [...sayac.entries()].sort()) console.log(`  ${kaynak.padEnd(24)} ${adet}`);
  if (atlanan) console.log(`\n${atlanan} adım atlandı (kayıt zaten o durumdaydı).`);
  if (hatalar.length) {
    console.log(`\n${hatalar.length} kayıt yazılamadı:`);
    for (const satir of hatalar.slice(0, 40)) console.log(`  ${satir}`);
  } else {
    console.log("\nTüm kayıtlar yazıldı.");
  }
}

await main();
