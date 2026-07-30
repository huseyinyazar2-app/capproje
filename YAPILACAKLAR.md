# Capproje Ürün Yol Haritası ve Yapılacaklar

> Mevcut aşama: Backend geliştirmesine geçmeden önce nihai ürün yapısını, ekranları, iş akışlarını ve form alanlarını müşteriyle netleştirmek.

## Ürün konumu ve temel kararlar

- [ ] Ürünü yalnızca Capproje'ye özel yazılım değil, benzer firmalara satılabilir sektörel ürün olarak tasarlamak.
- [ ] Ürün markasını Capproje müşteri/firma markasından ayırmak.
- [ ] Hedef ürünü “özel üretim mobilya ve mimari ahşap işleri için tekliften montaja işletim sistemi” olarak konumlandırmak.
- [ ] Genel ERP kapsamına yayılmamak; özel üretim ahşap sektöründe derinleşmek.
- [ ] Tek çekirdek ürün kullanmak; firma ihtiyaçlarını ayarlar, roller, süreç şablonları ve özel alanlarla karşılamak.
- [ ] Müşteriye özel ayrı kod kolları oluşturmamak.
- [ ] Her yeni özelliğin ölçülebilir şekilde zaman kazandırması, hatayı veya maliyet kaybını azaltması şartını koymak.

## Öncelik 0 — Müşteri onayı için ürün ve ekran tasarımı

- [x] Prototipe müşteri görüşmelerinde kullanılacak gezilebilir “Ürün Vizyonu” çalışma alanını eklemek.
- [x] Akıllı teklif, revizyon kilidi, kâr kontrolü, dış işlem, atölye mobil, montaj/hakediş, SaaS yönetimi ve iş akışına gömülü yapay zekâ ekranlarını mock verilerle göstermek.
- [x] Ürün vizyonu ekranlarını her iki mevcut tasarım teması ve mobil menüyle uyumlu hale getirmek.
- [ ] Aşağıdaki tüm süreçlerin liste, oluşturma, düzenleme, detay, onay ve rapor ekranlarını prototipte tamamlamak.
- [ ] Proje → blok → kat → mahal → ürün/iş kalemi hiyerarşisini tüm ilgili ekranlarda görünür kılmak.
- [ ] Kullanıcı rolleri için yönetici, mimar, satış, satın alma, üretim, muhasebe, montaj ve dış kullanıcı görünümlerini tasarlamak.
- [ ] Loading, boş veri, hata, yetkisiz erişim, çevrimdışı ve tekrar deneme durumlarını tasarlamak.
- [ ] Masaüstü, tablet ve telefon ekranlarını doğrulamak.
- [ ] Firma yetkilileriyle her formun gerekli/gereksiz alanlarını işaretleyerek nihai alan kataloğunu çıkarmak.
- [ ] Onaylanan ekranları ve alanları sürümleyerek kapsam belgesi haline getirmek.

## Öncelik 1 — Sektöre özel teklif ve maliyet motoru

- [ ] Mahal ve ürün bazlı keşif/metraj girişi tasarlamak.
- [ ] Ölçülerden miktar ve maliyet hesaplayan parametrik ürün reçeteleri oluşturmak.
- [ ] Levha, kaplama, boya, hırdavat, aksesuar, işçilik, makine, dış hizmet, nakliye ve montaj maliyetlerini hesaba katmak.
- [ ] Fire, kesim payı, genel gider, risk payı, kur farkı ve hedef kâr hesaplarını eklemek.
- [ ] Güncel tedarikçi fiyatlarını teklif maliyetine bağlamak.
- [ ] Ekonomik, standart ve premium teklif alternatifleri oluşturmak.
- [ ] Asgari kâr oranı ve zarar riski uyarıları eklemek.
- [ ] Geçmiş benzer işlerden ürün, süre ve maliyet şablonu kullanılmasını sağlamak.
- [ ] Teklif kabul, ret ve kayıp nedeni takibini eklemek.
- [ ] Tekliften sözleşme, proje ve üretim kayıtlarının tekrar veri girmeden oluşturulmasını sağlamak.

## Öncelik 1 — Revizyon, numune ve müşteri onayı

- [ ] Çizim, malzeme, renk, kaplama ve numuneler için sürüm/revizyon geçmişi tutmak.
- [ ] Müşteri veya mimarın süreli bağlantı üzerinden onay/ret verebildiği portal tasarlamak.
- [ ] Onay veren kişi, tarih, açıklama ve onaylanan sürümü değiştirilemez geçmişte saklamak.
- [ ] Onaylanmamış veya eski revizyonun üretime açılmasını engelleyen onay kapısı oluşturmak.
- [ ] Revizyonun maliyet, termin, satın alma ve üretim üzerindeki etkisini otomatik göstermek.
- [ ] Revizyondan doğan ek işi ve değişiklik emrini teklif/hakediş sürecine bağlamak.
- [ ] Yorumların doğrudan ilgili çizim, mahal ve iş kalemine bağlanmasını sağlamak.

## Öncelik 1 — Proje kârlılığı ve maliyet kaçağı

