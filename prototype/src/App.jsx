import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bank,
  Bell,
  Buildings,
  CalendarBlank,
  CaretDown,
  ChartBar,
  ChartLineUp,
  CheckCircle,
  ClipboardText,
  Clock,
  CurrencyCircleDollar,
  Factory,
  FileText,
  FolderSimple,
  FrameCorners,
  Handshake,
  House,
  IdentificationCard,
  Images,
  ListChecks,
  MagnifyingGlass,
  MapPin,
  Package,
  PaintBrush,
  Plus,
  Receipt,
  ShoppingCart,
  SidebarSimple,
  Sparkle,
  TreeEvergreen,
  Truck,
  UserCircle,
  UsersThree,
  Wallet,
  Warning,
  X,
} from "@phosphor-icons/react";
import { FormStructureSummary, SpecializedForm, formBlueprintMeta } from "./SpecializedForms";
import { ProductVision } from "./ProductVision";

const projects = [
  {
    id: "gedikpasa",
    name: "Gedikpaşa Otel",
    code: "CP-25018",
    location: "Fatih / İstanbul",
    stage: "İmalat",
    progress: 65,
    owner: "Ahmet Şahin",
    deadline: "30 Eyl 2026",
    contract: "₺24.800.000",
    actual: "₺12.750.000",
    risk: "Orta",
    next: "Üretim kontrolü",
    nextDate: "30 Tem 2026",
    description: "12 oda sabit mobilyaları, lobi duvar panelleri ve kapı imalatları",
  },
  {
    id: "kurtkoy",
    name: "Kurtköy Konutları",
    code: "CP-25032",
    location: "Pendik / İstanbul",
    stage: "Satın Alma",
    progress: 42,
    owner: "Murat Demir",
    deadline: "20 Ağu 2026",
    contract: "₺31.500.000",
    actual: "₺11.960.000",
    risk: "Yüksek",
    next: "Kaplama malzemesi onayı",
    nextDate: "29 Tem 2026",
    description: "306 daire mutfak, kapı, vestiyer ve banyo dolabı işleri",
  },
  {
    id: "kavacik",
    name: "Kavacık Ofis",
    code: "CP-25027",
    location: "Beykoz / İstanbul",
    stage: "Tasarım Onayı",
    progress: 80,
    owner: "Selin Kara",
    deadline: "15 Eki 2026",
    contract: "₺18.200.000",
    actual: "₺13.880.000",
    risk: "Orta",
    next: "Tasarım onayı",
    nextDate: "31 Tem 2026",
    description: "Toplantı, muhasebe ve yönetici odaları özel üretim mobilyaları",
  },
  {
    id: "tuzla",
    name: "Tuzla Villa",
    code: "CP-25021",
    location: "Tuzla / İstanbul",
    stage: "Cila / Dış İşlem",
    progress: 25,
    owner: "Zeynep Aksoy",
    deadline: "10 Eyl 2026",
    contract: "₺12.600.000",
    actual: "₺3.150.000",
    risk: "Düşük",
    next: "Lake renk numunesi",
    nextDate: "30 Tem 2026",
    description: "Mutfak, giyinme odaları, vestiyer ve özel kapılar",
  },
  {
    id: "suadiye",
    name: "Suadiye Residence",
    code: "CP-25029",
    location: "Kadıköy / İstanbul",
    stage: "Tedarik",
    progress: 55,
    owner: "Ece Aydın",
    deadline: "25 Eyl 2026",
    contract: "₺22.000.000",
    actual: "₺9.900.000",
    risk: "Orta",
    next: "Ahşap panel sevkiyatı",
    nextDate: "1 Ağu 2026",
    description: "Daire içi sabit mobilyalar ve ilave iş paketleri",
  },
  {
    id: "bodrum",
    name: "Bodrum Villa",
    code: "CP-25038",
    location: "Bodrum / Muğla",
    stage: "Keşif & Teklif",
    progress: 15,
    owner: "Mert Kaya",
    deadline: "1 Kas 2026",
    contract: "₺9.800.000",
    actual: "₺1.200.000",
    risk: "Düşük",
    next: "Teklif sunumu",
    nextDate: "4 Ağu 2026",
    description: "Villa komple sabit mobilya ve kapı paketi",
  },
];

const interventions = [
  { project: "Gedikpaşa Otel", projectId: "gedikpasa", stage: "Tasarım Onayı", issue: "Mimari revizyonun onaylanması bekleniyor.", owner: "Ece Aydın", role: "Satış Yöneticisi", time: "Bugün 17:00", action: "Takip et" },
  { project: "Kurtköy Konutları", projectId: "kurtkoy", stage: "Satın Alma", issue: "Amerikan ceviz kaplama tedarik onayı gerekli.", owner: "Yusuf Kaplan", role: "Satın Alma Uzmanı", time: "Bugün 15:00", action: "Onay al" },
  { project: "Kavacık Ofis", projectId: "kavacik", stage: "Üretim", issue: "CNC programı onayı bekleniyor.", owner: "Cem Topal", role: "Üretim Planlama", time: "Bugün 16:30", action: "Onay al" },
  { project: "Tuzla Villa", projectId: "tuzla", stage: "Yüzey İşlem", issue: "Lake renk numunesi onayı bekleniyor.", owner: "Büşra Demir", role: "Kalite Sorumlusu", time: "Bugün 14:30", action: "Onay al" },
  { project: "Kurtköy Konutları", projectId: "kurtkoy", stage: "İlerleme Ödemesi", issue: "%30 hakediş için evrak ve onay eksik.", owner: "Mert Kaya", role: "Proje Koordinatörü", time: "Bugün 17:00", action: "Evrakları tamamla" },
];

const pipeline = [
  { title: "Tasarım Onayı", items: [{ id: "kavacik", item: "Danışma Bankosu", owner: "Selin Kara", date: "31 Tem 2026", progress: 45, blocker: "Onay bekleniyor", tone: "danger" }] },
  { title: "Satın Alma", items: [{ id: "kurtkoy", item: "Mutfak Dolapları", owner: "Murat Demir", date: "30 Tem 2026", progress: 60, blocker: "Kaplama malzemesi tedarik gecikmesi", tone: "danger" }, { id: "tuzla", item: "Giyinme Odaları", owner: "Ayşe Polat", date: "3 Ağu 2026", progress: 30, blocker: "Menteşe tedariği kısmi gecikme", tone: "warning" }] },
  { title: "İmalat", items: [{ id: "gedikpasa", item: "Oda Kapıları", owner: "Ahmet Şahin", date: "4 Ağu 2026", progress: 70, blocker: "CNC kapasitesi dolu", tone: "danger" }] },
  { title: "Cila / Dış İşlem", items: [{ id: "kurtkoy", item: "Mutfak Dolapları", owner: "Zeynep Aksoy", date: "5 Ağu 2026", progress: 40, blocker: "Cila hattı yoğunluğu", tone: "warning" }] },
  { title: "Montaj", items: [{ id: "tuzla", item: "Giyinme Odaları", owner: "Mehmet Yalçın", date: "7 Ağu 2026", progress: 80, blocker: "Montaj ekibi dolu", tone: "danger" }] },
];

const offers = [
  ["TKL-2026-041", "Bodrum Villa", "Rev. 2", "₺9.800.000", "Sunum bekliyor", "4 Ağu 2026"],
  ["TKL-2026-038", "Maslak Plaza", "Rev. 1", "₺27.300.000", "Maliyet çalışılıyor", "31 Tem 2026"],
  ["TKL-2026-034", "Suadiye Residence", "Rev. 3", "₺22.000.000", "Kabul edildi", "26 Tem 2026"],
  ["TKL-2026-031", "Yalıköy Villa", "Rev. 1", "₺7.450.000", "Revizyon istendi", "30 Tem 2026"],
];

const purchaseRows = [
  ["SAT-26081", "Kurtköy Konutları", "Amerikan ceviz kaplama", "Ergin Ahşap", "1.250 m²", "30 Tem", "Onay bekliyor"],
  ["SAT-26078", "Tuzla Villa", "Blum menteşe ve ray", "Hafele", "168 set", "3 Ağu", "Sipariş verildi"],
  ["SAT-26074", "Gedikpaşa Otel", "Kapı kolu ve kilit", "Yapı Market Pro", "48 takım", "29 Tem", "Kısmi teslim"],
  ["SAT-26069", "Kavacık Ofis", "Pirinç profil", "Eksen Metal", "210 mtül", "5 Ağu", "Teklif toplanıyor"],
];

const installations = [
  ["Kavacık Ofis", "30 Temmuz Perşembe", "Beykoz / İstanbul", "Montaj Ekibi 1", "Saha hazır"],
  ["Tuzla Villa", "31 Temmuz Cuma", "Tuzla / İstanbul", "Montaj Ekibi 2", "Malzeme bekleniyor"],
  ["Gedikpaşa Otel", "4 Ağustos Salı", "Fatih / İstanbul", "Montaj Ekibi 1", "Planlandı"],
  ["Suadiye Residence", "6 Ağustos Perşembe", "Kadıköy / İstanbul", "Montaj Ekibi 3", "Keşif gerekli"],
];

const navigation = {
  d1: [
    ["home", "Ana Sayfa", House],
    ["vision", "Ürün Vizyonu", Sparkle],
    ["blueprint", "Süreç Merkezi", Package],
    ["sales", "Satış", Handshake],
    ["projects", "Projeler", FolderSimple],
    ["operations", "Operasyon", Factory],
    ["finance", "Finans", ChartLineUp],
    ["reports", "Raporlar", ChartBar],
    ["forms", "Formlar", ClipboardText],
  ],
  d2: [
    ["home", "Ana Sayfa", House],
    ["vision", "Ürün Vizyonu", Sparkle],
    ["blueprint", "Süreç Merkezi", Package],
    ["sales", "Satış", Handshake],
    ["projects", "Projeler", FolderSimple],
    ["production", "Üretim", Factory],
    ["procurement", "Satın Alma", ShoppingCart],
    ["installation", "Montaj", Truck],
    ["finance", "Finans", CurrencyCircleDollar],
    ["accounting", "Ön Muhasebe", Wallet],
    ["hr", "İnsan Kaynakları", UsersThree],
    ["reports", "Raporlar", ChartBar],
    ["forms", "Formlar", ClipboardText],
  ],
};

const titles = {
  sales: ["Satış ve Teklifler", "Yeni teklif"],
  projects: ["Projeler", "Yeni proje"],
  operations: ["Operasyon", "İş emri oluştur"],
  production: ["Üretim Planı", "İş emri oluştur"],
  procurement: ["Satın Alma", "Satın alma talebi"],
  installation: ["Montaj Planı", "Montaj planla"],
  finance: ["Proje Finansları", "Hareket ekle"],
  accounting: ["Ön Muhasebe", "Yeni işlem"],
  hr: ["İnsan Kaynakları", "Yeni personel"],
  reports: ["Raporlar", "Rapor oluştur"],
};

