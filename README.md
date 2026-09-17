# Capproje Yönetim Yazılımı

Capproje Orman Ürünleri için hazırlanmış, mobil uyumlu ve PWA kurulabilir işletme yönetim uygulamasıdır. Sunum prototipi korunurken Design 2 üzerinde çalışan çok kiracılı ürün katmanı eklenmiştir.

## Çalışan ürün

- Çok kiracılı D1/SQLite veri modeli ve tenant izolasyonu
- Rol ve alan bazlı erişim; maliyet, maaş ve hassas İK verisi koruması
- Teklif, proje, iş kalemi, üretim, satın alma, montaj, finans, ön muhasebe ve İK akışları
- Uçtan uca operasyon zinciri: keşif → teklif → sözleşme → tasarım → malzeme planı →
  satın alma talebi → sipariş → mal kabul → stok → üretim → kalite → montaj → teslim
- Müşteri, tedarikçi, dosya, kullanıcı, rol, audit ve yedek yönetimi
- R2 dosya saklama, günlük tenant yedeği ve idempotent iş akışları
- Mobil/masaüstü uyumlu PWA; offline durumda kritik işlemleri güvenli biçimde engelleme
- Geçici olarak Türkiye cep telefonu numarası ve hash'li şifreyle güvenli oturum; SMS doğrulama sonraki aşamaya hazır

Canlı çalışma alanı Sites ortamında otomatik açılır. Yerelde `?live=1`, sunum prototipinde `?prototype=1` kullanılabilir.

## Yerel geliştirme

```bash
cd prototype
pnpm install --frozen-lockfile
pnpm dev
```

Doğrulama:

```bash
pnpm test
pnpm build
```

Veritabanı migration'ları `prototype/migrations`, Worker API'si `prototype/worker`, canlı arayüz ise `prototype/src/LiveWorkspace.jsx` altındadır.

## Tanıtım verisi

Boş bir kurulumda her ekran boştur ve programın ne yaptığı anlaşılmaz. Aşağıdaki
betik, bir marangoz atölyesinin gerçek iş akışını taklit eden, birbirine bağlı
örnek veri yazar: on iki proje farklı aşamalarda (talepten kapanışa), müşteri,
tedarikçi, keşif, teklif, sözleşme, tasarım, reçete, satın alma, üretim, kalite,
montaj, teslim, finans ve insan kaynakları kayıtlarıyla birlikte. Ekip sohbeti de
dolar; bazı mesajlara gerçek kayıtlar iliştirilmiştir, tıklanınca o kaydın üzerine
gidilir.

```bash
cd prototype
CAPPROJE_URL=https://alan-adiniz CAPPROJE_TOKEN=cap_... node scripts/seed-demo.mjs
```

Anahtarı uygulamadan **Yönetim → API Erişim Anahtarları** ekranından üretin.
Betik aynı veriyi ikinci kez yazmaz; yarıda kalırsa tekrar çalıştırılabilir.
Tanıtım verisi gerçek müşteri kayıtlarıyla karışmasın diye ayrı bir firmada
(tenant) çalıştırılması önerilir.

Betik ayrıca sekiz kişilik bir ekip kurar ve ekip sohbetini bu kişilerin
ağzından yazar. Tanıtımı yapan kişi, ekranların rolden role nasıl değiştiğini
göstermek için bu hesaplarla giriş yapabilir:

| Kişi | Telefon | Rol |
| --- | --- | --- |
| Fatma Koç | 0534 111 22 01 | Mimar |
| Melis Arda | 0534 111 22 09 | Proje Yöneticisi |
| Zeynep Erdoğan | 0534 111 22 03 | Satın Alma |
| Selin Kurt | 0534 111 22 05 | Finans |
| Ahmet Yılmaz | 0534 111 22 00 | Üretim |
| Hasan Aydın | 0534 111 22 02 | Montaj |
| Derya Güneş | 0534 111 22 07 | İnsan Kaynakları |
| Emre Polat | 0534 111 22 06 | Salt Okunur |

Hepsinin şifresi `Capproje2026!Demo`'dur. **Bu hesaplar yalnız tanıtım içindir;**
gerçek veri tutan bir kurulumda betiği çalıştırmayın, çalıştırdıysanız bu
kullanıcıları Yönetim → Kullanıcılar ekranından devre dışı bırakın.

## Kullanım kılavuzu

Kılavuz `/kilavuz` adresinde yayınlanır; kaynağı `prototype/public/kilavuz.html`
ve ekran görüntüleri `prototype/public/kilavuz/gorseller/` altındadır. Arayüz
değiştiğinde görüntüler tek komutla yenilenir:

```bash
cd prototype
CAPPROJE_URL=http://127.0.0.1:3000 CAPPROJE_TOKEN=cap_... node scripts/kilavuz-goruntuleri.mjs
```

