# Capproje Masaüstü

Capproje'yi kendi penceresinde, kendi ikonuyla açan Windows programı. İçinde
uygulamanın bir kopyası **yoktur**; sunucudaki Capproje'ye bağlanır. Bu yüzden
veriler bölünmez: masaüstünden giren de tarayıcıdan giren de aynı firmayı,
aynı projeleri görür.

Ana uygulamanın kodu `../prototype` içindedir ve bu klasör ona hiç dokunmaz.

## Kurulum dosyasını üretmek

### Yol 1 — GitHub üzerinden (Windows bilgisayar gerekmez)

1. GitHub'da depoya girin, üstteki **Actions** sekmesine tıklayın.
2. Soldan **Masaüstü kurulumu (Windows)** iş akışını seçin.
3. Sağdaki **Run workflow** düğmesine basın.
4. Birkaç dakika sonra iş bitince sayfanın altındaki **capproje-windows**
   dosyasını indirin. İçinden iki dosya çıkar:
   - `Capproje-Kurulum-1.0.0.exe` — normal kurulum (Başlat menüsüne ve masaüstüne
     kısayol ekler).
   - `Capproje-Tasinabilir-1.0.0.exe` — kurulum istemez, çift tıklanınca çalışır.

### Yol 2 — Kendi Windows bilgisayarınızda

Node.js 24 kurulu olmalıdır.

```
cd desktop
npm ci
npm run build:win
```

Üretilen dosyalar `desktop/dist` klasörüne düşer.

### Geliştirirken denemek

```
cd desktop
npm start
```

Başka bir sunucuya bağlanarak denemek için:

```
CAPPROJE_URL=http://127.0.0.1:3000 npm start
```

## Sunucu adresini değiştirmek

Program varsayılan olarak `https://cap.taslak.online` adresine bağlanır. Kurulum
sonrasında bunu değiştirmek için yeni bir kurulum dosyası üretmek gerekmez.
Programda **Yardım → Sunucu Adresi…** menüsü hem geçerli adresi gösterir hem de
ayar dosyasının nereye konacağını söyler. Oradaki klasöre şu dosyayı koyup
programı yeniden başlatmak yeterlidir:

`capproje-masaustu.json`

```json
{ "url": "https://baska-adres.com" }
```

Aynı dosya programın kurulduğu klasöre de konabilir. Sıralama şöyledir:
`CAPPROJE_URL` ortam değişkeni → kullanıcı klasöründeki ayar dosyası →
program klasöründeki ayar dosyası → yerleşik adres.

## Programın yaptıkları

- Pencere boyutu ve konumu kapanışta hatırlanır.
- Oturum açık kalır; her seferinde yeniden giriş yapmak gerekmez.
- Sunucuya ulaşılamazsa tarayıcının teknik hata sayfası yerine Türkçe bir
  açıklama ve **Tekrar Dene** düğmesi gösterilir.
- Capproje dışına giden bağlantılar programın içinde değil, kullanıcının kendi
  tarayıcısında açılır.
- Kısayola ikinci kez tıklandığında yeni pencere açılmaz, açık olan öne gelir.
- Menüden yazdırma, yakınlaştırma ve tam ekran yapılabilir.

## Bilinmesi gerekenler

- İnternet bağlantısı gereklidir. Program çevrimdışı çalışmaz; sunucudaki
  Capproje'nin bir penceresidir.
- Şu an yalnızca Windows kurulumu üretiliyor. Mac ve Linux için ayrı derleme
  yapılabilir, `npm run build:linux` komutu Linux için hazırdır.
- Kurulum dosyası ~90 MB'tır; pencereyi çizen tarayıcı motoru içinde gelir.