const formDefinitions = [
  {
    id: "customer-survey",
    category: "Satış",
    title: "Müşteri & Keşif Kaydı",
    description: "İlk müşteri görüşmesi, ihtiyaç özeti ve saha keşif bilgileri.",
    icon: Handshake,
    sections: [
      {
        title: "Müşteri bilgileri",
        note: "Teklif öncesinde müşteri ve karar verici tarafı netleştirir.",
        fields: [
          { label: "Müşteri / firma adı", value: "Marmara Otelcilik A.Ş.", required: true },
          { label: "Müşteri tipi", type: "select", value: "Otel", options: ["Otel", "Konut", "Ofis", "Mağaza", "Restoran", "Diğer"], required: true },
          { label: "Yetkili kişi", value: "Deniz Arslan", required: true },
          { label: "Telefon", value: "+90 532 555 14 20", required: true },
          { label: "E-posta", type: "email", value: "deniz.arslan@ornek.com" },
          { label: "Müşteri kaynağı", type: "select", value: "Mimar yönlendirmesi", options: ["Mimar yönlendirmesi", "Referans", "Web sitesi", "Eski müşteri", "Fuar", "Diğer"] },
        ],
      },
      {
        title: "Talep ve keşif",
        note: "İşin kapsamını ve teklif hazırlığı için gereken saha verilerini toplar.",
        fields: [
          { label: "Proje / iş adı", value: "Marmara Hotel Renovasyon", required: true },
          { label: "Proje adresi", value: "Şişli / İstanbul", required: true },
          { label: "Talep edilen ürün grupları", type: "textarea", value: "Oda kapıları, gardıroplar, TV üniteleri, lobi duvar panelleri", span: "full", required: true },
          { label: "Keşif tarihi", type: "date", value: "2026-08-03" },
          { label: "Keşfe katılacaklar", value: "Ece Aydın, Selin Kara" },
          { label: "Yaklaşık bütçe", value: "₺20.000.000 – ₺25.000.000" },
          { label: "Hedef teslim tarihi", type: "date", value: "2026-12-15" },
          { label: "Keşif notları", type: "textarea", value: "Numune oda öncelikli hazırlanacak. Mevcut kapılar sökülecek.", span: "full" },
          { label: "Keşif fotoğrafları / dosyalar", type: "file", accept: "image/*,.pdf", span: "full" },
        ],
      },
    ],
  },
  {
    id: "offer",
    category: "Satış",
    title: "Teklif & Maliyetlendirme",
    description: "Metraj, güncel alış fiyatı, işçilik, genel gider ve satış fiyatı.",
    icon: Receipt,
    sections: [
      {
        title: "Teklif üst bilgileri",
        fields: [
          { label: "Müşteri / proje", type: "select", value: "Bodrum Villa", options: ["Bodrum Villa", "Maslak Plaza", "Marmara Hotel Renovasyon"], required: true },
          { label: "Teklif no", value: "TKL-2026-041", required: true },
          { label: "Revizyon", type: "number", value: "2" },
          { label: "Para birimi", type: "select", value: "TRY", options: ["TRY", "EUR", "USD"] },
          { label: "Teklif tarihi", type: "date", value: "2026-07-28" },
          { label: "Geçerlilik tarihi", type: "date", value: "2026-08-12" },
          { label: "Hazırlayan", type: "select", value: "Ece Aydın", options: ["Ece Aydın", "Mert Kaya", "Selin Kara"] },
          { label: "Fiyatlara KDV", type: "select", value: "Hariç", options: ["Hariç", "Dahil"] },
        ],
      },
      {
        title: "İş kalemi ve fiyatlandırma",
        note: "Gerçek uygulamada satır eklenebilir metraj tablosu olarak çalışacaktır.",
        fields: [
          { label: "İş kalemi", value: "Lake boyalı oda kapısı", required: true },
          { label: "Birim", type: "select", value: "Adet", options: ["Adet", "m²", "mtül", "Takım", "Paket"] },
          { label: "Miktar", type: "number", value: "48", required: true },
          { label: "Malzeme birim maliyeti", value: "₺24.500" },
          { label: "İşçilik birim maliyeti", value: "₺8.750" },
          { label: "Dış imalat / hizmet", value: "₺2.400" },
          { label: "Genel gider oranı", value: "%12" },
          { label: "Kâr oranı", value: "%28" },
          { label: "Satış birim fiyatı", value: "₺48.900", required: true },
          { label: "Toplam satış", value: "₺2.347.200", required: true },
          { label: "Ödeme planı", type: "textarea", value: "%30 sözleşmede, %40 imalat başlangıcında, %20 montajda, %10 teslimde", span: "full" },
          { label: "Teklif kapsamı / hariçler", type: "textarea", value: "Nakliye ve montaj dahildir. Elektrik işleri hariçtir.", span: "full" },
        ],
      },
    ],
  },
  {
    id: "project-contract",
    category: "Proje",
    title: "Yeni Proje & Sözleşme",
    description: "Kabul edilen teklifin projeye dönüşmesi ve ticari şartların kaydı.",
    icon: FolderSimple,
    sections: [
      {
        title: "Proje kimliği",
        fields: [
          { label: "Proje kodu", value: "CP-26042", required: true },
          { label: "Proje adı", value: "Marmara Hotel Renovasyon", required: true },
          { label: "Müşteri", value: "Marmara Otelcilik A.Ş.", required: true },
          { label: "Bağlı teklif", type: "select", value: "TKL-2026-044 / Rev.1", options: ["TKL-2026-044 / Rev.1", "TKL-2026-041 / Rev.2"] },
          { label: "Proje sorumlusu", type: "select", value: "Mert Kaya", options: ["Mert Kaya", "Erdem Yılmaz", "Selin Kara"], required: true },
          { label: "Mimar / tasarım sorumlusu", type: "select", value: "Selin Kara", options: ["Selin Kara", "Ece Aydın"] },
          { label: "Başlangıç tarihi", type: "date", value: "2026-08-10", required: true },
          { label: "Hedef teslim", type: "date", value: "2026-12-15", required: true },
        ],
      },
      {
        title: "Sözleşme ve ödeme",
        fields: [
          { label: "Sözleşme bedeli", value: "₺24.800.000", required: true },
          { label: "KDV durumu", type: "select", value: "Hariç", options: ["Hariç", "Dahil"] },
          { label: "Avans oranı", value: "%30" },
          { label: "Teminat / kesinti", value: "%5 teminat kesintisi" },
          { label: "Ödeme yöntemi", type: "select", value: "Hakediş", options: ["Hakediş", "Başlangıç / Bitiş", "Vadeli", "Peşin"] },
          { label: "Garanti süresi", value: "24 ay" },
          { label: "Sözleşme dosyası", type: "file", accept: ".pdf,.doc,.docx" },
          { label: "İmzalanma tarihi", type: "date", value: "2026-08-07" },
          { label: "Kapsam özeti", type: "textarea", value: "96 oda sabit mobilyaları, kapılar, lobi panelleri ve montaj işleri.", span: "full", required: true },
          { label: "Özel şartlar / cezalar", type: "textarea", value: "Numune oda onayından sonra seri üretime geçilecektir.", span: "full" },
        ],
      },
    ],
  },
  {
    id: "work-item-approval",
    category: "Proje",
    title: "İş Kalemi & Tasarım Onayı",
    description: "Metraj satırı, teknik tarif, çizim revizyonu ve müşteri onayı.",
    icon: ClipboardText,
    sections: [
      {
        title: "İş kalemi",
        fields: [
          { label: "Proje", type: "select", value: "Gedikpaşa Otel", options: ["Gedikpaşa Otel", "Kurtköy Konutları", "Tuzla Villa"], required: true },
          { label: "Mahal / blok", value: "Tip A Oda / 2–6. Kat", required: true },
          { label: "Ürün grubu", type: "select", value: "Kapı", options: ["Kapı", "Dolap", "Masa", "Duvar paneli", "Aksesuar", "Diğer"] },
          { label: "İş kalemi adı", value: "Lake boyalı oda giriş kapısı", required: true },
          { label: "Miktar", type: "number", value: "48" },
          { label: "Birim", type: "select", value: "Adet", options: ["Adet", "m²", "mtül", "Takım"] },
          { label: "Teknik tarif", type: "textarea", value: "90×210 cm, 6 mm MDF yüzey, mat lake, yangın dayanımlı kasa.", span: "full" },
          { label: "Malzeme / renk kodu", value: "RAL 9010 / Mat" },
          { label: "Üretim şekli", type: "select", value: "İç üretim", options: ["İç üretim", "Dış imalat", "Karma"] },
        ],
      },
      {
        title: "Revizyon ve onay",
        fields: [
          { label: "Çizim revizyonu", value: "R2" },
          { label: "Revizyon tarihi", type: "date", value: "2026-07-28" },
          { label: "Onay talep edilen kişi", value: "Deniz Arslan" },
          { label: "Onay son tarihi", type: "date", value: "2026-07-31" },
          { label: "Onay durumu", type: "select", value: "Müşteri onayı bekleniyor", options: ["Taslak", "İç onay bekliyor", "Müşteri onayı bekleniyor", "Onaylandı", "Revizyon istendi"] },
          { label: "Numune gerekli mi?", type: "select", value: "Evet", options: ["Evet", "Hayır"] },
          { label: "Çizim / görsel dosyaları", type: "file", accept: "image/*,.pdf,.dwg", span: "full" },
          { label: "Revizyon açıklaması", type: "textarea", value: "Kapı kolu aksı 10 cm yukarı alındı; kasa detayı güncellendi.", span: "full" },
        ],
      },
    ],
  },
  {
    id: "procurement",
    category: "Satın Alma",
    title: "Satın Alma Talebi",
    description: "Proje ihtiyacı, teknik şart, teklif toplama ve onay akışı.",
    icon: ShoppingCart,
    sections: [
      {
        title: "Talep bilgileri",
        fields: [
          { label: "Talep no", value: "SAT-26084", required: true },
          { label: "Proje", type: "select", value: "Kurtköy Konutları", options: ["Kurtköy Konutları", "Gedikpaşa Otel", "Tuzla Villa"], required: true },
          { label: "İş kalemi / maliyet kodu", value: "Mutfak / Kaplama / 740.02" },
          { label: "Talep eden", type: "select", value: "Murat Demir", options: ["Murat Demir", "Ahmet Şahin", "Zeynep Aksoy"] },
          { label: "Malzeme / hizmet", value: "Amerikan ceviz kaplama", required: true },
          { label: "Teknik özellik", value: "A kalite, 0,6 mm, aynı desen partisi", required: true },
          { label: "Miktar", type: "number", value: "1250" },
          { label: "Birim", type: "select", value: "m²", options: ["m²", "Adet", "mtül", "Takım", "Kg"] },
          { label: "İstenen teslim tarihi", type: "date", value: "2026-08-05", required: true },
          { label: "Teslim yeri", type: "select", value: "Capproje Fabrika", options: ["Capproje Fabrika", "Proje sahası", "Taşeron atölyesi"] },
          { label: "Aciliyet", type: "select", value: "Kritik", options: ["Normal", "Öncelikli", "Kritik"] },
          { label: "Ek dosya / numune görseli", type: "file", accept: "image/*,.pdf" },
        ],
      },
      {
        title: "Tedarik ve onay",
        fields: [
          { label: "Önerilen tedarikçi", value: "Ergin Ahşap" },
          { label: "Alternatif tedarikçi", value: "Eksen Kaplama" },
          { label: "Hedef birim fiyat", value: "₺1.480 / m²" },
          { label: "Toplam bütçe", value: "₺1.850.000" },
          { label: "Ödeme koşulu", value: "%30 peşin / 45 gün vadeli" },
          { label: "Onaylayacak kişi", type: "select", value: "Erdem Yılmaz", options: ["Erdem Yılmaz", "Mert Kaya", "Muhasebe"] },
          { label: "Talep açıklaması", type: "textarea", value: "Tek seferde aynı partiden sevk edilmesi desen sürekliliği için zorunludur.", span: "full" },
        ],
      },
    ],
  },
  {
    id: "production-order",
    category: "Üretim",
    title: "Üretim / Dış İmalat İş Emri",
    description: "Atölye veya taşeron iş emri, planlama, kalite ve teslim kriterleri.",
    icon: Factory,
    sections: [
      {
        title: "İş emri",
        fields: [
          { label: "İş emri no", value: "URE-260197", required: true },
          { label: "Proje", type: "select", value: "Gedikpaşa Otel", options: ["Gedikpaşa Otel", "Kurtköy Konutları", "Kavacık Ofis"], required: true },
          { label: "İş kalemi", value: "Oda giriş kapıları / 48 adet", required: true },
          { label: "Üretim tipi", type: "select", value: "İç üretim", options: ["İç üretim", "Dış imalat", "Karma"], required: true },
          { label: "Atölye / taşeron", type: "select", value: "Kapı Hattı 1", options: ["Kapı Hattı 1", "CNC Hattı", "Eksen Metal", "Poli Cila"] },
          { label: "Sorumlu", type: "select", value: "Ahmet Şahin", options: ["Ahmet Şahin", "Cem Topal", "Zeynep Aksoy"] },
          { label: "Planlanan başlangıç", type: "date", value: "2026-08-04" },
          { label: "Planlanan bitiş", type: "date", value: "2026-08-22" },
          { label: "Öncelik", type: "select", value: "Yüksek", options: ["Normal", "Yüksek", "Acil"] },
          { label: "Bağlı çizim revizyonu", value: "R2 / 28.07.2026" },
        ],
      },
      {
        title: "Teknik ve kalite",
        fields: [
          { label: "Malzeme hazır mı?", type: "select", value: "Kısmi hazır", options: ["Hazır", "Kısmi hazır", "Bekleniyor"] },
          { label: "Makine / istasyon", value: "CNC-02, Pres-01, Cila-03" },
          { label: "Kontrol noktaları", type: "textarea", value: "Ölçü kontrolü, yüzey kusuru, renk tonu, aksesuar uyumu", span: "full" },
          { label: "Paketleme şekli", value: "Köşe korumalı, oda bazlı etiketli" },
          { label: "Teslim kriteri", value: "Montaj ekibine palet bazında" },
          { label: "Teknik dosyalar", type: "file", accept: "image/*,.pdf,.dwg,.dxf", span: "full" },
          { label: "Üretim notu", type: "textarea", value: "İlk iki kapı kalite kontrol onayından sonra seri imalata geçilecek.", span: "full" },
        ],
      },
    ],
  },
  {
    id: "installation",
    category: "Montaj",
    title: "Montaj & Saha Planı",
    description: "Saha hazırlığı, ekip, sevkiyat, iş güvenliği ve teslim kaydı.",
    icon: Truck,
    sections: [
      {
        title: "Planlama",
        fields: [
          { label: "Proje", type: "select", value: "Kavacık Ofis", options: ["Kavacık Ofis", "Tuzla Villa", "Gedikpaşa Otel"], required: true },
          { label: "Montaj paketi", value: "Danışma bankosu ve arka panel", required: true },
          { label: "Başlangıç tarihi", type: "date", value: "2026-07-30", required: true },
          { label: "Tahmini bitiş", type: "date", value: "2026-08-01" },
          { label: "Montaj ekibi", type: "select", value: "Montaj Ekibi 1", options: ["Montaj Ekibi 1", "Montaj Ekibi 2", "Montaj Ekibi 3"] },
          { label: "Ekip sorumlusu", value: "Mehmet Yalçın" },
          { label: "Saha yetkilisi", value: "Burak Akın / 0532 555 22 90" },
          { label: "Çalışma saatleri", value: "08:30 – 18:00" },
          { label: "Araç / sevkiyat no", value: "34 CAP 126 / SVK-26091" },
          { label: "Konaklama gerekli mi?", type: "select", value: "Hayır", options: ["Hayır", "Evet"] },
        ],
      },
      {
        title: "Saha hazırlığı ve teslim",
        fields: [
          { label: "Saha hazır mı?", type: "select", value: "Kontrol edildi", options: ["Kontrol edilmedi", "Eksikli", "Kontrol edildi"] },
          { label: "Elektrik / zemin / duvar durumu", value: "Uygun" },
          { label: "İSG evrakları", type: "select", value: "Tam", options: ["Eksik", "Kısmi", "Tam"] },
          { label: "Teslim alınan ürün adedi", type: "number", value: "12" },
          { label: "Montaj öncesi fotoğraflar", type: "file", accept: "image/*", span: "full" },
          { label: "Saha riskleri / notlar", type: "textarea", value: "Yük asansörü 10:00–12:00 arasında kullanılabilir.", span: "full" },
          { label: "Müşteri teslim onayı", type: "select", value: "Montaj sonrası", options: ["Montaj sonrası", "Kısmi teslim", "Onaylandı"] },
          { label: "Teslim tutanağı", type: "file", accept: ".pdf,image/*" },
        ],
      },
    ],
  },
  {
    id: "quality-photo",
    category: "Kalite",
    title: "Kalite, Eksik & Fotoğraf Kaydı",
    description: "Saha veya üretim fotoğrafı, uygunsuzluk, sorumlu ve düzeltme takibi.",
    icon: Images,
    sections: [
      {
        title: "Kayıt bilgileri",
        fields: [
          { label: "Proje", type: "select", value: "Tuzla Villa", options: ["Tuzla Villa", "Gedikpaşa Otel", "Kurtköy Konutları"], required: true },
          { label: "Aşama", type: "select", value: "Cila / Dış İşlem", options: ["Keşif", "Tasarım", "Üretim", "Cila / Dış İşlem", "Montaj", "Teslim"] },
          { label: "Mahal / iş kalemi", value: "Ana yatak odası / Giyinme dolabı" },
          { label: "Kayıt türü", type: "select", value: "Uygunsuzluk", options: ["İlerleme fotoğrafı", "Uygunsuzluk", "Eksik iş", "Hasar", "Teslim kanıtı"] },
          { label: "Önem derecesi", type: "select", value: "Orta", options: ["Düşük", "Orta", "Yüksek", "Kritik"] },
          { label: "Tespit tarihi", type: "date", value: "2026-07-28" },
          { label: "Tespit eden", value: "Büşra Demir" },
          { label: "Sorumlu kişi / ekip", value: "Poli Cila / Zeynep Aksoy" },
        ],
      },
      {
        title: "Bulgu ve düzeltme",
        fields: [
          { label: "Bulgu açıklaması", type: "textarea", value: "Sağ kapak yüzeyinde ışık altında görünen dalgalanma mevcut.", span: "full", required: true },
          { label: "Kök neden", type: "textarea", value: "Ara zımpara yetersizliği ve kabin sıcaklık değişimi.", span: "full" },
          { label: "Düzeltici işlem", value: "Yeniden zımpara ve son kat uygulama" },
          { label: "Hedef kapanış", type: "date", value: "2026-07-31" },
          { label: "Durum", type: "select", value: "Düzeltme bekliyor", options: ["Açık", "Düzeltme bekliyor", "Kontrol bekliyor", "Kapandı"] },
          { label: "Müşteriye görünür mü?", type: "select", value: "Hayır", options: ["Hayır", "Evet"] },
          { label: "Fotoğraf / video / dosya", type: "file", accept: "image/*,video/*,.pdf", span: "full", required: true },
        ],
      },
    ],
  },
  {
    id: "finance-progress",
    category: "Finans",
    title: "Gelir / Gider & Hakediş",
    description: "Proje bazlı finans hareketi, resmi/gayri resmi ayrım ve tahsilat planı.",
    icon: CurrencyCircleDollar,
    sections: [
      {
        title: "Finans hareketi",
        fields: [
          { label: "Proje", type: "select", value: "Gedikpaşa Otel", options: ["Gedikpaşa Otel", "Kurtköy Konutları", "Kavacık Ofis"], required: true },
          { label: "Hareket türü", type: "select", value: "Hakediş", options: ["Gelir", "Gider", "Hakediş", "Avans", "Tahsilat", "Ödeme", "İade"], required: true },
          { label: "Kayıt tipi", type: "select", value: "Resmi", options: ["Resmi", "Dahili / gayri resmi"], required: true },
          { label: "Belge no", value: "HKD-26018-01" },
          { label: "İşlem tarihi", type: "date", value: "2026-07-28" },
          { label: "Vade tarihi", type: "date", value: "2026-08-12" },
          { label: "Cari / karşı taraf", value: "Marmara Otelcilik A.Ş." },
          { label: "Maliyet merkezi", value: "CP-25018 / Üretim" },
          { label: "Tutar", value: "₺7.440.000", required: true },
          { label: "KDV oranı", type: "select", value: "%20", options: ["%0", "%1", "%10", "%20"] },
          { label: "Para birimi", type: "select", value: "TRY", options: ["TRY", "EUR", "USD"] },
          { label: "Kur", value: "1,00" },
        ],
      },
      {
        title: "Hakediş ve muhasebe",
        fields: [
          { label: "Hakediş oranı", value: "%30" },
          { label: "Tamamlanma oranı", value: "%34" },
          { label: "Kesinti / teminat", value: "₺372.000" },
          { label: "Net tahsilat", value: "₺7.068.000" },
          { label: "Datasoft fiş no", value: "DS-2026-8471" },
          { label: "Ödeme durumu", type: "select", value: "Onay bekliyor", options: ["Taslak", "Onay bekliyor", "Faturalandı", "Tahsil edildi", "Gecikti"] },
          { label: "Fatura / hakediş eki", type: "file", accept: ".pdf,.xlsx,image/*", span: "full" },
          { label: "Açıklama", type: "textarea", value: "1. hakediş; kapı kasaları ve lobi panel alt konstrüksiyon imalatı.", span: "full" },
        ],
      },
    ],
  },
  {
    id: "current-account",
    category: "Ön Muhasebe",
    title: "Cari Hesap Kartı",
    description: "Müşteri ve tedarikçi hesapları, risk limiti, vade ve mutabakat bilgileri.",
    icon: IdentificationCard,
    sections: [
      {
        title: "Cari kimlik ve iletişim",
        fields: [
          { label: "Cari tipi", type: "select", value: "Müşteri", options: ["Müşteri", "Tedarikçi", "Taşeron", "Hem müşteri hem tedarikçi"], required: true },
          { label: "Cari kodu", value: "CR-00184", required: true },
          { label: "Ticari unvan", value: "Marmara Otelcilik A.Ş.", required: true },
          { label: "Kısa ad", value: "Marmara Otel" },
          { label: "Vergi dairesi", value: "Şişli" },
          { label: "Vergi / T.C. kimlik no", value: "1234567890", required: true },
          { label: "Yetkili kişi", value: "Deniz Arslan" },
          { label: "Telefon", value: "+90 532 555 14 20" },
          { label: "E-posta", type: "email", value: "finans@marmaraotel.com" },
          { label: "Fatura adresi", type: "textarea", value: "Harbiye Mah. Cumhuriyet Cad. No:48 Şişli / İstanbul", span: "full" },
        ],
      },
      {
        title: "Ticari koşullar ve hesap kontrolü",
        fields: [
          { label: "Varsayılan para birimi", type: "select", value: "TRY", options: ["TRY", "EUR", "USD"] },
          { label: "Standart vade", value: "30 gün" },
          { label: "Risk limiti", value: "₺12.000.000" },
          { label: "Açılış bakiyesi", value: "₺0" },
          { label: "Fiyat listesi", type: "select", value: "Kurumsal müşteri", options: ["Kurumsal müşteri", "Proje özel", "Tedarikçi alış", "Standart"] },
          { label: "Tahsilat / ödeme yöntemi", type: "select", value: "Havale / EFT", options: ["Havale / EFT", "Çek", "Kredi kartı", "Nakit"] },
          { label: "IBAN", value: "TR12 0006 2000 0000 1234 5678 90", span: "full" },
          { label: "E-fatura durumu", type: "select", value: "E-Fatura mükellefi", options: ["E-Fatura mükellefi", "E-Arşiv", "Kontrol edilmedi"] },
          { label: "Mutabakat sıklığı", type: "select", value: "Aylık", options: ["Aylık", "Üç aylık", "Yıllık", "Talep üzerine"] },
          { label: "Datasoft cari kodu", value: "DS-120.01.0184" },
          { label: "Cari notu", type: "textarea", value: "Hakediş onayından sonra 30 gün vade uygulanır. Mutabakat finans yetkilisine gönderilir.", span: "full" },
        ],
      },
    ],
  },
  {
    id: "invoice-transaction",
    category: "Ön Muhasebe",
    title: "Fatura & Tahsilat / Ödeme",
    description: "Alış-satış faturası, proje dağılımı, vade ve kapatma hareketinin tek kaydı.",
    icon: Receipt,
    sections: [
      {
        title: "Belge bilgileri",
        fields: [
          { label: "İşlem türü", type: "select", value: "Satış faturası", options: ["Satış faturası", "Alış faturası", "Masraf fişi", "Tahsilat", "Ödeme", "İade"], required: true },
          { label: "Cari hesap", type: "select", value: "Marmara Otelcilik A.Ş.", options: ["Marmara Otelcilik A.Ş.", "Ergin Ahşap", "Renk Cila", "Hafele"], required: true },
          { label: "Belge / fatura no", value: "GIB20260000184", required: true },
          { label: "Belge tarihi", type: "date", value: "2026-08-07", required: true },
          { label: "Vade tarihi", type: "date", value: "2026-09-06", required: true },
          { label: "Para birimi", type: "select", value: "TRY", options: ["TRY", "EUR", "USD"] },
          { label: "Kur", value: "1,00" },
          { label: "Resmi / dahili kayıt", type: "select", value: "Resmi", options: ["Resmi", "Dahili yönetim kaydı"], required: true },
          { label: "Belge eki", type: "file", accept: ".pdf,.xml,image/*", span: "full" },
        ],
      },
      {
        title: "Tutar, proje ve kapatma",
        note: "Gerçek uygulamada bir belge birden fazla proje ve maliyet merkezine dağıtılabilir.",
        fields: [
          { label: "Bağlı proje", type: "select", value: "CP-25018 · Gedikpaşa Otel", options: ["CP-25018 · Gedikpaşa Otel", "CP-25032 · Kurtköy Konutları", "Genel gider"] },
          { label: "Maliyet merkezi", type: "select", value: "Montaj", options: ["Malzeme", "Üretim", "Dış imalat", "Montaj", "Genel gider"] },
          { label: "Ara toplam", value: "₺620.000", required: true },
          { label: "İskonto", value: "₺0" },
          { label: "KDV oranı", type: "select", value: "%20", options: ["%0", "%1", "%10", "%20"] },
          { label: "Genel toplam", value: "₺744.000", required: true },
          { label: "Ödeme hesabı", type: "select", value: "Garanti TL", options: ["Garanti TL", "Ziraat TL", "Merkez Kasa", "Çek portföyü"] },
          { label: "Kapanan tutar", value: "₺300.000" },
          { label: "Kalan bakiye", value: "₺444.000" },
          { label: "Datasoft aktarım durumu", type: "select", value: "Aktarım bekliyor", options: ["Aktarım bekliyor", "Aktarıldı", "Hata kontrolü", "Aktarılmayacak"] },
          { label: "Açıklama", type: "textarea", value: "1. hakediş kapsamında düzenlenen satış faturası; kısmi tahsilat alındı.", span: "full" },
        ],
      },
    ],
  },
  {
    id: "employee-card",
    category: "İnsan Kaynakları",
    title: "Personel Özlük Kartı",
    description: "Kimlik, iletişim, çalışma, ücret, belge ve acil durum bilgilerinin kontrollü kaydı.",
    icon: UsersThree,
    sections: [
      {
        title: "Kimlik ve iletişim",
        fields: [
          { label: "Sicil no", value: "CP-PRS-084", required: true },
          { label: "Ad soyad", value: "Kerem Yıldız", required: true },
          { label: "T.C. kimlik no", value: "12345678901", required: true },
          { label: "Doğum tarihi", type: "date", value: "1992-04-18" },
          { label: "Telefon", value: "+90 533 555 08 42", required: true },
          { label: "E-posta", type: "email", value: "kerem.yildiz@capproje.com" },
          { label: "Adres", type: "textarea", value: "Pendik / İstanbul", span: "full" },
          { label: "Acil durumda aranacak kişi", value: "Ayşe Yıldız / Eşi" },
          { label: "Acil durum telefonu", value: "+90 532 555 18 10" },
        ],
      },
      {
        title: "Çalışma ve organizasyon",
        fields: [
          { label: "Şirket / işyeri", type: "select", value: "Capproje Merkez", options: ["Capproje Merkez", "Üretim Tesisi", "Saha / Montaj"] },
          { label: "Departman", type: "select", value: "Üretim", options: ["Yönetim", "Satış", "Proje", "Satın Alma", "Üretim", "Montaj", "Finans", "İnsan Kaynakları"] },
          { label: "Görev / unvan", value: "CNC Operatörü", required: true },
          { label: "Yönetici", type: "select", value: "Ahmet Şahin", options: ["Ahmet Şahin", "Erdem Yılmaz", "Mert Kaya"] },
          { label: "İşe giriş tarihi", type: "date", value: "2023-05-08", required: true },
          { label: "Çalışma tipi", type: "select", value: "Tam zamanlı", options: ["Tam zamanlı", "Yarı zamanlı", "Dönemsel", "Stajyer", "Taşeron personeli"] },
          { label: "Vardiya", type: "select", value: "Gündüz · 08:00–18:00", options: ["Gündüz · 08:00–18:00", "Akşam · 18:00–02:00", "Esnek", "Saha planına göre"] },
          { label: "Çalışma durumu", type: "select", value: "Aktif", options: ["Aktif", "İzinli", "Pasif", "İşten ayrıldı"] },
        ],
      },
      {
        title: "Ücret, erişim ve belgeler",
        fields: [
          { label: "Ücret tipi", type: "select", value: "Aylık", options: ["Aylık", "Günlük", "Saatlik"] },
          { label: "Brüt ücret", value: "₺48.500", required: true },
          { label: "Banka / IBAN", value: "TR44 0006 2000 0000 0084 0001", span: "full" },
          { label: "Fazla mesaiye uygun", type: "select", value: "Evet", options: ["Evet", "Hayır"] },
          { label: "Yıllık izin bakiyesi", value: "11 gün" },
          { label: "Uygulama rolü", type: "select", value: "Üretim kullanıcısı", options: ["Yönetici", "Proje yöneticisi", "Üretim kullanıcısı", "Saha kullanıcısı", "Sadece görüntüleme", "Erişim yok"] },
          { label: "Özlük belgeleri", type: "file", accept: ".pdf,image/*", span: "full" },
          { label: "Sağlık / iş güvenliği notu", type: "textarea", value: "Periyodik muayene 15.04.2027 tarihine kadar geçerli. CNC kullanım yetkisi mevcut.", span: "full" },
        ],
      },
    ],
  },
  {
    id: "leave-attendance",
    category: "İnsan Kaynakları",
    title: "İzin & Puantaj Kaydı",
    description: "İzin talebi, vardiya, fazla mesai, eksik gün ve yönetici onay süreci.",
    icon: CalendarBlank,
    sections: [
      {
        title: "Çalışan ve dönem",
        fields: [
          { label: "Personel", type: "select", value: "Kerem Yıldız · CP-PRS-084", options: ["Kerem Yıldız · CP-PRS-084", "Mehmet Yalçın · CP-PRS-042", "Büşra Demir · CP-PRS-031"], required: true },
          { label: "Kayıt türü", type: "select", value: "Yıllık izin", options: ["Yıllık izin", "Mazeret izni", "Rapor", "Ücretsiz izin", "Fazla mesai", "Eksik gün", "Vardiya değişikliği"], required: true },
          { label: "Başlangıç", type: "date", value: "2026-08-17", required: true },
          { label: "Bitiş", type: "date", value: "2026-08-19", required: true },
          { label: "Süre", value: "3 gün" },
          { label: "Dönüş tarihi", type: "date", value: "2026-08-20" },
          { label: "Bağlı proje / görev", type: "select", value: "Üretim genel", options: ["Üretim genel", "CP-25018 · Gedikpaşa Otel", "CP-25032 · Kurtköy Konutları", "Bağlantısız"] },
          { label: "Vekâlet edecek kişi", value: "Emre Koç" },
          { label: "Talep açıklaması", type: "textarea", value: "Aile ziyareti nedeniyle yıllık izin talebi.", span: "full", required: true },
          { label: "Rapor / belge", type: "file", accept: ".pdf,image/*", span: "full" },
        ],
      },
      {
        title: "Puantaj ve onay",
        fields: [
          { label: "Normal çalışma", value: "198 saat" },
          { label: "Fazla mesai", value: "14 saat" },
          { label: "Hafta tatili", value: "4 gün" },
          { label: "Eksik gün", value: "0 gün" },
          { label: "İzin öncesi bakiye", value: "14 gün" },
          { label: "İzin sonrası bakiye", value: "11 gün" },
          { label: "İlk onaycı", type: "select", value: "Ahmet Şahin", options: ["Ahmet Şahin", "Erdem Yılmaz", "Mert Kaya"] },
          { label: "İK kontrolü", type: "select", value: "Bekliyor", options: ["Bekliyor", "Uygun", "Eksik belge", "Reddedildi"] },
          { label: "Onay durumu", type: "select", value: "Yönetici onayı bekliyor", options: ["Taslak", "Yönetici onayı bekliyor", "İK kontrolünde", "Onaylandı", "Reddedildi"] },
          { label: "Onay notu", type: "textarea", value: "Vardiya planında Emre Koç ile değişiklik yapıldı.", span: "full" },
        ],
      },
    ],
  },
  {
    id: "payroll-preparation",
    category: "İnsan Kaynakları",
    title: "Bordro Hazırlık Kaydı",
    description: "Puantaj, fazla mesai, prim, avans ve kesintilerin bordro programına aktarım öncesi kontrolü.",
    icon: Bank,
    sections: [
      {
        title: "Dönem ve kazançlar",
        fields: [
          { label: "Bordro dönemi", type: "select", value: "Ağustos 2026", options: ["Temmuz 2026", "Ağustos 2026", "Eylül 2026"], required: true },
          { label: "Personel", type: "select", value: "Kerem Yıldız · CP-PRS-084", options: ["Kerem Yıldız · CP-PRS-084", "Mehmet Yalçın · CP-PRS-042", "Büşra Demir · CP-PRS-031"], required: true },
          { label: "Brüt ücret", value: "₺48.500", required: true },
          { label: "Normal çalışma", value: "22 gün / 198 saat" },
          { label: "Fazla mesai", value: "14 saat" },
          { label: "Fazla mesai tutarı", value: "₺4.630" },
          { label: "Prim / proje bonusu", value: "₺2.500" },
          { label: "Yol / yemek", value: "₺4.400" },
        ],
      },
      {
        title: "Kesintiler ve kontrol",
        fields: [
          { label: "Personel avansı", value: "₺5.000" },
          { label: "İcra / diğer kesinti", value: "₺0" },
          { label: "Eksik gün", value: "0 gün" },
          { label: "Ücretsiz izin", value: "0 gün" },
          { label: "Masraf iadesi", value: "₺1.280" },
          { label: "Tahmini net ödeme", value: "₺42.810" },
          { label: "Puantaj kontrolü", type: "select", value: "Onaylandı", options: ["Bekliyor", "Eksik", "Onaylandı"] },
          { label: "Bordro aktarım durumu", type: "select", value: "Aktarım bekliyor", options: ["Aktarım bekliyor", "Aktarıldı", "Muhasebe kontrolünde", "Kapatıldı"] },
          { label: "Kontrol notu", type: "textarea", value: "14 saat fazla mesai üretim sorumlusu tarafından onaylandı; avans kesintisi uygulanacak.", span: "full" },
          { label: "Puantaj / destekleyici belge", type: "file", accept: ".xlsx,.pdf,image/*", span: "full" },
        ],
      },
    ],
  },
  {
    id: "weekly-meeting",
    category: "Yönetim",
    title: "Haftalık Toplantı Notu",
    description: "Proje ve üretim ekibi gündemi, kararlar, sorumlular ve termin takibi.",
    icon: ListChecks,
    sections: [
      {
        title: "Toplantı bilgileri",
        fields: [
          { label: "Toplantı tarihi", type: "date", value: "2026-08-03", required: true },
          { label: "Toplantı türü", type: "select", value: "Pazartesi proje & üretim", options: ["Pazartesi proje & üretim", "Satış değerlendirme", "Finans", "Şantiye koordinasyon"] },
          { label: "Toplantı yöneticisi", value: "Erdem Yılmaz" },
          { label: "Notları tutan", value: "Mert Kaya" },
          { label: "Katılımcılar", type: "textarea", value: "Ece Aydın, Selin Kara, Ahmet Şahin, Yusuf Kaplan, Zeynep Aksoy", span: "full" },
          { label: "Geçen haftadan açık maddeler", type: "textarea", value: "Kaplama sipariş onayı; R2 çizim onayı; Tuzla renk numunesi.", span: "full" },
        ],
      },
      {
        title: "Gündem ve aksiyon",
        note: "Gerçek uygulamada her aksiyon ayrı satır olarak eklenebilecektir.",
        fields: [
          { label: "İlgili proje", type: "select", value: "Kurtköy Konutları", options: ["Kurtköy Konutları", "Gedikpaşa Otel", "Tuzla Villa", "Genel"] },
          { label: "Konu / karar", value: "Kaplama alternatif tedarikçiden numune alınacak.", required: true },
          { label: "Sorumlu", type: "select", value: "Yusuf Kaplan", options: ["Yusuf Kaplan", "Ece Aydın", "Ahmet Şahin", "Mert Kaya"] },
          { label: "Termin", type: "date", value: "2026-08-04" },
          { label: "Öncelik", type: "select", value: "Yüksek", options: ["Normal", "Yüksek", "Kritik"] },
          { label: "Durum", type: "select", value: "Açık", options: ["Açık", "Devam ediyor", "Tamamlandı", "İptal"] },
          { label: "Karar gerekçesi / detay", type: "textarea", value: "Mevcut tedarikçinin teslim tarihi üretim planını 5 gün geciktiriyor.", span: "full" },
          { label: "Toplantı eki", type: "file", accept: ".pdf,.xlsx,image/*", span: "full" },
        ],
      },
    ],
  },
  {
    id: "supplier",
    category: "Satın Alma",
    title: "Tedarikçi / Taşeron Kartı",
    description: "İletişim, ürün grubu, fiyat-vade, kalite ve termin performansı.",
    icon: Buildings,
    sections: [
      {
        title: "Firma bilgileri",
        fields: [
          { label: "Firma unvanı", value: "Ergin Ahşap San. Tic. Ltd.", required: true },
          { label: "Tedarikçi tipi", type: "select", value: "Malzeme", options: ["Malzeme", "Dış imalat", "Nakliye", "Montaj", "Hizmet"] },
          { label: "Vergi dairesi / no", value: "İkitelli / 1234567890" },
          { label: "Yetkili kişi", value: "Hakan Ergin" },
          { label: "Telefon", value: "+90 212 555 10 20" },
          { label: "E-posta", type: "email", value: "satis@erginahsap.com" },
          { label: "Adres", type: "textarea", value: "İkitelli OSB, Başakşehir / İstanbul", span: "full" },
          { label: "Ürün / hizmet grupları", value: "Kaplama, masif panel, kontrplak" },
          { label: "Standart vade", value: "45 gün" },
        ],
      },
      {
        title: "Değerlendirme",
        fields: [
          { label: "Fiyat puanı", type: "select", value: "4 / 5", options: ["1 / 5", "2 / 5", "3 / 5", "4 / 5", "5 / 5"] },
          { label: "Kalite puanı", type: "select", value: "5 / 5", options: ["1 / 5", "2 / 5", "3 / 5", "4 / 5", "5 / 5"] },
          { label: "Termin puanı", type: "select", value: "3 / 5", options: ["1 / 5", "2 / 5", "3 / 5", "4 / 5", "5 / 5"] },
          { label: "Onay durumu", type: "select", value: "Onaylı tedarikçi", options: ["Aday", "Onaylı tedarikçi", "Şartlı", "Bloke"] },
          { label: "Banka / IBAN", value: "TR12 0006 2000 0000 1234 5678 90", span: "full" },
          { label: "Sözleşme / belgeler", type: "file", accept: ".pdf,.doc,.docx,.xlsx", span: "full" },
          { label: "Değerlendirme notu", type: "textarea", value: "Kalite güçlü; yoğun dönemlerde termin teyidi siparişten önce alınmalı.", span: "full" },
        ],
      },
    ],
  },
];

