-- Tahsilat ve ödeme yetkileri.
--
-- `financial_transactions` tablosunun durum kümesinde `collected` ve `paid`
-- baştan beri vardı (göç 0012'deki durum tetikleyicisine bakın) ama oraya
-- ulaşan hiçbir yol yoktu: POST ile o durumda kayıt açmak da PATCH ile durumu
-- oraya çekmek de iş akışı kapısına takılıyordu. Uygulamada paranın tahsil
-- edildiğini ya da ödendiğini kaydetmek mümkün değildi; tahsilat raporu hep
-- sıfır gösteriyor, vadesi geçmiş alacak hiç kapanmıyordu. Yollar artık
-- `POST /api/v1/financial-transactions/:id/collect` ve `.../pay` uçlarıdır ve
-- her iş akışı ucu gibi kendi yetki kodunu arar.
INSERT OR IGNORE INTO permissions (code,description) VALUES
('financial-transactions.collect','Onaylı gelir hareketini tahsil edildi olarak kaydetme'),
('financial-transactions.pay','Onaylı gider hareketini ödendi olarak kaydetme');

-- Dağıtım uydurulmuyor: bu iki kod, `financial-transactions.approve` bugün
-- hangi rol şablonundaysa oraya ekleniyor. Parayı kasaya girmiş saymak, o
-- gideri onaylamakla aynı sorumluluk düzeyidir; ayrı bir rol kurgusu icat
-- etmek, yetkiyi bugün kimin taşıdığı sorusunu iki farklı cevaba bölerdi.
-- Şablon güncellemesi bundan sonra açılacak firmalar için.
UPDATE role_templates SET permissions_json=json_insert(permissions_json,
  '$[#]','financial-transactions.collect',
  '$[#]','financial-transactions.pay')
WHERE EXISTS (SELECT 1 FROM json_each(permissions_json) j WHERE j.value='financial-transactions.approve')
  -- Göç iki kez uygulanırsa şablona ikinci bir kopya yazılmasın.
  AND NOT EXISTS (SELECT 1 FROM json_each(permissions_json) j2 WHERE j2.value='financial-transactions.collect');

-- Var olan firmalar için: şablon değil, rollerin kendi satırları okunur.
-- Bir firma rolünü elle düzenlediyse dağıtım onun bugünkü hâlini izler,
-- şablonun ilk hâlini değil.
INSERT OR IGNORE INTO role_permissions (tenant_id,role_id,permission_code)
SELECT rp.tenant_id,rp.role_id,p.code
FROM role_permissions rp
JOIN permissions p ON p.code IN ('financial-transactions.collect','financial-transactions.pay')
WHERE rp.permission_code='financial-transactions.approve';

PRAGMA optimize;
