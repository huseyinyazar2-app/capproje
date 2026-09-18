# Yazılım Özellik Listesi ve Teklif Şartnamesi

## Orman Ürünleri / Özel Üretim Ahşap İşletmesi

| | |
|---|---|
| **Belge tarihi** | 18.09.2026 |
| **Sürüm** | 1.0 |
| **Amaç** | Aşağıda tarif edilen yazılımın aynısı veya dengi için farklı tedarikçilerden karşılaştırılabilir teklif almak. |

---

## 0. Teklif verene not

Bu belge, halihazırda **çalışır durumda olan** bir yazılımın özellik dökümüdür. Hayali bir istek listesi değildir; her madde çalışan üründen çıkarılmıştır.

Teklifinizi hazırlarken lütfen:

1. Her maddeyi **Var / Yok / Ek geliştirme ile** şeklinde işaretleyin.
2. "Ek geliştirme ile" dediğiniz maddeler için **adam-gün** ve **bedel** yazın.
3. Hazır paketinizde olmayan ve yapılamayacak maddeleri açıkça belirtin.
4. Bölüm 13'teki soruları cevaplayın.

Kısmi teklif kabul edilir; ancak hangi bölümlerin kapsam dışı olduğu açıkça yazılmalıdır.

### Ölçek özeti

| Ölçüt | Değer |
|---|---|
| Kullanıcı arayüzündeki ekran sayısı | 49 |
| Arka uçtaki veri kaynağı (API kaynağı) | 44 |
| Ayrı ayrı verilebilen yetki kodu | 166 |
| Durum makinesiyle yönetilen süreç | 19 |
| Veritabanı tablosu | 59 |
| Otomatik test | 138 |
| Toplam kaynak kod (yorumlar dahil) | ~11.700 satır |

---

## 1. Ürün tanımı ve kapsam

Özel üretim mobilya ve mimari ahşap işleri yapan bir işletmenin **tekliften montaj teslimine kadar** bütün sürecini tek programda yöneten, çok firmalı (multi-tenant) bir işletme yönetim sistemi.

**Kapsadığı zincir:**

Müşteri talebi → Keşif ve metraj → Teklif → Sözleşme → Tasarım/çizim onayı → Malzeme planı ve satın alma → Üretim ve kalite → Montaj → Teslim ve kabul → Hakediş ve tahsilat

**Kapsam dışı (bilinçli karar):** Genel muhasebe defteri, resmi bordro hesaplama, e-fatura kesme ve CAD/CAM tasarım araçları bu yazılımda yeniden yapılmaz. Bu işler mevcut muhasebe programında ve tasarım araçlarında kalır.

---

## 2. İşlevsel özellikler — ekran ekran

### 2.1 Genel (4 ekran)

| # | Ekran | Kapsam |
|---|---|---|
| 1 | **Ana Sayfa** | Yönetim panosu. Proje aşama dağılımı, açık teklif sayısı ve tutarı, beklenen tahsilat, gecikmiş borç, üretim ve montaj sayıları, personel sayısı. Dikkat kutuları: gecikmiş görev, bekleyen satın alma onayı, bekleyen tasarım onayı, kalite uyarısı, malzeme eksiği, kapasite çakışması. Her kutu ilgili ekrana atlar. |
| 2 | **Bildirimler** | Kişiye özel iş kutusu. Okundu/okunmadı durumu, kapatma, bildirime basınca ilgili kaydın açılması. |
| 3 | **Ekip Sohbeti** | Firma içi yazışma. Ekip kanalı, projeye bağlı kanal ve duyuru kanalı. Kişi başına okunmamış mesaj sayacı. Mesaja kayıt iliştirme (bkz. 2.8). |
| 4 | **Saha Modu** | Telefon için sadeleştirilmiş hızlı kayıt ekranı. Aktif proje seçilir; fotoğraf, keşif, metraj, kalite kontrolü, teslim eksiği, görüşme ve görev kayıtları tek dokunuşla açılır. Çevrimdışı çalışır. |

### 2.2 Müşteri ve Proje (11 ekran)

