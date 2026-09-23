-- Tahsilat/ödeme tarihinin kendi sütunu; `overdue` saklanan bir durum olmaktan çıkıyor.

-- 1) Tarih ve kaydeden kişi.
--
-- Göç 0018 ile açılan tahsilat/ödeme uçları bu ikisini `metadata_json` içine
-- yazıyordu (`$.collected_on`, `$.collected_by`, `$.paid_on`, `$.paid_by`).
-- Rapor motoru sütunları `PRAGMA table_info` ile beyaz listeliyor; JSON
-- içindeki bir alan o listeye hiç giremiyor, dolayısıyla raporlanamıyor,
-- sıralanamıyor, indekslenemiyordu. "Bu ay ne tahsil edildi" sorusu elde
-- veri olduğu hâlde cevapsız kalıyordu.
--
-- `transaction_date` bu işi göremez: o tahakkuk tarihidir, yani paranın
-- hangi döneme ait olduğunu söyler. Para çoğu zaman başka bir gün hareket
-- eder ve tarih bazlı bütün mevcut raporlar tahakkuk tarihine dayanıyor;
-- üzerine yazmak o raporların hepsini sessizce kaydırırdı.
ALTER TABLE financial_transactions ADD COLUMN settled_on TEXT;
ALTER TABLE financial_transactions ADD COLUMN settled_by TEXT REFERENCES users(id);

-- 2) Var olan kayıtların taşınması.
--
-- Bir hareket ya tahsil edilir ya ödenir, ikisi birden olamaz (uç, yönü
-- türden ve karşı taraftan okuyup tek yöne kilitliyor). Bu yüzden iki JSON
-- anahtar çiftini tek sütun çiftine indirmek güvenlidir.
-- `settled_on IS NULL` koşulu, göç yeniden uygulanırsa sonradan elle
-- düzeltilmiş bir tarihin eski JSON kopyasıyla ezilmesini engeller.
UPDATE financial_transactions
SET settled_on = COALESCE(json_extract(metadata_json,'$.collected_on'), json_extract(metadata_json,'$.paid_on')),
    settled_by = COALESCE(json_extract(metadata_json,'$.collected_by'), json_extract(metadata_json,'$.paid_by'))
WHERE settled_on IS NULL
  AND (json_extract(metadata_json,'$.collected_on') IS NOT NULL
    OR json_extract(metadata_json,'$.paid_on') IS NOT NULL
    OR json_extract(metadata_json,'$.collected_by') IS NOT NULL
    OR json_extract(metadata_json,'$.paid_by') IS NOT NULL);

-- 3) JSON'daki kopyaların temizlenmesi.
--
-- Aynı bilgi iki yerde durursa er geç ayrışır: sütun düzeltilip JSON
-- unutulduğunda hangisinin doğru olduğunu kimse bilemez. Koşul, anahtarı
-- hiç taşımayan satırların `metadata_json` değerini gereksiz yere yeniden
-- yazmasını da önlüyor.
UPDATE financial_transactions
SET metadata_json = json_remove(metadata_json,'$.collected_on','$.collected_by','$.paid_on','$.paid_by')
WHERE json_extract(metadata_json,'$.collected_on') IS NOT NULL
   OR json_extract(metadata_json,'$.paid_on') IS NOT NULL
   OR json_extract(metadata_json,'$.collected_by') IS NOT NULL
   OR json_extract(metadata_json,'$.paid_by') IS NOT NULL;

-- 4) İndeks.
--
-- Sütunun varlık nedeni tarihe göre sorulan sorular ("bu ay tahsil edilenler",
-- "geçen çeyrekte ödenenler") ve rapor motoru bu sorguları her zaman firma
-- kimliğiyle birlikte kuruyor; öncelik sırası da bu yüzden (tenant_id,
-- settled_on). Var olan (tenant_id, transaction_date) indeksi bu soruya
-- yaramıyor, o tahakkuk tarihine bakıyor.
--
-- İndeks kısmi (`WHERE settled_on IS NOT NULL`) değil: SQLite kısmi indeksi
-- ancak sorgunun WHERE'inden indeksin WHERE'ini kanıtlayabildiğinde kullanır,
-- ve rapor motorunun ürettiği süzgeçler (between, lt, gte…) bunu her zaman
-- sağlamaz. Tahsil edilmemiş satırların NULL girdileri yer kaplar ama sessizce
-- kullanılmayan bir indeksten iyidir.
CREATE INDEX IF NOT EXISTS idx_financial_transactions_tenant_settled ON financial_transactions(tenant_id, settled_on);

-- 5) `overdue` durumunun kaldırılması.
--
-- `overdue` durum kümesinde vardı ama onu hiçbir şey üretmiyordu: oluştururken
-- izin verilen başlangıç durumları `draft/planned/pending`, PATCH ile durum
-- değiştirmek kapalı, iş akışı uçları (approve/collect/pay/reverse) de onu hiç
-- yazmıyordu. Yazabilseydik bile bayatlardı: vadesi uzatılan bir kayıt
-- "Gecikti" olarak kalır, veriyi düzelten kişi durumu geri alamazdı.
--
-- Vadesi geçmiş alacak/borç tek bir yerden okunur ve okunmalıdır:
-- `status='approved' AND due_date IS NOT NULL AND due_date < bugün`.
-- Panodaki `overdue_amount_minor` ve `overdue-receivables` raporu zaten
-- böyle hesaplıyordu; durum kodu ikinci ve her zaman geç kalan bir cevaptı.
--
-- `invoices` tablosuna dokunulmuyor: orada `overdue` gerçekten kullanılıyor
-- (fatura o durumda açılabiliyor ve rapor onu süzüyor).
--
-- Eski değer `$.legacy_status` altında saklanıyor (göç 0012'nin aynı
-- durumda kullandığı yer), `updated_at` ise bilerek değiştirilmiyor: göç bir
-- kullanıcı düzenlemesi değildir, "son güncelleyen" listelerini bozmamalı.
UPDATE financial_transactions
SET metadata_json = json_set(metadata_json,'$.legacy_status','overdue'), status = 'approved'
WHERE status = 'overdue';

-- 6) Kuralın veritabanına yazılması.
--
-- Göç 0012'deki tetikleyiciler izin verilen kümeyi zorunlu kılıyor; kümeden
-- çıkardığımız kodu orada bırakmak "hiçbir satırda bu durum yok" cümlesini bir
-- varsayım hâline getirirdi. Tetikleyici gövdesi değiştirilemediği için önce
-- düşürülüp yeniden kuruluyor.
DROP TRIGGER IF EXISTS trg_financial_transactions_status_insert;
DROP TRIGGER IF EXISTS trg_financial_transactions_status_update;

CREATE TRIGGER IF NOT EXISTS trg_financial_transactions_status_insert BEFORE INSERT ON financial_transactions
WHEN NEW.status NOT IN ('draft','planned','pending','approved','collected','paid','reversed','cancelled')
BEGIN
  SELECT RAISE(ABORT,'invalid status for financial_transactions');
END;
CREATE TRIGGER IF NOT EXISTS trg_financial_transactions_status_update BEFORE UPDATE OF status ON financial_transactions
WHEN NEW.status NOT IN ('draft','planned','pending','approved','collected','paid','reversed','cancelled')
BEGIN
  SELECT RAISE(ABORT,'invalid status for financial_transactions');
END;

PRAGMA optimize;