function initials(name) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2);
}

function parseHash() {
  const parts = window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  return {
    design: parts[0] === "d1" ? "d1" : "d2",
    route: parts[1] || "home",
    id: parts[2] || null,
  };
}

function IconButton({ children, label, onClick }) {
  return <button className="icon-button" aria-label={label} onClick={onClick}>{children}</button>;
}

function Progress({ value }) {
  return <span className="progress" aria-label={`%${value} tamamlandı`}><span style={{ width: `${value}%` }} /></span>;
}

function RiskBadge({ risk }) {
  return <span className={`badge risk-${risk.toLocaleLowerCase("tr-TR")}`}>{risk}</span>;
}

function AppHeader({ design, query, setQuery, navigate }) {
  return (
    <header className="app-header">
      {design === "d2" && <div className="desktop-brand-inline"><Brand design={design} /></div>}
      <div className="search-wrap">
        <MagnifyingGlass size={22} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ara (proje, müşteri, teklif...)"
          aria-label="Genel arama"
        />
        <kbd>Ctrl K</kbd>
        {query && (
          <div className="search-results">
            {projects.filter((item) => item.name.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR"))).slice(0, 4).map((item) => (
              <button key={item.id} onClick={() => { navigate("project", item.id); setQuery(""); }}>
                <span><strong>{item.name}</strong><small>{item.code} · {item.stage}</small></span>
                <ArrowRight size={18} />
              </button>
            ))}
            {!projects.some((item) => item.name.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR"))) && <p>Sonuç bulunamadı.</p>}
          </div>
        )}
      </div>
      <div className="header-actions">
        <IconButton label="Bildirimler"><Bell size={22} /><span className="notification-dot">3</span></IconButton>
        <div className="profile">
          <span className="avatar">{design === "d1" ? "MK" : "EY"}</span>
          <span><strong>{design === "d1" ? "Mert Kaya" : "Erdem Yılmaz"}</strong><small>{design === "d1" ? "Proje Koordinatörü" : "Operasyon Müdürü"}</small></span>
          <CaretDown size={16} />
        </div>
      </div>
    </header>
  );
}

function Brand({ design }) {
  return (
    <div className="brand">
      {design === "d1" ? <TreeEvergreen size={41} weight="light" /> : <FrameCorners size={41} weight="light" />}
      <span><strong>Capproje</strong><small>Orman Ürünleri</small></span>
    </div>
  );
}

function Sidebar({ design, route, navigate }) {
  return (
    <aside className="sidebar">
      <Brand design={design} />
      <nav>
        {navigation[design].map(([id, label, Icon]) => {
          const active = route === id || (route === "project" && id === "projects") || (route === "form" && id === "forms");
          return (
            <button key={id} className={active ? "active" : ""} onClick={() => navigate(id)}>
              <Icon size={23} weight={active ? "fill" : "regular"} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
      <button className="collapse-button"><SidebarSimple size={21} /><span>Menüyü daralt</span></button>
      {design === "d2" && <div className="sidebar-profile"><span className="avatar">EY</span><span><strong>Erdem Yılmaz</strong><small>Operasyon Müdürü</small></span></div>}
    </aside>
  );
}

function DesignSwitcher({ design, switchDesign }) {
  return (
    <div className="design-switcher" aria-label="Tasarım seçimi">
      <span>Canlı karşılaştırma</span>
      <button className={design === "d1" ? "active" : ""} onClick={() => switchDesign("d1")}>Tasarım 1</button>
      <button className={design === "d2" ? "active" : ""} onClick={() => switchDesign("d2")}>Tasarım 2</button>
    </div>
  );
}

function PageHeader({ title, action, onAction }) {
  return (
    <div className="page-heading">
      <div><h1>{title}</h1><p>28 Temmuz 2026 Salı</p></div>
      {action && <button className="primary-button" onClick={onAction}><Plus size={21} />{action}</button>}
    </div>
  );
}

function ViewToolbar({ label = "Görünüm", options = ["Kanban", "Liste", "Takvim", "Zaman Planı"] }) {
  const [active, setActive] = useState(options[0]);
  return (
    <div className="view-toolbar">
      <span>{label}</span>
      <div>
        {options.map((option) => (
          <button key={option} className={active === option ? "active" : ""} onClick={() => setActive(option)}>{option}</button>
        ))}
      </div>
      <button className="view-filter"><ListChecks size={17} />Filtrele & grupla</button>
    </div>
  );
}

function StageRail({ current = 4 }) {
  const stages = ["Fırsat", "Teklif", "Sözleşme", "Tasarım", "Satın Alma", "Üretim", "Montaj", "Teslim"];
  return (
    <div className="stage-rail" aria-label="Proje aşamaları">
      {stages.map((stage, index) => (
        <span key={stage} className={index < current ? "done" : index === current ? "active" : ""}>
          <i>{index < current ? <CheckCircle size={15} weight="fill" /> : index + 1}</i>
          <b>{stage}</b>
        </span>
      ))}
    </div>
  );
}

function SmartRecords({ navigate }) {
  const records = [
    ["Teklif", "3", Receipt, "sales"],
    ["İş kalemi", "42", ClipboardText, "project"],
    ["Satın alma", "8", ShoppingCart, "procurement"],
    ["Üretim emri", "16", Factory, "operations"],
    ["Montaj", "4", Truck, "installation"],
    ["Fotoğraf", "128", Images, "form", "quality-photo"],
    ["Hakediş", "3", CurrencyCircleDollar, "finance"],
  ];
  return (
    <div className="smart-records">
      {records.map(([label, count, Icon, route, id]) => (
        <button key={label} onClick={() => navigate(route, id)}>
          <Icon size={20} /><span><b>{count}</b><small>{label}</small></span>
        </button>
      ))}
    </div>
  );
}

function ProfitabilityCards({ compact = false }) {
  const items = [
    ["Sözleşme / Gelir", "₺24,80 Mn", "Beklenen", ""],
    ["Bütçelenen maliyet", "₺17,36 Mn", "Teklif maliyeti", ""],
    ["Bağlanan maliyet", "₺14,92 Mn", "Sipariş + üretim", "warning"],
    ["Gerçekleşen maliyet", "₺12,75 Mn", "Bugüne kadar", ""],
    ["Tahmini proje kârı", "₺6,21 Mn", "%25,0 marj", "success"],
  ];
  return (
    <div className={`profitability-cards ${compact ? "compact" : ""}`}>
      {items.map(([label, value, note, tone]) => (
        <span key={label} className={tone}><small>{label}</small><strong>{value}</strong><em>{note}</em></span>
      ))}
    </div>
  );
}

function ProcessBlueprintPage({ navigate }) {
  const layers = [
    ["1", "Müşteri & Fırsat", "Keşif, karar verici, teklif, revizyon ve kayıp nedeni", "customer-survey"],
    ["2", "Sözleşme & Proje", "Kapsam paketleri, ödeme planı, kilometre taşları ve roller", "project-contract"],
    ["3", "Mahal & İş Kalemi", "Ölçü, metraj, reçete, çizim sürümü ve müşteri onayı", "work-item-approval"],
    ["4", "Tedarik & Dış İmalat", "RFQ karşılaştırma, termin, taşerona malzeme ve giriş kalite", "procurement"],
    ["5", "Üretim & Kalite", "İş merkezleri, operasyon rotası, süre, fire ve kontrol noktaları", "production-order"],
    ["6", "Montaj & Teslim", "Ekip, sevkiyat, saha formu, fotoğraf, eksik iş ve imza", "installation"],
    ["7", "Finans & Kârlılık", "Hakediş, tahsilat, proje maliyeti, bütçe ve gerçekleşen karşılaştırması", "finance-progress"],
  ];
  return (
    <>
      <PageHeader title="Capproje Süreç Merkezi" action="Yeni proje başlat" onAction={() => navigate("form", "customer-survey")} />
      <div className="blueprint-intro">
        <div>
          <span className="eyebrow">NİHAİ ÜRÜN OMURGASI</span>
          <h2>Bir kayıt girilir, ilgili tüm ekipler aynı proje zincirinde çalışır.</h2>
          <p>Bu ekran müşteri görüşmelerinde yazılımın yalnız form toplamından ibaret olmadığını; satıştan teslim ve kârlılığa kadar ilişkili bir sistem olduğunu göstermek için hazırlandı.</p>
        </div>
        <span><strong>7</strong><small>ana süreç</small></span>
        <span><strong>11</strong><small>uzman form</small></span>
        <span><strong>1</strong><small>ortak proje kaydı</small></span>
      </div>
      <StageRail current={4} />
      <section className="blueprint-flow">
        {layers.map(([number, title, note, form]) => (
          <button key={title} onClick={() => navigate("form", form)}>
            <i>{number}</i><span><strong>{title}</strong><small>{note}</small></span><ArrowRight size={19} />
          </button>
        ))}
      </section>
      <div className="blueprint-columns">
        <DataPanel title="Sistemin ortak kayıt yapısı" icon={FolderSimple}>
          <div className="record-tree">
            <span><b>Proje</b><small>CP-25018 · Gedikpaşa Otel</small></span>
            <span><b>Mahal</b><small>Tip A Oda · 2–6. kat</small></span>
            <span><b>İş kalemi</b><small>Oda giriş kapısı · 48 adet</small></span>
            <span><b>Revizyon</b><small>R2 · müşteri onayı bekleniyor</small></span>
            <span><b>Operasyonlar</b><small>Satın alma · üretim · kalite · montaj</small></span>
          </div>
        </DataPanel>
        <DataPanel title="Otomatik kontrol ve onay kuralları" icon={CheckCircle}>
          <div className="rule-list">
            <span><CheckCircle weight="fill" /><b>Teklif marjı düşükse</b><small>Genel müdür onayı ister.</small></span>
            <span><CheckCircle weight="fill" /><b>R2 müşteri onayı yoksa</b><small>Üretime serbest bırakmaz.</small></span>
            <span><CheckCircle weight="fill" /><b>Malzeme eksikse</b><small>İş emrini riskli gösterir.</small></span>
            <span><CheckCircle weight="fill" /><b>Kalite kontrolü kapanmadıysa</b><small>Sevkiyata izin vermez.</small></span>
          </div>
        </DataPanel>
      </div>
      <DataPanel title="Ana veri kütüphaneleri" icon={Package}>
        <div className="master-data-grid">
          {[
            ["Malzeme & aksesuar", "MDF, kaplama, ray, menteşe, boya, cam ve metal kodları"],
            ["Tedarikçi & taşeron", "Fiyat, termin, kalite puanı ve yetkinlik geçmişi"],
            ["Reçete & operasyon", "Malzeme listesi, fire, iş merkezi ve standart süre"],
            ["Mahal & ürün tipleri", "Otel odası, mutfak, kapı, panel ve özel imalat şablonları"],
            ["Birim fiyatlar", "Son alış, ortalama maliyet, para birimi ve geçerlilik tarihi"],
            ["Rol & yetki", "Departman, okuma/yazma, maliyet gizleme ve onay limiti"],
          ].map(([title, note]) => <span key={title}><strong>{title}</strong><small>{note}</small></span>)}
        </div>
      </DataPanel>
    </>
  );
}

function HomeD1({ navigate, flash }) {
  return (
    <>
      <PageHeader title="Bugün, 28 Temmuz Salı" action="Yeni proje" onAction={() => navigate("form", "project-contract")} />
      <section className="intervention-section">
        <h2><Warning size={25} weight="fill" />Bugün müdahale gerekenler</h2>
        <div className="action-table">
          <div className="action-head"><span>Proje</span><span>Aşama</span><span>Engelleyici konu</span><span>Sahip</span><span>Son tarih</span><span>Aksiyon</span></div>
          {interventions.map((item, index) => (
            <div className="action-row" key={`${item.project}-${item.stage}`}>
              <button className="project-cell" onClick={() => navigate("project", item.projectId)}><b>{index + 1}</b><span><strong>{item.project}</strong><small>{projects.find((project) => project.id === item.projectId)?.code}</small></span></button>
              <span className="stage-cell"><ClipboardText size={22} /><span><strong>{item.stage}</strong><small>● Aktif</small></span></span>
              <span>{item.issue}</span>
              <span className="owner-cell"><i>{initials(item.owner)}</i><span><strong>{item.owner}</strong><small>{item.role}</small></span></span>
              <span className="time-cell"><Clock size={20} />{item.time}</span>
              <button className="row-action" onClick={() => flash(`${item.project}: ${item.action} aksiyonu kaydedildi.`)}>{item.action}</button>
            </div>
          ))}
        </div>
      </section>
      <div className="split-lists">
        <SimpleList
          icon={FileText}
          title="Onay bekleyenler"
          headers={["Belge / Talep", "Proje", "Talep Eden", "Bekleme"]}
          rows={[
            ["Tasarım Revizyonu - R2", "Gedikpaşa Otel", "Ece Aydın", "1 gün"],
            ["Malzeme Onay Formu", "Kurtköy Konutları", "Yusuf Kaplan", "2 gün"],
            ["Renk Numunesi Onayı", "Tuzla Villa", "Büşra Demir", "3 gün"],
          ]}
          onMore={() => navigate("projects")}
        />
        <SimpleList
          icon={CalendarBlank}
          title="Yaklaşan montajlar"
          headers={["Proje", "Montaj Tarihi", "Yer", "Ekip"]}
          rows={installations.slice(0, 3).map((row) => row.slice(0, 4))}
          onMore={() => navigate("installation")}
        />
      </div>
    </>
  );
}

function SimpleList({ icon: Icon, title, headers, rows, onMore }) {
  return (
    <section className="simple-list">
      <h2><Icon size={25} />{title}</h2>
      <div className="simple-head">{headers.map((header) => <span key={header}>{header}</span>)}</div>
      {rows.map((row, index) => <div className="simple-row" key={index}>{row.map((value, itemIndex) => <span key={itemIndex} className={itemIndex === row.length - 1 ? "emphasis" : ""}>{value}</span>)}</div>)}
      <button className="text-link" onClick={onMore}>Tümünü gör <ArrowRight size={17} /></button>
    </section>
  );
}

function HomeD2({ navigate, flash }) {
  const blockers = [
    ["CNC kapasitesi dolu", "Gedikpaşa Otel", "Kapı üretimi planlanan tarihten 2 gün gecikebilir.", "Ahmet Şahin", "30 Temmuz 2026"],
    ["Kaplama malzemesi tedarik gecikmesi", "Kurtköy Konutları", "Kaplama sevkiyatı bekleniyor.", "Murat Demir", "30 Temmuz 2026"],
    ["Cila hattı yoğunluğu", "Kurtköy Konutları", "Cila hattı %110 dolulukta.", "Zeynep Aksoy", "5 Ağustos 2026"],
  ];
  return (
    <>
      <PageHeader title="Operasyon Akışı" action="İş emri oluştur" onAction={() => navigate("form", "production-order")} />
      <div className="week-strip">
        <button>‹</button><span className="week-range"><CalendarBlank size={19} />27 Tem – 1 Ağu 2026</span>
        {["Pzt|27 Temmuz", "Salı|28 Temmuz", "Çarşamba|29 Temmuz", "Perşembe|30 Temmuz", "Cuma|31 Temmuz", "Cumartesi|1 Ağustos"].map((day) => {
          const [name, date] = day.split("|");
          return <button key={day} className={name === "Salı" ? "active" : ""}><strong>{name}</strong><small>{date}</small></button>;
        })}
      </div>
      <h2 className="section-label">Aktif projeler</h2>
      <div className="flow-layout">
        <div className="pipeline-board">
          {pipeline.map((column) => (
            <section className="pipeline-column" key={column.title}>
              <h3>{column.title}<span>{column.items.length}</span></h3>
              {column.items.map((item) => {
                const project = projects.find((projectItem) => projectItem.id === item.id);
                return (
                  <button className="pipeline-card" key={`${item.id}-${item.item}`} onClick={() => navigate("project", item.id)}>
                    <strong>{project.name}</strong><span>{item.item}</span>
                    <small><UserCircle size={17} />{item.owner}</small>
                    <small><CalendarBlank size={17} />{item.date}</small>
                    <span className="pipeline-progress"><b>%{item.progress}</b><Progress value={item.progress} /></span>
                    <em className={item.tone}><Warning size={17} weight="fill" />{item.blocker}</em>
                  </button>
                );
              })}
              <button className="add-ghost" onClick={() => flash(`${column.title} aşamasına proje ekleme alanı açıldı.`)}><Plus size={18} />Proje ekle</button>
            </section>
          ))}
        </div>
        <aside className="blocker-rail">
          <h2>Kritik engeller</h2>
          {blockers.map((item, index) => (
            <button key={item[0]} onClick={() => navigate("project", index === 0 ? "gedikpasa" : "kurtkoy")}>
              <Warning size={25} weight="fill" />
              <span><strong>{item[0]}</strong><b>{item[1]}</b><small>{item[2]}</small><i>{item[3]}</i><em>Son gün: {item[4]}</em></span>
            </button>
          ))}
        </aside>
      </div>
    </>
  );
}

function SalesPage({ design, navigate }) {
  return (
    <>
      <PageHeader title={titles.sales[0]} action={titles.sales[1]} onAction={() => navigate("form", "offer")} />
      <div className="summary-line">
        <Summary label="Açık teklif" value="12" note="₺86,4 Mn" />
        <Summary label="Bu ay kazanılan" value="5" note="₺34,8 Mn" />
        <Summary label="Kazanma oranı" value="%42" note="+6 puan" />
      </div>
      <ViewToolbar label="Satış hunisi" options={["Kanban", "Liste", "Aktiviteler", "Analiz"]} />
      <div className="sales-pipeline">
        {[
          ["Yeni Fırsat", "8", "₺46,2 Mn"],
          ["Keşif", "5", "₺31,8 Mn"],
          ["Maliyet", "4", "₺28,4 Mn"],
          ["Teklif Müşteride", "7", "₺52,6 Mn"],
          ["Kazanıldı", "5", "₺34,8 Mn"],
        ].map(([stage, count, value], index) => <span key={stage} className={index === 3 ? "active" : ""}><small>{stage}</small><strong>{count}</strong><em>{value}</em></span>)}
      </div>
      <DataPanel title="Güncel teklifler" icon={Handshake}>
        <DataTable headers={["Teklif No", "Müşteri / Proje", "Revizyon", "Tutar", "Durum", "Son işlem"]} rows={offers} design={design} />
      </DataPanel>
      <DataPanel title="Kaybedilen teklif nedenleri" icon={ChartBar}>
        <DataTable headers={["Neden", "Teklif", "Toplam değer", "Oran", "Son örnek"]} rows={[
          ["Fiyat yüksek bulundu", "6", "₺18,4 Mn", "%38", "Yalıköy Villa"],
          ["Termin uygun değil", "3", "₺9,7 Mn", "%19", "Maslak Ofis"],
          ["Rakip tercih edildi", "4", "₺12,2 Mn", "%25", "Bebek Residence"],
          ["Proje ertelendi", "3", "₺7,8 Mn", "%18", "Sapanca Otel"],
        ]} />
      </DataPanel>
    </>
  );
}

function ProjectsPage({ navigate }) {
  return (
    <>
      <PageHeader title="Projeler" action="Yeni proje" onAction={() => navigate("form", "project-contract")} />
      <div className="filter-row">
        <button className="active">Tümü <b>18</b></button><button>Riskli <b>4</b></button><button>Onay bekleyen <b>6</b></button><button>Bu ay bitecek <b>3</b></button>
      </div>
      <ViewToolbar label="Proje görünümü" />
      <DataPanel title="Aktif projeler" icon={FolderSimple}>
        <div className="project-list">
          {projects.map((project) => (
            <button key={project.id} className="project-list-row" onClick={() => navigate("project", project.id)}>
              <span className="project-mark"><Buildings size={23} /></span>
              <span><strong>{project.name}</strong><small>{project.code} · {project.location}</small></span>
              <span className="badge">{project.stage}</span>
              <span className="project-progress"><b>%{project.progress}</b><Progress value={project.progress} /></span>
              <span><strong>{project.deadline}</strong><small>{project.next}</small></span>
              <RiskBadge risk={project.risk} />
              <ArrowRight size={20} />
            </button>
          ))}
        </div>
      </DataPanel>
    </>
  );
}

function OperationsPage({ design, navigate }) {
  return (
    <>
      <PageHeader title={design === "d2" ? "Üretim Planı" : "Operasyon"} action="İş emri oluştur" onAction={() => navigate("form", "production-order")} />
      <ViewToolbar label="Planlama görünümü" options={["İş Merkezi", "Kanban", "Gantt", "Takvim"]} />
      <div className="capacity-strip">
        {[
          ["Ebatlama", 72, "Normal"],
          ["CNC", 108, "Kritik"],
          ["Kenar bantlama", 84, "Yoğun"],
          ["Montaj öncesi", 61, "Normal"],
          ["Cila / dış işlem", 94, "Yoğun"],
        ].map(([name, value, state]) => <span key={name} className={value > 100 ? "danger" : value > 90 ? "warning" : ""}><small>{name}</small><strong>%{value}</strong><Progress value={Math.min(value, 100)} /><em>{state}</em></span>)}
      </div>
      <div className="operation-grid">
        {pipeline.map((column) => (
          <DataPanel key={column.title} title={column.title} icon={Factory}>
            <div className="compact-jobs">
              {column.items.map((item) => {
                const project = projects.find((projectItem) => projectItem.id === item.id);
                return <button key={`${item.id}-${item.item}`} onClick={() => navigate("project", item.id)}><span><strong>{project.name}</strong><small>{item.item} · {item.owner}</small></span><span><b>%{item.progress}</b><Progress value={item.progress} /></span></button>;
              })}
            </div>
          </DataPanel>
        ))}
      </div>
    </>
  );
}

function ProcurementPage({ navigate }) {
  return (
    <>
      <PageHeader title="Satın Alma" action="Satın alma talebi" onAction={() => navigate("form", "procurement")} />
      <div className="summary-line">
        <Summary label="Onay bekleyen" value="7" note="₺4,2 Mn" />
        <Summary label="Geciken teslim" value="3" note="2 kritik" />
        <Summary label="Bu hafta sipariş" value="18" note="₺8,7 Mn" />
      </div>
      <ViewToolbar label="Satın alma görünümü" options={["Talepler", "RFQ Karşılaştırma", "Siparişler", "Termin"]} />
      <DataPanel title="Tedarikçi teklif karşılaştırması · SAT-26081" icon={ShoppingCart}>
        <DataTable headers={["Tedarikçi", "Birim fiyat", "Toplam", "Termin", "Ödeme", "Puan", "Karar"]} rows={[
          ["Ergin Ahşap", "₺1.480 / m²", "₺1.850.000", "7 gün", "30 gün", "4,7 / 5", "Önerilen"],
          ["Marmara Kaplama", "₺1.425 / m²", "₺1.781.250", "14 gün", "Peşin", "4,1 / 5", "Alternatif"],
          ["Doğa Panel", "₺1.560 / m²", "₺1.950.000", "5 gün", "45 gün", "4,4 / 5", "Alternatif"],
        ]} />
      </DataPanel>
      <DataPanel title="Açık satın alma talepleri" icon={ShoppingCart}>
        <DataTable headers={["Talep No", "Proje", "Malzeme / Hizmet", "Tedarikçi", "Miktar", "Termin", "Durum"]} rows={purchaseRows} />
      </DataPanel>
    </>
  );
}

function InstallationPage({ navigate }) {
  return (
    <>
      <PageHeader title="Montaj Planı" action="Montaj planla" onAction={() => navigate("form", "installation")} />
      <ViewToolbar label="Saha görünümü" options={["Takvim", "Harita", "Gantt", "Ekip"]} />
      <div className="field-service-strip">
        <span><Truck size={23} /><b>4 ekip sahada</b><small>7 aktif montaj görevi</small></span>
        <span><Clock size={23} /><b>186 saat</b><small>Bu hafta planlanan</small></span>
        <span><Images size={23} /><b>64 fotoğraf</b><small>Bu hafta yüklenen</small></span>
        <span><CheckCircle size={23} /><b>3 imzalı teslim</b><small>2 form onay bekliyor</small></span>
      </div>
      <div className="calendar-ribbon">
        {["27 Pzt", "28 Salı", "29 Çar", "30 Per", "31 Cum", "1 Cmt", "2 Paz"].map((day) => <button key={day} className={day.includes("28") ? "active" : ""}>{day}</button>)}
      </div>
      <DataPanel title="Yaklaşan saha çalışmaları" icon={Truck}>
        <DataTable headers={["Proje", "Montaj Tarihi", "Yer", "Ekip / Sorumlu", "Hazırlık durumu"]} rows={installations} />
      </DataPanel>
    </>
  );
}

function FinancePage({ navigate }) {
  const rows = projects.slice(0, 5).map((project, index) => [project.name, project.contract, project.actual, index % 2 ? "₺1.250.000" : "₺2.480.000", index === 1 ? "7 gün gecikti" : "Planında"]);
  return (
    <>
      <PageHeader title="Proje Finansları" action="Hareket ekle" onAction={() => navigate("form", "finance-progress")} />
      <div className="summary-line">
        <Summary label="Toplam sözleşme" value="₺118,9 Mn" note="18 aktif proje" />
        <Summary label="Gerçekleşen maliyet" value="₺52,6 Mn" note="Bütçenin %44'ü" />
        <Summary label="Beklenen tahsilat" value="₺8,1 Mn" note="30 gün içinde" />
      </div>
      <ProfitabilityCards />
      <DataPanel title="Proje bazlı finans özeti" icon={CurrencyCircleDollar}>
        <DataTable headers={["Proje", "Sözleşme", "Gerçekleşen maliyet", "Sıradaki hakediş", "Tahsilat durumu"]} rows={rows} />
      </DataPanel>
    </>
  );
}

function ModuleTabs({ items, active, onChange }) {
  return (
    <div className="module-tabs" role="tablist" aria-label="Bölüm görünümü">
      {items.map((item) => (
        <button key={item} role="tab" aria-selected={active === item} className={active === item ? "active" : ""} onClick={() => onChange(item)}>{item}</button>
      ))}
    </div>
  );
}

function AccountingPage({ navigate }) {
  const [active, setActive] = useState("Genel Bakış");
  const tabs = ["Genel Bakış", "Cari Hesaplar", "Faturalar", "Kasa & Banka", "Çek / Senet"];
  const actions = {
    "Genel Bakış": ["Yeni işlem", "invoice-transaction"],
    "Cari Hesaplar": ["Yeni cari", "current-account"],
    "Faturalar": ["Fatura ekle", "invoice-transaction"],
    "Kasa & Banka": ["Hareket ekle", "invoice-transaction"],
    "Çek / Senet": ["Evrak ekle", "invoice-transaction"],
  };
  const [action, formId] = actions[active];

  const content = {
    "Cari Hesaplar": {
      title: "Cari hesaplar ve yaşlandırma",
      icon: IdentificationCard,
      headers: ["Cari", "Tür", "Borç", "Alacak", "Bakiye", "En eski vade", "Risk"],
      rows: [
        ["Marmara Otelcilik A.Ş.", "Müşteri", "₺8.184.000", "₺3.720.000", "₺4.464.000 A", "6 Eyl 2026", "Limit içinde"],
        ["Kurtköy Yapı A.Ş.", "Müşteri", "₺12.600.000", "₺9.450.000", "₺3.150.000 A", "18 Ağu 2026", "Yaklaşıyor"],
        ["Ergin Ahşap", "Tedarikçi", "₺1.850.000", "₺2.480.000", "₺630.000 B", "12 Ağu 2026", "Normal"],
        ["Renk Cila", "Taşeron", "₺430.000", "₺780.000", "₺350.000 B", "9 Ağu 2026", "Vadesi geçti"],
      ],
    },
    "Faturalar": {
      title: "Faturalar ve ödeme durumu",
      icon: Receipt,
      headers: ["Belge no", "Cari", "Tür", "Proje", "Tutar", "Vade", "Durum"],
      rows: [
        ["GIB20260000184", "Marmara Otelcilik", "Satış", "Gedikpaşa Otel", "₺744.000", "6 Eyl", "Kısmi tahsilat"],
        ["EA-2026-00812", "Ergin Ahşap", "Alış", "Kurtköy Konutları", "₺2.220.000", "21 Ağu", "Onay bekliyor"],
        ["RC-2026-00448", "Renk Cila", "Alış", "Tuzla Villa", "₺516.000", "9 Ağu", "Vadesi geçti"],
        ["GIB20260000179", "Kavacık Ofis", "Satış", "Kavacık Ofis", "₺1.860.000", "15 Ağu", "Açık"],
      ],
    },
    "Kasa & Banka": {
      title: "Kasa ve banka hesapları",
      icon: Bank,
      headers: ["Hesap", "Para birimi", "Güncel bakiye", "Bloke", "Kullanılabilir", "Son hareket", "Mutabakat"],
      rows: [
        ["Garanti TL", "TRY", "₺4.860.420", "₺310.000", "₺4.550.420", "Bugün 11:42", "Tam"],
        ["Ziraat TL", "TRY", "₺1.284.600", "—", "₺1.284.600", "Dün 16:18", "Tam"],
        ["Garanti EUR", "EUR", "€86.240", "—", "€86.240", "7 Ağu 14:06", "Kontrol bekliyor"],
        ["Merkez Kasa", "TRY", "₺184.750", "—", "₺184.750", "Bugün 09:20", "₺2.400 fark"],
      ],
    },
    "Çek / Senet": {
      title: "Çek ve senet portföyü",
      icon: FileText,
      headers: ["Portföy no", "Cari", "Tür", "Tutar", "Vade", "Konum", "Durum"],
      rows: [
        ["CEK-26048", "Kurtköy Yapı", "Müşteri çeki", "₺1.250.000", "20 Ağu", "Portföy", "Tahsil bekliyor"],
        ["CEK-26044", "Marmara Otelcilik", "Müşteri çeki", "₺2.480.000", "5 Eyl", "Garanti teminat", "Bankada"],
        ["SNT-26012", "Renk Cila", "Firma senedi", "₺350.000", "18 Ağu", "Tedarikçide", "Ödeme planlandı"],
      ],
    },
  };

  return (
    <>
      <PageHeader title="Ön Muhasebe" action={action} onAction={() => navigate("form", formId)} />
      <div className="module-note"><Wallet size={24} /><span><strong>Şirket geneli nakit ve cari görünümü</strong><small>Proje maliyetleri Finans bölümünde izlenir; resmi kayıtlar kontrol sonrası Datasoft’a aktarılır.</small></span><button onClick={() => navigate("finance")}>Proje finansına git <ArrowRight size={16} /></button></div>
      <div className="summary-line accounting-summary">
        <Summary label="Nakit & banka" value="₺9,84 Mn" note="4 hesap" />
        <Summary label="Alacaklar" value="₺14,62 Mn" note="₺1,28 Mn gecikmiş" />
        <Summary label="Borçlar" value="₺8,47 Mn" note="7 gün içinde ₺2,14 Mn" />
        <Summary label="30 günlük net akış" value="+₺3,18 Mn" note="Tahmini" />
      </div>
      <ModuleTabs items={tabs} active={active} onChange={setActive} />
      {active === "Genel Bakış" ? (
        <div className="module-dashboard-grid">
          <DataPanel title="Yaklaşan tahsilat ve ödemeler" icon={CalendarBlank}>
            <DataTable headers={["Tarih", "Cari", "İşlem", "Proje", "Tutar", "Durum"]} rows={[
              ["9 Ağu", "Renk Cila", "Tedarikçi ödemesi", "Tuzla Villa", "−₺516.000", "Onay bekliyor"],
              ["12 Ağu", "Marmara Otelcilik", "Hakediş tahsilatı", "Gedikpaşa Otel", "+₺2.480.000", "Teyit edildi"],
              ["15 Ağu", "Kavacık Ofis", "Fatura tahsilatı", "Kavacık Ofis", "+₺1.860.000", "Bekleniyor"],
              ["18 Ağu", "Hafele", "Malzeme ödemesi", "Tuzla Villa", "−₺684.000", "Planlandı"],
            ]} />
          </DataPanel>
          <DataPanel title="Kontrol gerektirenler" icon={Warning}>
            <div className="attention-list">
              <button onClick={() => setActive("Faturalar")}><span className="attention-tone danger"><Warning weight="fill" /></span><span><strong>3 gecikmiş alacak</strong><small>Toplam ₺1,28 Mn · en eski 11 gün</small></span><ArrowRight /></button>
              <button onClick={() => setActive("Kasa & Banka")}><span className="attention-tone warning"><Bank weight="fill" /></span><span><strong>Kasa mutabakat farkı</strong><small>Merkez Kasa · ₺2.400 kontrol edilecek</small></span><ArrowRight /></button>
              <button onClick={() => setActive("Faturalar")}><span className="attention-tone"><Receipt weight="fill" /></span><span><strong>6 belge aktarım bekliyor</strong><small>Datasoft kontrol kuyruğu</small></span><ArrowRight /></button>
            </div>
          </DataPanel>
          <DataPanel title="Haftalık nakit akışı" icon={ChartLineUp}>
            <div className="cashflow-bars">
              {[["10–16 Ağu", 72, "₺4,34 Mn", "₺1,62 Mn"], ["17–23 Ağu", 48, "₺2,10 Mn", "₺2,44 Mn"], ["24–30 Ağu", 88, "₺6,82 Mn", "₺2,18 Mn"], ["31 Ağu–6 Eyl", 64, "₺3,75 Mn", "₺2,06 Mn"]].map(([week, value, incoming, outgoing]) => <span key={week}><small>{week}</small><i><b style={{ width: `${value}%` }} /></i><strong>{incoming} giriş</strong><em>{outgoing} çıkış</em></span>)}
            </div>
          </DataPanel>
          <DataPanel title="Cari yaşlandırma" icon={ChartBar}>
            <div className="aging-grid">
              {[["Vadesi gelmemiş", "₺9,84 Mn", 67], ["1–30 gün", "₺3,50 Mn", 24], ["31–60 gün", "₺920 Bin", 6], ["60+ gün", "₺360 Bin", 3]].map(([label, value, rate]) => <span key={label}><small>{label}</small><strong>{value}</strong><Progress value={rate} /><em>%{rate}</em></span>)}
            </div>
          </DataPanel>
        </div>
      ) : (
        <DataPanel title={content[active].title} icon={content[active].icon}>
          <DataTable headers={content[active].headers} rows={content[active].rows} />
        </DataPanel>
      )}
    </>
  );
}

function HumanResourcesPage({ navigate }) {
  const [active, setActive] = useState("Genel Bakış");
  const tabs = ["Genel Bakış", "Personel", "Puantaj", "İzinler", "Bordro Hazırlık", "Belgeler & Zimmet"];
  const actions = {
    "Genel Bakış": ["Yeni personel", "employee-card"],
    "Personel": ["Yeni personel", "employee-card"],
    "Puantaj": ["Puantaj kaydı", "leave-attendance"],
    "İzinler": ["İzin talebi", "leave-attendance"],
    "Bordro Hazırlık": ["Bordro kaydı", "payroll-preparation"],
    "Belgeler & Zimmet": ["Belge / zimmet ekle", "employee-card"],
  };
  const [action, formId] = actions[active];

  const tables = {
    "Personel": {
      title: "Personel listesi",
      icon: UsersThree,
      headers: ["Sicil", "Personel", "Departman / görev", "Çalışma yeri", "İşe giriş", "Durum", "Belge"],
      rows: [
        ["CP-PRS-084", "Kerem Yıldız", "Üretim · CNC Operatörü", "Üretim Tesisi", "8 May 2023", "Aktif", "Tam"],
        ["CP-PRS-042", "Mehmet Yalçın", "Montaj · Ekip Lideri", "Saha", "14 Şub 2021", "Aktif", "1 eksik"],
        ["CP-PRS-031", "Büşra Demir", "Kalite · Sorumlu", "Üretim Tesisi", "3 Kas 2020", "İzinli", "Tam"],
        ["CP-PRS-096", "Eren Uslu", "Satın Alma · Uzman", "Merkez", "1 Tem 2026", "Deneme süresi", "2 eksik"],
      ],
    },
    "Puantaj": {
      title: "Ağustos 2026 puantaj kontrolü",
      icon: Clock,
      headers: ["Personel", "Normal", "Fazla mesai", "İzin", "Eksik gün", "Saha / proje", "Kontrol"],
      rows: [
        ["Kerem Yıldız", "198 sa", "14 sa", "0 gün", "0", "Üretim genel", "Onaylandı"],
        ["Mehmet Yalçın", "176 sa", "22 sa", "1 gün", "0", "3 proje", "Yönetici kontrolü"],
        ["Büşra Demir", "162 sa", "8 sa", "2 gün", "0", "Tuzla Villa", "Onaylandı"],
        ["Eren Uslu", "198 sa", "0 sa", "0 gün", "0", "Merkez", "Eksik giriş"],
      ],
    },
    "İzinler": {
      title: "İzin talepleri ve bakiyeler",
      icon: CalendarBlank,
      headers: ["Personel", "İzin türü", "Tarih", "Süre", "Bakiye", "Vekâlet", "Durum"],
      rows: [
        ["Kerem Yıldız", "Yıllık izin", "17–19 Ağu", "3 gün", "11 gün", "Emre Koç", "Onay bekliyor"],
        ["Büşra Demir", "Yıllık izin", "10–11 Ağu", "2 gün", "8 gün", "Cem Topal", "Onaylandı"],
        ["Murat Demir", "Mazeret", "14 Ağu", "1 gün", "—", "Ece Aydın", "İK kontrolünde"],
      ],
    },
    "Bordro Hazırlık": {
      title: "Bordro ön kontrol listesi · Ağustos 2026",
      icon: Bank,
      headers: ["Personel", "Brüt ücret", "Fazla mesai", "Prim", "Avans / kesinti", "Tahmini net", "Durum"],
      rows: [
        ["Kerem Yıldız", "₺48.500", "₺4.630", "₺2.500", "−₺5.000", "₺42.810", "Aktarım bekliyor"],
        ["Mehmet Yalçın", "₺56.000", "₺8.120", "₺4.000", "—", "₺51.460", "Puantaj kontrolü"],
        ["Büşra Demir", "₺61.500", "₺2.860", "₺3.000", "−₺2.500", "₺48.920", "Hazır"],
      ],
    },
    "Belgeler & Zimmet": {
      title: "Süresi yaklaşan belgeler ve zimmetler",
      icon: FileText,
      headers: ["Personel", "Kayıt", "Tür", "Veriliş", "Geçerlilik / iade", "Sorumlu", "Durum"],
      rows: [
        ["Mehmet Yalçın", "Yüksekte çalışma", "Sertifika", "12 Eyl 2025", "12 Eyl 2026", "İK", "34 gün kaldı"],
        ["Kerem Yıldız", "CNC kullanım yetkisi", "Yetkinlik", "15 Nis 2026", "15 Nis 2027", "Üretim", "Geçerli"],
        ["Eren Uslu", "Lenovo ThinkPad E14", "Zimmet", "1 Tem 2026", "İşten ayrılış", "Bilgi İşlem", "Teslim edildi"],
        ["Büşra Demir", "Periyodik muayene", "Sağlık", "20 Eki 2025", "20 Eki 2026", "İSG", "72 gün kaldı"],
      ],
    },
  };

  return (
    <>
      <PageHeader title="İnsan Kaynakları" action={action} onAction={() => navigate("form", formId)} />
      <div className="module-note hr-note"><UsersThree size={24} /><span><strong>Personel yaşam döngüsü ve saha uygunluğu</strong><small>Özlük ve ücret bilgileri yalnızca yetkili rollere açık; proje ekranlarında yalnızca görev için gerekli bilgiler görünür.</small></span><button onClick={() => navigate("forms")}>İK formlarını aç <ArrowRight size={16} /></button></div>
      <div className="summary-line accounting-summary">
        <Summary label="Aktif personel" value="86" note="72 kadrolu · 14 saha" />
        <Summary label="Bugün sahada" value="31" note="6 projede" />
        <Summary label="İzinli / raporlu" value="7" note="2 onay bekliyor" />
        <Summary label="Açık pozisyon" value="4" note="2 üretim · 2 montaj" />
      </div>
      <ModuleTabs items={tabs} active={active} onChange={setActive} />
      {active === "Genel Bakış" ? (
        <div className="module-dashboard-grid">
          <DataPanel title="Bugünün ekip durumu" icon={UsersThree}>
            <DataTable headers={["Birim", "Planlı", "Mevcut", "İzin / rapor", "Fazla mesai", "Durum"]} rows={[
              ["Üretim", "38", "35", "3", "64 saat", "Planında"],
              ["Montaj", "18", "16", "2", "42 saat", "1 ekip desteği gerekli"],
              ["Proje & Tasarım", "14", "13", "1", "8 saat", "Planında"],
              ["Ofis birimleri", "16", "15", "1", "4 saat", "Planında"],
            ]} />
          </DataPanel>
          <DataPanel title="İK aksiyonları" icon={ListChecks}>
            <div className="attention-list">
              <button onClick={() => setActive("İzinler")}><span className="attention-tone warning"><CalendarBlank weight="fill" /></span><span><strong>2 izin onayı bekliyor</strong><small>En yakın başlangıç 17 Ağustos</small></span><ArrowRight /></button>
              <button onClick={() => setActive("Belgeler & Zimmet")}><span className="attention-tone danger"><Warning weight="fill" /></span><span><strong>4 belgenin süresi yaklaşıyor</strong><small>İSG ve sağlık belgeleri · 45 gün içinde</small></span><ArrowRight /></button>
              <button onClick={() => setActive("Bordro Hazırlık")}><span className="attention-tone"><Bank weight="fill" /></span><span><strong>Ağustos bordro kontrolü</strong><small>8 puantaj kaydı eksik</small></span><ArrowRight /></button>
            </div>
          </DataPanel>
          <DataPanel title="Departman dağılımı" icon={ChartBar}>
            <div className="department-list">
              {[["Üretim", 38, 44], ["Montaj", 18, 21], ["Proje & Tasarım", 14, 16], ["Satın Alma & Finans", 9, 10], ["Yönetim & Destek", 7, 9]].map(([label, count, rate]) => <span key={label}><small>{label}</small><i><b style={{ width: `${rate}%` }} /></i><strong>{count}</strong></span>)}
            </div>
          </DataPanel>
          <DataPanel title="Yaklaşan tarihler" icon={CalendarBlank}>
            <div className="people-events">
              <span><i>12</i><b>Ağu</b><small>2 yeni personel oryantasyonu</small></span>
              <span><i>15</i><b>Ağu</b><small>Puantaj kapanış kontrolü</small></span>
              <span><i>20</i><b>Ağu</b><small>İSG tazeleme eğitimi · 12 kişi</small></span>
              <span><i>31</i><b>Ağu</b><small>Bordro banka listesi onayı</small></span>
            </div>
          </DataPanel>
        </div>
      ) : (
        <DataPanel title={tables[active].title} icon={tables[active].icon}>
          <DataTable headers={tables[active].headers} rows={tables[active].rows} />
        </DataPanel>
      )}
    </>
  );
}

function ReportsPage({ navigate, flash }) {
  const reportItems = [
    ["Proje kârlılığı", "Teklif, bütçe ve gerçekleşen maliyet karşılaştırması", ChartLineUp],
    ["Termin performansı", "Planlanan ve gerçekleşen teslim süreleri", Clock],
    ["Tedarikçi performansı", "Fiyat, kalite ve termin puanları", ShoppingCart],
    ["Teklif dönüşleri", "Kazanılan, kaybedilen ve bekleyen teklifler", Handshake],
    ["Haftalık toplantı", "Geciken işler ve sorumlu bazlı gündem", ListChecks],
    ["Fotoğraf ve teslim", "Proje aşamalarına göre saha kayıtları", Images],
    ["Revizyon ve onay süresi", "Çizim sürümleri, bekleme ve üretim serbest bırakma", ClipboardText],
    ["Dış imalat performansı", "Taşeron kalite, maliyet ve termin karşılaştırması", Factory],
    ["Kalite maliyeti", "Hata, yeniden üretim ve sorumluluk analizi", Warning],
  ];
  return (
    <>
      <PageHeader title="Raporlar" action="Toplantı notu ekle" onAction={() => navigate("form", "weekly-meeting")} />
      <div className="report-grid">
        {reportItems.map(([title, note, Icon]) => <button key={title} onClick={() => flash(`${title} raporu önizlemeye hazır.`)}><Icon size={28} /><span><strong>{title}</strong><small>{note}</small></span><ArrowRight size={20} /></button>)}
      </div>
      <DataPanel title="Son kullanılan raporlar" icon={ChartBar}>
        <DataTable headers={["Rapor", "Dönem", "Oluşturan", "Son görüntüleme", "Format"]} rows={[
          ["Temmuz Proje Kârlılığı", "Temmuz 2026", "Mert Kaya", "Bugün 09:42", "PDF"],
          ["Haftalık Üretim Durumu", "27 Tem – 2 Ağu", "Erdem Yılmaz", "Dün 17:10", "Ekran"],
          ["Tedarikçi Termin Performansı", "2. Çeyrek", "Yusuf Kaplan", "25 Tem 2026", "Excel"],
        ]} />
      </DataPanel>
    </>
  );
}

function FormCatalog({ navigate }) {
  const categories = [...new Set(formDefinitions.map((form) => form.category))];
  return (
    <>
      <PageHeader title="Form Kataloğu" />
      <div className="form-intro">
        <span className="form-intro-icon"><ClipboardText size={28} /></span>
        <div>
          <strong>Firma görüşmesi için alan envanteri</strong>
          <p>Her form örnek verilerle dolduruldu. Zorunlu alanları, gereksiz alanları ve departmanların görebileceği bölümleri bu ekranlar üzerinden birlikte netleştirebilirsiniz.</p>
        </div>
        <span className="form-count">{formDefinitions.length} form</span>
      </div>
      {categories.map((category) => (
        <section className="form-category" key={category}>
          <div className="form-category-heading">
            <h2>{category}</h2>
            <span>{formDefinitions.filter((form) => form.category === category).length} form</span>
          </div>
          <div className="form-catalog-grid">
            {formDefinitions.filter((form) => form.category === category).map((form) => {
              const Icon = form.icon;
              const blueprint = formBlueprintMeta[form.id];
              const fieldCount = blueprint?.fields || form.sections.reduce((total, section) => total + section.fields.length, 0);
              const sectionCount = blueprint?.sections || form.sections.length;
              return (
                <button className="form-card" key={form.id} onClick={() => navigate("form", form.id)}>
                  <span className="form-card-icon"><Icon size={25} /></span>
                  <span className="form-card-copy">
                    <strong>{form.title}</strong>
                    <small>{form.description}</small>
                    <em>{sectionCount} işe özel bölüm · {fieldCount} alan / hücre</em>
                  </span>
                  <ArrowRight size={20} />
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}

function EntryField({ field, fieldId }) {
  const className = `entry-field ${field.span === "full" ? "full" : ""}`;
  const label = (
    <span className="entry-label">
      {field.label}
      {field.required && <b>Zorunlu</b>}
    </span>
  );

  if (field.type === "textarea") {
    return (
      <label className={className} htmlFor={fieldId}>
        {label}
        <textarea id={fieldId} defaultValue={field.value} rows={3} />
        {field.hint && <small>{field.hint}</small>}
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <label className={className} htmlFor={fieldId}>
        {label}
        <span className="select-shell">
          <select id={fieldId} defaultValue={field.value}>
            {field.options.map((option) => <option key={option}>{option}</option>)}
          </select>
          <CaretDown size={16} />
        </span>
        {field.hint && <small>{field.hint}</small>}
      </label>
    );
  }

  if (field.type === "file") {
    return (
      <label className={`${className} file-entry`} htmlFor={fieldId}>
        {label}
        <span className="file-drop">
          <FileText size={24} />
          <span><strong>Dosya seç veya buraya bırak</strong><small>Fotoğraf, PDF veya ilgili teknik dosya</small></span>
          <em>Dosya seç</em>
        </span>
        <input id={fieldId} type="file" accept={field.accept} />
      </label>
    );
  }

  return (
    <label className={className} htmlFor={fieldId}>
      {label}
      <input id={fieldId} type={field.type || "text"} defaultValue={field.value} placeholder={field.placeholder} />
      {field.hint && <small>{field.hint}</small>}
    </label>
  );
}

function EntryFormPage({ id, navigate, flash }) {
  const form = formDefinitions.find((item) => item.id === id) || formDefinitions[0];
  const Icon = form.icon;
  const blueprint = formBlueprintMeta[form.id];
  const isHr = form.category === "İnsan Kaynakları";
  const isAccounting = form.category === "Ön Muhasebe";
  const contextLabel = isHr ? "Bağlı personel" : isAccounting ? "Bağlı cari" : "Bağlı proje";
  const contextValue = isHr ? "CP-PRS-084 · Kerem Yıldız" : isAccounting ? "CR-00184 · Marmara Otelcilik" : "CP-25018 · Gedikpaşa Otel";
  const contextRoute = isHr ? "hr" : isAccounting ? "accounting" : "project";

  const submitDemo = (event, message) => {
    event.preventDefault();
    flash(message);
  };

  return (
    <>
      <div className="form-breadcrumb">
        <button onClick={() => navigate("forms")}>Form Kataloğu</button>
        <span>/</span>
        <strong>{form.title}</strong>
      </div>
      <div className="entry-form-heading">
        <span className="entry-form-heading-icon"><Icon size={28} /></span>
        <div>
          <span className="eyebrow">{form.category}</span>
          <h1>{form.title}</h1>
          <p>{form.description}</p>
        </div>
        <button className="secondary-button" onClick={() => navigate("forms")}>Tüm formlar</button>
      </div>
      <div className="record-context-bar">
        <span><small>{contextLabel}</small><strong>{contextValue}</strong></span>
        <span><small>Kayıt durumu</small><strong>Taslak / İç kontrol</strong></span>
        <span><small>Sorumlu</small><strong>{isHr ? "Derya Akın" : form.category === "Satın Alma" ? "Yusuf Kaplan" : isAccounting ? "Seda Yılmaz" : "Mert Kaya"}</strong></span>
        <span><small>Son aktivite</small><strong>Bugün 10:24</strong></span>
        <button type="button" onClick={() => navigate(contextRoute, contextRoute === "project" ? "gedikpasa" : null)}>İlgili kaydı aç <ArrowRight size={16} /></button>
      </div>
      <div className="entry-form-layout deep-layout">
        <aside className="form-outline">
          <FormStructureSummary id={form.id} />
          <div className="form-review-note">
            <ClipboardText size={21} />
            <p>Her bölüm için “zorunlu, isteğe bağlı, kaldırılacak veya role göre gizli” kararı verilebilir.</p>
          </div>
        </aside>
        <form className="entry-form deep-entry-form" onSubmit={(event) => submitDemo(event, `${form.title} demo kaydı hazırlandı.`)}>
          {blueprint ? <SpecializedForm id={form.id} /> : form.sections.map((section, sectionIndex) => (
            <fieldset className="entry-section" key={section.title}>
              <legend><span>{sectionIndex + 1}</span><strong>{section.title}</strong></legend>
              {section.note && <p className="entry-section-note">{section.note}</p>}
              <div className="entry-fields">
                {section.fields.map((field, fieldIndex) => <EntryField key={`${section.title}-${field.label}`} field={field} fieldId={`${form.id}-${sectionIndex}-${fieldIndex}`} />)}
              </div>
            </fieldset>
          ))}
          {!blueprint && (
            <div className="entry-form-actions">
              <span>Bu prototip veri kaydetmez; alan kapsamını değerlendirmek içindir.</span>
              <button type="button" className="secondary-button">Taslak görünümü</button>
              <button type="submit" className="primary-button"><CheckCircle size={19} />Formu tamamla</button>
            </div>
          )}
        </form>
      </div>
    </>
  );
}

function ProjectDetail({ id, navigate, activeTab, setActiveTab }) {
  const project = projects.find((item) => item.id === id) || projects[0];
  const tabs = ["Özet", "İş Kalemleri", "Revizyon & Onay", "Plan", "Satın Alma", "Üretim", "Kalite", "Montaj", "Finans", "Dosyalar", "Geçmiş"];
  const tabForms = {
    "Özet": "project-contract",
    "İş Kalemleri": "work-item-approval",
    "Revizyon & Onay": "work-item-approval",
    "Plan": "production-order",
    "Satın Alma": "procurement",
    "Üretim": "production-order",
    "Kalite": "quality-photo",
    "Montaj": "installation",
    "Finans": "finance-progress",
    "Dosyalar": "quality-photo",
    "Geçmiş": "weekly-meeting",
  };
  return (
    <>
      <div className="detail-back"><button onClick={() => navigate("projects")}>‹ Projelere dön</button></div>
      <div className="project-hero">
        <div><span className="eyebrow">{project.code}</span><h1>{project.name}</h1><p><MapPin size={18} />{project.location} · {project.description}</p></div>
        <div className="project-health"><span><small>Aşama</small><strong>{project.stage}</strong></span><span><small>İlerleme</small><strong>%{project.progress}</strong></span><RiskBadge risk={project.risk} /></div>
      </div>
      <StageRail current={4} />
      <SmartRecords navigate={navigate} />
      <div className="detail-tabs" role="tablist">{tabs.map((tab) => <button role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)} key={tab}>{tab}</button>)}</div>
      <div className="detail-form-link">
        <span>Bu bölümde kullanılacak veri giriş alanlarını inceleyin.</span>
        <button onClick={() => navigate("form", tabForms[activeTab])}><ClipboardText size={18} />İlgili formu aç</button>
      </div>
      <ProjectTab tab={activeTab} project={project} />
    </>
  );
}

function ProjectTab({ tab, project }) {
  if (tab === "Özet") {
    return (
      <div className="detail-grid">
        <DataPanel title="Proje durumu" icon={ChartLineUp}>
          <div className="detail-status">
            <span><small>Sözleşme</small><strong>{project.contract}</strong></span>
            <span><small>Gerçekleşen maliyet</small><strong>{project.actual}</strong></span>
            <span><small>Proje sorumlusu</small><strong>{project.owner}</strong></span>
            <span><small>Hedef teslim</small><strong>{project.deadline}</strong></span>
          </div>
          <div className="milestone"><CheckCircle size={25} weight="fill" /><span><strong>Sonraki kritik adım</strong><small>{project.next} · {project.nextDate}</small></span><button>Detayı aç</button></div>
        </DataPanel>
        <DataPanel title="Onay kapıları" icon={ClipboardText}>
          <div className="approval-list"><span><CheckCircle weight="fill" />Sözleşme imzalandı</span><span><CheckCircle weight="fill" />Keşif ve metraj onaylandı</span><span className="waiting"><Clock weight="fill" />R2 müşteri onayı bekleniyor</span><span className="muted"><CheckCircle />Üretime serbest bırakma</span><span className="muted"><CheckCircle />Sevkiyat kalite onayı</span></div>
        </DataPanel>
        <DataPanel title="Canlı proje kârlılığı" icon={CurrencyCircleDollar}>
          <ProfitabilityCards compact />
        </DataPanel>
        <DataPanel title="Son aktiviteler" icon={ListChecks}>
          <div className="timeline"><span><b>Bugün 10:24 · Ece Aydın</b>R2 çizimleri müşteri onayına gönderildi.</span><span><b>Dün 16:40 · Yusuf Kaplan</b>Kaplama fiyatı tedarikçiden güncellendi.</span><span><b>25 Tem 11:12 · Selin Kara</b>İmalat öncesi saha kontrolü tamamlandı.</span></div>
        </DataPanel>
      </div>
    );
  }
  if (tab === "İş Kalemleri") {
    return (
      <div className="tab-stack">
        <ViewToolbar label="İş kalemi görünümü" options={["Mahal Ağacı", "Liste", "Kanban", "Metraj"]} />
        <DataPanel title="Proje → mahal → iş kalemi zinciri" icon={ClipboardText}>
          <DataTable headers={["Mahal / İş kalemi", "Ölçü & miktar", "Reçete", "Revizyon", "Durum", "İlerleme"]} rows={[
            ["Tip A Oda / Oda giriş kapısı", "90×210 cm · 48 adet", "RC-KAPI-014", "R2", "Onay bekliyor", "%42"],
            ["Tip A Oda / Gardırop", "180×240×60 · 48 adet", "RC-DLP-022", "R3", "Üretimde", "%68"],
            ["Lobi / Duvar paneli", "186 m²", "RC-PNL-008", "R1", "Malzeme bekliyor", "%20"],
            ["Toplantı / Masa", "360×120 cm · 2 adet", "RC-MSA-031", "R1", "İç onay", "%10"],
          ]} />
        </DataPanel>
        <DataPanel title="Seçili iş kalemi reçetesi · RC-KAPI-014" icon={Package}>
          <DataTable headers={["Bileşen / operasyon", "Miktar", "Birim maliyet", "Kaynak", "Fire", "Durum"]} rows={[
            ["MDF 6 mm", "282 m²", "₺420", "Stok", "%8", "Hazır"],
            ["Yangın dayanımlı kasa", "48 takım", "₺8.750", "Eksen Metal", "%0", "Siparişte"],
            ["Mat lake RAL 9010", "192 m²", "₺640", "Dış işlem", "%5", "Numune onayı"],
            ["CNC + kenar bant", "76 saat", "₺890 / saat", "İç üretim", "%2", "Planlandı"],
          ]} />
        </DataPanel>
      </div>
    );
  }
  if (tab === "Revizyon & Onay") {
    return (
      <div className="tab-stack">
        <div className="release-lock"><Warning size={24} weight="fill" /><span><strong>Üretime geçiş kilitli</strong><small>R2 çizimi müşteri tarafından onaylanmadan ilgili 48 kapı için üretim emri başlatılamaz.</small></span><button>Müşteriye hatırlat</button></div>
        <DataPanel title="Çizim ve reçete sürümleri" icon={FileText}>
          <DataTable headers={["Sürüm", "Değişiklik", "Hazırlayan", "İç onay", "Müşteri", "Üretim durumu"]} rows={[
            ["R0", "İlk teknik çizim", "Selin Kara", "Onaylandı", "Revizyon istedi", "Arşiv"],
            ["R1", "Kasa detayı ve kol aksı", "Selin Kara", "Onaylandı", "Revizyon istedi", "Arşiv"],
            ["R2", "Kol aksı + kaplama yönü", "Selin Kara", "Onaylandı", "Bekliyor", "Kilitli"],
          ]} />
        </DataPanel>
        <DataPanel title="Onay sırası ve sorumlular" icon={CheckCircle}>
          <div className="approval-chain">
            {[
              ["1", "Teknik kontrol", "Ahmet Şahin", "Tamamlandı", "done"],
              ["2", "Proje yöneticisi", "Mert Kaya", "Tamamlandı", "done"],
              ["3", "Müşteri / mimar", "Deniz Arslan", "1 gündür bekliyor", "waiting"],
              ["4", "Üretime serbest bırak", "Erdem Yılmaz", "Sırada", ""],
            ].map(([number, title, person, state, tone]) => <span key={title} className={tone}><i>{tone === "done" ? <CheckCircle weight="fill" /> : number}</i><b>{title}</b><small>{person}</small><em>{state}</em></span>)}
          </div>
        </DataPanel>
      </div>
    );
  }
  if (tab === "Satın Alma") {
    return (
      <div className="tab-stack">
        <DataPanel title="Proje satın alma ve dış imalat" icon={ShoppingCart}>
          <DataTable headers={["Talep", "Malzeme / hizmet", "Tedarikçi", "Termin", "Bütçe", "Durum"]} rows={[
            ["SAT-26081", "Amerikan ceviz kaplama", "Ergin Ahşap", "30 Tem", "₺1.850.000", "Onay bekliyor"],
            ["SAT-26074", "Kapı kolu ve kilit", "Yapı Market Pro", "29 Tem", "₺684.000", "Kısmi teslim"],
            ["DIS-26018", "Mat lake dış işlem", "Renk Cila", "8 Ağu", "₺430.000", "Numune onayı"],
          ]} />
        </DataPanel>
        <DataPanel title="Dış imalat hareketi · DIS-26018" icon={Factory}>
          <div className="subcontract-flow">
            {[
              ["Capproje çıkış", "48 kapı kanadı", "2 Ağu · 09:30"],
              ["Renk Cila", "Zımpara + mat lake", "3–7 Ağu"],
              ["Giriş kalite", "Renk, yüzey, desen", "8 Ağu · 10:00"],
              ["Üretime dönüş", "Paketleme sırası", "8 Ağu · 14:00"],
            ].map(([title, detail, date], index) => <span key={title}><i>{index + 1}</i><b>{title}</b><small>{detail}</small><em>{date}</em></span>)}
          </div>
        </DataPanel>
      </div>
    );
  }
  if (tab === "Üretim") {
    return (
      <div className="tab-stack">
        <ViewToolbar label="Üretim görünümü" options={["Operasyonlar", "İş Merkezi", "Gantt", "Tablet"]} />
        <DataPanel title="Üretim emirleri ve operasyon rotası" icon={Factory}>
          <DataTable headers={["İş emri", "İş kalemi", "Operasyon", "İş merkezi", "Plan / gerçekleşen", "Durum"]} rows={[
            ["UE-260184", "Oda kapıları", "CNC işleme", "CNC-01", "32 sa / 28 sa", "Devam ediyor"],
            ["UE-260185", "Oda kapıları", "Kenar bant", "KB-02", "18 sa / —", "Sırada"],
            ["UE-260186", "Oda kapıları", "Mat lake", "Renk Cila", "5 gün / —", "Dış imalat"],
            ["UE-260191", "Lobi panelleri", "Ebatlama", "EB-01", "14 sa / 16 sa", "Gecikiyor"],
          ]} />
        </DataPanel>
        <div className="production-kpis">
          <span><small>Bugünkü tamamlanma</small><strong>%76</strong><Progress value={76} /></span>
          <span className="warning"><small>CNC kapasitesi</small><strong>%108</strong><Progress value={100} /></span>
          <span><small>İlk seferde kalite</small><strong>%94</strong><Progress value={94} /></span>
          <span><small>Toplam fire</small><strong>%3,2</strong><em>Hedefin altında</em></span>
        </div>
      </div>
    );
  }
  if (tab === "Kalite") {
    return (
      <div className="tab-stack">
        <DataPanel title="Kalite kontrol noktaları" icon={CheckCircle}>
          <DataTable headers={["Kontrol", "Bağlı kayıt", "Yöntem", "Sorumlu", "Sonuç", "Kanıt"]} rows={[
            ["Ölçü doğrulama", "UE-260184", "Kontrol listesi", "Büşra Demir", "Uygun", "6 fotoğraf"],
            ["Lake renk / yüzey", "DIS-26018", "Numune + görsel", "Büşra Demir", "Bekliyor", "R2 numune"],
            ["Montaj öncesi", "48 kapı", "AQL kontrol", "Cem Topal", "2 uygunsuz", "12 fotoğraf"],
          ]} />
        </DataPanel>
        <div className="quality-cards">
          <span className="danger"><Warning size={23} /><strong>2 açık uygunsuzluk</strong><small>1 taşeron · 1 iç üretim</small></span>
          <span><CheckCircle size={23} /><strong>18 kapanan kayıt</strong><small>Ortalama 1,6 gün</small></span>
          <span><CurrencyCircleDollar size={23} /><strong>₺86.400 kalite maliyeti</strong><small>Proje bütçesinin %0,35’i</small></span>
        </div>
      </div>
    );
  }
  if (tab === "Montaj") {
    return (
      <div className="tab-stack">
        <ViewToolbar label="Saha görünümü" options={["Takvim", "Harita", "Ekip", "Eksik İş"]} />
        <DataPanel title="Montaj görevleri" icon={Truck}>
          <DataTable headers={["Görev", "Mahal", "Tarih", "Ekip", "Saha formu", "Durum"]} rows={[
            ["MNT-26044", "Tip A Oda · 2. kat", "4 Ağu", "Ekip 1", "%100 · imzalı", "Tamamlandı"],
            ["MNT-26045", "Tip A Oda · 3–4. kat", "5–6 Ağu", "Ekip 1", "%60 · 18 fotoğraf", "Devam ediyor"],
            ["MNT-26046", "Lobi", "8 Ağu", "Ekip 3", "Hazırlanmadı", "Saha kontrolü"],
          ]} />
        </DataPanel>
        <div className="field-checks">
          <span><CheckCircle weight="fill" /><b>Sevkiyat kontrolü</b><small>48 / 48 parça okundu</small></span>
          <span><CheckCircle weight="fill" /><b>Saha hazırlığı</b><small>Elektrik ve aks kontrolü tamam</small></span>
          <span className="waiting"><Clock weight="fill" /><b>Eksik işler</b><small>3 madde müşteri onayı bekliyor</small></span>
          <span><Images weight="fill" /><b>Teslim kanıtı</b><small>36 fotoğraf + müşteri imzası</small></span>
        </div>
      </div>
    );
  }
  if (tab === "Finans") {
    return (
      <div className="tab-stack">
        <ProfitabilityCards />
        <DataPanel title="Hakediş ve tahsilat planı" icon={CurrencyCircleDollar}>
          <DataTable headers={["Dönem", "Hakediş", "Kesinti", "Net", "Fatura / iç kayıt", "Tahsilat"]} rows={[
            ["Avans", "₺7.440.000", "—", "₺7.440.000", "Resmi", "Tahsil edildi"],
            ["1. Hakediş · %30", "₺7.440.000", "₺372.000", "₺7.068.000", "Taslak", "15 Ağu"],
            ["2. Hakediş · %25", "₺6.200.000", "₺310.000", "₺5.890.000", "Plan", "5 Eyl"],
            ["Teslim · %15", "₺3.720.000", "Teminat çözümü", "₺4.402.000", "Plan", "20 Eyl"],
          ]} />
        </DataPanel>
        <DataPanel title="Maliyet kaynağı kırılımı" icon={ChartBar}>
          <DataTable headers={["Maliyet grubu", "Bütçe", "Bağlanan", "Gerçekleşen", "Sapma", "Kaynak kayıt"]} rows={[
            ["Malzeme", "₺7.820.000", "₺7.460.000", "₺6.180.000", "+₺360.000", "8 satın alma"],
            ["İç işçilik", "₺3.440.000", "₺3.440.000", "₺2.780.000", "Planında", "16 üretim emri"],
            ["Dış imalat", "₺2.260.000", "₺2.510.000", "₺2.140.000", "−₺250.000", "5 taşeron işi"],
            ["Nakliye & montaj", "₺1.680.000", "₺1.510.000", "₺1.240.000", "+₺170.000", "4 saha görevi"],
          ]} />
        </DataPanel>
      </div>
    );
  }
  const content = {
    "Plan": [["Tasarım ve onay", "18–31 Temmuz", "Selin Kara", "Devam ediyor"], ["İmalat", "1–28 Ağustos", "Ahmet Şahin", "Planlandı"], ["Montaj", "3–18 Eylül", "Montaj Ekibi 1", "Planlandı"]],
    "Dosyalar": [["R2 Mimari Çizimler.pdf", "Proje / Revizyon", "Ece Aydın", "Bugün"], ["Sözleşme.pdf", "Sözleşme", "Mert Kaya", "15 Tem"], ["Keşif Fotoğrafları", "24 fotoğraf", "Selin Kara", "12 Tem"]],
    "Geçmiş": [["Proje oluşturuldu", "Mert Kaya", "10 Tem 2026", "09:14"], ["Teklif Rev. 3 kabul edildi", "Ece Aydın", "14 Tem 2026", "17:42"], ["Sözleşme yüklendi", "Mert Kaya", "15 Tem 2026", "11:08"]],
  };
  return <DataPanel title={tab} icon={tab === "Dosyalar" ? FolderSimple : ListChecks}><DataTable headers={["Kayıt", "Detay", "Sorumlu / Durum", "Tarih / İlerleme"]} rows={content[tab] || []} /></DataPanel>;
}

function Summary({ label, value, note }) {
  return <div className="summary-item"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function DataPanel({ title, icon: Icon, children }) {
  return <section className="data-panel"><h2><Icon size={24} />{title}</h2>{children}</section>;
}

function DataTable({ headers, rows }) {
  return (
    <div className="data-table" style={{ "--cols": headers.length }}>
      <div className="data-table-head">{headers.map((header) => <span key={header}>{header}</span>)}</div>
      {rows.map((row, index) => <div className="data-table-row" key={index}>{row.map((cell, cellIndex) => <span key={cellIndex} className={String(cell).includes("gecik") || String(cell).includes("Yüksek") ? "danger-text" : ""}>{cell}</span>)}</div>)}
    </div>
  );
}

function Toast({ message, onClose }) {
  if (!message) return null;
  return <div className="toast"><CheckCircle size={21} weight="fill" /><span>{message}</span><button onClick={onClose}><X size={18} /></button></div>;
}

function MobileNav({ design, route, navigate }) {
  const mobileIds = design === "d1"
    ? ["home", "vision", "projects", "forms", "finance"]
    : ["home", "projects", "production", "accounting", "hr", "forms"];
  const items = mobileIds.map((id) => navigation[design].find((item) => item[0] === id));
  return (
    <nav className="mobile-nav" style={{ "--mobile-items": items.length }}>
      {items.map(([id, label, Icon]) => {
        const active = route === id || (route === "form" && id === "forms");
        return <button key={id} className={active ? "active" : ""} onClick={() => navigate(id)}><Icon size={21} /><span>{label}</span></button>;
      })}
    </nav>
  );
}

export function App() {
  const [location, setLocation] = useState(parseHash);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [activeTab, setActiveTab] = useState("Özet");

  useEffect(() => {
    if (!window.location.hash) window.location.hash = "#/d2/home";
    const onChange = () => { setLocation(parseHash()); setActiveTab("Özet"); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const { design, route, id } = location;
  const navigate = (nextRoute, nextId = null) => {
    window.location.hash = `#/${design}/${nextRoute}${nextId ? `/${nextId}` : ""}`;
  };
  const switchDesign = (nextDesign) => {
    window.location.hash = `#/${nextDesign}/${route}${id ? `/${id}` : ""}`;
  };

  const content = useMemo(() => {
    if (route === "home") return design === "d1" ? <HomeD1 navigate={navigate} flash={setToast} /> : <HomeD2 navigate={navigate} flash={setToast} />;
    if (route === "vision") return <ProductVision notify={setToast} />;
    if (route === "blueprint") return <ProcessBlueprintPage navigate={navigate} />;
    if (route === "sales") return <SalesPage design={design} navigate={navigate} />;
    if (route === "projects") return <ProjectsPage navigate={navigate} />;
    if (route === "project") return <ProjectDetail id={id} navigate={navigate} activeTab={activeTab} setActiveTab={setActiveTab} />;
    if (route === "operations" || route === "production") return <OperationsPage design={design} navigate={navigate} />;
    if (route === "procurement") return <ProcurementPage navigate={navigate} />;
    if (route === "installation") return <InstallationPage navigate={navigate} />;
    if (route === "finance") return <FinancePage navigate={navigate} />;
    if (route === "accounting") return <AccountingPage navigate={navigate} />;
    if (route === "hr") return <HumanResourcesPage navigate={navigate} />;
    if (route === "forms") return <FormCatalog navigate={navigate} />;
    if (route === "form") return <EntryFormPage id={id} navigate={navigate} flash={setToast} />;
    return <ReportsPage navigate={navigate} flash={setToast} />;
  }, [route, design, id, activeTab]);

  return (
    <div className={`app-shell ${design} route-${route}`}>
      <Sidebar design={design} route={route} navigate={navigate} />
      <AppHeader design={design} query={query} setQuery={setQuery} navigate={navigate} />
      <main className="page-content">{content}</main>
      <DesignSwitcher design={design} switchDesign={switchDesign} />
      <MobileNav design={design} route={route} navigate={navigate} />
      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}