Betik Playwright ister (`npm i -D playwright && npx playwright install chromium`)
ve demo verinin yüklü olduğu bir kurulumda çalıştırılmalıdır.

## Ubuntu sunucu hedefi

Uygulama, bulut önizlemesine ek olarak Node.js 24 ve yerel SQLite ile kendi sunucusunda çalışabilir. `prototype/server/index.mjs`; aynı API, tenant izolasyonu ve rol kontrollerini kullanır, migration'ları başlangıçta uygular, yüklenen dosyaları özel veri dizininde saklar ve her gün okunabilir bir SQLite yedeği üretir.

Sunucuda çalışma sırası `npm ci`, `npm run build` ve `npm run start:self-host` şeklindedir. Üretim ayarları Git'e eklenmeyen bir ortam dosyasından verilmelidir. Uygulama varsayılan olarak yalnızca `127.0.0.1:3000` dinler; alan adı ve HTTPS, Nginx üzerinden bu adrese yönlendirilir. `/var/lib/capproje` dizini uygulama kullanıcısına özel tutulmalı ve ayrıca sunucu dışındaki şifreli bir hedefe yedeklenmelidir.

Kurulumdan önce en az şu değerler değiştirilmelidir: `PASSWORD_AUTH_PEPPER`, `BOOTSTRAP_SECRET` ve ilk yönetici şifresi. `ALLOW_DEV_AUTH` üretimde hiçbir zaman açılmamalıdır. Sağlık kontrolü `/api/v1/health` adresindedir.

Nginx, uygulamaya `Host` ve `X-Forwarded-Proto` başlıklarını iletmelidir. Uygulama
yazma isteklerinde kaynak alan adını doğrular; ön yüz farklı bir alan adından
sunuluyorsa `ALLOWED_ORIGINS` ile bu alan adı tanımlanmalıdır.

Varsayılan veri katmanı sunucunun kendi diskindeki SQLite'tır
(`DATABASE_PROVIDER=sqlite`); migration'lar uygulama açılışında otomatik
uygulanır, ayrı bir komut gerekmez.

### Kalıcı disk (Coolify / Docker)

Veritabanı, yüklenen dosyalar ve yedekler tek bir dizinde tutulur. Docker imajında
bu dizin `/app/storage`'dır ve `VOLUME` olarak tanımlıdır. Konteyner yeniden
başlatmalarında veri korunur; **yeniden dağıtımlarda da korunması için barındırma
tarafında bu yola adlandırılmış kalıcı bir disk bağlanmalıdır.**

Coolify'da: uygulamanın sayfasında **Storages → Add** → Name: `capproje-data`,
Mount Path: `/app/storage` → kaydedip yeniden dağıtın. Başka bir yol kullanmak
isterseniz `CAPPROJE_DATA_DIR` değişkenini de aynı yola ayarlayın.

Doğrulama: `GET /api/v1/health` çıktısındaki `persistent_storage` alanı ikinci
dağıtımdan sonra `true` olmalıdır. `false` kalıyorsa disk bağlı değildir ve her
dağıtımda veri sıfırlanır; uygulama açılış günlüğüne de uyarı yazar.

Turso yalnızca bulut önizlemesi için bir seçenektir ve zorunlu değildir.
Kullanılırsa migration'lar otomatik uygulanmaz; her dağıtımdan sonra
`npm run db:turso:migrate` çalıştırılmalıdır.

### Yedek doğrulama

Yedek almak yeterli değildir; geri yüklenebildiği kanıtlanmalıdır. İndirilen bir
tenant yedeğini boş bir veritabanına geri yükleyerek doğrulayın:

```bash
npm run db:verify-backup -- /yol/yedek.jsonl
```

Komut varsayılan olarak bellek içi prova yapar ve canlı veriye dokunmaz. Gerçek
bir geri yükleme için bakım penceresinde `--into geri-yukleme.sqlite` ekleyin.

## Vercel ile yayınlama

Vercel yalnızca sunum prototipini yayımlar; **çalışan ürün Vercel'de çalışmaz**
çünkü Worker API'si, veritabanı ve dosya deposu orada bulunmaz. Canlı ürün için
Ubuntu sunucusu (yukarıdaki bölüm) veya Cloudflare Workers kullanın.

1. Bu GitHub deposunu Vercel'e bağlayın.
2. Proje kök dizinini değiştirmeden devam edin.
3. Vercel, kökteki `vercel.json` dosyasından kurulum, build ve çıktı ayarlarını otomatik alacaktır.

Sunum modu iki farklı tasarım yönünü ve süreç formlarını içerir:

- `/#/d1/forms`
- `/#/d2/forms`

Sunum rotaları mock veri kullanır; çalışan ürün rotası kalıcı D1/R2 verisine bağlıdır.