| # | Ekran | Kapsam |
|---|---|---|
| 5 | **Müşteriler** | Cari kart: kod, tür (şirket/bireysel/otel/mimar), yetkili kişi, iletişim, vergi dairesi ve numarası, adres, ödeme vadesi, kredi limiti, durum. |
| 6 | **Projeler** | Proje portföyü. Kod, müşteri, tür, saha adresi, şehir, proje yöneticisi, mimar, öncelik, planlanan/gerçekleşen başlangıç ve bitiş, sözleşme bedeli, tahmini maliyet, ilerleme yüzdesi, fotoğraf kullanım izni. **Liste / Kanban / Takvim** görünümü. |
| — | **Proje Komuta Merkezi** | (Projeler ekranından açılır) Aşama şeridi, sonraki aşamaya hazırlık yüzdesi, zorunlu eksikler ve uyarılar, "sıradaki en doğru işler" listesi, açık görev/dosya/tahmini kâr özeti, operasyon bağlantıları (onaylı keşif, onaylı tasarım, üretim tamamlanma, kalite geçişi, montaj tamamlanma, müşteri kabulü). |
| 7 | **Satış & Teklif** | Teklif no, revizyon, tarih, geçerlilik, para birimi, ara toplam, iskonto, KDV, genel toplam, ödeme ve teslim şartları, kayıp/revizyon nedeni. |
| 8 | **Teklif Kalemleri** | Kalem kodu, açıklama, birim, miktar, birim satış fiyatı, maliyet fiyatı, iskonto oranı, vergi oranı, satır toplamı, sıra. Hiyerarşik (ana/alt kalem). |
| 9 | **Keşifler** | Keşif no, tarih, konum, keşfi yapan kişi, müşteri yetkilisi, notlar, onay durumu. |
| 10 | **Keşif Metrajları** | Keşfe bağlı ölçü satırları: mahal, eleman türü, kalem kodu, en/boy/derinlik/uzunluk, miktar, birim, malzeme, yüzey, sıra, not. |
| 11 | **Sözleşmeler** | Sözleşme no, ödeme modeli, bedel, avans oranı ve tutarı, teminat (stopaj) oranı ve tutarı, garanti süresi ve tutarı, ödeme planı, yürürlük ve planlanan tarihler, imzalayan taraflar, fotoğraf izni, fesih nedeni. |
| 12 | **Tasarım Revizyonları** | Revizyon numarası, çizim türü (2B / 3B / imalat çizimi), başlık, bağlı dosya, iş kalemi, onay/ret durumu ve ret gerekçesi, önceki sürüm bağı. |
| 13 | **Proje Toplantıları** | Toplantı türü (haftalık proje / haftalık üretim / koordinasyon / saha), tarih, başlık, yöneten kişi, katılımcılar, özet, yayın durumu. |
| 14 | **Toplantı Aksiyonları** | Toplantıdan çıkan iş: başlık, açıklama, sorumlu, termin, öncelik, durum, tamamlanma zamanı. |
| 15 | **İletişim Günlüğü** | Müşteriyle her temas: kanal (telefon/e-posta/WhatsApp/toplantı/saha), yön (gelen/giden/iç), görüşülen kişi, konu, özet, **alınan karar**, görüşme tarihi, **sonraki takip tarihi**, takip sorumlusu. |

### 2.3 Operasyon (20 ekran)

| # | Ekran | Kapsam |
|---|---|---|
| 16 | **İş Kalemleri** | Üretilecek ürün/mahal: mahal adı, ürün tipi, kalem kodu, ölçüler, miktar, malzeme, yüzey, üretim tipi (iç/dış imalat), tedarikçi, birim maliyet ve satış fiyatı, revizyon onay durumu. |
| 17 | **Proje Görevleri** | Başlık, açıklama, sorumlu, departman, öncelik, planlanan başlangıç/bitiş, tamamlanma, ilerleme yüzdesi, bağımlılıklar, alt görev. |
| 18 | **Satın Alma (Talepler)** | Talep no, malzeme/hizmet, miktar, birim, ihtiyaç tarihi, öncelik, tahmini tutar, önerilen tedarikçi, teknik şartname, onay zinciri. |
| 19 | **Tedarikçi Teklifleri** | Aynı talebe gelen tekliflerin karşılaştırılması: teklif no, tarih, geçerlilik, birim fiyat, toplam, termin (gün), ödeme şartı, kalite notu. **Karşılaştırma ekranı**, en düşük–en yüksek farkı ve seçim gerekçesi. |
| 20 | **Satın Alma Siparişleri** | Sipariş no, tedarikçi, talep bağı, sipariş ve beklenen tarih, tutarlar, teslimat adresi, **mal kabul** işlemi. |
| 21 | **Üretim** | İş emri: kod, iş kalemi, üretim tipi, taşeron branşı (cila/metal/cam-ayna/kapı/döşeme/taş), atölye, ekip, planlanan/gerçekleşen tarihler, miktar, tamamlanan miktar, kalite durumu. |
| 22 | **Ürün Reçeteleri (BOM)** | İş kalemi başına malzeme listesi: stok kartı, kalem kodu, birim başına miktar, birim, fire oranı, birim maliyet, tedarikçi, sıra. **Reçeteyi patlatma** ile malzeme ihtiyacına dönüştürme. |
| 23 | **İş Merkezleri** | Kod, ad, kategori, günlük kapasite (dakika), saatlik maliyet, dış imalat işareti. |
| 24 | **Üretim Operasyonları** | İş emri içindeki adımlar: sıra, ad, iş merkezi, planlanan süre ve tarihler, sorumlu, başlatma/tamamlama. |
| 25 | **Üretim Sorunları** | Sorun no, tür (malzeme/kalite/makine/çizim/iş gücü/tedarikçi), önem, açıklama, sorumlu, **yeniden imalat miktarı, hurda miktarı, maliyet etkisi, gecikme günü**, kök neden, çözüm. |
| 26 | **İş Merkezi Yükü** | Kapasite doluluk görünümü. |
| 27 | **Montaj** | Montaj plan no, konum, ekip lideri, ekip, planlanan/gerçekleşen tarih, ilerleme, saha hazırlık notu, teslim yetkilisi, eksik notları. |
| 28 | **Kalite Kontrolleri** | Kontrol no, tür (girdi/süreç içi/final/saha), tarih, kontrolü yapan, sonuç (geçti/koşullu/kaldı), kontrol listesi, kusur notu, düzeltici faaliyet ve termini. |
| 29 | **Teslim & Kabul** | Teslim no, tarih, müşteri yetkilisi, memnuniyet puanı, **müşteri imza dosyası**, kabul notları. |
| 30 | **Teslim Eksikleri (Punch List)** | Eksik başlığı, açıklama, sorumlu, termin, önem, çözüldü/kabul edildi durumu. |
| 31 | **Tedarikçiler** | Kod, ad, kategori, yetkili, iletişim, vergi bilgileri, ödeme vadesi, **puan**, durum (aktif/kara liste). |
| 32 | **Stok Kartları** | SKU, ad, kategori, birim, rezerve miktar, minimum miktar, ortalama maliyet, depo konumu, tercih edilen tedarikçi. |
| 33 | **Stok Hareketleri** | Hareket no, tür (giriş/çıkış/sayım fazlası/sayım eksiği/projeye çıkış/projeden iade), tarih, miktar, birim maliyet, toplam maliyet, kaynak kayıt, referans. Kesinleştirme (post) işlemi. |
| 34 | **Malzeme İhtiyaç Planı** | Proje ve iş kalemi bazında ihtiyaç: stok kartı, miktar, birim, ihtiyaç tarihi. **Stoktan rezerve etme**, **satın almaya bağlama**, **tüketme** akışları. Eksik uyarısı. |
| 35 | **Ekip & Kapasite** | Kaynak planı: personel/ekip/iş merkezi/taşeron, rol, planlanan tarih aralığı, tahsis yüzdesi. **Çakışma tespiti**. |

