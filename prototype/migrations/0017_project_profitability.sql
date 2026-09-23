-- Gerçek proje kârlılığı. Rapor motoru tek tablodan okur; kârlılık ise
-- sözleşme bedelini finans, stok ve üretim kayıtlarıyla karşılaştırmayı
-- gerektirir. Motora genel bir birleştirme (JOIN) yeteneği eklemek,
-- kullanıcıdan gelen tanımla tablo birleştirmek demek olurdu: hem güvenlik
-- yüzeyi hem karmaşıklık büyürdü. Bunun yerine birleştirme burada, şemanın
-- içinde bir kez ve sabit biçimde yapılır; motor onu sıradan bir kaynak gibi
-- okur ve süzme, gruplama, CSV, kişisel görünüm olduğu gibi çalışır.
--
-- Göç tekrar çalıştırılabilir olsun diye IF NOT EXISTS: aynı dosya iki kez
-- uygulanırsa ikinci uygulama hatasız geçer. Görünümün tanımı değişirse yeni
-- bir göç dosyası önce DROP VIEW yazmalıdır, IF NOT EXISTS eskisini sessizce
-- yerinde bırakır.
CREATE VIEW IF NOT EXISTS project_profitability AS
SELECT
  base.id AS id,
  base.tenant_id AS tenant_id,
  base.project_id AS project_id,
  base.code AS code,
  base.name AS name,
  base.customer_id AS customer_id,
  base.manager_user_id AS manager_user_id,
  base.status AS status,
  base.progress_percent AS progress_percent,
  base.contract_amount_minor AS contract_amount_minor,
  base.estimated_cost_minor AS estimated_cost_minor,
  base.expense_minor AS expense_minor,
  base.collected_minor AS collected_minor,
  base.material_cost_minor AS material_cost_minor,
  base.issue_cost_minor AS issue_cost_minor,
  -- Gerçekleşen maliyet üç kalemin toplamıdır. İç sorguda hesaplanamaz,
  -- çünkü aynı SELECT içinde kendi takma adlarına başvurulamaz; bu yüzden
  -- görünüm iki katmanlı yazıldı ve toplam tek yerde durur.
  base.expense_minor + base.material_cost_minor + base.issue_cost_minor AS actual_cost_minor,
  base.contract_amount_minor - (base.expense_minor + base.material_cost_minor + base.issue_cost_minor) AS margin_minor,
  -- Sözleşme bedeli girilmemiş projede yüzde hesaplanamaz. Sıfıra bölmek
  -- SQLite'ta hata değil NULL üretirdi ama 0 yazmak daha kötüsü olurdu:
  -- "marjı %0" ile "marjı bilinmiyor" aynı şey değildir ve ilki zararsız
  -- görünen bir yalan olur. İki ondalığa yuvarlanır ki kayan nokta artığı
  -- (%40 yerine %40,00000000000001) rapora sızmasın.
  CASE
    WHEN base.contract_amount_minor = 0 THEN NULL
    ELSE ROUND((base.contract_amount_minor - (base.expense_minor + base.material_cost_minor + base.issue_cost_minor)) * 100.0 / base.contract_amount_minor, 2)
  END AS margin_percent,
  base.created_at AS created_at,
  base.updated_at AS updated_at