- [ ] Proje, mahal ve iş kalemi seviyesinde teklif bütçesi, taahhüt edilmiş maliyet, gerçekleşen maliyet ve kalan tahmini maliyeti göstermek.
- [ ] Projenin tahmini bitiş maliyetini ve tahmini bitiş kârını hesaplamak.
- [ ] Malzeme artışı, fazla tüketim, fire, yeniden üretim, gecikme, fazla mesai, dış hizmet ve onaysız ek iş kaynaklı kayıpları ayırmak.
- [ ] “Kâr neden düştü?” açıklamasını tutar ve kaynağıyla göstermek.
- [ ] Kritik sapmalar için erken uyarı ve sorumlu kişiye görev oluşturmak.
- [ ] Proje nakit akışı, tahsilat, ödeme ve hakediş takvimini kârlılıkla birlikte göstermek.

## Öncelik 1 — Satın alma ve dışarı verilen üretim

- [ ] Satın alma talebi, tedarikçi fiyat toplama, karşılaştırma, onay ve sipariş akışını tamamlamak.
- [ ] İhtiyaç tarihi ve üretim planına göre satın alma önerileri oluşturmak.
- [ ] Stokta bulunan, rezerve edilen ve satın alınması gereken miktarları ayırmak.
- [ ] Cila, metal, cam, CNC, döşeme ve benzeri dış işlemleri proje ve iş kalemiyle ilişkilendirmek.
- [ ] Dışarı gönderilen parçanın adet, revizyon, gönderim, beklenen dönüş ve gerçek dönüş bilgisini izlemek.
- [ ] Numune onayı, kalite kabulü, eksik/kusurlu dönüş ve kusur sorumlusunu kaydetmek.
- [ ] Tedarikçi fiyat, kalite, termin ve kusur performansını raporlamak.
- [ ] Tedarikçi gecikmesinin üretim ve montaj tarihine etkisini göstermek.

## Öncelik 1 — Üretim, kalite ve saha kullanımı

- [ ] İş emri, ürün reçetesi, operasyon sırası, iş merkezi ve sorumlu yapısını kurmak.
- [ ] Üretim kapasitesi, iş merkezi yükü ve darboğaz görünümünü tasarlamak.
- [ ] QR/barkod ile iş emri ve ürün takibi sağlamak.
- [ ] Usta ekranını yalnızca güncel çizim, yapılacak iş, malzeme, miktar, kontrol listesi ve temel aksiyonlarla sadeleştirmek.
- [ ] Başlat, duraklat, tamamla, sorun bildir ve fotoğraf ekle işlemlerini mobil uyumlu yapmak.
- [ ] Kalite kontrol noktaları, ölçüm sonuçları, kusur, yeniden işlem ve hurda kaydı eklemek.
- [ ] Zayıf internet bağlantısında çalışacak çevrimdışı PWA kullanımını planlamak.

## Öncelik 1 — Sevkiyat, montaj ve saha kapanışı

- [ ] Mahal ve ürün bazlı paketleme, yükleme ve sevkiyat kontrol listesi oluşturmak.
- [ ] Araca yüklenen ve sahada teslim alınan parçaları QR/barkodla doğrulamak.
- [ ] Saha hazır olma kontrolü ve montaj ekibi planlaması yapmak.
- [ ] Montaj ilerlemesi, süre, ekip, fotoğraf ve konum bilgilerini kaydetmek.
- [ ] Eksik/kusur listesi, sorumlu, termin, düzeltme ve kapanış kanıtını tutmak.
- [ ] Müşteri teslim tutanağı ve dijital imza eklemek.
- [ ] Sahada çıkan ek işi değişiklik emri, fiyatlandırma ve onaya bağlamak.
- [ ] Artan, iade edilen, kaybolan veya hasarlı malzemeyi takip etmek.

## Öncelik 1 — Hakediş ve proje finansı

- [ ] Avans, ara ödeme, hakediş, kalan ödeme ve vade planlarını desteklemek.
- [ ] Avans mahsubu, teminat kesintisi, stopaj ve benzeri kesintileri ayarlanabilir yapmak.
- [ ] Mahal, iş kalemi, miktar veya ilerleme yüzdesi bazlı hakediş hazırlamak.
- [ ] Önceki, bu dönem ve kümülatif hakediş değerlerini göstermek.
- [ ] Onaylı ve onaysız ek işleri ayırmak.
- [ ] Proje bazlı gelir, gider, kasa/banka hareketi ve nakit tahminini göstermek.
- [ ] Resmî muhasebeyi tekrar geliştirmek yerine Datasoft ve gerekirse Logo/Mikro aktarımını planlamak.

## Öncelik 2 — Satılabilir SaaS ürün altyapısı