### 2.4 Finans (4 ekran)

| # | Ekran | Kapsam |
|---|---|---|
| 36 | **Proje Finansları** | Gelir, gider, hakediş, avans ve maliyet tahmini hareketleri. Kategori, tutar, para birimi, kur, işlem ve vade tarihi, ödeme yöntemi, referans. **Resmi / proje içi (gayri resmi) ayrımı** ve ayrı sekmeler. Onay ve ters kayıt işlemleri. |
| 37 | **Faturalar & Ön Muhasebe** | Fatura no, yön (satış/alış), taraf, tarih, vade, ara toplam, KDV, genel toplam, ödenen tutar, resmi işareti, muhasebe aktarım durumu alanı. |
| 38 | **Kasa & Banka** | Hesap kodu, ad, tür, para birimi, banka, IBAN, açılış ve güncel bakiye. |
| 39 | **Hakedişler** | Hakediş no, sözleşme bağı, dönem, önceki/bu dönem/kümülatif imalat, kesinti, teminat, vergi, net ödenecek. Onay akışı, fatura ve tahsilat kaydı bağlantısı. |

### 2.5 İnsan Kaynakları (4 ekran)

| # | Ekran | Kapsam |
|---|---|---|
| 40 | **Personel** | Sicil no, ad, TC (maskeli), doğum tarihi, iletişim, departman, unvan, çalışma şekli, işe giriş/çıkış, bağlı yönetici, maaş, acil durum kişisi, adres. |
| 41 | **Puantaj** | Gün bazında giriş/çıkış, normal dakika, fazla mesai dakikası, konum, kaynak (manuel/mobil/cihaz), durum. |
| 42 | **İzinler** | İzin türü (yıllık/sağlık/ücretsiz/mazeret/doğum), tarih aralığı, gün sayısı, gerekçe, onay akışı. |
| 43 | **Bordro Hazırlık** | Dönem bazında: baz maaş, fazla mesai, prim, yardım, kesinti, avans, net önizleme. *(Resmi bordro hesabı değil; muhasebeye girdi hazırlar.)* |

### 2.6 Yönetim (6 ekran)

| # | Ekran | Kapsam |
|---|---|---|
| 44 | **Dosyalar** | Bağlamsal dosya merkezi. Her dosya projeye, iş kalemine, tasarım revizyonuna, kalite kontrolüne veya montaja bağlanır. Mahal, süreç aşaması, çekim tarihi, kategori, **görünürlük** (yalnız firma içi / müşteriyle paylaşılabilir / pazarlamada kullanılabilir), fotoğraf izni anlık görüntüsü, dosya özeti (checksum). Tarayıcı içi önizleme (görsel ve PDF). |
| 45 | **Kullanıcılar** | Davet, rol atama, çoklu rol, unvan, durum, **geçici şifre verme** ve ilk girişte zorunlu değiştirme. |
| 46 | **Roller & Yetkiler** | Rol tanımı ve 166 yetki kodunun tek tek işaretlenmesi. 8 hazır rol şablonu (+ Firma Sahibi): Mimar, Proje Yöneticisi, Satın Alma, Üretim, Montaj, Finans/Ön Muhasebe, İnsan Kaynakları, Salt Okunur. |
| 47 | **Denetim Kayıtları** | Salt okunur işlem izi: kim, ne zaman, hangi modülde, hangi kaydı, hangi işlemi yaptı, hangi IP'den. |
| 48 | **Yedekler** | Yedek listesi, durum, kayıt sayısı, tetikleyen kişi, anlık yedek alma. |
| 49 | **API Erişim Anahtarları** | Dış sistem entegrasyonu için anahtar üretme, yenileme ve iptal. Anahtar yalnız bir kez gösterilir. |

