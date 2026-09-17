#!/usr/bin/env node
/**
 * Kullanım kılavuzundaki ekran görüntülerini yeniden üretir.
 *
 * Görüntüler elle alındığında, arayüz her değiştiğinde kılavuz sessizce
 * eskiyor ve kullanıcı ekranda gördüğüyle kılavuzdakinin aynı olmadığını fark
 * ediyor. Bu betik hepsini tek komutla yeniden çeker.
 *
 * Önce demo veri yüklü bir sunucu gerekir:
 *   node scripts/seed-demo.mjs
 *   CAPPROJE_URL=http://127.0.0.1:3000 CAPPROJE_TOKEN=cap_... node scripts/kilavuz-goruntuleri.mjs
 *
 * Playwright kurulu değilse betik bunu söyleyip çıkar; kılavuzdaki mevcut
 * görüntülere dokunmaz.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projeKoku = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HEDEF = path.join(projeKoku, "public", "kilavuz", "gorseller");
const BASE = (process.env.CAPPROJE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const TOKEN = process.env.CAPPROJE_TOKEN;

if (!TOKEN) {
  console.error("CAPPROJE_TOKEN gerekli. Yönetim → API Erişim Anahtarları ekranından üretebilirsiniz.");
  process.exit(1);
}

// Playwright yalnız bu betik için gerekli; projenin bağımlılığı değildir. Genel
// olarak kurulmuş bir kopya da kabul edilir, PLAYWRIGHT_MODULE ile yolu da
// verilebilir. Bulunamazsa mevcut görüntülere dokunulmaz.
let chromium;
for (const aday of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright/index.mjs", "/usr/lib/node_modules/playwright/index.mjs"]) {
  if (!aday) continue;
  try { ({ chromium } = await import(aday)); break; } catch { /* sıradaki adaya bak */ }
}
if (!chromium) {
  console.error("Playwright bulunamadı. Kurmak için: npm i -D playwright && npx playwright install chromium");
  console.error("Kurulu bir kopya varsa yolunu PLAYWRIGHT_MODULE ile verebilirsiniz.");
  process.exit(1);
}

await mkdir(HEDEF, { recursive: true });

// Masaüstü görüntüleri 1440×900, telefon görüntüleri 390×844; ikisi de iki kat
// çözünürlükle çekilir ki kılavuzda büyütüldüğünde bulanıklaşmasın.
const masaustu = { width: 1440, height: 900 };
const telefon = { width: 390, height: 844 };
const ortak = { deviceScaleFactor: 2, extraHTTPHeaders: { Authorization: `Bearer ${TOKEN}` }, locale: "tr-TR" };

const browser = await chromium.launch({ args: ["--no-sandbox"] });
let cekilen = 0;

async function kaydet(sayfa, ad, secici) {
  const dosya = path.join(HEDEF, `${ad}.png`);
  const hedef = secici ? sayfa.locator(secici).first() : sayfa;
  await hedef.screenshot({ path: dosya });
  cekilen += 1;
  process.stdout.write(`  ${ad} ✓\n`);
}

// Yalnız adresin kısmı (#) değiştiğinde tarayıcı sayfayı yeniden yüklemez;
// bir önceki adımdan kalan açık pencere ya da çekmece yerinde durur ve sonraki
// adımın tıklamasını yutar. Bu yüzden her adımda gerçekten yeniden yükleniyor.
async function git(sayfa, modul, bekleme = 1800) {
  await sayfa.goto(`${BASE}/#/${modul}`, { waitUntil: "domcontentloaded" });
  await sayfa.reload({ waitUntil: "domcontentloaded" });
  await sayfa.waitForTimeout(bekleme);
}

// Pencereler Escape ile kapanmıyor; kapatma düğmesine basıp gerçekten
// kapandığını beklemek gerekiyor, yoksa sonraki adım perdenin arkasına tıklamaya
// çalışıp zaman aşımına düşüyor.
async function kapat(sayfa) {
  const kapatma = sayfa.locator(".live-modal header .live-icon-button").last();
  if (await kapatma.count()) {
    await kapatma.click().catch(() => {});
    await sayfa.locator(".live-modal-backdrop").waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
  }
}

// Bir adım başarısız olursa kalan görüntüler de çekilemiyordu; her adım kendi
// başına denenir ve atlanan adım rapor edilir.
async function adim(ad, is) {
  try { await is(); } catch (hata) { console.warn(`  ${ad} atlandı: ${String(hata.message || hata).split("\n")[0]}`); }
}