- [ ] Bulut tabanlı, çok firmalı (multi-tenant) ana ürün mimarisini tasarlamak.
- [ ] Her firmanın verisini güvenli biçimde ayırmak.
- [ ] Büyük firmalar için özel sunucu veya kurum içi kurulum seçeneği hazırlamak.
- [ ] Rol bazlı okuma, yazma, onay, silme, maliyet görme ve dışa aktarma izinleri oluşturmak.
- [ ] Kritik işlemler için değiştirilemez denetim kaydı tutmak.
- [ ] Otomatik günlük yedekleme, saklama süresi ve geri yükleme testlerini planlamak.
- [ ] Dosya/fotoğraf depolama, kota, virüs tarama ve erişim politikalarını belirlemek.
- [ ] Firma, şube, depo, para birimi, dil ve belge numaralandırmasını ayarlanabilir yapmak.
- [ ] Excel'den veri aktarımı ve hazır sektör şablonlarıyla hızlı kurulum sağlamak.
- [ ] Kaynak kodu SaaS müşterilerine devretmeden lisans sözleşmesi hazırlamak.

## Öncelik 2 — Portallar ve entegrasyonlar

- [ ] Müşteri/mimar portalında çizim, numune, değişiklik ve teslim onaylarını sunmak.
- [ ] Tedarikçi portalında fiyat, termin ve sipariş teyidi alınmasını sağlamak.
- [ ] Müşteri portalında iç maliyetleri göstermeden takvim, ilerleme, belge ve fotoğraf paylaşmak.
- [ ] Datasoft muhasebe veri aktarımını araştırmak.
- [ ] Logo ve Mikro entegrasyon ihtiyacını hedef müşterilerle doğrulamak.
- [ ] Excel/CSV, PDF, DWG ve mevcut metraj dosyalarından veri alma akışlarını tasarlamak.
- [ ] Cabinet Vision, Microvellum, Mozaik ve imos ile veri alışverişi seçeneklerini araştırmak.
- [ ] İlk aşamada tam CAD/CAM/CNC ürünü geliştirmemek; mevcut araçlarla entegrasyona öncelik vermek.
- [ ] E-posta ve gerektiğinde WhatsApp bildirimlerini iş akışlarına bağlamak.

## Öncelik 3 — Veriye dayalı yapay zekâ

- [ ] Yapay zekâyı ayrı bir sohbet vitrini yerine mevcut iş akışlarının içine yerleştirmek.
- [ ] Geçmiş benzer projelerden fiyat, süre, malzeme ve işçilik önerisi üretmek.
- [ ] Excel/PDF metrajlarından mahal ve ürün taslağı çıkarmak; kullanıcı onayı olmadan kesin kayıt oluşturmamak.
- [ ] Kâr sapması, fazla tüketim ve gecikme risklerini erken tespit etmek.
- [ ] Tedarikçi teslim süresi ve kalite riskini tahmin etmek.
- [ ] Toplantı kaydından karar, görev, sorumlu ve termin taslağı çıkarmak.
- [ ] Proje sorularına yalnızca kayıt ve belgelerdeki kanıtlara dayanarak cevap vermek.
- [ ] Yeterli kaliteli veri biriktikten sonra fotoğraftan kusur sınıflandırmayı değerlendirmek.
- [ ] Yapay zekâ özelliklerinde firma verisini ortak model eğitimi için izinsiz kullanmamak.
- [ ] Her yapay zekâ özelliğinin zaman veya para kazancını ölçmek.

## Ticarileştirme

- [ ] Capproje'yi ilk tasarım ortağı ve referans müşteri olarak konumlandırmak.
- [ ] Farklı büyüklükte 3–5 benzer firmayla süreç doğrulaması yapmak.
- [ ] İlk hedef müşteri profilini 15–100 çalışanlı, proje bazlı ve iç/dış üretim yapan firmalar olarak sınamak.
- [ ] Gerçek bir proje üzerinden ücretli pilot uygulama modeli hazırlamak.
- [ ] Kurulum/eğitim/veri aktarımı ücreti ile aylık veya yıllık aboneliği ayırmak.
- [ ] Başlangıç, Profesyonel ve Kurumsal paket kapsamlarını belirlemek.
- [ ] Saha/montaj kullanıcılarını sınırsız veya düşük maliyetli tutarak kullanım engelini azaltmak.
- [ ] Özel sunucu, kurum içi kurulum, API, SSO ve çoklu fabrika özelliklerini Kurumsal pakette sunmak.
- [ ] Kaynak kod devrini standart satış modeli yapmamak; gerekiyorsa ayrı ve yüksek bedelli kurumsal anlaşma olarak değerlendirmek.
- [ ] Teklif hazırlama süresi, yeniden üretim maliyeti, onaysız ek iş, kâr tahmin doğruluğu, tedarikçi gecikmesi ve zamanında montaj oranını satış kanıtı olarak ölçmek.

## Bilinçli olarak ilk sürüme alınmayacaklar

- [ ] Genel muhasebe, bordro, e-ticaret, web sitesi ve sektör bağımsız insan kaynakları sistemi geliştirmemek.
- [ ] Tam kapsamlı CAD/CAM, 3D modelleme veya CNC kod üretimini ilk sürüme almamak.
- [ ] Yeterli veri ve açık fayda olmadan gösteriş amaçlı yapay zekâ özellikleri eklememek.
- [ ] Ürün-pazar uyumu görülmeden sınırsız özelleştirilebilir süreç motoru geliştirmemek.
- [ ] Her müşteri için çekirdek ürünü çatallayan özel geliştirmeler yapmamak.