### 2.7 Her liste ekranında ortak özellikler

- **Arama** — ekrana özgü alanlarda metin araması
- **Sayfalama** — sayfa başına 1–100 kayıt
- **Süzme** — kaynağa özel alan bazlı süzgeçler
- **Üç görünüm** — Liste, Kanban (durum sütunları), Takvim (aylık)
- **CSV dışa aktarım** — ayrı yetkiye bağlı
- **Satır işlemleri** — detay, düzenle, sil, iş akışı düğmeleri
- **Yeni kayıt formu** — zorunlu alan denetimi, alan bazlı hata mesajı
- **Bağlı kayıt seçici** — ID yazmak yerine arayarak seçme
- **Yetki duyarlılığı** — yetkisi olmayan alan, sütun ve düğme hiç görünmez

### 2.8 Kayıt paylaşma ve kısayollar

- Her kayıt detayında **"Bağlantıyı kopyala"** — kaydın doğrudan adresini panoya alır
- **"Sohbette paylaş"** — kaydı ekip sohbetine iliştirir
- Adres çubuğu açık kaydı gösterir; kopyalanıp e-posta/WhatsApp ile paylaşılabilir
- Paylaşılan adres yetkiyi değiştirmez
- Genel arama sonucu ve bildirim, doğrudan ilgili kaydın üzerine gider
- Genel arama: proje, müşteri, teklif, ürün, satın alma ve belgede aynı anda arar

---

## 3. Süreç kuralları ve iş akışı motoru

### 3.1 Proje aşama zinciri

14 aşama: Talep → Keşif → Teklif Hazırlığı → Teklif → Sözleşme → Tasarım → Satın Alma → Üretim & Kalite → Montaj → Teslim → Tamamlandı (ayrıca Beklemede, Kaybedildi, İptal).

Aşamalar arası geçiş **serbest değildir**; her aşamadan hangi aşamalara geçilebileceği tanımlıdır.

### 3.2 Aşama kapıları (kontrol koşulları)

Her geçişte otomatik kontrol edilen koşullar. İki seviye:

- **Engel (blocker)** — tamamlanmadan geçiş yapılamaz
- **Uyarı (warning)** — geçiş yapılır ama kullanıcı uyarılır

Örnek kapılar:

| Hedef aşama | Koşul | Seviye |
|---|---|---|
| Teklif Hazırlığı | Onaylı keşif ve metraj mevcut | Engel |
| Teklif | Müşteriye sunulmuş teklif mevcut | Engel |
| Sözleşme | Kabul edilmiş teklif mevcut | Engel |
| Sözleşme | İmzalı sözleşme mevcut | Uyarı |
| Tasarım | İmzalı/aktif sözleşme mevcut | Engel |
| Tasarım | Ödeme planı tanımlı | Uyarı |
| Satın Alma | Onaylı tasarım revizyonu + tanımlı iş kalemleri | Engel |
| Üretim | Güncel tasarım onaylı | Engel |
| Üretim | Tüm malzemeler rezerve veya siparişe bağlı | Engel |
| Üretim | Malzeme ihtiyaç planı hazır | Uyarı |
| Üretim | Bekleyen satın alma onayı yok | Uyarı |
| Üretim | Kapasite çakışması yok | Uyarı |
| Montaj | Üretim emirleri tamamlandı + final kalite geçti | Engel |
| Teslim | Montaj tamamlandı | Engel |
| Tamamlandı | Müşteri kabulü var + açık teslim eksiği yok | Engel |

**Yönetici istisnası:** Zorunlu koşullar yalnız firma sahibi/yönetici tarafından, **en az 10 karakterlik yazılı gerekçeyle** aşılabilir. Gerekçe denetim kaydına yazılır.

### 3.3 Aşama geçişinin yan etkileri

- Hedef aşamaya özgü **standart görevler otomatik açılır** (departman ve termin ile)
- Proje yöneticisine **bildirim** düşer
- İşlem denetim kaydına yazılır

### 3.4 Durum makinesiyle yönetilen 19 süreç

Aşağıdaki kayıtların durumu **elle değiştirilemez**; yalnız kendi iş akışı uçlarından değişir:

Teklifler · Projeler · Üretim emirleri · Satın alma talepleri · Satın alma siparişleri · İzinler · Finans hareketleri · Keşifler · Sözleşmeler · Tasarım revizyonları · Hakedişler · Stok hareketleri · Toplantılar · Kalite kontrolleri · Teslimler · Malzeme ihtiyaçları · Tedarikçi teklifleri · Üretim operasyonları · Üretim sorunları

**İş akışı eylemleri:** onayla, reddet, aşama değiştir, üretime sal, tamamla, mal kabul, sipariş oluştur, stok kesinleştir, ters kayıt, tedarikçi teklifi seç, yayınla, çözüme kapat, projeye dönüştür, kabul et, rezerve et, satın almaya bağla, tüket, onaya gönder, reçeteyi patlat, revizyon onayla.

### 3.5 Ek iş kuralı örnekleri (sunucuda zorunlu)

