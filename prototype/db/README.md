# Capproje veri katmanı

Worker, varsayılan olarak Cloudflare D1'i `DB` binding'i üzerinden kullanır. Geçici önizleme ortamında `DATABASE_PROVIDER=turso` ile aynı sorgular Turso adaptörüne yönlendirilir; dosya ve yedekler R2 `FILES` binding'inde kalır. Şema `migrations/` altındaki sıralı SQL dosyalarıyla uygulanır.

- Tenant bağlamı istemciden `x-tenant-id` olarak gelir; sunucu aktif `memberships` kaydını doğrulamadan hiçbir tenant verisini döndürmez.
- Para alanları `*_minor` isimli `INTEGER` kolonlardır. TRY için değer kuruştur (`125050` = 1.250,50 TL). API güvenli tam sayı veya tam sayı metni kabul eder.
- Oran, ölçü ve miktar kolonları gerektiğinde `REAL` kalır.
- Geçici önizleme girişi Türkiye cep telefonu ve şifreyle yapılır. Şifreler 16 bayt kullanıcı tuzu ve PBKDF2-HMAC-SHA256 iş faktörüyle hash'lenir; açık metin tutulmaz. Oturum anahtarı yalnız hash olarak veritabanında tutulur ve tarayıcıya `HttpOnly`, `Secure`, `SameSite=Lax` çerezi verilir. API entegrasyonları hash'i tutulan Bearer token kullanabilir; geliştirme ve platform kimliği üretimde kapalıdır.
- Telefon girişi için `PHONE_AUTH_ENABLED=true`, güçlü ve gizli `PHONE_AUTH_PEPPER`, `TWILIO_VERIFY_SERVICE_SID`, tercihen `TWILIO_API_KEY` ve `TWILIO_API_KEY_SECRET` gerekir. Alternatif olarak Twilio hesap SID/auth token çifti desteklenir. Türkiye dışı ve sabit hat numaraları kabul edilmez; telefon/IP bazlı 10 dakikalık hız sınırı uygulanır.
- Geçici şifreli giriş için `PASSWORD_AUTH_ENABLED=true` ve en az 16 karakter gizli `PASSWORD_AUTH_PEPPER` gerekir. Başarısız girişler telefon/IP hash'iyle hız sınırına alınır. SMS değişkenleri bu aşamada kapalı kalabilir.
- Turso geçici ortamı `TURSO_DATABASE_URL` ve gizli `TURSO_AUTH_TOKEN` ister. Bu değerler yalnız yerel `.env.local` veya barındırma ortamının secret kasasında tutulur; Git'e eklenmez. `npm run db:turso:migrate` yalnız uygulanmamış migration dosyalarını çalıştırır.
- Her mutasyon tenant kapsamlı audit üretir. Tekrarlanan yazma isteklerinde kalıcı `Idempotency-Key` kaydı kullanılır.
- Worker `scheduled()` girişini sunar; ancak Sites hosting bildirimi cron takvimi tanımlamadığı için tek başına tetikleme garantisi yoktur. R2 bağlı canlı ortamda ilk yetkili tenant API isteği günlük yedeği `waitUntil` ile başlatan fallback görevi görür. `backup_runs(tenant_id, backup_date)` benzersizliği scheduler ve fallback aynı anda çalışsa bile günde tek JSONL snapshot üretir.
- Owner API tokenları `/api/v1/tokens` üzerinden oluşturulur, yenilenir ve iptal edilir. Ham token yalnız oluşturma/yenileme cevabında bir kez gösterilir; D1'de yalnız SHA-256 özeti tutulur. Token ömrü varsayılan 90, en fazla 365 gündür.

Geri yükleme endpoint'i kasıtlı olarak `501 restore_not_enabled` döndürür. Otomatik restore; şema sürümü, bütünlük kontrolü ve bakım penceresi tasarlanmadan etkinleştirilmemelidir.