// --- Masaüstü -------------------------------------------------------------
{
  const context = await browser.newContext({ viewport: masaustu, ...ortak });
  const sayfa = await context.newPage();

  await git(sayfa, "dashboard", 2600);
  await kaydet(sayfa, "02-ana-sayfa");
  await kaydet(sayfa, "04-ust-cubuk", ".live-topbar");

  // Menü: bütün grupları açıp kenar çubuğunu göster.
  for (const baslik of ["MÜŞTERİ & PROJE", "OPERASYON"]) {
    const dugme = sayfa.locator(`.live-nav-group-toggle:has-text("${baslik}")`).first();
    if (await dugme.count()) await dugme.click();
    await sayfa.waitForTimeout(300);
  }
  await kaydet(sayfa, "03-menu", ".live-sidebar");

  await git(sayfa, "projects", 2200);
  await kaydet(sayfa, "05-projeler-liste");
  await kaydet(sayfa, "06-arac-cubugu", ".live-toolbar");
  await kaydet(sayfa, "08-satir-islemleri", ".live-table tbody tr");

  await adim("07-kanban", async () => {
    const kanban = sayfa.locator('.live-view-switcher button, .live-search button').filter({ hasText: /Pano|Kanban/ }).first();
    if (!(await kanban.count())) return;
    await kanban.click({ timeout: 5000 });
    await sayfa.waitForTimeout(1200);
    await kaydet(sayfa, "07-kanban");
  });

  await git(sayfa, "projects", 2000);
  await adim("09-yeni-kayit-formu", async () => {
    const yeni = sayfa.locator('.live-button.primary:has-text("Yeni")').first();
    if (await yeni.count()) { await yeni.click(); await sayfa.waitForTimeout(900); await kaydet(sayfa, "09-yeni-kayit-formu", ".live-modal"); await kapat(sayfa); }
  });

  await git(sayfa, "projects", 2000);
  await adim("10-komuta-merkezi", async () => {
    const detay = sayfa.locator('.live-workflow-button:has-text("Komuta merkezi"), button[title="Detayı aç"]').first();
    await detay.click({ timeout: 8000 });
    await sayfa.waitForTimeout(2400);
    await kaydet(sayfa, "10-komuta-merkezi", ".live-modal");
    await kapat(sayfa);
  });

  await git(sayfa, "projects", 2000);
  await adim("11-asama-degistir", async () => {
    const asama = sayfa.locator('.live-workflow-button:has-text("Aşama")').first();
    if (await asama.count()) { await asama.click(); await sayfa.waitForTimeout(900); await kaydet(sayfa, "11-asama-degistir", ".live-modal"); await kapat(sayfa); }
  });

  await git(sayfa, "dashboard", 1600);
  await sayfa.locator(".live-global-search input").fill("CP-26");
  await sayfa.waitForTimeout(1400);
  await kaydet(sayfa, "12-genel-arama", ".live-topbar");
  // Arama kutusu üst çubukta durur ve bölüm değiştirince temizlenmez; açık
  // kalan sonuç listesi sonraki bütün görüntülerin üstünü kapatıyordu.
  await sayfa.locator(".live-global-search input").fill("");
  await sayfa.waitForTimeout(400);

  await git(sayfa, "notifications", 2000);
  await kaydet(sayfa, "13-bildirimler");

  await git(sayfa, "chat", 2600);
  await adim("26-ekip-sohbeti", async () => {
    // Kılavuz, mesaja iliştirilen kaydı anlatıyor; açılışta gelen kanalda böyle
    // bir mesaj olmayabilir, o yüzden kayıt kutusu içeren kanal seçiliyor.
    const kanallar = sayfa.locator(".live-chat-channels button");
    for (let sira = 0; sira < await kanallar.count(); sira += 1) {
      await kanallar.nth(sira).click();
      await sayfa.waitForTimeout(1600);
      if (await sayfa.locator(".live-chat-link").count()) break;
    }
    await kaydet(sayfa, "26-ekip-sohbeti");
  });

  await git(sayfa, "production", 2000);
  await adim("27-kayit-paylas", async () => {
    const uretimDetay = sayfa.locator('button[title="Detayı aç"]').first();
    if (await uretimDetay.count()) { await uretimDetay.click(); await sayfa.waitForTimeout(1800); await kaydet(sayfa, "27-kayit-paylas", ".live-modal"); await kapat(sayfa); }
  });

  await git(sayfa, "roles", 2000);
  await kaydet(sayfa, "14-roller");
  await adim("15-rol-yetkileri", async () => {
    const yetki = sayfa.locator('button[title="Rol yetkileri"]').first();
    if (await yetki.count()) { await yetki.click(); await sayfa.waitForTimeout(1200); await kaydet(sayfa, "15-rol-yetkileri", ".live-modal"); await kapat(sayfa); }
  });

  for (const [modul, ad] of [["memberships", "16-kullanicilar"], ["backups", "17-yedekler"], ["finance", "18-finans"], ["purchases", "19-satin-alma"], ["production", "20-uretim"]]) {
    await git(sayfa, modul, 2000);
    await kaydet(sayfa, ad);
  }

  await context.close();
}

// --- Telefon --------------------------------------------------------------
{
  const context = await browser.newContext({ viewport: telefon, isMobile: true, hasTouch: true, ...ortak });
  const sayfa = await context.newPage();

  await git(sayfa, "dashboard", 2600);
  await kaydet(sayfa, "22-telefon-ana-sayfa");

  await adim("23-telefon-menu", async () => {
    const menu = sayfa.locator('.live-tabbar button:has-text("Tüm Menü")');
    if (await menu.count()) { await menu.click(); await sayfa.waitForTimeout(900); await kaydet(sayfa, "23-telefon-menu"); await kapat(sayfa); }
  });

  await git(sayfa, "fieldMode", 2400);
  await kaydet(sayfa, "24-saha-modu");
  await adim("25-saha-fotograf", async () => {
    // Hızlı kayıt düğmeleri aktif proje seçilmeden çalışmıyor.
    const secici = sayfa.locator(".live-field-project input");
    const ilkProje = await sayfa.locator("#field-project-list option").first().getAttribute("value");
    if (ilkProje) { await secici.fill(ilkProje); await sayfa.waitForTimeout(700); }
    await sayfa.locator(".live-field-actions button").first().click({ timeout: 8000 });
    await sayfa.waitForTimeout(1400);
    await kaydet(sayfa, "25-saha-fotograf");
  });

  await context.close();
}

await browser.close();
console.log(`\n${cekilen} görüntü yenilendi: ${path.relative(projeKoku, HEDEF)}`);
console.log("Giriş ekranı (01-giris.png) oturum açılmadan çekildiği için elle güncellenir.");