- Kabul edilmiş teklif olmadan sözleşme yapılamaz
- İmzalı sözleşme olmadan hakediş düzenlenemez
- Revizyonu onaylanmamış iş kalemi üretime salınamaz
- Stokta yeterli miktar yoksa rezervasyon ve çıkış reddedilir
- Kapatılmış toplantıya aksiyon eklenemez
- Kabul edilmiş teslime yeni eksik eklenemez
- Müşteri imza dosyası olmadan teslim kabul edilemez
- Açık teslim eksiği varken proje kapatılamaz

---

## 4. Yetkilendirme ve roller

| Özellik | Kapsam |
|---|---|
| Yetki modeli | Rol tabanlı (RBAC), **166 ayrı yetki kodu** |
| Yetki granülerliği | Kaynak başına oku / yaz / sil + işleme özel yetkiler (onayla, üretime sal, mal kabul, stok kesinleştir, ters kayıt, tedarikçi seç…) |
| Çoklu rol | Bir kullanıcıya birden fazla rol atanabilir |
| Rol şablonları | 8 hazır şablon + firma sahibi rolü; yeni firma açıldığında otomatik kurulur |
| Üst yetki devri | `files.manage` → `files.read/write/delete`; `users.manage` → üyelik yetkileri; `roles.manage` → rol yetkileri |
| Hassas alan koruması | Maliyet (`cost.view`), maaş (`salary.view`), özlük (`hr.sensitive.read`), resmi finans/IBAN (`finance.sensitive.read`) — yetkisi olmayan bu alanları **sunucudan hiç almaz**, sadece arayüzde gizlenmez |
| Yetki yükseltme koruması | Sistem rollerini (sahip/yönetici) yalnız firma sahibi atayabilir |
| Salt okunur rol | Görür, yazamaz |

---

## 5. Güvenlik

### 5.1 Kimlik doğrulama

| Özellik | Uygulama |
|---|---|
| Giriş yöntemi | Telefon numarası + şifre |
| İkinci giriş yöntemi | SMS tek kullanımlık kod (Twilio Verify). Kod hazır, kullanılması için SMS sağlayıcı hesabı tanımlanmalıdır. |
| Şifre saklama | **PBKDF2-HMAC-SHA256**, kullanıcı başına rastgele tuz (salt) |
| Tur sayısı | Varsayılan **100.000**, ortam değişkeniyle 1.000.000'a kadar yükseltilebilir |
| Tur sayısı geçmişi | Her kayıt kendi tur sayısını saklar; artırım eski şifreleri bozmaz |
| Zamanlama saldırısı koruması | Kullanıcı yoksa da sahte tuzla hash hesaplanır |
| Şifre kuralı | En az 8 karakter, en az bir harf ve bir rakam |
| Geçici şifre | Yönetici verir, **ilk girişte değiştirme zorunlu**; değiştirilmeden hiçbir yazma işlemi yapılamaz |
| Oturum saklama | HttpOnly çerez; çerez engellenirse başlıkla taşıma yedeği |
| Oturum jetonu | Veritabanında **hash'lenerek** saklanır, açık metin tutulmaz |
| Oturum süresi | 12 saat; kullanım sürerse son 1 saatte otomatik uzar |
| Oturum üst sınırı | Kullanıcı başına **10** eş zamanlı oturum; aşılınca en eski oturum kapatılır |
| Oturum yönetimi | Kullanıcı kendi açık oturumlarını (cihaz, giriş yöntemi, son görülme) listeler; tek tek veya "diğerlerinin hepsi" şeklinde sonlandırır |
| IP ve cihaz izi | IP ve tarayıcı bilgisi **hash'lenerek** saklanır |

### 5.2 Kaba kuvvet ve kötüye kullanım koruması

| Koruma | Eşik |
|---|---|
| Başarısız giriş (telefon başına) | 10 dakikada 5 deneme → 429, 10 dakika bekleme |
| Başarısız giriş (IP başına) | 10 dakikada 20 deneme → 429 |
| Şifre sıfırlama talebi | Saatte sınırlı → 429, 1 saat bekleme |
| Sayaç mantığı | Yalnız **başarısız** denemeler sayılır (aynı ofisten çalışan ekip topluca kilitlenmez) |
| Deneme kaydı saklama | 7 gün sonra otomatik silinir |

### 5.3 Uygulama güvenliği

| Önlem | Değer |
|---|---|
| Content-Security-Policy | `default-src 'self'` — satır içi script **yok**, dış kaynak **yok**, yazı tipleri dahil her şey kendi alan adından |
| Çerçeveleme koruması | `frame-ancestors 'none'` + `X-Frame-Options: DENY` |
| MIME koruması | `X-Content-Type-Options: nosniff` |
| Referrer politikası | `strict-origin-when-cross-origin` |
| Tarayıcı izinleri | Kamera, mikrofon, konum, ödeme, USB kapalı |
| CSRF koruması | Giriş ve yazma işlemlerinde kaynak (origin) doğrulaması |
| SQL enjeksiyonu | Tüm sorgular parametreli; dinamik SQL yok |
| İstek gövdesi sınırı | Varsayılan 12 MB, yapılandırılabilir |
| Dosya yükleme sınırı | Varsayılan 10 MB, yapılandırılabilir |
| Metin alan sınırı | Kısa alan 2.000, uzun metin 20.000, JSON 100.000 karakter |
| Genel ağa açılma koruması | Sunucu, ters vekil (nginx) arkasında olmadan genel IP'ye açılmayı reddeder |