FROM (
  SELECT
    -- Kaynak kayıt defteri her kaynakta bir `id` bekler ve tekil okuma
    -- (`GET /api/v1/project-profitability/<id>`) bu sütundan gider. Proje
    -- başına tek satır olduğu için projenin kimliği hem satırın kimliğidir
    -- hem de ayrıca `project_id` olarak durur: arayüz satırdan proje kaydına
    -- bağlantı kurarken tahmin yürütmek zorunda kalmasın.
    p.id AS id,
    p.tenant_id AS tenant_id,
    p.id AS project_id,
    p.code AS code,
    p.name AS name,
    p.customer_id AS customer_id,
    p.manager_user_id AS manager_user_id,
    p.status AS status,
    p.progress_percent AS progress_percent,
    p.created_at AS created_at,
    p.updated_at AS updated_at,
    COALESCE(p.contract_amount_minor, 0) AS contract_amount_minor,
    -- Tahmini maliyet karşılaştırma içindir, maliyetin kendisi değildir:
    -- gerçekleşen maliyete karışmasın diye ayrı sütunda taşınır.
    COALESCE(p.estimated_cost_minor, 0) AS estimated_cost_minor,
    -- Gider. `cost_forecast` türü bilerek dışarıda: o bir tahmindir,
    -- gerçekleşen bir hareket değil. Tahmini maliyete saymak, henüz
    -- harcanmamış parayı harcanmış göstererek her projeyi olduğundan zararlı
    -- gösterirdi. `draft`, `planned` ve `pending` henüz kesinleşmemiştir,
    -- `reversed` ters kayıtla geri alınmıştır, `cancelled` hiç olmamıştır:
    -- yalnız `approved` ve `paid` gerçek bir maliyettir.
    --
    -- Ters kaydın fişi de (`reversal_of_id` dolu olan satır) dışarıda kalır.
    -- Asli kayıt ters kaydedilince `reversed` olup toplamdan zaten düşüyor.
    -- Fiş de eksi tutarıyla toplama girerse aynı düzeltme iki kez sayılır ve
    -- maliyet sıfıra değil eksiye giderdi: 300.000 onaylı gider ters
    -- kaydedildiğinde maliyet -300.000, marj da 600.000 fazla görünüyordu.
    -- İkisi de dışarıda kalınca sonuç doğru şekilde sıfır olur ve fiş kayıt
    -- olarak yerinde durur, iz kaybolmaz.
    --
    -- Resmi (`official=1`) ve proje içi (`official=0`) hareketlerin ikisi de
    -- sayılır. Bu raporun sorusu "resmi defterde ne görünüyor" değil, "bu iş
    -- gerçekte kazandırdı mı"dır; firma bu ayrımı zaten bilerek tutuyor ve
    -- yalnız bir tarafı saymak işin gerçek maliyetini gizlerdi.
    COALESCE((
      SELECT SUM(t.amount_minor) FROM financial_transactions t
      WHERE t.tenant_id = p.tenant_id AND t.project_id = p.id
        AND t.type = 'expense' AND t.status IN ('approved', 'paid')
        AND t.reversal_of_id IS NULL
    ), 0) AS expense_minor,
    -- Tahsilat. `progress_payment` (hakediş) ve `advance` (avans) türleri
    -- bilerek dışarıda: hakediş faturaya, fatura da bir finans hareketine
    -- dönüşür. İkisini birden saymak aynı parayı iki kez tahsil edilmiş
    -- gösterir. Tahsil edilmiş sayılan tek durum çifti `paid` ile
    -- `collected` olur, çünkü `pending` ya da `overdue` bir alacak henüz
    -- kasaya girmemiştir. Ters kayıt fişi giderde olduğu gibi burada da
    -- dışarıda: yanlış girilmiş bir tahsilat ters kaydedildiğinde tahsilat
    -- toplamı eksiye değil sıfıra dönmelidir.
    COALESCE((
      SELECT SUM(t.amount_minor) FROM financial_transactions t
      WHERE t.tenant_id = p.tenant_id AND t.project_id = p.id
        AND t.type = 'income' AND t.status IN ('paid', 'collected')
        AND t.reversal_of_id IS NULL
    ), 0) AS collected_minor,
    -- Malzeme maliyeti. Yalnız projeye çıkılan (`project_issue`) ve kesinleşmiş
    -- (`posted`) hareketler sayılır: `draft` bir çıkış henüz depodan çıkmamış,
    -- `cancelled` bir çıkış ise hiç çıkmamıştır. Depoya giriş, sayım farkı ve
    -- projeden iade türleri projenin maliyeti değildir.
    COALESCE((
      SELECT SUM(m.total_cost_minor) FROM stock_movements m
      WHERE m.tenant_id = p.tenant_id AND m.project_id = p.id
        AND m.movement_type = 'project_issue' AND m.status = 'posted'
    ), 0) AS material_cost_minor,
    -- Üretim sorunlarının maliyet etkisi (fire, yeniden üretim, gecikme).
    -- `cancelled` sorun kaydı yanlışlıkla açılmış demektir ve maliyeti
    -- yoktur. Kalan durumlar (`open`, `in_progress`, `resolved`) gerçekten yaşanmış
    -- bir sorunu gösterir, çözülmüş olması maliyetini geri getirmez.
    COALESCE((
      SELECT SUM(i.cost_impact_minor) FROM production_issues i
      WHERE i.tenant_id = p.tenant_id AND i.project_id = p.id
        AND i.status <> 'cancelled'
    ), 0) AS issue_cost_minor
  -- Bütün toplamlar COALESCE(...,0) ile sarılı ve birleştirme değil ilişkili
  -- alt sorgu kullanılıyor: hiç finans, stok ya da üretim kaydı olmayan proje
  -- de satırda kalır ve sıfır gösterir. Kaybolan satır, "bu projeye hiç
  -- bakılmamış" ile "bu proje yok" arasındaki farkı silerdi.
  FROM projects p
) AS base;

-- Görünümün üç alt sorgusu projeye bağlı hareketleri arar; bu erişim yolunun
-- indeksi yoktu (var olanlar tarih, kalem ve iş kalemi üzerineydi). İndekssiz
-- hâlde her proje satırı için üç tam tablo taraması yapılırdı.
CREATE INDEX IF NOT EXISTS idx_financial_transactions_tenant_project ON financial_transactions(tenant_id, project_id, type, status);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_project ON stock_movements(tenant_id, project_id, movement_type, status);

-- Yeni yetki kodu bilerek yok: kârlılık görünümü projenin kendi verisinin
-- türevidir ve `worker/index.js` içindeki yetki eşlemesi onu `projects.read`
-- altına bağlar. Ayrı bir kod, her firmada yönetici elle dağıtana kadar
-- raporun görünmemesi demek olurdu. Bunun bedeli, maliyet ve marjın yanında
-- tahsilatın da `cost.view` arkasına alınmasıdır (worker/index.js,
-- sensitiveFieldGuards): kapı `projects.read` olunca tek koruma noktası orası
-- kalıyor ve korumasız bırakılan tek tutar, proje ekranında zaten görünen
-- sözleşme bedeli oluyor.

PRAGMA optimize;
