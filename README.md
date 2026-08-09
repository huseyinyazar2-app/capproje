# Capproje Yönetim Yazılımı

Capproje Orman Ürünleri için hazırlanmış, mobil uyumlu ve PWA kurulabilir işletme yönetim uygulamasıdır. Sunum prototipi korunurken Design 2 üzerinde çalışan çok kiracılı ürün katmanı eklenmiştir.

## Çalışan ürün

- Çok kiracılı D1/SQLite veri modeli ve tenant izolasyonu
- Rol ve alan bazlı erişim; maliyet, maaş ve hassas İK verisi koruması
- Teklif, proje, iş kalemi, üretim, satın alma, montaj, finans, ön muhasebe ve İK akışları
- Müşteri, tedarikçi, dosya, kullanıcı, rol, audit ve yedek yönetimi
- R2 dosya saklama, günlük tenant yedeği ve idempotent iş akışları
- Mobil/masaüstü uyumlu PWA; offline durumda kritik işlemleri güvenli biçimde engelleme
- Türkiye cep telefonu numarası ve SMS tek kullanımlık koduyla güvenli oturum

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

## Vercel ile yayınlama

1. Bu GitHub deposunu Vercel'e bağlayın.
2. Proje kök dizinini değiştirmeden devam edin.
3. Vercel, kökteki `vercel.json` dosyasından kurulum, build ve çıktı ayarlarını otomatik alacaktır.

Sunum modu iki farklı tasarım yönünü ve süreç formlarını içerir:

- `/#/d1/forms`
- `/#/d2/forms`

Sunum rotaları mock veri kullanır; çalışan ürün rotası kalıcı D1/R2 verisine bağlıdır.