### 5.4 Çok firmalı (multi-tenant) izolasyon

- Her tablo `tenant_id` taşır
- **Her sorguda** firma kimliği zorunlu koşuldur (kod tabanında 165 ayrı yerde)
- Bir kayda başka firmanın kaydı bağlanmaya çalışılırsa istek reddedilir (`cross_tenant_reference`)
- Kullanıcı birden fazla firmaya üye olabilir; firma değiştirme seçicisi vardır
- Yedekler firma bazında alınır

### 5.5 İşlem izi ve veri bütünlüğü

| Özellik | Kapsam |
|---|---|
| Denetim kaydı | Her oluşturma, düzenleme, silme, onay, aşama geçişi, yükleme, dışa aktarım ve yetki değişikliği kaydedilir |
| Kaydedilen bilgi | Kullanıcı, işlem, modül, kayıt, istek kimliği, IP, değişen alanlar, zaman |
| Değiştirilemezlik | Denetim kaydı ekranı **salt okunur**; API'den silinemez |
| Tekrarlı istek koruması | `Idempotency-Key` başlığı; aynı istek iki kez gönderilirse ikinci kez işlenmez, ilk yanıt döner |
| Eşzamanlılık | İşlem devam ederken aynı anahtarla gelen ikinci istek 409 ile reddedilir |
| Silme koruması | İş akışıyla yönetilen kayıtlar yalnız belirli durumlarda silinebilir |

### 5.6 Kişisel veri (KVKK'ya yardımcı özellikler)

- TC kimlik numarası **maskelenmiş** saklanır
- Özlük alanları (doğum tarihi, adres, acil durum kişisi) ayrı yetkiye bağlı
- Maaş alanları ayrı yetkiye bağlı
- **Fotoğraf kullanım izni** proje ve sözleşme düzeyinde tutulur (talep edilmedi / izin verilmedi / yalnız firma içi / pazarlamada kullanılabilir)
- Yüklenen her dosyada izin durumunun **anlık görüntüsü** saklanır
- Dosya görünürlüğü üç seviyeli

---

## 6. Teknoloji ve mimari

### 6.1 Teknoloji yığını

| Katman | Teknoloji |
|---|---|
| Arayüz | React 19.2, Vite 6.4 ile derleme |
| Arayüz mimarisi | Tek sayfa uygulaması (SPA), kod bölme (code splitting) |
| İkonlar | Phosphor Icons |
| Yazı tipleri | Kendi sunucusundan servis edilir (dış CDN yok) |
| Arka uç | JavaScript (ESM), çalışma zamanı Node.js ≥ 24 |
| Arka uç mimarisi | **Tek paylaşılan istek işleyici** — hem Cloudflare Workers hem Node sunucusunda aynı kod çalışır |
| Veritabanı | SQLite (yerel), Turso/libSQL (bulut), Cloudflare D1 |
| Dosya saklama | Dosya sistemi (kendi sunucusu) veya nesne deposu (bulut) |
| Bağımlılık sayısı | 6 doğrudan üretim bağımlılığı |

> **Not:** Bağımlılık sayısının azlığı bilinçli bir karardır. Üçüncü taraf kütüphane ne kadar azsa, güvenlik açığı yüzeyi ve bakım yükü o kadar düşüktür.

### 6.2 Veritabanı

- 14 sürüm göçü (migration) dosyası, sıralı ve tekrar çalıştırılabilir
- Göçler **sunucu açılışında otomatik uygulanır**
- Uygulanan göçler takip tablosunda tutulur
- Yabancı anahtar kısıtları açık (`PRAGMA foreign_keys=ON`)
- WAL kayıt modu, tam senkronizasyon
- Para tutarları **kuruş cinsinden tam sayı** saklanır (kayan nokta hatası yok)
- Tarihler ISO 8601 metin

### 6.3 API

| Özellik | Kapsam |
|---|---|
| Tür | REST, JSON |
| Sürümleme | `/api/v1/` |
| Kaynak sayısı | 44 |
| İşlemler | Listele, getir, oluştur, güncelle, sil + kaynağa özel iş akışı uçları |
| Kimlik doğrulama | API anahtarı (Bearer) veya oturum jetonu |
| Sayfalama | `page` / `pageSize` (en fazla 100) + toplam sayı |
| Arama ve süzme | `q` ve alan bazlı parametreler |
| Dışa aktarım | Kaynak başına `/export` ile CSV |
| Hata biçimi | Standart: kod, okunabilir mesaj, ayrıntı |
| Tekrarlı istek koruması | `Idempotency-Key` |
| Anahtar yönetimi | Üretme, yenileme, iptal, son kullanma tarihi |

---

## 7. Mobil uyumluluk ve çevrimdışı çalışma

### 7.1 Mobil

| Özellik | Kapsam |
|---|---|
| Yaklaşım | Duyarlı (responsive) tek kod tabanı — ayrı mobil uygulama yok |
| Kırılım noktaları | 1050 px (daralmış menü), 720 px (telefon düzeni) |
| Telefon menüsü | Alt sekme çubuğu (4 kısayol) + tam menü çekmecesi |
| Güvenli alan | Çentikli ekranlar için `safe-area-inset` desteği |
| Dokunma hedefleri | Asgari 40–46 px yükseklik |
| Kamera | Saha modunda doğrudan kameradan fotoğraf çekme |
| Yatay kaydırma | Hiçbir ekranda yatay taşma yok (test edilmiştir) |

