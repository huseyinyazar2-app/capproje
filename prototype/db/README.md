# Capproje veri katmanı

Worker, Cloudflare D1'i `DB`, dosya ve yedekleri R2'yi `FILES` binding'i üzerinden kullanır. Şema sırasıyla `migrations/0001_tenant_core.sql` ve `0002_permissions.sql` ile uygulanır.

- Tenant bağlamı istemciden `x-tenant-id` olarak gelir; sunucu aktif `memberships` kaydını doğrulamadan hiçbir tenant verisini döndürmez.
- Para alanları `*_minor` isimli `INTEGER` kolonlardır. TRY için değer kuruştur (`125050` = 1.250,50 TL). API güvenli tam sayı veya tam sayı metni kabul eder.
- Oran, ölçü ve miktar kolonları gerektiğinde `REAL` kalır.
- Üretimde kimlik platformun `oai-authenticated-user-email` başlığından veya hash'i D1'de tutulan Bearer token'dan alınır. `x-user-email` yalnız `ALLOW_DEV_AUTH=true` ortamında etkindir.
- Her mutasyon tenant kapsamlı audit üretir. Tekrarlanan yazma isteklerinde kalıcı `Idempotency-Key` kaydı kullanılır.
- Worker `scheduled()` girişini sunar; ancak Sites hosting bildirimi cron takvimi tanımlamadığı için tek başına tetikleme garantisi yoktur. R2 bağlı canlı ortamda ilk yetkili tenant API isteği günlük yedeği `waitUntil` ile başlatan fallback görevi görür. `backup_runs(tenant_id, backup_date)` benzersizliği scheduler ve fallback aynı anda çalışsa bile günde tek JSONL snapshot üretir.
- Owner API tokenları `/api/v1/tokens` üzerinden oluşturulur, yenilenir ve iptal edilir. Ham token yalnız oluşturma/yenileme cevabında bir kez gösterilir; D1'de yalnız SHA-256 özeti tutulur. Token ömrü varsayılan 90, en fazla 365 gündür.

Geri yükleme endpoint'i kasıtlı olarak `501 restore_not_enabled` döndürür. Otomatik restore; şema sürümü, bütünlük kontrolü ve bakım penceresi tasarlanmadan etkinleştirilmemelidir.