### 7.2 PWA (telefona kurulabilir uygulama)

- Web App Manifest (ad, ikonlar 192/512 px, tema rengi, `standalone` görünüm)
- Service Worker ile uygulama kabuğu önbelleği
- Ana ekrana eklenebilir; tarayıcı çubuğu olmadan tam ekran açılır

### 7.3 Çevrimdışı çalışma

| Özellik | Kapsam |
|---|---|
| Amaç | Şantiyede internet yokken saha kaydı kaybolmasın |
| Depolama | Tarayıcıda IndexedDB kuyruğu |
| Kapsam | 15 kayıt türünde **yeni kayıt** (keşif, metraj, iş kalemi, görev, satın alma talebi, üretim, montaj, puantaj, toplantı, aksiyon, kalite, teslim eksiği, görüşme, kaynak planı, malzeme ihtiyacı) |
| Kuyruk sınırı | 100 kayıt, kayıt başına 128 KB, 7 gün ömür |
| Eşitleme | Bağlantı gelince otomatik; elle de tetiklenebilir |
| Çakışma koruması | Her kuyruk kaydı `Idempotency-Key` taşır — iki kez gönderilmez |
| Kullanıcı geri bildirimi | Çevrimdışı uyarı çubuğu, "Kuyrukta" rozeti, bekleyen/başarısız sayacı |
| Bilinçli sınır | Onay, silme ve dosya yükleme çevrimdışı yapılmaz (veri bütünlüğü için) |

### 7.4 Masaüstü uygulaması

- Windows için Electron tabanlı kurulum paketi
- GitHub Actions ile derlenir
- Linux AppImage çıktısı da alınabilir

---

## 8. Yedekleme, veri sahipliği ve süreklilik

| Özellik | Kapsam |
|---|---|
| Uygulama içi yedek | Firma bazında, tek tıkla; firmaya ait 48 tablo JSONL biçiminde dışa yazılır |
| Yedek içeriği | Şema sürümü, göç listesi, firma kimliği ve zaman damgası içeren başlık (manifest) |
| Günlük otomatik yedek | Kendi sunucusunda günlük SQLite dosya yedeği |
| Saklama süresi | Varsayılan 30 gün, yapılandırılabilir (1–3650) |
| Yedek doğrulama | Ayrı komut satırı aracı (`db:verify-backup`) |
| Geri yükleme | **Bilinçli olarak uygulama içinden kapalı** — bakım penceresinde komut satırından yapılır (kazara veri kaybı riskini ortadan kaldırır) |
| Veri sahipliği | Veri müşterinin kendi sunucusunda veya kendi bulut hesabında durur |
| Dışa aktarım | Her ekrandan CSV; tam veri dökümü yedek dosyasından |
| Kilitlenme yok | Standart SQLite; özel/kapalı format kullanılmaz |

---

## 9. Kurulum ve işletim seçenekleri

Yazılım **aynı kod tabanıyla** üç şekilde çalışır:

| Seçenek | Açıklama |
|---|---|
| **Kendi sunucusu** | Ubuntu + Node.js 24 + yerel SQLite. Nginx arkasında. Dosyalar disk üzerinde. |
| **Bulut (uç ağ)** | Cloudflare Workers + D1 veritabanı + R2 nesne deposu |
| **Bulut (yönetilen veritabanı)** | Turso / libSQL |

**İşletim özellikleri:**
- Göçler açılışta otomatik uygulanır — elle SQL çalıştırmak gerekmez
- Veri dizini kalıcı disk kontrolü (kalıcı olmayan diske kurulursa uyarır)
- Dosya izinleri kısıtlanır (0600 / 0700)
- İlk kurulum tek uçtan (firma + sahip kullanıcı + API anahtarı)
- Sağlık kontrolü ve hata ayıklama modu ortam değişkeniyle

---

## 10. Kalite güvencesi

| Ölçüt | Değer |
|---|---|
| Otomatik test sayısı | **138** |
| Test dosyası | 12 |
| Test kapsamı | API sözleşmesi, iş akışı kuralları, güvenlik sözleşmesi, çok firmalı izolasyon, göç sözleşmesi, arayüz sözleşmesi, PWA sözleşmesi, kendi sunucusu, Turso bağdaştırıcısı, operasyon zinciri, tedarik ve maliyetlendirme, alan tamlığı |
| Çalıştırma | `npm test` — dış servis gerektirmez |
| Test türü | Gerçek veritabanına karşı uçtan uca; sahte (mock) değil |

---

## 11. Dokümantasyon ve devreye alma

| Ürün | Kapsam |
|---|---|
| **Kullanım kılavuzu** | Uygulamanın içinden erişilen, 17 bölümlük Türkçe kılavuz. Adım adım anlatım, 25 ekran görüntüsü, bütün ekranların dizini, sık karşılaşılan uyarıların açıklaması. |
| Kılavuz bakımı | Ekran görüntüleri tek komutla yeniden üretilir; arayüz değiştiğinde kılavuz eskimez |
| **Tanıtım veri seti** | Tek komutla, birbirine bağlı gerçekçi örnek veri: 12 proje (farklı aşamalarda), 10 müşteri, 6 tedarikçi, 10 personel, 8 rollü kullanıcı, keşiften teslime bütün kayıtlar |
| Arayüz dili | Tamamı Türkçe. Tarih `gg.aa.yyyy`, sayı `1.234,50`, para `TL` |
| Kod içi belgeleme | Yorumlar Türkçe ve "neden" sorusunu yanıtlar |

---

## 12. Kapsam sınırları — bu yazılımda **olmayan**lar

Karşılaştırmanın dürüst olması için, bu yazılımda bulunmayan veya bilinçli olarak
sınırlı bırakılan noktalar aşağıdadır. Teklif veren firmaların bu maddelerde ne
sunduğunu ayrıca belirtmesi beklenir.

| Konu | Durum |
|---|---|
| Genel muhasebe defteri | Yok — bilinçli karar. Mevcut muhasebe programında kalır. |
| Resmi bordro hesaplama | Yok — yalnız bordro girdisi hazırlanır. |
| E-fatura / e-arşiv kesme | Yok. Fatura kaydı tutulur, resmi kesim dışarıda yapılır. |
| Muhasebe programı entegrasyonu | Veri alanı hazır (aktarım durumu). Kullanılan muhasebe programının entegrasyon (veri alışverişi) özelliği varsa bağlantı eklenebilir. |

---

## 13. Teklif verene sorular

Lütfen aşağıdaki soruları **yazılı** olarak cevaplayın:

### 13.1 Kapsam
1. Bölüm 2'deki 49 ekranın kaçı hazır paketinizde var? Olmayanlar için ek geliştirme bedeli nedir?
2. Bölüm 3'teki aşama kapıları ve zorunlu iş kuralları sizin üründe **sunucu tarafında** mı, yoksa yalnız arayüzde mi zorlanıyor?
3. Yönetici istisnası (gerekçeli aşma) ve bunun denetim kaydına yazılması var mı?
4. Resmi / proje içi finans ayrımı destekleniyor mu?

### 13.2 Güvenlik
5. Şifreler hangi algoritma ve kaç turla saklanıyor?
6. Kaba kuvvet koruması var mı, eşikleri nedir?
7. Yetki granülerliğiniz nedir — kaç ayrı yetki kodu tanımlanabiliyor?
8. Hassas alanlar (maliyet, maaş, özlük) yetkisiz kullanıcıya **sunucudan** gönderiliyor mu, yoksa sadece arayüzde mi gizleniyor?
9. Denetim kaydı hangi işlemleri kapsıyor? Silinebiliyor mu?
10. Çok firmalı kullanımda firma izolasyonu nasıl garanti ediliyor?

### 13.3 Teknoloji ve sahiplik
11. Kaynak kodu müşteriye veriliyor mu? Hangi lisansla?
12. Yazılım müşterinin **kendi sunucusunda** çalışabiliyor mu, yoksa yalnız sizin bulutunuzda mı?
13. Veri hangi ülkede saklanıyor?
14. Müşteri istediği anda verisinin tamamını hangi biçimde dışa aktarabilir?
15. Sözleşme biterse veriye ne olur?
16. Kaç üçüncü taraf bağımlılık kullanıyorsunuz?

### 13.4 Mobil ve saha
17. Mobil erişim nasıl sağlanıyor: duyarlı web, PWA, yoksa ayrı uygulama mı?
18. Ayrı uygulamaysa iOS ve Android ayrı ücretlendiriliyor mu?
19. **İnternet olmayan şantiyede** kayıt alınabiliyor mu? Alınabiliyorsa hangi kayıt türlerinde ve nasıl eşitleniyor?

### 13.5 Ticari
20. Lisans modeli: kullanıcı başına mı, firma başına mı, tek seferlik mi?
21. Yıllık bakım/destek bedeli ve kapsamı nedir?
22. Sürüm yükseltmeleri bakım bedeline dahil mi?
23. Devreye alma süresi ve eğitim kapsamı nedir?
24. Destek yanıt süresi taahhüdünüz (SLA) nedir?
25. Özel geliştirme adam-gün ücreti nedir?
26. Veri aktarımı (mevcut Excel/program verisinin taşınması) kapsam dahilinde mi?

---

## 14. Değerlendirme kriterleri

Teklifler aşağıdaki ağırlıklarla değerlendirilecektir:

| Kriter | Ağırlık |
|---|---|
| İşlevsel kapsam (Bölüm 2–3) | %35 |
| Güvenlik ve veri sahipliği (Bölüm 4–5, 8) | %25 |
| Toplam sahip olma maliyeti (lisans + bakım + geliştirme, 3 yıllık) | %20 |
| Mobil ve saha kullanımı (Bölüm 7) | %10 |
| Devreye alma süresi ve eğitim | %10 |

---

## 15. Ekler

**Ek-1:** Yetki kodları listesi (166 kalem) — talep üzerine verilir
**Ek-2:** Veri modeli / tablo listesi — talep üzerine verilir
**Ek-3:** Örnek ekran görüntüleri ve kullanım kılavuzu — talep üzerine verilir

---

*Bu belge, çalışır durumdaki bir yazılımın kod tabanından çıkarılmıştır. Her madde doğrulanabilir.*
