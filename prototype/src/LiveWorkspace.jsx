import { useEffect, useMemo, useState } from "react";
import {
  ArrowClockwise,
  Bell,
  Buildings,
  CalendarBlank,
  Camera,
  CaretDown,
  CaretLeft,
  CaretRight,
  ChartLineUp,
  ChatCircleText,
  Check,
  ClipboardText,
  CloudArrowUp,
  CurrencyCircleDollar,
  Factory,
  FolderSimple,
  Handshake,
  House,
  Kanban,
  ListBullets,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  ShoppingCart,
  SignOut,
  Truck,
  UserCircle,
  UsersThree,
  Wallet,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { api, ApiError, demoAuthEnabled, permissionAllows } from "./api";

const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
const projectStageLabels = { lead: "Talep", discovery: "Keşif", estimating: "Teklif Hazırlığı", offered: "Teklif", contracted: "Sözleşme", design: "Tasarım", procurement: "Satın Alma", production: "Üretim & Kalite", installation: "Montaj", acceptance: "Teslim", completed: "Kapanış", on_hold: "Beklemede", lost: "Kaybedildi", cancelled: "İptal" };

const modules = [
  { id: "dashboard", group: "Genel", title: "Ana Sayfa", icon: House, resource: "dashboard", singular: "kayıt" },
  { id: "notifications", group: "Genel", title: "Bildirimler", icon: Bell, resource: "notifications", singular: "bildirim", authenticated: true },
  { id: "fieldMode", group: "Genel", title: "Saha Modu", icon: Camera, resource: "field-mode", singular: "saha kaydı", authenticated: true },
  { id: "customers", group: "Müşteri & Proje", title: "Müşteriler", icon: UsersThree, resource: "customers", singular: "müşteri" },
  { id: "projects", group: "Müşteri & Proje", title: "Projeler", icon: FolderSimple, resource: "projects", singular: "proje" },
  { id: "offers", group: "Müşteri & Proje", title: "Satış & Teklif", icon: Handshake, resource: "offers", singular: "teklif" },
  { id: "offerItems", group: "Müşteri & Proje", title: "Teklif Kalemleri", icon: ClipboardText, resource: "offerItems", singular: "teklif kalemi" },
  { id: "workItems", group: "Operasyon", title: "İş Kalemleri", icon: ClipboardText, resource: "workItems", singular: "iş kalemi" },
  { id: "projectTasks", group: "Operasyon", title: "Proje Görevleri", icon: Check, resource: "projectTasks", singular: "proje görevi" },
  { id: "purchases", group: "Operasyon", title: "Satın Alma", icon: ShoppingCart, resource: "purchases", singular: "talep" },
  { id: "purchaseOrders", group: "Operasyon", title: "Satın Alma Siparişleri", icon: ShoppingCart, resource: "purchaseOrders", singular: "satın alma siparişi" },
  { id: "production", group: "Operasyon", title: "Üretim", icon: Factory, resource: "production", singular: "üretim emri" },
  { id: "installations", group: "Operasyon", title: "Montaj", icon: Truck, resource: "installations", singular: "montaj planı" },
  { id: "suppliers", group: "Operasyon", title: "Tedarikçiler", icon: Truck, resource: "suppliers", singular: "tedarikçi" },
  { id: "finance", group: "Finans", title: "Proje Finansları", icon: ChartLineUp, resource: "finance", singular: "finans hareketi" },
  { id: "accounting", group: "Finans", title: "Faturalar & Ön Muhasebe", icon: Wallet, resource: "accounting", singular: "fatura" },
  { id: "accounts", group: "Finans", title: "Kasa & Banka", icon: Wallet, resource: "accounts", singular: "hesap" },
  { id: "hr", group: "İnsan Kaynakları", title: "Personel", icon: UsersThree, resource: "hr", singular: "personel" },
  { id: "attendance", group: "İnsan Kaynakları", title: "Puantaj", icon: Check, resource: "attendance", singular: "puantaj" },
  { id: "leaves", group: "İnsan Kaynakları", title: "İzinler", icon: FolderSimple, resource: "leaves", singular: "izin talebi" },
  { id: "payroll", group: "İnsan Kaynakları", title: "Bordro Hazırlık", icon: CurrencyCircleDollar, resource: "payroll", singular: "bordro girdisi" },
  { id: "files", group: "Yönetim", title: "Dosyalar", icon: ClipboardText, resource: "files", singular: "dosya" },
  { id: "memberships", group: "Yönetim", title: "Kullanıcılar", icon: UserCircle, resource: "memberships", singular: "kullanıcı daveti", noEdit: true },
  { id: "roles", group: "Yönetim", title: "Roller & Yetkiler", icon: Buildings, resource: "roles", singular: "rol" },
  { id: "auditLogs", group: "Yönetim", title: "Denetim Kayıtları", icon: ClipboardText, resource: "auditLogs", singular: "denetim kaydı", readOnly: true },
  { id: "backups", group: "Yönetim", title: "Yedekler", icon: ArrowClockwise, resource: "backups", singular: "yedek", ownerOnly: true },
  { id: "tokens", group: "Yönetim", title: "API Erişim Anahtarları", icon: Buildings, resource: "tokens", singular: "API anahtarı", specialAccess: "tokens.manage" },
];

modules.splice(5, 0,
  { id: "siteSurveys", group: "Müşteri & Proje", title: "Keşifler", icon: ClipboardText, resource: "siteSurveys", singular: "keşif" },
  { id: "surveyMeasurements", group: "Müşteri & Proje", title: "Keşif Metrajları", icon: ClipboardText, resource: "surveyMeasurements", singular: "metraj satırı" },
  { id: "contracts", group: "Müşteri & Proje", title: "Sözleşmeler", icon: Handshake, resource: "contracts", singular: "sözleşme" },
  { id: "designRevisions", group: "Müşteri & Proje", title: "Tasarım Revizyonları", icon: PencilSimple, resource: "designRevisions", singular: "tasarım revizyonu" },
  { id: "projectMeetings", group: "Müşteri & Proje", title: "Proje Toplantıları", icon: UsersThree, resource: "projectMeetings", singular: "toplantı" },
  { id: "meetingActions", group: "Müşteri & Proje", title: "Toplantı Aksiyonları", icon: Check, resource: "meetingActions", singular: "aksiyon" },
  { id: "projectCommunications", group: "Müşteri & Proje", title: "İletişim Günlüğü", icon: ChatCircleText, resource: "projectCommunications", singular: "iletişim kaydı" },
);
const supplierIndex = modules.findIndex((item) => item.id === "suppliers");
modules.splice(supplierIndex + 1, 0,
  { id: "inventoryItems", group: "Operasyon", title: "Stok Kartları", icon: FolderSimple, resource: "inventoryItems", singular: "stok kartı" },
  { id: "materialRequirements", group: "Operasyon", title: "Malzeme İhtiyaç Planı", icon: ClipboardText, resource: "materialRequirements", singular: "malzeme ihtiyacı" },
  { id: "stockMovements", group: "Operasyon", title: "Stok Hareketleri", icon: ClipboardText, resource: "stockMovements", singular: "stok hareketi" },
  { id: "qualityInspections", group: "Operasyon", title: "Kalite Kontrolleri", icon: Check, resource: "qualityInspections", singular: "kalite kontrolü" },
  { id: "handovers", group: "Operasyon", title: "Teslim & Kabul", icon: Handshake, resource: "handovers", singular: "teslim kaydı" },
  { id: "handoverPunchItems", group: "Operasyon", title: "Teslim Eksikleri", icon: WarningCircle, resource: "handoverPunchItems", singular: "eksik kalemi" },
  { id: "resourceAssignments", group: "Operasyon", title: "Ekip & Kapasite", icon: UsersThree, resource: "resourceAssignments", singular: "kaynak planı" },
);
const accountsIndex = modules.findIndex((item) => item.id === "accounts");
modules.splice(accountsIndex + 1, 0,
  { id: "progressPayments", group: "Finans", title: "Hakedişler", icon: CurrencyCircleDollar, resource: "progressPayments", singular: "hakediş" },
);

const field = (name, label, type = "text", extra = {}) => ({ name, label, type, ...extra });

const configs = {
  projects: {
    description: "Tekliften montaj kapanışına kadar proje portföyü",
    columns: [
      ["code", "Proje Kodu"], ["name", "Proje"], ["customerName", "Müşteri"],
      ["status", "Aşama", "status"], ["progress", "İlerleme", "percent"], ["targetDate", "Hedef", "date"],
    ],
    fields: [
      field("code", "Proje kodu", "text", { required: true, placeholder: "CP-26001" }),
      field("name", "Proje adı", "text", { required: true }),
      field("customerName", "Müşteri kayıt ID", "text"),
      field("projectManager", "Proje yöneticisi kullanıcı ID"),
      field("status", "Başlangıç aşaması", "select", { required: true, options: ["Potansiyel", "Keşif"] }),
      field("progress", "İlerleme (%)", "number", { min: 0, max: 100 }),
      field("startDate", "Başlangıç", "date"), field("targetDate", "Hedef teslim", "date"),
      field("contractAmount", "Sözleşme tutarı", "number"),
      field("address", "Uygulama adresi", "textarea", { wide: true }),
      field("description", "Kapsam ve önemli notlar", "textarea", { wide: true }),
    ],
  },
  offers: {
    description: "Revizyonları, kazanma olasılığını ve kayıp nedenlerini izleyin",
    columns: [["referenceNo", "Teklif No"], ["projectName", "Proje"], ["customerName", "Müşteri"], ["revision", "Rev."], ["totalAmount", "Tutar", "money"], ["status", "Durum", "status"], ["validUntil", "Geçerlilik", "date"]],
    fields: [
      field("referenceNo", "Teklif numarası", "text", { required: true }), field("revision", "Revizyon", "number", { min: 0 }),
      field("projectName", "Proje kayıt ID", "text"), field("customerName", "Müşteri kayıt ID", "text"),
      field("status", "Durum", "select", { required: true, options: ["Taslak", "Maliyet çalışılıyor", "Sunuldu", "Revizyon istendi", "Kabul edildi", "Kaybedildi"] }),
      field("totalAmount", "Teklif toplamı", "number", { required: true }), field("currency", "Para birimi", "select", { options: ["TRY", "USD", "EUR"] }),
      field("validUntil", "Geçerlilik tarihi", "date"), field("lossReason", "Kayıp / revizyon nedeni"),
      field("notes", "Teklif notu", "textarea", { wide: true }),
    ],
  },
  purchases: {
    description: "Malzeme taleplerini, teklifleri, sipariş ve teslimatı yönetin",
    columns: [["number", "Talep No"], ["projectName", "Proje"], ["itemName", "Malzeme"], ["supplierName", "Tedarikçi"], ["quantity", "Miktar"], ["requiredAt", "İhtiyaç", "date"], ["status", "Durum", "status"]],
    fields: [
      field("number", "Talep numarası", "text", { required: true }), field("projectId", "Proje ID", "text", { required: true }),
      field("itemName", "Malzeme / hizmet", "text", { required: true }), field("supplierName", "Önerilen tedarikçi ID"),
      field("quantity", "Miktar", "number", { required: true, min: 0 }), field("unit", "Birim", "select", { options: ["adet", "m²", "mtül", "kg", "takım", "paket"] }),
      field("requiredAt", "İhtiyaç tarihi", "date"), field("status", "Durum", "select", { options: ["Taslak", "Onay bekliyor", "Onaylandı", "Sipariş verildi", "Kısmi teslim", "Teslim edildi", "İptal"] }),
      field("estimatedAmount", "Tahmini tutar", "number", { permission: { resource: "cost", action: "view" } }), field("currency", "Para birimi", "select", { options: ["TRY", "USD", "EUR"] }),
      field("specification", "Teknik şartname / kalite notu", "textarea", { wide: true }),
    ],
  },
  production: {
    description: "İç üretim ve dış imalat emirlerini kapasiteyle birlikte izleyin",
    columns: [["code", "İş Emri"], ["projectName", "Proje"], ["itemName", "Ürün / Mahal"], ["workCenter", "İş Merkezi"], ["assignee", "Sorumlu"], ["plannedEnd", "Planlanan Bitiş", "date"], ["status", "Durum", "status"]],
    fields: [
      field("code", "İş emri kodu", "text", { required: true }), field("projectId", "Proje ID", "text", { required: true }),
      field("itemName", "İş kalemi kayıt ID", "text"), field("workCenter", "İş merkezi", "select", { options: ["Kesim", "CNC", "Kenar Bantlama", "Montaj", "Cila", "Dış İmalat"] }),
      field("assignee", "Sorumlu / ekip"), field("status", "Durum", "select", { options: ["Planlandı", "Malzeme bekliyor", "Üretimde", "Kalite kontrolde", "Tamamlandı", "Durduruldu"] }),
      field("plannedStart", "Planlanan başlangıç", "date"), field("plannedEnd", "Planlanan bitiş", "date"),
      field("quantity", "Miktar", "number", { min: 0 }), field("outsourced", "Üretim tipi", "select", { options: ["İç üretim", "Dış imalat"] }),
      field("tradeType", "İmalat / taşeron branşı", "select", { options: ["internal", "cila", "metal", "glass_mirror", "door", "upholstery", "stone", "other"] }),
      field("notes", "İmalat / kalite notu", "textarea", { wide: true }),
    ],
  },
  installations: {
    description: "Saha hazırlığı, ekip planı, eksikler ve teslim tutanakları",
    columns: [["code", "Plan No"], ["projectName", "Proje"], ["location", "Konum"], ["teamName", "Ekip"], ["scheduledAt", "Tarih", "date"], ["status", "Durum", "status"]],
    fields: [
      field("code", "Montaj plan no", "text", { required: true }), field("projectId", "Proje ID", "text", { required: true }),
      field("location", "Saha / mahal", "text", { required: true }), field("teamName", "Montaj ekibi", "text", { required: true }),
      field("scheduledAt", "Planlanan tarih", "date", { required: true }), field("status", "Durum", "select", { options: ["Keşif gerekli", "Saha bekleniyor", "Planlandı", "Yolda", "Montajda", "Eksikli", "Teslim edildi"] }),
      field("contactName", "Saha yetkilisi"),
      field("siteReadiness", "Saha hazırlık notu", "textarea", { wide: true }), field("notes", "Montaj / eksik notu", "textarea", { wide: true }),
    ],
  },
  finance: {
    description: "Proje gelir, gider, hakediş ve tahmini kârlılık hareketleri",
    query: { official: false }, officialScope: true,
    columns: [["projectName", "Proje"], ["type", "Hareket"], ["category", "Kategori"], ["amount", "Tutar", "money"], ["dueDate", "Vade", "date"], ["status", "Durum", "status"]],
    fields: [
      field("transactionNo", "Hareket numarası", "text", { required: true }), field("projectId", "Proje ID", "text"),
      field("type", "Hareket tipi", "select", { required: true, options: ["Gelir", "Gider", "Hakediş", "Avans", "Maliyet tahmini"] }),
      field("category", "Kategori", "select", { options: ["Malzeme", "İşçilik", "Taşeron", "Nakliye", "Montaj", "Genel gider", "Satış"] }),
      field("amount", "Tutar", "number", { required: true }), field("currency", "Para birimi", "select", { options: ["TRY", "USD", "EUR"] }),
      field("transactionDate", "İşlem tarihi", "date", { required: true }), field("dueDate", "Vade / hakediş tarihi", "date"),
      field("status", "Durum", "select", { options: ["Planlandı", "Onay bekliyor", "Onaylandı", "Tahsil edildi", "Ödendi", "Gecikti"] }),
      field("description", "Açıklama", "textarea", { wide: true }),
    ],
  },
  accounting: {
    description: "Cari, kasa/banka, fatura ve ödeme takibi; resmi kayıtlar Datasoft'ta kalır",
    query: { official: true }, officialScope: true,
    columns: [["documentNo", "Belge No"], ["customerId", "Müşteri ID"], ["supplierId", "Tedarikçi ID"], ["direction", "Yön"], ["amount", "Tutar", "money"], ["dueDate", "Vade", "date"], ["status", "Durum", "status"]],
    fields: [
      field("direction", "Fatura yönü", "select", { required: true, options: ["Satış", "Alış"] }),
      field("documentNo", "Fatura / belge numarası", "text", { required: true }), field("customerId", "Müşteri ID"), field("supplierId", "Tedarikçi ID"),
      field("amount", "Tutar", "number", { required: true }), field("currency", "Para birimi", "select", { options: ["TRY", "USD", "EUR"] }),
      field("transactionDate", "İşlem tarihi", "date", { required: true }), field("dueDate", "Vade tarihi", "date"),
      field("status", "Durum", "select", { options: ["Taslak", "Açık", "Kısmi", "Ödendi", "Tahsil edildi", "Gecikti"] }),
      field("datasoftStatus", "Datasoft", "select", { options: ["Aktarılmayacak", "Aktarım bekliyor", "Aktarıldı"] }),
      field("description", "Açıklama", "textarea", { wide: true }),
    ],
  },
  hr: {
    description: "Özlük, görev, izin ve çalışma durumu; bordro yerine bordro hazırlık verisi",
    columns: [["employeeNo", "Sicil No"], ["fullName", "Personel"], ["department", "Bölüm"], ["jobTitle", "Görev"], ["startDate", "İşe Giriş", "date"], ["status", "Durum", "status"]],
    fields: [
      field("employeeNo", "Sicil numarası", "text", { required: true }), field("firstName", "Ad", "text", { required: true }),
      field("lastName", "Soyad", "text", { required: true }), field("department", "Bölüm", "select", { options: ["Yönetim", "Mimari", "Proje", "Satın Alma", "Üretim", "Montaj", "Finans", "İnsan Kaynakları"] }),
      field("jobTitle", "Görev / unvan", "text", { required: true }), field("employmentType", "Çalışma tipi", "select", { options: ["Tam zamanlı", "Yarı zamanlı", "Dönemsel", "Taşeron"] }),
      field("email", "E-posta", "email"), field("phone", "Telefon", "tel"), field("startDate", "İşe giriş", "date"),
      field("status", "Durum", "select", { options: ["Aktif", "İzinli", "Pasif", "İşten ayrıldı"] }),
      field("emergencyContact", "Acil durum kişisi / telefonu"),
      field("salaryAmount", "Aylık ücret", "number", { permission: { resource: "salary", action: "view" } }),
      field("address", "Adres / özlük notu", "textarea", { wide: true }),
    ],
  },
  customers: {
    description: "Müşteri, karar verici, vergi ve ticari çalışma bilgileri",
    columns: [["code", "Cari Kod"], ["name", "Müşteri"], ["type", "Tür"], ["contactName", "Yetkili"], ["phone", "Telefon"], ["city", "Şehir"], ["status", "Durum", "status"]],
    fields: [field("code", "Cari kod"), field("name", "Müşteri / firma adı", "text", { required: true }), field("type", "Müşteri türü", "select", { options: ["company", "individual", "hotel", "architect"] }), field("contactName", "Yetkili kişi"), field("email", "E-posta", "email"), field("phone", "Telefon", "tel"), field("taxOffice", "Vergi dairesi"), field("taxNumber", "Vergi / T.C. no"), field("city", "Şehir"), field("paymentTerms", "Ödeme koşulu"), field("creditLimit", "Kredi limiti", "number"), field("status", "Durum", "select", { options: ["active", "passive"] }), field("address", "Adres", "textarea", { wide: true }), field("notes", "Notlar", "textarea", { wide: true })],
  },
  suppliers: {
    description: "Malzeme ve dış imalat tedarikçileri, yetkililer ve performans",
    columns: [["code", "Kod"], ["name", "Tedarikçi"], ["category", "Kategori"], ["contactName", "Yetkili"], ["phone", "Telefon"], ["rating", "Puan"], ["status", "Durum", "status"]],
    fields: [field("code", "Tedarikçi kodu"), field("name", "Tedarikçi adı", "text", { required: true }), field("category", "Kategori"), field("contactName", "Yetkili kişi"), field("email", "E-posta", "email"), field("phone", "Telefon", "tel"), field("taxOffice", "Vergi dairesi"), field("taxNumber", "Vergi numarası"), field("city", "Şehir"), field("paymentTerms", "Ödeme koşulu"), field("rating", "Tedarikçi puanı", "number", { min: 0, max: 5 }), field("status", "Durum", "select", { options: ["active", "passive"] }), field("address", "Adres", "textarea", { wide: true }), field("notes", "Notlar", "textarea", { wide: true })],
  },
  workItems: {
    description: "Proje, mahal ve ürün kırılımında ölçü, malzeme, üretim ve fiyat bilgisi",
    columns: [["itemCode", "Kalem Kodu"], ["spaceName", "Mahal"], ["productType", "Ürün"], ["description", "Açıklama"], ["quantity", "Miktar"], ["productionType", "Üretim"], ["status", "Durum", "status"]],
    fields: [field("projectId", "Proje ID", "text", { required: true }), field("taskId", "Görev ID"), field("itemCode", "İş kalemi kodu"), field("spaceName", "Mahal"), field("productType", "Ürün türü"), field("description", "Açıklama", "text", { required: true }), field("width", "Genişlik (mm)", "number"), field("height", "Yükseklik (mm)", "number"), field("depth", "Derinlik (mm)", "number"), field("quantity", "Miktar", "number", { min: 0 }), field("unit", "Birim"), field("material", "Malzeme"), field("finish", "Yüzey / renk"), field("productionType", "Üretim tipi", "select", { options: ["internal", "external"] }), field("supplierId", "Tedarikçi ID"), field("unitCost", "Birim maliyet", "number", { permission: { resource: "cost", action: "view" } }), field("unitPrice", "Birim satış", "number"), field("status", "Durum", "select", { options: ["planned", "approved", "production", "completed"] })],
  },
  attendance: {
    description: "Günlük giriş-çıkış, normal çalışma ve fazla mesai kayıtları",
    columns: [["employeeId", "Personel ID"], ["workDate", "Tarih", "date"], ["checkIn", "Giriş"], ["checkOut", "Çıkış"], ["regularMinutes", "Normal dk"], ["overtimeMinutes", "Fazla dk"], ["status", "Durum", "status"]],
    fields: [field("employeeId", "Personel ID", "text", { required: true }), field("workDate", "Çalışma tarihi", "date", { required: true }), field("checkIn", "Giriş saati", "time"), field("checkOut", "Çıkış saati", "time"), field("regularMinutes", "Normal çalışma (dk)", "number"), field("overtimeMinutes", "Fazla mesai (dk)", "number"), field("location", "Çalışma yeri"), field("source", "Kayıt kaynağı", "select", { options: ["manual", "mobile", "device"] }), field("status", "Durum", "select", { options: ["present", "absent", "leave", "remote"] }), field("notes", "Not", "textarea", { wide: true })],
  },
  leaves: {
    description: "Personel izin talepleri, süreleri ve onay durumları",
    columns: [["employeeId", "Personel ID"], ["leaveType", "İzin Türü"], ["startDate", "Başlangıç", "date"], ["endDate", "Bitiş", "date"], ["dayCount", "Gün"], ["status", "Durum", "status"]],
    fields: [field("employeeId", "Personel ID", "text", { required: true }), field("leaveType", "İzin türü", "select", { required: true, options: ["annual", "medical", "unpaid", "excuse", "birth"] }), field("startDate", "Başlangıç", "date", { required: true }), field("endDate", "Bitiş", "date", { required: true }), field("dayCount", "Gün sayısı", "number", { required: true, min: 0 }), field("status", "Durum", "select", { options: ["pending", "approved", "rejected", "cancelled"] }), field("reason", "İzin açıklaması", "textarea", { wide: true })],
  },
  payroll: {
    description: "Resmi bordroya aktarılacak dönemsel ücret, mesai ve kesinti girdileri",
    columns: [["employeeId", "Personel ID"], ["period", "Dönem"], ["baseSalary", "Brüt Ücret", "money"], ["overtimeAmount", "Mesai", "money"], ["netPreview", "Net Önizleme", "money"], ["status", "Durum", "status"]],
    fields: [field("employeeId", "Personel ID", "text", { required: true }), field("period", "Dönem (YYYY-AA)", "month", { required: true }), field("baseSalary", "Brüt ücret", "number", { permission: { resource: "salary", action: "view" } }), field("overtimeAmount", "Fazla mesai", "number", { permission: { resource: "salary", action: "view" } }), field("bonusAmount", "Prim", "number", { permission: { resource: "salary", action: "view" } }), field("allowanceAmount", "Yan hak", "number", { permission: { resource: "salary", action: "view" } }), field("deductionAmount", "Kesinti", "number", { permission: { resource: "salary", action: "view" } }), field("advanceAmount", "Avans", "number", { permission: { resource: "salary", action: "view" } }), field("netPreview", "Net önizleme", "number", { permission: { resource: "salary", action: "view" } }), field("currency", "Para birimi", "select", { options: ["TRY", "USD", "EUR"] }), field("status", "Durum", "select", { options: ["draft", "approved", "exported"] }), field("notes", "Notlar", "textarea", { wide: true })],
  },
  files: {
    description: "Proje, mahal, iş kalemi, revizyon, kalite ve montaj adımına bağlı fotoğraf ve belgeler",
    columns: [["fileName", "Dosya"], ["projectId", "Proje ID"], ["spaceName", "Mahal"], ["captureStage", "Aşama"], ["category", "Kategori"], ["visibility", "Görünürlük"], ["takenAt", "Çekim", "date"]],
    fields: [], uploadOnly: true,
  },
  memberships: {
    description: "Firma kullanıcılarını davet edin ve rollerini belirleyin",
    columns: [["userId", "Kullanıcı ID"], ["title", "Görev"], ["roleId", "Rol ID"], ["status", "Durum", "status"]],
    fields: [field("email", "E-posta", "email", { required: true }), field("fullName", "Ad soyad", "text", { required: true }), field("phone", "Giriş telefonu", "tel", { required: true, placeholder: "05xx xxx xx xx" }), field("temporaryPassword", "Geçici giriş şifresi", "password", { required: true, placeholder: "En az 8 karakter" }), field("roleId", "Rol ID", "text", { required: true }), field("title", "Firma içi görev")],
  },
  roles: {
    description: "Görev rollerini ve her rolün okuyabileceği/değiştirebileceği alanları yönetin",
    columns: [["code", "Rol Kodu"], ["name", "Rol"], ["description", "Açıklama"], ["isSystem", "Sistem Rolü"]],
    fields: [field("code", "Rol kodu", "text", { required: true }), field("name", "Rol adı", "text", { required: true }), field("description", "Açıklama", "textarea", { wide: true })],
  },
  auditLogs: {
    description: "Kim, ne zaman, hangi kaydı değiştirdi: salt okunur işlem izi",
    columns: [["createdAt", "Tarih", "date"], ["action", "İşlem"], ["entityType", "Modül"], ["entityId", "Kayıt ID"], ["userId", "Kullanıcı ID"], ["ipAddress", "IP"]], fields: [],
  },
  offerItems: {
    description: "Teklifin ürün, miktar, satış fiyatı ve maliyet kırılımı",
    columns: [["itemCode", "Kalem Kodu"], ["offerId", "Teklif ID"], ["description", "Açıklama"], ["quantity", "Miktar"], ["unit", "Birim"], ["unitPrice", "Birim Fiyat", "money"], ["total", "Toplam", "money"]],
    fields: [field("offerId", "Teklif ID", "text", { required: true }), field("parentId", "Üst kalem ID"), field("itemCode", "Kalem kodu"), field("description", "Açıklama", "text", { required: true }), field("unit", "Birim"), field("quantity", "Miktar", "number", { min: 0 }), field("unitPrice", "Birim satış fiyatı", "number"), field("costPrice", "Birim maliyet", "number", { permission: { resource: "cost", action: "view" } }), field("discountRate", "İndirim (%)", "number", { min: 0, max: 100 }), field("taxRate", "KDV (%)", "number", { min: 0, max: 100 }), field("total", "Toplam", "number"), field("sortOrder", "Sıra", "number")],
  },
  projectTasks: {
    description: "Proje iş planı, sorumlular, bağımlılıklar ve ilerleme",
    columns: [["title", "Görev"], ["projectId", "Proje ID"], ["department", "Bölüm"], ["assigneeUserId", "Sorumlu ID"], ["plannedEnd", "Hedef", "date"], ["progress", "İlerleme", "percent"], ["status", "Durum", "status"]],
    fields: [field("projectId", "Proje ID", "text", { required: true }), field("parentId", "Üst görev ID"), field("title", "Görev başlığı", "text", { required: true }), field("assigneeUserId", "Sorumlu kullanıcı ID"), field("department", "Bölüm"), field("status", "Durum", "select", { options: ["todo", "in_progress", "blocked", "completed"] }), field("priority", "Öncelik", "select", { options: ["low", "normal", "high", "urgent"] }), field("plannedStart", "Planlanan başlangıç", "date"), field("plannedEnd", "Planlanan bitiş", "date"), field("progress", "İlerleme (%)", "number", { min: 0, max: 100 }), field("dependencyIds", "Bağımlı görev ID'leri", "text", { placeholder: "Virgülle ayırın" }), field("description", "Açıklama", "textarea", { wide: true })],
  },
  purchaseOrders: {
    description: "Onaylı taleplerden açılan tedarikçi siparişleri ve teslim durumu",
    columns: [["orderNumber", "Sipariş No"], ["projectId", "Proje ID"], ["supplierId", "Tedarikçi ID"], ["orderDate", "Sipariş", "date"], ["expectedDate", "Teslim", "date"], ["grandTotal", "Toplam", "money"], ["status", "Durum", "status"]],
    fields: [field("orderNumber", "Sipariş numarası", "text", { required: true }), field("requestId", "Talep ID"), field("projectId", "Proje ID"), field("supplierId", "Tedarikçi ID", "text", { required: true }), field("orderDate", "Sipariş tarihi", "date"), field("expectedDate", "Beklenen teslim", "date"), field("currency", "Para birimi", "select", { options: ["TRY", "USD", "EUR"] }), field("subtotal", "Ara toplam", "number"), field("taxTotal", "Vergi toplamı", "number"), field("grandTotal", "Genel toplam", "number"), field("status", "Durum", "select", { options: ["draft", "ordered", "partial", "received", "cancelled"] }), field("deliveryAddress", "Teslimat adresi", "textarea", { wide: true }), field("notes", "Notlar", "textarea", { wide: true })],
  },
  accounts: {
    description: "Kasa, banka ve diğer ödeme hesaplarının güncel bakiyeleri",
    columns: [["code", "Hesap Kodu"], ["name", "Hesap"], ["type", "Tür"], ["bankName", "Banka"], ["currency", "Para Birimi"], ["currentBalance", "Bakiye", "money"], ["status", "Durum", "status"]],
    fields: [field("code", "Hesap kodu", "text", { required: true }), field("name", "Hesap adı", "text", { required: true }), field("type", "Hesap türü", "select", { required: true, options: ["cash", "bank", "credit_card", "other"] }), field("currency", "Para birimi", "select", { options: ["TRY", "USD", "EUR"] }), field("bankName", "Banka adı"), field("iban", "IBAN"), field("openingBalance", "Açılış bakiyesi", "number"), field("currentBalance", "Güncel bakiye", "number"), field("status", "Durum", "select", { options: ["active", "passive"] })],
  },
  tokens: { description: "Entegrasyonlar için süreli erişim anahtarları; gizli değer yalnız bir kez gösterilir", columns: [], fields: [] },
  backups: { description: "Firmaya ait verilerin günlük ve isteğe bağlı güvenli yedekleri", columns: [], fields: [] },
};

Object.assign(configs, {
  siteSurveys: {
    description: "Müşteri sahasındaki keşif randevusu, sorumlu, konum ve onay süreci",
    columns: [["surveyNumber", "Keşif No"], ["projectId", "Proje ID"], ["customerId", "Müşteri ID"], ["surveyDate", "Keşif Tarihi", "date"], ["location", "Konum"], ["status", "Durum", "status"]],
    fields: [field("surveyNumber", "Keşif numarası", "text", { required: true }), field("projectId", "Proje ID"), field("customerId", "Müşteri ID"), field("surveyDate", "Keşif tarihi", "date", { required: true }), field("location", "Keşif konumu"), field("surveyorUserId", "Keşfi yapan kullanıcı ID"), field("customerContact", "Müşteri saha yetkilisi"), field("status", "Durum", "select", { options: ["draft", "in_progress", "completed", "approved", "cancelled"] }), field("notes", "Keşif notları", "textarea", { wide: true })],
  },
  surveyMeasurements: {
    description: "Onay öncesi keşiflere bağlı mahal, eleman ve ölçü bazlı metraj satırları",
    columns: [["siteSurveyId", "Keşif ID"], ["spaceName", "Mahal"], ["elementType", "Eleman"], ["itemCode", "Kalem Kodu"], ["quantity", "Miktar"], ["unit", "Birim"]],
    fields: [field("siteSurveyId", "Keşif ID", "text", { required: true }), field("spaceName", "Mahal", "text", { required: true }), field("elementType", "Eleman türü", "text", { required: true }), field("itemCode", "Kalem kodu"), field("description", "Açıklama"), field("width", "Genişlik (mm)", "number"), field("height", "Yükseklik (mm)", "number"), field("depth", "Derinlik (mm)", "number"), field("length", "Uzunluk (mm)", "number"), field("quantity", "Miktar", "number", { min: 0 }), field("unit", "Birim", "text", { required: true }), field("material", "Malzeme"), field("finish", "Yüzey / renk"), field("sortOrder", "Sıra", "number"), field("notes", "Ölçüm notu", "textarea", { wide: true })],
  },
  contracts: {
    description: "Tekliften doğan sözleşme, ödeme modeli, teminat ve imza yaşam döngüsü",
    columns: [["contractNumber", "Sözleşme No"], ["projectId", "Proje ID"], ["customerId", "Müşteri ID"], ["paymentModel", "Ödeme Modeli"], ["contractAmount", "Tutar", "money"], ["effectiveDate", "Başlangıç", "date"], ["status", "Durum", "status"]],
    fields: [field("contractNumber", "Sözleşme numarası", "text", { required: true }), field("projectId", "Proje ID", "text", { required: true }), field("customerId", "Müşteri ID", "text", { required: true }), field("offerId", "Kaynak teklif ID"), field("paymentModel", "Ödeme modeli", "select", { required: true, options: ["progress_payment", "advance_balance", "custom"] }), field("paymentSchedule", "Ödeme planı", "textarea", { wide: true, placeholder: "Taksitleri virgülle veya JSON olarak girin" }), field("currency", "Para birimi", "select", { options: ["TRY", "USD", "EUR"] }), field("contractAmount", "Sözleşme tutarı", "number"), field("advanceRate", "Avans oranı (%)", "number", { min: 0, max: 100 }), field("advanceAmount", "Avans tutarı", "number"), field("retentionRate", "Teminat kesintisi (%)", "number", { min: 0, max: 100 }), field("retentionAmount", "Teminat tutarı", "number"), field("warrantyMonths", "Garanti süresi (ay)", "number", { min: 0 }), field("warrantyAmount", "Garanti teminatı", "number"), field("effectiveDate", "Yürürlük tarihi", "date"), field("plannedStartDate", "Planlanan başlangıç", "date"), field("plannedEndDate", "Planlanan bitiş", "date"), field("signedByCustomer", "Müşteri imza yetkilisi"), field("signedByCompany", "Firma imza yetkilisi"), field("photoConsent", "Fotoğraf kullanım izni", "select", { options: ["not_requested", "denied", "internal_only", "marketing_allowed"] }), field("status", "Durum", "select", { options: ["draft", "pending_signature", "signed", "active", "completed", "terminated", "cancelled"] }), field("notes", "Sözleşme notları", "textarea", { wide: true })],
  },
  designRevisions: {
    description: "2D/3D çizim dosyalarının iç kontrolü ve müşteri onay revizyonları",
    columns: [["projectId", "Proje ID"], ["drawingType", "Çizim Türü"], ["title", "Başlık"], ["revisionNumber", "Revizyon"], ["fileId", "Dosya ID"], ["status", "Durum", "status"]],
    fields: [field("projectId", "Proje ID", "text", { required: true }), field("workItemId", "İş kalemi ID"), field("drawingType", "Çizim türü", "select", { required: true, options: ["2d", "3d", "shop_drawing"] }), field("title", "Revizyon başlığı", "text", { required: true }), field("revisionNumber", "Revizyon numarası", "number", { min: 0 }), field("fileId", "Çizim dosyası ID"), field("supersedesId", "Yerine geçtiği revizyon ID"), field("status", "Durum", "select", { options: ["draft", "internal_review", "client_review", "approved", "rejected", "superseded"] }), field("rejectionReason", "Ret / değişiklik nedeni"), field("notes", "Tasarım notları", "textarea", { wide: true })],
  },
  progressPayments: {
    description: "Sözleşmeye bağlı dönemsel hakediş, kesinti, fatura ve tahsilat süreci",
    columns: [["progressNumber", "Hakediş No"], ["projectId", "Proje ID"], ["contractId", "Sözleşme ID"], ["periodEnd", "Dönem Sonu", "date"], ["netPayable", "Net Hakediş", "money"], ["status", "Durum", "status"]],
    fields: [field("progressNumber", "Hakediş numarası", "text", { required: true }), field("projectId", "Proje ID", "text", { required: true }), field("contractId", "Sözleşme ID", "text", { required: true }), field("periodStart", "Dönem başlangıcı", "date", { required: true }), field("periodEnd", "Dönem sonu", "date", { required: true }), field("currency", "Para birimi", "select", { options: ["TRY", "USD", "EUR"] }), field("previousWork", "Önceki imalat toplamı", "number"), field("currentWork", "Bu dönem imalat", "number"), field("cumulativeWork", "Kümülatif imalat", "number"), field("deduction", "Kesinti", "number"), field("retention", "Teminat kesintisi", "number"), field("tax", "Vergi", "number"), field("netPayable", "Net hakediş", "number"), field("status", "Durum", "select", { options: ["draft", "pending", "approved", "rejected", "invoiced", "paid", "cancelled"] }), field("invoiceId", "Fatura ID"), field("paymentTransactionId", "Ödeme hareketi ID"), field("rejectionReason", "Ret nedeni"), field("notes", "Hakediş notları", "textarea", { wide: true })],
  },
  inventoryItems: {
    description: "Malzeme stok kartı, rezerv, minimum seviye ve tercih edilen tedarikçi",
    columns: [["sku", "Stok Kodu"], ["name", "Malzeme"], ["category", "Kategori"], ["unit", "Birim"], ["onHandQuantity", "Mevcut"], ["reservedQuantity", "Rezerve"], ["minimumQuantity", "Minimum"], ["status", "Durum", "status"]],
    fields: [field("sku", "Stok kodu", "text", { required: true }), field("name", "Malzeme adı", "text", { required: true }), field("category", "Kategori"), field("unit", "Birim", "text", { required: true }), field("reservedQuantity", "Rezerve miktar", "number", { min: 0 }), field("minimumQuantity", "Minimum stok", "number", { min: 0 }), field("averageCost", "Ortalama maliyet", "number", { permission: { resource: "cost", action: "view" } }), field("warehouseLocation", "Depo / raf konumu"), field("preferredSupplierId", "Tercih edilen tedarikçi ID"), field("status", "Durum", "select", { options: ["active", "passive", "discontinued"] }), field("notes", "Stok notları", "textarea", { wide: true })],
  },
  stockMovements: {
    description: "Projeye bağlı giriş, çıkış, rezerv ve sayım düzeltmelerinin kesin kaydı",
    columns: [["movementNumber", "Hareket No"], ["inventoryItemId", "Stok Kartı ID"], ["projectId", "Proje ID"], ["movementType", "Hareket"], ["movementDate", "Tarih", "date"], ["quantity", "Miktar"], ["totalCost", "Toplam Maliyet", "money"], ["status", "Durum", "status"]],
    fields: [field("movementNumber", "Hareket numarası", "text", { required: true }), field("inventoryItemId", "Stok kartı ID", "text", { required: true }), field("projectId", "Proje ID"), field("movementType", "Hareket türü", "select", { required: true, options: ["receipt", "issue", "adjustment_in", "adjustment_out", "project_issue", "project_return"] }), field("movementDate", "Hareket tarihi", "date", { required: true }), field("quantity", "Miktar", "number", { required: true }), field("unitCost", "Birim maliyet", "number", { permission: { resource: "cost", action: "view" } }), field("totalCost", "Toplam maliyet", "number", { permission: { resource: "cost", action: "view" } }), field("status", "Durum", "select", { options: ["draft", "posted", "cancelled"] }), field("sourceType", "Kaynak türü"), field("sourceId", "Kaynak kayıt ID"), field("reference", "Referans"), field("notes", "Hareket notu", "textarea", { wide: true })],
  },
});

Object.assign(configs, {
  projectMeetings: {
    description: "Haftalık proje, üretim ve saha toplantılarının karar ve yayın akışı",
    columns: [["meetingDate", "Tarih", "date"], ["meetingType", "Toplantı Türü"], ["title", "Başlık"], ["projectId", "Proje ID"], ["facilitatorUserId", "Yöneten"], ["status", "Durum", "status"]],
    fields: [field("projectId", "Proje ID"), field("meetingType", "Toplantı türü", "select", { required: true, options: ["weekly_project", "weekly_production", "coordination", "site"] }), field("meetingDate", "Toplantı tarihi", "date", { required: true }), field("title", "Toplantı başlığı", "text", { required: true }), field("facilitatorUserId", "Toplantı yöneticisi kullanıcı ID"), field("attendees", "Katılımcılar", "textarea", { wide: true, placeholder: "Virgülle ayırın" }), field("summary", "Kararlar ve toplantı özeti", "textarea", { wide: true }), field("status", "Durum", "select", { options: ["draft", "published", "closed"] })],
  },
  meetingActions: {
    description: "Toplantılarda alınan kararların sorumlu, termin ve gerçekleşme takibi",
    columns: [["title", "Aksiyon"], ["meetingId", "Toplantı ID"], ["projectId", "Proje ID"], ["ownerUserId", "Sorumlu"], ["dueDate", "Termin", "date"], ["priority", "Öncelik"], ["status", "Durum", "status"]],
    fields: [field("meetingId", "Toplantı ID", "text", { required: true }), field("projectId", "Proje ID"), field("title", "Aksiyon", "text", { required: true }), field("description", "Açıklama", "textarea", { wide: true }), field("ownerUserId", "Sorumlu kullanıcı ID"), field("dueDate", "Termin", "date"), field("priority", "Öncelik", "select", { options: ["low", "normal", "high", "urgent"] }), field("status", "Durum", "select", { options: ["open", "in_progress", "completed", "cancelled"] })],
  },
  qualityInspections: {
    description: "Girdi, üretim, final ve saha kalite kontrolleri ile düzeltici faaliyetler",
    columns: [["inspectionNumber", "Kontrol No"], ["projectId", "Proje ID"], ["inspectionType", "Kontrol Türü"], ["inspectionDate", "Tarih", "date"], ["result", "Sonuç", "status"], ["status", "Durum", "status"]],
    fields: [field("inspectionNumber", "Kontrol numarası", "text", { required: true }), field("projectId", "Proje ID", "text", { required: true }), field("workItemId", "İş kalemi ID"), field("productionOrderId", "Üretim emri ID"), field("installationId", "Montaj ID"), field("inspectionType", "Kontrol türü", "select", { required: true, options: ["incoming", "in_process", "final", "site"] }), field("inspectionDate", "Kontrol tarihi", "date", { required: true }), field("inspectorUserId", "Kontrol sorumlusu kullanıcı ID"), field("result", "Sonuç", "select", { options: ["pending", "pass", "conditional", "fail"] }), field("checklist", "Kontrol listesi", "textarea", { wide: true, placeholder: "Virgülle ayırın" }), field("defectNotes", "Uygunsuzluk / kusur", "textarea", { wide: true }), field("correctiveAction", "Düzeltici faaliyet", "textarea", { wide: true }), field("correctiveDueDate", "Düzeltme termini", "date"), field("status", "Durum", "select", { options: ["draft", "completed", "closed"] })],
  },
  handovers: {
    description: "Müşteri teslimi, kabul imzası, memnuniyet puanı ve kapanış takibi",
    columns: [["handoverNumber", "Teslim No"], ["projectId", "Proje ID"], ["handoverDate", "Teslim Tarihi", "date"], ["customerContact", "Müşteri Yetkilisi"], ["satisfactionScore", "Memnuniyet"], ["status", "Durum", "status"]],
    fields: [field("handoverNumber", "Teslim numarası", "text", { required: true }), field("projectId", "Proje ID", "text", { required: true }), field("installationId", "Montaj ID"), field("handoverDate", "Teslim tarihi", "date", { required: true }), field("customerContact", "Müşteri teslim yetkilisi", "text", { required: true }), field("satisfactionScore", "Memnuniyet puanı (1-5)", "number", { min: 1, max: 5 }), field("customerSignatureFileId", "Müşteri imza dosyası ID"), field("acceptanceNotes", "Teslim / kabul notları", "textarea", { wide: true }), field("status", "Durum", "select", { options: ["draft", "punch_open", "accepted", "rejected", "closed"] })],
  },
  handoverPunchItems: {
    description: "Teslim sırasında belirlenen eksik ve kusurların sorumlu, termin ve kabul takibi",
    columns: [["title", "Eksik / Kusur"], ["handoverId", "Teslim ID"], ["responsibleUserId", "Sorumlu"], ["dueDate", "Termin", "date"], ["severity", "Önem"], ["status", "Durum", "status"]],
    fields: [field("handoverId", "Teslim ID", "text", { required: true }), field("title", "Eksik / kusur başlığı", "text", { required: true }), field("description", "Açıklama", "textarea", { wide: true }), field("responsibleUserId", "Sorumlu kullanıcı ID"), field("dueDate", "Tamamlama termini", "date"), field("severity", "Önem", "select", { options: ["low", "normal", "high", "critical"] }), field("status", "Durum", "select", { options: ["open", "in_progress", "resolved", "accepted", "cancelled"] })],
  },
  projectCommunications: {
    description: "Telefon, e-posta, WhatsApp, toplantı ve saha görüşmelerinin proje bazlı karar ve takip günlüğü",
    columns: [["occurredAt", "Tarih", "date"], ["projectId", "Proje ID"], ["channel", "Kanal"], ["contactName", "Görüşülen Kişi"], ["subject", "Konu"], ["nextFollowUpAt", "Takip", "date"], ["status", "Durum", "status"]],
    fields: [field("projectId", "Proje ID", "text", { required: true }), field("customerId", "Müşteri ID"), field("channel", "İletişim kanalı", "select", { required: true, options: ["phone", "email", "whatsapp", "meeting", "site", "other"] }), field("direction", "Yön", "select", { options: ["inbound", "outbound", "internal"] }), field("contactName", "Görüşülen kişi"), field("subject", "Konu", "text", { required: true }), field("occurredAt", "Görüşme tarihi ve saati", "datetime-local", { required: true }), field("nextFollowUpAt", "Sonraki takip tarihi", "datetime-local"), field("ownerUserId", "Takip sorumlusu kullanıcı ID"), field("status", "Takip durumu", "select", { options: ["open", "follow_up", "closed"] }), field("summary", "Görüşme özeti", "textarea", { wide: true }), field("decision", "Alınan karar / taahhüt", "textarea", { wide: true })],
  },
  resourceAssignments: {
    description: "Proje ekiplerinin, iş merkezlerinin ve dış kaynakların tarih bazlı kapasite planı",
    columns: [["resourceName", "Kaynak / Ekip"], ["resourceType", "Tür"], ["projectId", "Proje ID"], ["role", "Rol / İş"], ["plannedStart", "Başlangıç", "date"], ["plannedEnd", "Bitiş", "date"], ["allocationPercent", "Kapasite", "percent"], ["status", "Durum", "status"]],
    fields: [field("projectId", "Proje ID", "text", { required: true }), field("employeeId", "Personel ID"), field("resourceType", "Kaynak türü", "select", { required: true, options: ["employee", "team", "work_center", "subcontractor"] }), field("resourceName", "Personel / ekip / iş merkezi", "text", { required: true }), field("role", "Projede görevi"), field("plannedStart", "Planlanan başlangıç", "date", { required: true }), field("plannedEnd", "Planlanan bitiş", "date", { required: true }), field("allocationPercent", "Kapasite kullanımı (%)", "number", { min: 1, max: 100 }), field("status", "Durum", "select", { options: ["planned", "confirmed", "active", "completed", "cancelled"] }), field("notes", "Planlama notu", "textarea", { wide: true })],
  },
  materialRequirements: {
    description: "Proje ve iş kalemi bazında ihtiyaç, stok rezervasyonu ve eksik satın alma bağlantısı",
    columns: [["itemCode", "Malzeme Kodu"], ["description", "Malzeme / Açıklama"], ["projectId", "Proje ID"], ["requiredQuantity", "İhtiyaç"], ["reservedQuantity", "Stoktan Ayrılan"], ["orderedQuantity", "Tedarike Bağlanan"], ["neededBy", "İhtiyaç Tarihi", "date"], ["status", "Durum", "status"]],
    fields: [field("projectId", "Proje ID", "text", { required: true }), field("workItemId", "İş kalemi ID"), field("inventoryItemId", "Stok kartı ID"), field("preferredSupplierId", "Tercih edilen tedarikçi ID"), field("itemCode", "Malzeme kodu"), field("description", "Malzeme / teknik açıklama", "text", { required: true }), field("requiredQuantity", "İhtiyaç miktarı", "number", { required: true, min: 0.001, step: "any" }), field("unit", "Birim", "select", { required: true, options: ["adet", "m", "m²", "m³", "kg", "lt", "plaka", "takım"] }), field("neededBy", "En geç ihtiyaç tarihi", "date"), field("status", "Plan durumu", "select", { options: ["draft", "shortage", "covered", "cancelled"] }), field("notes", "Kalite, desen, renk ve tedarik notları", "textarea", { wide: true })],
  },
});

configs.projects.fields.push(field("photoConsent", "Proje fotoğraf kullanım izni", "select", { options: ["not_requested", "denied", "internal_only", "marketing_allowed"] }));

const protectFields = (config, names, resource, action = "read") => {
  const protectedNames = new Set(names);
  config.fields = config.fields.map((item) => protectedNames.has(item.name) ? { ...item, permission: { resource, action } } : item);
};
protectFields(configs.hr, ["emergencyContact", "address"], "hr.sensitive");
protectFields(configs.accounts, ["iban", "openingBalance", "currentBalance"], "finance.sensitive");
protectFields(configs.purchaseOrders, ["subtotal", "taxTotal", "grandTotal"], "cost", "view");
configs.finance.createDefaults = {};
configs.accounting.createDefaults = { official: true };

const operationalViews = ["list", "kanban", "calendar"];
Object.assign(configs.projects, {
  views: operationalViews,
  titleField: "name",
  subtitleField: "code",
  dateField: "targetDate",
  boardField: "status",
  boardColumns: ["Potansiyel", "Keşif", "Maliyetlendirme", "Teklif", "Sözleşme", "Tasarım", "Satın Alma", "Üretim", "Montaj", "Kabul", "Beklemede", "Tamamlandı", "Kaybedildi", "İptal"],
});
Object.assign(configs.projectTasks, {
  views: operationalViews,
  titleField: "title",
  subtitleField: "department",
  dateField: "plannedEnd",
  boardField: "status",
  boardColumns: ["todo", "in_progress", "blocked", "completed"],
});
Object.assign(configs.purchases, {
  views: operationalViews,
  titleField: "itemName",
  subtitleField: "number",
  dateField: "requiredAt",
  boardField: "status",
  boardColumns: ["Taslak", "Onay bekliyor", "Onaylandı", "Sipariş verildi", "Kısmi teslim", "Teslim edildi", "İptal"],
});
Object.assign(configs.production, {
  views: operationalViews,
  titleField: "code",
  subtitleField: "workCenter",
  dateField: "plannedEnd",
  boardField: "status",
  boardColumns: ["Planlandı", "Malzeme bekliyor", "Üretimde", "Kalite kontrolde", "Tamamlandı", "Durduruldu"],
});
Object.assign(configs.installations, {
  views: operationalViews,
  titleField: "location",
  subtitleField: "code",
  dateField: "scheduledAt",
  boardField: "status",
  boardColumns: ["Keşif gerekli", "Saha bekleniyor", "Planlandı", "Yolda", "Montajda", "Eksikli", "Teslim edildi"],
});
Object.assign(configs.resourceAssignments, {
  views: operationalViews,
  titleField: "resourceName",
  subtitleField: "role",
  dateField: "plannedStart",
  rangeEndField: "plannedEnd",
  boardField: "status",
  boardColumns: ["planned", "confirmed", "active", "completed", "cancelled"],
});

function recordValue(record, key) {
  if (key === "fullName") return record.fullName || [record.firstName, record.lastName].filter(Boolean).join(" ");
  if (key === "projectName") return record.projectName || record.project?.name || "—";
  if (key === "customerName") return record.customerName || record.customer?.name || "—";
  return record[key];
}

function formatValue(value, type, record) {
  if (value == null || value === "") return "—";
  if (type === "money") return money.format(Number(value) || 0).replace("₺", record.currency && record.currency !== "TRY" ? record.currency : "₺");
  if (type === "date") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? value : date.format(parsed);
  }
  if (type === "percent") return `%${value}`;
  if (type === "bytes") {
    const bytes = Number(value) || 0;
    return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  return String(value);
}

function statusTone(value = "") {
  const normalized = String(value).toLocaleLowerCase("tr-TR");
  if (/gecik|kayıp|iptal|durdur|eksik/.test(normalized)) return "danger";
  if (/bekli|taslak|kısmi|keşif/.test(normalized)) return "warning";
  if (/tamam|onaylandı|ödendi|tahsil|aktif|teslim edildi/.test(normalized)) return "success";
  return "neutral";
}

const enumLabels = {
  active: "Aktif", passive: "Pasif", inactive: "Pasif", invited: "Davet edildi", disabled: "Devre dışı",
  draft: "Taslak", planned: "Planlandı", pending: "Onay bekliyor", approved: "Onaylandı", rejected: "Reddedildi", cancelled: "İptal",
  completed: "Tamamlandı", released: "Üretime salındı", in_progress: "Devam ediyor", on_hold: "Beklemede", reversed: "Ters kayıt oluşturuldu",
  todo: "Yapılacak", blocked: "Engelli", confirmed: "Kesinleşti", ordered: "Sipariş verildi", partial: "Kısmi teslim", received: "Teslim edildi",
  waiting_material: "Malzeme bekliyor", quality_control: "Kalite kontrolde", paused: "Durduruldu", survey_needed: "Keşif gerekli", site_waiting: "Saha bekleniyor",
  in_transit: "Yolda", incomplete: "Eksikli", lost: "Kaybedildi",
  present: "Çalıştı", absent: "Devamsız", leave: "İzinli", remote: "Uzaktan", exported: "Aktarıldı",
  internal: "İç üretim", external: "Dış imalat", review: "İncelemede", changes_requested: "Revizyon istendi",
  income: "Gelir", expense: "Gider", payable: "Borç", receivable: "Alacak", sales: "Satış", purchase: "Alış",
};

function localizedEnum(value) {
  return enumLabels[String(value)] || projectStatusLabels?.[String(value)] || value;
}

function hasCapability(session, capability) {
  const role = String(session?.role?.code || session?.user?.role?.code || session?.user?.role || "").toLowerCase();
  if (["owner", "admin", "super_admin"].includes(role)) return true;
  return (session?.permissions || session?.user?.permissions || []).some((item) =>
    (typeof item === "string" ? item : item?.code || item?.permission_code) === capability,
  );
}

const projectTransitions = {
  lead: ["discovery", "estimating", "cancelled"], discovery: ["estimating", "on_hold", "cancelled"],
  estimating: ["offered", "on_hold", "cancelled"], offered: ["contracted", "lost", "estimating", "on_hold"],
  contracted: ["design", "cancelled"], design: ["procurement", "on_hold", "cancelled"],
  procurement: ["production", "on_hold", "cancelled"], production: ["installation", "on_hold", "cancelled"],
  installation: ["acceptance", "on_hold", "cancelled"], acceptance: ["completed", "installation", "on_hold"],
  on_hold: ["discovery", "estimating", "offered", "contracted", "design", "procurement", "production", "installation", "acceptance", "cancelled"],
};

const projectStatusLabels = { lead: "Potansiyel", discovery: "Keşif", estimating: "Maliyetlendirme", offered: "Teklif", contracted: "Sözleşme", design: "Tasarım", procurement: "Satın Alma", production: "Üretim", installation: "Montaj", acceptance: "Kabul", on_hold: "Beklemede", completed: "Tamamlandı", lost: "Kaybedildi", cancelled: "İptal" };
const projectStatusCodes = Object.fromEntries(Object.entries(projectStatusLabels).map(([code, label]) => [label, code]));

function coreWorkflowActions(module, row, session) {
  const status = module.id === "projects" ? projectStatusCodes[row.status] || row.status : row.status;
  if (module.id === "offers") {
    const actions = [];
    if (["draft", "sent", "pending", "Taslak", "Sunuldu"].includes(status) && hasCapability(session, "offers.approve")) {
      actions.push({ key: "accept", label: "Kabul et", title: "Teklifi kabul et", message: "Teklif kabul edildi olarak işaretlenecek.", tone: "success" });
      actions.push({ key: "reject", label: "Reddet", title: "Teklifi reddet", message: "Teklif reddedilecek. Müşteri kayıp nedenini yazın.", reasonRequired: true, tone: "danger" });
    }
    if (["accepted", "Kabul edildi"].includes(status) && hasCapability(session, "offers.convert")) actions.push({ key: "convert-to-project", label: "Projeye dönüştür", title: "Yeni proje oluştur", message: "Teklif tutarı ve müşteri bağlantısıyla sözleşmeli proje oluşturulacak.", tone: "success" });
    return actions;
  }
  if (module.id === "projects" && hasCapability(session, "projects.transition")) {
    const options = (projectTransitions[status] || []).map((value) => ({ value, label: projectStatusLabels[value] || value }));
    return options.length ? [{ key: "transition", label: "Aşamayı değiştir", title: "Proje aşamasını değiştir", message: "Yalnız izin verilen sıradaki aşamalar seçilebilir.", options }] : [];
  }
  if (module.id === "workItems" && ["draft", "review", "changes_requested"].includes(row.revisionStatus) && hasCapability(session, "work-items.revision.approve")) return [{ key: "approve-revision", label: "Revizyonu onayla", title: "Üretim revizyonunu onayla", message: "Bu revizyon üretime salınabilir hale gelecek.", tone: "success" }];
  if (module.id === "production" && row.workItemId && ["draft", "planned", "Planlandı"].includes(status) && hasCapability(session, "production-orders.release")) return [{ key: "release", label: "Üretime sal", title: "Üretim emrini serbest bırak", message: "Güncel iş kalemi revizyonu kontrol edilerek üretim başlatılacak.", tone: "success" }];
  if (module.id === "purchases" && ["draft", "pending", "Taslak", "Onay bekliyor"].includes(status) && hasCapability(session, "purchase-requests.approve")) return [{ key: "approve", label: "Onayla", title: "Satın alma talebini onayla", message: "Talep sipariş sürecine hazır hale gelecek.", tone: "success" }];
  if (module.id === "leaves" && status === "pending" && hasCapability(session, "leaves.approve")) return [{ key: "approve", label: "Onayla", title: "İzin talebini onayla", message: "Personelin izin talebi onaylanacak.", tone: "success" }, { key: "reject", label: "Reddet", title: "İzin talebini reddet", message: "Ret nedeni personele ait karar kaydında tutulacak.", reasonRequired: true, tone: "danger" }];
  if (module.id === "finance") {
    if (["draft", "planned", "pending", "Planlandı", "Onay bekliyor"].includes(status) && hasCapability(session, "financial-transactions.approve")) return [{ key: "approve", label: "Onayla", title: "Finans hareketini onayla", message: "Onaylanan finans kaydı değiştirilemez; düzeltme ters kayıtla yapılır.", tone: "success" }];
    if (["approved", "Onaylandı"].includes(status) && hasCapability(session, "financial-transactions.reverse")) return [{ key: "reverse", label: "Ters kayıt", title: "Finans hareketini ters kaydet", message: "Orijinal hareket korunacak ve eşit tutarlı ters kayıt oluşturulacak.", reasonRequired: true, tone: "danger" }];
  }
  return [];
}

function workflowActions(module, row, session) {
  const core = coreWorkflowActions(module, row, session);
  if (core.length) return core;
  const status = row.status;
  const transition = (options, capability, title) => hasCapability(session, capability) && options.length ? [{ key: "transition", label: "Aşamayı değiştir", title, message: "Yalnız geçerli sıradaki aşama seçilebilir.", options: options.map((value) => ({ value, label: localizedEnum(value) })) }] : [];
  if (module.id === "siteSurveys") {
    const next = { draft: ["in_progress", "cancelled"], in_progress: ["completed", "cancelled"], completed: ["approved", "in_progress"] };
    return transition(next[status] || [], "site-surveys.approve", "Keşif aşamasını değiştir");
  }
  if (module.id === "contracts") {
    const next = { draft: ["pending_signature", "cancelled"], pending_signature: ["signed", "cancelled"], signed: ["active", "terminated"], active: ["completed", "terminated"] };
    return transition(next[status] || [], "contracts.transition", "Sözleşme aşamasını değiştir");
  }
  if (module.id === "designRevisions") {
    const actions = [];
    if (["draft", "internal_review", "rejected"].includes(status) && hasCapability(session, "design-revisions.write")) actions.push({ key: "submit", label: "Müşteriye sun", title: "Revizyonu müşteriye sun", message: "Çizim müşteri incelemesine gönderilecek." });
    if (status === "client_review" && hasCapability(session, "design-revisions.approve")) actions.push({ key: "approve", label: "Onayla", title: "Tasarımı onayla", message: "Müşteri tasarım kararı onaylı kaydedilecek.", tone: "success" }, { key: "reject", label: "Reddet", title: "Tasarımı reddet", message: "Müşterinin değişiklik nedeni kaydedilecek.", reasonRequired: true, tone: "danger" });
    if (status === "approved" && hasCapability(session, "design-revisions.approve")) actions.push({ key: "supersede", label: "Yeni revizyonla değiştir", title: "Revizyonu geçersiz kıl", message: "Yeni revizyon kayıt ID'sini girin.", inputKey: "replacement_revision_id", inputLabel: "Yeni revizyon ID", reasonRequired: true });
    return actions;
  }
  if (module.id === "progressPayments") {
    if (["draft", "rejected"].includes(status) && hasCapability(session, "progress-payments.write")) return [{ key: "submit", label: "Onaya gönder", title: "Hakedişi onaya gönder", message: "Hakediş tutarları kontrol için kilitlenecek." }];
    if (status === "pending" && hasCapability(session, "progress-payments.approve")) return [{ key: "approve", label: "Onayla", title: "Hakedişi onayla", message: "Hakediş onaylanacak.", tone: "success" }, { key: "reject", label: "Reddet", title: "Hakedişi reddet", message: "Ret nedeni kaydedilecek.", reasonRequired: true, tone: "danger" }];
    if (status === "approved" && hasCapability(session, "progress-payments.approve")) return [{ key: "invoice", label: "Faturalandı", title: "Hakedişi faturaya bağla", message: "Fatura kayıt ID'sini girin.", inputKey: "invoice_id", inputLabel: "Fatura ID", reasonRequired: true }];
    if (status === "invoiced" && hasCapability(session, "progress-payments.approve")) return [{ key: "paid", label: "Ödendi", title: "Hakediş ödemesini kaydet", message: "Onaylı finans hareketi ID'sini girin.", inputKey: "payment_transaction_id", inputLabel: "Finans hareketi ID", reasonRequired: true, tone: "success" }];
  }
  if (module.id === "stockMovements" && status === "draft" && hasCapability(session, "stock-movements.post")) return [{ key: "post", label: "Kesinleştir", title: "Stok hareketini kesinleştir", message: "Stok miktarı kalıcı olarak güncellenecek.", tone: "success" }];
  if (module.id === "materialRequirements" && !["covered", "consumed", "cancelled"].includes(status)) {
    const actions = [];
    if (row.inventoryItemId && hasCapability(session, "material-requirements.reserve")) actions.push({ key: "reserve", label: "Stoktan ayır", title: "Malzemeyi proje için ayır", message: "Mevcut stok, kalan ihtiyaç kadar projeye rezerve edilecek.", tone: "success" });
    if (hasCapability(session, "material-requirements.purchase")) actions.push({ key: "create-purchase-request", label: "Satın alma talebi aç", title: "Eksik miktarı satın almaya gönder", message: "Rezervasyondan sonra kalan miktar için onay bekleyen satın alma talebi oluşturulacak." });
    return actions;
  }
  if (module.id === "projectMeetings") {
    const next = { draft: ["published"], published: ["closed"] };
    return transition(next[status] || [], "project-meetings.publish", "Toplantı durumunu değiştir");
  }
  if (module.id === "qualityInspections") {
    const next = { draft: ["completed"], completed: ["closed"] };
    return transition(next[status] || [], "quality-inspections.complete", "Kalite kontrolünü sonuçlandır");
  }
  if (module.id === "handovers") {
    const next = { draft: ["punch_open", "accepted", "rejected"], punch_open: ["accepted", "rejected"], rejected: ["punch_open"], accepted: ["closed"] };
    return transition(next[status] || [], "handovers.transition", "Teslim-kabul aşamasını değiştir");
  }
  return [];
}

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.records)) return payload.records;
  return [];
}

function LoadingState() {
  return <div className="live-state"><span className="live-spinner" /><b>Veriler yükleniyor</b><small>Güncel firma kayıtları hazırlanıyor.</small></div>;
}

function ErrorState({ error, retry }) {
  return <div className="live-state live-state-error"><WarningCircle size={34} /><b>Veriler getirilemedi</b><small>{error?.message || "Beklenmeyen bir hata oluştu."}</small><button onClick={retry}><ArrowClockwise /> Tekrar dene</button></div>;
}

function PermissionDeniedState() {
  return <div className="live-state live-state-error"><WarningCircle size={34} /><b>Bu bölüm için yetkiniz yok</b><small>Firma yöneticinizden gerekli rol veya okuma iznini isteyebilirsiniz.</small></div>;
}

function EmptyState({ title, canCreate, onCreate }) {
  return <div className="live-state"><ClipboardText size={38} /><b>Henüz {title.toLocaleLowerCase("tr-TR")} kaydı yok</b><small>İlk kayıt eklendiğinde burada listelenecek.</small>{canCreate && <button onClick={onCreate}><Plus /> İlk kaydı ekle</button>}</div>;
}

function Status({ children }) {
  return <span className={`live-status ${statusTone(children)}`}>{localizedEnum(children) || "—"}</span>;
}

function Table({ rows, config, canEdit, onEdit, onDetail, canDelete, onDelete, onPermissions, getWorkflowActions, onWorkflow }) {
  const hasActions = canEdit || Boolean(onDetail) || Boolean(onDelete) || Boolean(onPermissions) || Boolean(getWorkflowActions);
  return <div className="live-table-wrap"><table className="live-table"><thead><tr>{config.columns.map(([, label]) => <th key={label}>{label}</th>)}{hasActions && <th aria-label="İşlem" />}</tr></thead><tbody>{rows.map((row, index) => {
    const actions = row._offlineQueued ? [] : getWorkflowActions?.(row) || [];
    return <tr className={row._offlineQueued ? "offline-queued" : ""} key={row.id || index}>{config.columns.map(([key, , type]) => <td key={key}>{type === "status" ? <Status>{recordValue(row, key)}</Status> : formatValue(recordValue(row, key), type, row)}</td>)}{hasActions && <td><div className="live-row-actions">{row._offlineQueued && <span className="live-offline-chip"><CloudArrowUp /> Kuyrukta</span>}{onDetail && <button className="live-icon-button" onClick={() => onDetail(row)} title="Detayı aç"><ClipboardText /></button>}{actions.map((action) => <button className={`live-workflow-button ${action.tone || ""}`} key={action.key} onClick={() => onWorkflow(row, action)}>{action.label}</button>)}{onPermissions && <button className="live-icon-button" onClick={() => onPermissions(row)} title="Rol yetkileri"><Buildings /></button>}{canEdit && !row._offlineQueued && <button className="live-icon-button" onClick={() => onEdit(row)} title="Düzenle"><PencilSimple /></button>}{onDelete && canDelete?.(row) && <button className="live-icon-button danger" onClick={() => onDelete(row)} title="Sil"><X /></button>}</div></td>}</tr>;
  })}</tbody></table></div>;
}

const viewOptions = {
  list: { label: "Liste", icon: ListBullets },
  kanban: { label: "Kanban", icon: Kanban },
  calendar: { label: "Takvim", icon: CalendarBlank },
};

function ViewSwitcher({ available, value, onChange }) {
  return <div className="live-view-switcher" role="group" aria-label="Kayıt görünümü">{available.map((key) => {
    const option = viewOptions[key];
    const Icon = option.icon;
    return <button type="button" key={key} className={value === key ? "active" : ""} aria-pressed={value === key} onClick={() => onChange(key)}><Icon /> <span>{option.label}</span></button>;
  })}</div>;
}

function ViewCard({ row, config, canEdit, onEdit, onDetail, getWorkflowActions, onWorkflow }) {
  const actions = row._offlineQueued ? [] : getWorkflowActions?.(row) || [];
  const title = recordValue(row, config.titleField) || "Adsız kayıt";
  const subtitle = recordValue(row, config.subtitleField);
  return <article className={`live-kanban-card ${row._offlineQueued ? "offline-queued" : ""}`}><button type="button" className="live-kanban-card-main" onClick={() => onDetail(row)}><b>{title}</b>{subtitle && subtitle !== "—" && <small>{subtitle}</small>}<span><Status>{recordValue(row, config.boardField)}</Status>{row._offlineQueued ? <em className="live-offline-chip"><CloudArrowUp /> Kuyrukta</em> : config.dateField && <time>{formatValue(recordValue(row, config.dateField), "date", row)}</time>}</span></button>{(actions.length > 0 || (canEdit && !row._offlineQueued)) && <footer>{actions.map((action) => <button type="button" className={`live-workflow-button ${action.tone || ""}`} key={action.key} onClick={() => onWorkflow(row, action)}>{action.label}</button>)}{canEdit && !row._offlineQueued && <button type="button" className="live-icon-button" onClick={() => onEdit(row)} title="Düzenle"><PencilSimple /></button>}</footer>}</article>;
}

function KanbanView({ rows, config, canEdit, onEdit, onDetail, getWorkflowActions, onWorkflow }) {
  const fieldName = config.boardField;
  const matchesColumn = (value, column) => value === column || localizedEnum(value) === localizedEnum(column);
  const unconfigured = rows.map((row) => String(recordValue(row, fieldName) || "Durumsuz")).filter((value) => !config.boardColumns.some((column) => matchesColumn(value, column)));
  const columns = [...config.boardColumns, ...new Set(unconfigured)];
  return <div className="live-kanban" aria-label="Kanban görünümü">{columns.map((column) => {
    const columnRows = rows.filter((row) => matchesColumn(String(recordValue(row, fieldName) || "Durumsuz"), column));
    return <section className="live-kanban-column" key={column}><header><span><Status>{column}</Status></span><b>{columnRows.length}</b></header><div>{columnRows.map((row, index) => <ViewCard key={row.id || index} row={row} config={config} canEdit={canEdit} onEdit={onEdit} onDetail={onDetail} getWorkflowActions={getWorkflowActions} onWorkflow={onWorkflow} />)}{columnRows.length === 0 && <small className="live-kanban-empty">Bu aşamada kayıt yok</small>}</div></section>;
  })}</div>;
}

function localCalendarDate(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const parsed = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function CalendarView({ rows, config, onDetail }) {
  const firstRecordDate = rows.map((row) => localCalendarDate(recordValue(row, config.dateField))).find(Boolean);
  const [month, setMonth] = useState(() => firstRecordDate || new Date());
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - ((monthStart.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, index) => {
    const item = new Date(gridStart);
    item.setDate(gridStart.getDate() + index);
    return item;
  });
  const datedRows = rows.filter((row) => localCalendarDate(recordValue(row, config.dateField)));
  const monthLabel = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(month);
  const isSameDay = (left, right) => left && right && left.getTime() === right.getTime();
  const today = localCalendarDate(new Date().toISOString());
  const rowsForDay = (day) => datedRows.filter((row) => {
    const start = localCalendarDate(recordValue(row, config.dateField));
    const end = localCalendarDate(recordValue(row, config.rangeEndField)) || start;
    return day >= start && day <= end;
  });
  if (!datedRows.length) return <div className="live-view-empty"><CalendarBlank /><b>Takvime yerleşecek tarih bulunamadı</b><small>Kayıtlara planlanan tarih eklediğinizde burada görünecek.</small></div>;
  return <section className="live-calendar"><header><div><button type="button" className="live-icon-button" aria-label="Önceki ay" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><CaretLeft /></button><button type="button" className="live-button secondary" onClick={() => setMonth(new Date())}>Bugün</button><button type="button" className="live-icon-button" aria-label="Sonraki ay" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><CaretRight /></button></div><h3>{monthLabel}</h3><small>{datedRows.length} tarihli kayıt</small></header><div className="live-calendar-scroll"><div className="live-calendar-grid" role="grid"><div className="live-calendar-weekdays">{["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((day) => <b key={day}>{day}</b>)}</div><div className="live-calendar-days">{days.map((day) => {
    const dayRows = rowsForDay(day);
    const outside = day.getMonth() !== month.getMonth();
    return <div role="gridcell" className={`${outside ? "outside" : ""} ${isSameDay(day, today) ? "today" : ""}`} key={day.toISOString()}><time>{day.getDate()}</time><div>{dayRows.slice(0, 3).map((row, index) => <button type="button" key={row.id || index} onClick={() => onDetail(row)} title={String(recordValue(row, config.titleField) || "Kayıt")}><b>{recordValue(row, config.titleField) || "Adsız kayıt"}</b>{recordValue(row, config.boardField) && <small>{localizedEnum(recordValue(row, config.boardField))}</small>}</button>)}{dayRows.length > 3 && <span>+{dayRows.length - 3} kayıt</span>}</div></div>;
  })}</div></div></div></section>;
}

function ResourceDataView({ view, rows, config, canEdit, onEdit, onDetail, canDelete, onDelete, onPermissions, getWorkflowActions, onWorkflow }) {
  if (view === "kanban") return <KanbanView rows={rows} config={config} canEdit={canEdit} onEdit={onEdit} onDetail={onDetail} getWorkflowActions={getWorkflowActions} onWorkflow={onWorkflow} />;
  if (view === "calendar") return <CalendarView rows={rows} config={config} onDetail={onDetail} />;
  return <Table rows={rows} config={config} canEdit={canEdit} onEdit={onEdit} onDetail={onDetail} canDelete={canDelete} onDelete={onDelete} onPermissions={onPermissions} getWorkflowActions={getWorkflowActions} onWorkflow={onWorkflow} />;
}

function RecordModal({ module, record, defaults = {}, session, saving, serverError, onClose, onSave }) {
  const config = configs[module.id];
  const canViewCost = permissionAllows(session, "view_cost", "cost");
  const canViewSalary = permissionAllows(session, "view_salary", "salary");
  const visibleFields = config.fields.filter((item) => !item.permission || permissionAllows(session, item.permission.action, item.permission.resource));
  const renderFields = visibleFields.filter((item) => !(record && ["projects", "offers", "purchases", "production", "leaves", "finance"].includes(module.id) && item.name === "status"));
  const [values, setValues] = useState(() => Object.fromEntries(visibleFields.map((item) => [item.name, record?.[item.name] ?? defaults[item.name] ?? item.defaultValue ?? ""])));
  const [errors, setErrors] = useState({});

  function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    visibleFields.forEach((item) => {
      if (item.required && !String(values[item.name] ?? "").trim()) nextErrors[item.name] = "Bu alan zorunlu.";
    });
    setErrors(nextErrors);
    if (!Object.keys(nextErrors).length) onSave(values);
  }

  return <div className="live-modal-backdrop" data-cost-access={canViewCost} data-salary-access={canViewSalary} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="live-modal" role="dialog" aria-modal="true" aria-labelledby="live-modal-title"><header><div><small>{record ? "KAYDI GÜNCELLE" : "YENİ KAYIT"}</small><h2 id="live-modal-title">{record ? `${module.singular} düzenle` : `Yeni ${module.singular}`}</h2></div><button className="live-icon-button" onClick={onClose} aria-label="Kapat"><X /></button></header><form onSubmit={submit}><div className="live-form-grid">{renderFields.map((item) => <label className={item.wide ? "wide" : ""} key={item.name}><span>{item.label}{item.required && <em>*</em>}</span>{item.type === "select" ? <select value={values[item.name]} onChange={(event) => setValues({ ...values, [item.name]: event.target.value })}><option value="">Seçiniz</option>{item.options.map((option) => <option key={option}>{option}</option>)}</select> : item.type === "textarea" ? <textarea rows="3" value={values[item.name]} placeholder={item.placeholder} onChange={(event) => setValues({ ...values, [item.name]: event.target.value })} /> : <input type={item.type} value={values[item.name]} placeholder={item.placeholder} min={item.min} max={item.max} onChange={(event) => setValues({ ...values, [item.name]: event.target.value })} />}{errors[item.name] && <small className="live-field-error">{errors[item.name]}</small>}</label>)}</div>{serverError && <div className="live-form-alert"><WarningCircle />{serverError.message}</div>}<footer><button type="button" className="live-button secondary" onClick={onClose}>Vazgeç</button><button className="live-button primary" disabled={saving}>{saving ? <><span className="live-spinner small" /> Kaydediliyor</> : <><Check /> Kaydet</>}</button></footer></form></section></div>;
}

function FileUploadModal({ saving, serverError, onClose, onSave }) {
  const [values, setValues] = useState(() => ({ entityType: "projects", entityId: "", projectId: "", workItemId: "", designRevisionId: "", qualityInspectionId: "", installationId: "", spaceName: "", captureStage: "discovery", visibility: "internal", takenAt: new Date().toISOString().slice(0, 16), category: "photo", description: "", file: null }));
  const submit = (event) => {
    event.preventDefault();
    const entityId = values.entityType === "projects" ? values.projectId : values.entityId;
    if (!values.file || !values.projectId || !entityId) return;
    const contextualValues = { ...values, entityId };
    if (values.entityType === "work-items") contextualValues.workItemId = entityId;
    if (values.entityType === "design-revisions") contextualValues.designRevisionId = entityId;
    if (values.entityType === "quality-inspections") contextualValues.qualityInspectionId = entityId;
    if (values.entityType === "installations") contextualValues.installationId = entityId;
    onSave(contextualValues);
  };
  const requiresEntityId = values.entityType !== "projects";
  return <div className="live-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="live-modal" role="dialog" aria-modal="true" aria-labelledby="file-upload-title"><header><div><small>BAĞLAMSAL DOSYA MERKEZİ</small><h2 id="file-upload-title">Fotoğraf veya belge yükle</h2><p>Dosyayı projedeki gerçek işi, mahali ve süreç adımıyla ilişkilendirin.</p></div><button className="live-icon-button" onClick={onClose} aria-label="Kapat"><X /></button></header><form onSubmit={submit}><div className="live-form-grid"><label><span>Proje ID <em>*</em></span><input required value={values.projectId} onChange={(event) => setValues({ ...values, projectId: event.target.value })} /></label><label><span>Bağlı kayıt türü <em>*</em></span><select value={values.entityType} onChange={(event) => setValues({ ...values, entityType: event.target.value, entityId: "" })}><option value="projects">Projenin geneli</option><option value="offers">Teklif</option><option value="work-items">İş kalemi / ürün</option><option value="design-revisions">Tasarım revizyonu</option><option value="production-orders">Üretim emri</option><option value="quality-inspections">Kalite kontrolü</option><option value="installations">Montaj</option><option value="handovers">Teslim & kabul</option></select></label>{requiresEntityId && <label><span>Bağlı kayıt ID <em>*</em></span><input required value={values.entityId} onChange={(event) => setValues({ ...values, entityId: event.target.value })} /></label>}<label><span>Mahal / konum</span><input value={values.spaceName} placeholder="Örn. Lobi, 204 numaralı oda" onChange={(event) => setValues({ ...values, spaceName: event.target.value })} /></label><label><span>Süreç aşaması</span><select value={values.captureStage} onChange={(event) => setValues({ ...values, captureStage: event.target.value })}><option value="discovery">Keşif</option><option value="design">Tasarım</option><option value="procurement">Satın alma</option><option value="production">Üretim</option><option value="quality">Kalite</option><option value="installation">Montaj</option><option value="handover">Teslim</option><option value="other">Diğer</option></select></label><label><span>Çekim / belge tarihi</span><input type="datetime-local" value={values.takenAt} onChange={(event) => setValues({ ...values, takenAt: event.target.value })} /></label><label><span>Kategori</span><select value={values.category} onChange={(event) => setValues({ ...values, category: event.target.value })}><option value="photo">Fotoğraf</option><option value="drawing">Çizim</option><option value="contract">Sözleşme</option><option value="quality_evidence">Kalite kanıtı</option><option value="installation_evidence">Montaj kanıtı</option><option value="handover_evidence">Teslim kanıtı</option><option value="report">Rapor</option><option value="other">Diğer</option></select></label><label><span>Görünürlük</span><select value={values.visibility} onChange={(event) => setValues({ ...values, visibility: event.target.value })}><option value="internal">Yalnız firma içi</option><option value="customer">Müşteriyle paylaşılabilir</option><option value="marketing">Pazarlamada kullanılabilir</option></select></label><label className="wide"><span>Dosya <em>*</em></span><input required type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => setValues({ ...values, file: event.target.files?.[0] || null })} /><small>Telefonda bu alan kameradan çekim veya galeriden seçim sunar.</small></label><label className="wide"><span>Açıklama / kusur / yapılan işlem</span><textarea rows="3" value={values.description} placeholder="Fotoğrafta ne görüldüğünü ve gerekiyorsa alınan aksiyonu yazın." onChange={(event) => setValues({ ...values, description: event.target.value })} /></label></div>{serverError && <div className="live-form-alert"><WarningCircle />{serverError.message}</div>}<footer><button type="button" className="live-button secondary" onClick={onClose}>Vazgeç</button><button className="live-button primary" disabled={saving || !values.file || !values.projectId || (requiresEntityId && !values.entityId)}>{saving ? "Yükleniyor…" : "Dosyayı bağlamıyla yükle"}</button></footer></form></section></div>;
}

function QuickPhotoModal({ projectId, saving, serverError, onClose, onSave }) {
  const [values, setValues] = useState(() => ({ projectId: projectId || "", spaceName: "", captureStage: "installation", visibility: "internal", takenAt: new Date().toISOString().slice(0, 16), description: "", file: null }));
  const [fileError, setFileError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  function chooseFile(file) {
    setFileError(null);
    if (!file) { setValues((current) => ({ ...current, file: null })); setPreviewUrl(""); return; }
    if (!file.type.startsWith("image/")) { setFileError("Yalnız fotoğraf seçebilirsiniz."); return; }
    if (file.size > 10 * 1024 * 1024) { setFileError("Fotoğraf en fazla 10 MB olabilir."); return; }
    setValues((current) => ({ ...current, file }));
    setPreviewUrl(URL.createObjectURL(file));
  }
  function submit(event) {
    event.preventDefault();
    if (!values.file || !values.projectId) return;
    onSave({ ...values, entityType: "projects", entityId: values.projectId, category: "photo" });
  }
  return <div className="live-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="live-modal compact live-quick-photo" role="dialog" aria-modal="true" aria-labelledby="quick-photo-title"><header><div><small>HIZLI SAHA KANITI</small><h2 id="quick-photo-title">Fotoğraf çek ve projeye ekle</h2><p>Kamera açılır; fotoğraf proje, mahal ve süreç aşamasıyla birlikte kaydedilir.</p></div><button className="live-icon-button" onClick={onClose} aria-label="Kapat"><X /></button></header><form onSubmit={submit}><label className={`live-camera-picker ${previewUrl ? "has-preview" : ""}`}>{previewUrl ? <img src={previewUrl} alt="Yüklenecek fotoğraf önizlemesi" /> : <><Camera /><b>Kamerayı aç</b><small>Fotoğraf çekmek için dokunun</small></>}<input required type="file" accept="image/*" capture="environment" onChange={(event) => chooseFile(event.target.files?.[0])} /></label>{fileError && <div className="live-form-alert"><WarningCircle />{fileError}</div>}<div className="live-form-grid"><label><span>Proje ID <em>*</em></span><input required value={values.projectId} onChange={(event) => setValues({ ...values, projectId: event.target.value })} /></label><label><span>Mahal / konum</span><input value={values.spaceName} placeholder="Örn. Lobi, 204 numaralı oda" onChange={(event) => setValues({ ...values, spaceName: event.target.value })} /></label><label><span>Süreç aşaması</span><select value={values.captureStage} onChange={(event) => setValues({ ...values, captureStage: event.target.value })}><option value="discovery">Keşif</option><option value="design">Tasarım</option><option value="production">Üretim</option><option value="quality">Kalite</option><option value="installation">Montaj</option><option value="handover">Teslim</option></select></label><label><span>Görünürlük</span><select value={values.visibility} onChange={(event) => setValues({ ...values, visibility: event.target.value })}><option value="internal">Yalnız firma içi</option><option value="customer">Müşteriyle paylaşılabilir</option></select></label><label className="wide"><span>Kısa açıklama</span><textarea rows="2" value={values.description} placeholder="Ne görüldü, hangi işlem yapıldı?" onChange={(event) => setValues({ ...values, description: event.target.value })} /></label></div>{serverError && <div className="live-form-alert"><WarningCircle />{serverError.message}</div>}<footer><button type="button" className="live-button secondary" onClick={onClose}>Vazgeç</button><button className="live-button primary" disabled={saving || !values.file || !values.projectId}>{saving ? "Yükleniyor…" : "Fotoğrafı projeye ekle"}</button></footer></form></section></div>;
}

function WorkflowConfirmModal({ workflow, saving, error, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [targetStatus, setTargetStatus] = useState(workflow.action.options?.[0]?.value || "");
  const gateBlocked = error?.code === "project_gate_blocked" || error?.code === "override_reason_required";
  const blockers = Array.isArray(error?.details?.blockers) ? error.details.blockers : [];
  const disabled = saving || (workflow.action.reasonRequired && reason.trim().length < 3) || (workflow.action.options && !targetStatus) || (gateBlocked && reason.trim().length < 10);
  return <div className="live-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}><section className="live-modal compact live-confirm-modal" role="alertdialog" aria-modal="true"><header><div><small>İŞ AKIŞI ONAYI</small><h2>{workflow.action.title}</h2></div><button className="live-icon-button" disabled={saving} onClick={onClose}><X /></button></header><div className="live-confirm-body"><p>{workflow.action.message}</p><div className="live-record-reference"><b>{workflow.row.name || workflow.row.referenceNo || workflow.row.code || workflow.row.number || workflow.row.documentNo || workflow.row.id}</b><small>{workflow.row.status || workflow.row.revisionStatus || "Kayıt"}</small></div>{workflow.action.options && <label><span>Yeni aşama</span><select value={targetStatus} onChange={(event) => setTargetStatus(event.target.value)}>{workflow.action.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>}{gateBlocked && <div className="live-gate-blockers"><b>Bu geçişi durduran eksikler</b>{blockers.map((item) => <span key={item.id}><WarningCircle />{item.label}</span>)}</div>}{(workflow.action.reasonRequired || workflow.action.key === "transition") && <label><span>{gateBlocked ? "Yönetici istisna gerekçesi *" : workflow.action.reasonRequired ? "Neden / açıklama *" : "Geçiş notu"}</span><textarea rows="3" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={gateBlocked ? "Neden eksikler tamamlanmadan devam edildiğini yazın (en az 10 karakter)" : workflow.action.reasonRequired ? "En az 3 karakter girin" : "İsteğe bağlı"} /></label>}{error && <div className="live-form-alert"><WarningCircle />{error.message}</div>}<footer><button className="live-button secondary" disabled={saving} onClick={onClose}>Vazgeç</button><button className={`live-button primary ${workflow.action.tone || ""}`} disabled={disabled} onClick={() => onConfirm({ reason: reason.trim() || undefined, status: targetStatus || undefined, note: gateBlocked ? undefined : reason.trim() || undefined, override_reason: gateBlocked ? reason.trim() : undefined })}>{saving ? <><span className="live-spinner small" /> İşleniyor</> : gateBlocked ? "İstisna ile devam et" : "İşlemi onayla"}</button></footer></div></section></div>;
}

function ProjectCommandCenterModal({ record, onClose, onNavigate }) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const load = () => {
    setState({ loading: true, data: null, error: null });
    api.projectCommandCenter(record.id).then((data) => setState({ loading: false, data, error: null })).catch((error) => setState({ loading: false, data: null, error }));
  };
  useEffect(() => { load(); }, [record.id]);
  const data = state.data;
  const jump = (moduleId) => { onClose(); onNavigate?.(moduleId); };
  return <div className="live-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="live-modal live-project-center" role="dialog" aria-modal="true"><header><div><small>PROJE KOMUTA MERKEZİ</small><h2>{data?.project?.name || record.name}</h2><p>{data?.project?.code || record.code} · {projectStageLabels[data?.project?.status] || data?.project?.status || record.status}</p></div><button className="live-icon-button" onClick={onClose}><X /></button></header>{state.loading ? <LoadingState /> : state.error ? <ErrorState error={state.error} retry={load} /> : <div className="live-project-center-body"><div className="live-project-stage-rail" aria-label="Proje aşamaları">{data.stages.map((stage, index) => <div className={stage.state} key={stage.status}><i>{stage.state === "complete" ? <Check /> : index + 1}</i><span><b>{stage.label}</b><small>{stage.state === "complete" ? "Tamamlandı" : stage.state === "current" ? "Aktif aşama" : stage.score ? `%${stage.score} hazır` : "Bekliyor"}</small></span></div>)}</div><section className="live-project-summary"><article className="readiness"><small>SONRAKİ AŞAMAYA HAZIRLIK</small><strong>%{data.readiness}</strong><span><i style={{ width: `${data.readiness}%` }} /></span><p>{data.nextStatus ? `${projectStageLabels[data.nextStatus] || data.nextStatus} aşaması için` : "Proje süreci tamamlandı"}</p></article><article><small>AÇIK GÖREV</small><strong>{data.facts.openTasks || 0}</strong><p>{data.facts.overdueTasks ? `${data.facts.overdueTasks} gecikmiş görev` : "Gecikmiş görev yok"}</p><button onClick={() => jump("projectTasks")}>Görevlere git</button></article><article><small>PROJE DOSYASI</small><strong>{data.facts.fileTotal || 0}</strong><p>Fotoğraf, çizim ve belgeler</p><button onClick={() => jump("files")}>Dosyaları aç</button></article><article><small>TAHMİNİ KÂR</small><strong>{money.format((data.finance.estimatedProfitMinor || 0) / 100)}</strong><p>{data.finance.marginPercent == null ? "Sözleşme bedeli bekleniyor" : `%${data.finance.marginPercent} tahmini marj`}</p><button onClick={() => jump("finance")}>Finansı aç</button></article></section><div className="live-project-columns"><section><header><div><small>SIRADAKİ DOĞRU İŞLER</small><h3>Projenin ilerlemesi için</h3></div></header><div className="live-next-actions">{data.nextActions.length ? data.nextActions.map((item, index) => <article key={`${item.module}-${index}`} className={item.priority}><span>{index + 1}</span><div><b>{item.title}</b><small>{item.priority === "high" ? "Zorunlu koşul" : "Önerilen kontrol"}</small></div><button onClick={() => jump(item.module)}>Aç</button></article>) : <div className="live-compact-empty">Bu proje için bekleyen işlem bulunmuyor.</div>}</div></section><section><header><div><small>AŞAMA KAPILARI</small><h3>Kontrol sonucu</h3></div></header><div className="live-gate-list">{[...data.blockers, ...data.warnings].length ? [...data.blockers, ...data.warnings].map((item) => <button key={item.id} className={item.severity} onClick={() => jump(item.module)}><span>{item.severity === "blocker" ? <WarningCircle /> : "!"}</span><div><b>{item.label}</b><small>{item.severity === "blocker" ? "Tamamlanmadan geçiş engellenir" : "Geçişte kullanıcı uyarılır"}</small></div></button>) : <div className="live-project-ready"><Check /><span><b>Geçişe hazır</b><small>Sonraki aşama için zorunlu eksik yok.</small></span></div>}</div></section></div><section className="live-project-operational"><header><div><small>OPERASYON BAĞLANTILARI</small><h3>Tek projede birleşen kayıtlar</h3></div></header><div><button onClick={() => jump("siteSurveys")}><strong>{data.facts.surveyApproved || 0}</strong><span>Onaylı keşif</span></button><button onClick={() => jump("designRevisions")}><strong>{data.facts.designApproved || 0}</strong><span>Onaylı tasarım</span></button><button onClick={() => jump("production")}><strong>{data.facts.productionDone || 0}/{data.facts.productionTotal || 0}</strong><span>Üretim tamamlanma</span></button><button onClick={() => jump("qualityInspections")}><strong>{data.facts.finalQualityPass || 0}</strong><span>Final kalite geçişi</span></button><button onClick={() => jump("installations")}><strong>{data.facts.installationDone || 0}/{data.facts.installationTotal || 0}</strong><span>Montaj tamamlanma</span></button><button onClick={() => jump("handovers")}><strong>{data.facts.handoverAccepted || 0}</strong><span>Müşteri kabulü</span></button></div></section></div>}</section></div>;
}

function RecordDetailModal({ module, record, session, onClose }) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const load = () => {
    setState({ loading: true, data: null, error: null });
    api.get(module.resource, record.id).then((data) => setState({ loading: false, data, error: null })).catch((error) => setState({ loading: false, data: null, error }));
  };
  useEffect(() => { load(); }, [module.resource, record.id]);
  const config = configs[module.id];
  const permittedFields = config.fields.filter((item) => !item.permission || permissionAllows(session, item.permission.action, item.permission.resource));
  const blockedFields = new Set(config.fields.filter((item) => item.permission && !permissionAllows(session, item.permission.action, item.permission.resource)).map((item) => item.name));
  const detailFields = [...permittedFields, ...config.columns.filter(([name]) => !blockedFields.has(name) && !permittedFields.some((item) => item.name === name)).map(([name, label, type]) => ({ name, label, type }))];
  const data = state.data || record;
  if (module.id === "files") {
    const contentUrl = api.fileContentUrl(data.id);
    const isImage = ["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"].includes(String(data.contentType || "").toLowerCase());
    const isPdf = data.contentType === "application/pdf" || String(data.fileName || "").toLowerCase().endsWith(".pdf");
    return <div className="live-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="live-modal live-file-detail" role="dialog" aria-modal="true"><header><div><small>DOSYA KANITI</small><h2>{data.fileName || "Dosya"}</h2><p>{data.spaceName || "Proje geneli"} · {localizedEnum(data.captureStage) || data.captureStage || "Diğer"}</p></div><button className="live-icon-button" onClick={onClose} aria-label="Kapat"><X /></button></header>{state.loading ? <LoadingState /> : state.error ? <ErrorState error={state.error} retry={load} /> : <div className="live-file-detail-body"><div className="live-file-preview">{isImage ? <img src={contentUrl} alt={data.description || data.fileName || "Proje fotoğrafı"} /> : isPdf ? <iframe src={contentUrl} title={data.fileName || "PDF belgesi"} /> : <div><ClipboardText /><b>Bu dosya tarayıcı içinde önizlenemiyor.</b><small>Güvenli görüntüleme bağlantısını kullanabilirsiniz.</small></div>}</div><aside><small>BAĞLAM</small><h3>{data.description || "Açıklama girilmemiş"}</h3><dl><div><dt>Proje ID</dt><dd>{data.projectId || "—"}</dd></div>{data.workItemId && <div><dt>İş kalemi ID</dt><dd>{data.workItemId}</dd></div>}{data.designRevisionId && <div><dt>Tasarım revizyonu ID</dt><dd>{data.designRevisionId}</dd></div>}{data.qualityInspectionId && <div><dt>Kalite kontrolü ID</dt><dd>{data.qualityInspectionId}</dd></div>}{data.installationId && <div><dt>Montaj ID</dt><dd>{data.installationId}</dd></div>}<div><dt>Mahal</dt><dd>{data.spaceName || "Proje geneli"}</dd></div><div><dt>Aşama</dt><dd>{localizedEnum(data.captureStage) || data.captureStage || "—"}</dd></div><div><dt>Kategori</dt><dd>{localizedEnum(data.category) || data.category || "—"}</dd></div><div><dt>Görünürlük</dt><dd>{localizedEnum(data.visibility) || data.visibility || "—"}</dd></div><div><dt>Çekim tarihi</dt><dd>{formatValue(data.takenAt || data.createdAt, "date", data)}</dd></div></dl><a className="live-button primary" href={contentUrl} target="_blank" rel="noreferrer">Dosyayı tam boy aç</a></aside></div>}</section></div>;
  }
  return <div className="live-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="live-modal" role="dialog" aria-modal="true"><header><div><small>KAYIT DETAYI</small><h2>{module.singular}</h2></div><button className="live-icon-button" onClick={onClose}><X /></button></header>{state.loading ? <LoadingState /> : state.error ? <ErrorState error={state.error} retry={load} /> : <div className="live-detail-grid">{detailFields.map((item) => <div className={item.wide ? "wide" : ""} key={item.name}><small>{item.label}</small>{item.type === "status" || item.name === "status" ? <Status>{recordValue(data, item.name)}</Status> : <b>{typeof recordValue(data, item.name) === "object" ? JSON.stringify(recordValue(data, item.name)) : formatValue(recordValue(data, item.name), item.type, data)}</b>}</div>)}<div><small>Kayıt ID</small><b className="live-breakable">{data.id}</b></div></div>}</section></div>;
}

function DeleteConfirmModal({ module, record, saving, error, onClose, onConfirm }) {
  return <div className="live-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}><section className="live-modal compact" role="alertdialog" aria-modal="true"><header><div><small>GERİ ALINAMAZ İŞLEM</small><h2>{module.singular} kaydını sil</h2></div><button className="live-icon-button" disabled={saving} onClick={onClose}><X /></button></header><div className="live-confirm-body"><p>Bu kayıt kalıcı olarak silinecek. İlişkili başka kayıtlarda kullanılıyorsa sistem silme işlemini güvenle reddeder.</p><div className="live-record-reference"><b>{record.name || record.referenceNo || record.code || record.number || record.documentNo || record.fileName || record.id}</b><small>{record.status || module.title}</small></div>{error && <div className="live-form-alert"><WarningCircle />{error.message}</div>}<footer><button className="live-button secondary" disabled={saving} onClick={onClose}>Vazgeç</button><button className="live-button danger-action" disabled={saving} onClick={onConfirm}>{saving ? "Siliniyor…" : "Kaydı sil"}</button></footer></div></section></div>;
}

const permissionCatalog = [
  ["dashboard.read", "Ana sayfayı görüntüleme"],
  ...[
    ["customers", "Müşteri"], ["suppliers", "Tedarikçi"], ["projects", "Proje"], ["offers", "Teklif"],
    ["offer-items", "Teklif kalemi"], ["project-tasks", "Proje görevi"], ["work-items", "İş kalemi"],
    ["purchase-requests", "Satın alma talebi"], ["purchase-orders", "Satın alma siparişi"],
    ["production-orders", "Üretim emri"], ["installations", "Montaj"], ["accounts", "Kasa/banka hesabı"],
    ["financial-transactions", "Finans hareketi"], ["invoices", "Fatura"], ["employees", "Personel"],
    ["attendance", "Puantaj"], ["leaves", "İzin"], ["payroll-inputs", "Bordro girdisi"],
    ["files", "Dosya"], ["memberships", "Ekip üyeliği"], ["roles", "Rol"],
  ].flatMap(([resource, label]) => [
    [`${resource}.read`, `${label} görüntüleme`], [`${resource}.write`, `${label} ekleme ve düzenleme`], [`${resource}.delete`, `${label} silme`],
  ]),
  ["audit-logs.read", "Denetim kayıtlarını görüntüleme"], ["backups.read", "Yedekleri görüntüleme"], ["backups.write", "Yedek oluşturma"],
  ["cost.view", "Maliyet ve kârlılık alanlarını görme"], ["salary.view", "Maaş ve bordro tutarlarını görme"],
  ["hr.sensitive.read", "Hassas personel alanlarını görme"], ["finance.sensitive.read", "IBAN ve finans ayrıntılarını görme"],
  ["export", "Dışa aktarma"], ["approve", "Genel onay işlemleri"], ["users.manage", "Kullanıcı yönetimi"],
  ["roles.manage", "Rol ve yetki yönetimi"], ["backups.manage", "Yedek yönetimi"], ["files.manage", "Dosya yönetimi"], ["tokens.manage", "API anahtarı yönetimi"],
  ["offers.approve", "Teklif kabul/ret"], ["offers.convert", "Teklifi projeye dönüştürme"], ["projects.transition", "Proje aşaması değiştirme"],
  ["work-items.revision.approve", "İş kalemi revizyon onayı"], ["production-orders.release", "Üretime salım"],
  ["purchase-requests.approve", "Satın alma talebi onayı"], ["leaves.approve", "İzin kararı"],
  ["financial-transactions.approve", "Finans hareketi onayı"], ["financial-transactions.reverse", "Finans ters kayıt"],
];

permissionCatalog.push(
  ...[
    ["site-surveys", "Keşif"], ["survey-measurements", "Metraj satırı"], ["contracts", "Sözleşme"],
    ["design-revisions", "Tasarım revizyonu"], ["progress-payments", "Hakediş"], ["inventory-items", "Stok kartı"],
    ["stock-movements", "Stok hareketi"], ["project-meetings", "Proje toplantısı"], ["meeting-actions", "Toplantı aksiyonu"],
    ["quality-inspections", "Kalite kontrolü"], ["handovers", "Teslim ve kabul"], ["handover-punch-items", "Eksik kalemi"],
    ["material-requirements", "Malzeme ihtiyacı"],
  ].flatMap(([resource, label]) => [
    [`${resource}.read`, `${label} görüntüleme`], [`${resource}.write`, `${label} ekleme ve düzenleme`], [`${resource}.delete`, `${label} silme`],
  ]),
  ["site-surveys.approve", "Keşif tamamlama ve onayı"], ["contracts.transition", "Sözleşme yaşam döngüsü"],
  ["design-revisions.approve", "Tasarım müşteri kararı"], ["progress-payments.approve", "Hakediş yaşam döngüsü"],
  ["stock-movements.post", "Stok hareketini kesinleştirme"], ["project-meetings.publish", "Toplantıyı yayımlama"],
  ["quality-inspections.complete", "Kalite kontrolünü sonuçlandırma"], ["handovers.transition", "Teslim kabul yaşam döngüsü"],
  ["material-requirements.reserve", "Malzemeyi stoktan projeye ayırma"], ["material-requirements.purchase", "Malzemeyi satın alma talebine bağlama"],
);

function RolePermissionsModal({ role, online, onClose }) {
  const [state, setState] = useState({ loading: true, permissions: [], error: null, saving: false });
  useEffect(() => {
    api.getRolePermissions(role.id).then((data) => setState({ loading: false, permissions: data.permissions || [], error: null, saving: false })).catch((error) => setState({ loading: false, permissions: [], error, saving: false }));
  }, [role.id]);
  const toggle = (code) => setState((current) => ({ ...current, permissions: current.permissions.includes(code) ? current.permissions.filter((item) => item !== code) : [...current.permissions, code] }));
  const save = async () => {
    if (!online) {
      setState((current) => ({ ...current, error: new ApiError("Çevrimdışıyken rol yetkileri değiştirilemez.", { code: "OFFLINE" }) }));
      return;
    }
    setState((current) => ({ ...current, saving: true, error: null }));
    try { await api.updateRolePermissions(role.id, state.permissions); onClose(); }
    catch (error) { setState((current) => ({ ...current, saving: false, error })); }
  };
  return <div className="live-modal-backdrop" role="presentation"><section className="live-modal" role="dialog" aria-modal="true"><header><div><small>ROL YETKİLERİ</small><h2>{role.name || role.code}</h2></div><button className="live-icon-button" onClick={onClose}><X /></button></header>{state.loading ? <LoadingState /> : <div className="live-permission-body"><p>Bu rolün kullanabileceği işlemleri seçin. Hassas maliyet ve ücret izinleri ayrıca işaretlenmelidir.</p><div className="live-permission-grid">{permissionCatalog.map(([code, label]) => <label key={code}><input type="checkbox" disabled={!online} checked={state.permissions.includes(code)} onChange={() => toggle(code)} /><span><b>{label}</b><small>{code}</small></span></label>)}</div>{state.error && <div className="live-form-alert"><WarningCircle />{state.error.message}</div>}<footer><button className="live-button secondary" onClick={onClose}>Vazgeç</button><button className="live-button primary" onClick={save} disabled={state.saving || !online}>{state.saving ? "Kaydediliyor…" : "Yetkileri kaydet"}</button></footer></div>}</section></div>;
}

function BackupView({ online }) {
  const [state, setState] = useState({ loading: true, rows: [], error: null, creating: false });
  const load = async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try { setState({ loading: false, rows: normalizeList(await api.listBackups()), error: null, creating: false }); }
    catch (error) { setState({ loading: false, rows: [], error, creating: false }); }
  };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!online) {
      setState((current) => ({ ...current, error: new ApiError("Çevrimdışıyken yedek oluşturulamaz.", { code: "OFFLINE" }) }));
      return;
    }
    setState((current) => ({ ...current, creating: true, error: null }));
    try { await api.createBackup(); await load(); }
    catch (error) { setState((current) => ({ ...current, creating: false, error })); }
  };
  return <section className="live-panel"><header className="live-toolbar"><div><small>VERİ GÜVENLİĞİ</small><h2>Yedekler</h2><p>Günlük otomatik yedekleri izleyin veya anlık yedek oluşturun.</p></div><button className="live-button primary" onClick={create} disabled={state.creating || !online}><ArrowClockwise /> {state.creating ? "Oluşturuluyor…" : "Şimdi yedekle"}</button></header>{state.loading ? <LoadingState /> : state.error?.status === 403 ? <PermissionDeniedState /> : state.error ? <ErrorState error={state.error} retry={load} /> : state.rows.length ? <div className="live-table-wrap"><table className="live-table"><thead><tr><th>Oluşturulma</th><th>Durum</th><th>Kayıt Sayısı</th><th>Tetikleyen</th><th>Tamamlanma</th></tr></thead><tbody>{state.rows.map((row) => <tr key={row.id}><td>{formatValue(row.createdAt, "date", row)}</td><td><Status>{row.status}</Status></td><td>{row.rowCount ?? "—"}</td><td>{row.triggeredBy || "sistem"}</td><td>{formatValue(row.completedAt, "date", row)}</td></tr>)}</tbody></table></div> : <EmptyState title="yedek" canCreate={online} onCreate={create} />}</section>;
}

function TokenView({ online }) {
  const [state, setState] = useState({ loading: true, rows: [], error: null, saving: false });
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("Entegrasyon Anahtarı");
  const [days, setDays] = useState(90);
  const [secret, setSecret] = useState(null);
  const [tokenAction, setTokenAction] = useState(null);
  const load = async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try { setState({ loading: false, rows: normalizeList(await api.listTokens()), error: null, saving: false }); }
    catch (error) { setState({ loading: false, rows: [], error, saving: false }); }
  };
  useEffect(() => { load(); }, []);
  const create = async (event) => {
    event.preventDefault();
    if (!online) return;
    setState((current) => ({ ...current, saving: true, error: null }));
    try { const created = await api.createToken({ name, expiresInDays: days }); setSecret(created.token); setFormOpen(false); await load(); }
    catch (error) { setState((current) => ({ ...current, saving: false, error })); }
  };
  const act = async () => {
    if (!online || !tokenAction) return;
    setState((current) => ({ ...current, saving: true, error: null }));
    try {
      const result = await api.tokenAction(tokenAction.row.id, tokenAction.action.key, tokenAction.action.key === "rotate" ? { expires_in_days: 90 } : {});
      if (result.token) setSecret(result.token);
      setTokenAction(null);
      await load();
    } catch (error) { setState((current) => ({ ...current, saving: false, error })); }
  };
  return <><section className="live-panel"><header className="live-toolbar"><div><small>GÜVENLİ ENTEGRASYON</small><h2>API Erişim Anahtarları</h2><p>Anahtarlar yalnız kendi kullanıcınıza aittir; gizli değer sonradan gösterilmez.</p></div><button className="live-button primary" disabled={!online} onClick={() => setFormOpen(true)}><Plus /> Yeni anahtar</button></header>{secret && <div className="live-secret"><div><b>Bu anahtarı şimdi güvenli bir yere kaydedin</b><code>{secret}</code><small>Bu değer kapatıldıktan sonra yeniden görüntülenemez.</small></div><button className="live-button secondary" onClick={() => navigator.clipboard?.writeText(secret)}>Kopyala</button><button className="live-icon-button" onClick={() => setSecret(null)}><X /></button></div>}{state.loading ? <LoadingState /> : state.error?.status === 403 ? <PermissionDeniedState /> : state.error ? <ErrorState error={state.error} retry={load} /> : state.rows.length ? <div className="live-table-wrap"><table className="live-table"><thead><tr><th>Ad</th><th>Oluşturulma</th><th>Son Kullanım</th><th>Son Kullanım Tarihi</th><th>Durum</th><th /></tr></thead><tbody>{state.rows.map((row) => { const revoked = Boolean(row.revokedAt); const expired = row.expiresAt && new Date(row.expiresAt) < new Date(); return <tr key={row.id}><td>{row.name}</td><td>{formatValue(row.createdAt, "date", row)}</td><td>{formatValue(row.lastUsedAt, "date", row)}</td><td>{formatValue(row.expiresAt, "date", row)}</td><td><Status>{revoked ? "İptal" : expired ? "Süresi doldu" : "Aktif"}</Status></td><td><div className="live-row-actions">{!revoked && !expired && <><button className="live-workflow-button" disabled={!online} onClick={() => setTokenAction({ row, action: { key: "rotate", title: "API anahtarını yenile", message: "Eski anahtar iptal edilip yeni bir gizli anahtar üretilecek." } })}>Yenile</button><button className="live-workflow-button danger" disabled={!online} onClick={() => setTokenAction({ row, action: { key: "revoke", title: "API anahtarını iptal et", message: "Bu anahtarı kullanan entegrasyonlar hemen erişimini kaybedecek.", tone: "danger" } })}>İptal et</button></>}</div></td></tr>; })}</tbody></table></div> : <EmptyState title="API anahtarı" canCreate={online} onCreate={() => setFormOpen(true)} />}</section>{formOpen && <div className="live-modal-backdrop" role="presentation"><section className="live-modal compact"><header><div><small>YENİ ERİŞİM ANAHTARI</small><h2>API anahtarı oluştur</h2></div><button className="live-icon-button" onClick={() => setFormOpen(false)}><X /></button></header><form onSubmit={create}><div className="live-form-grid"><label className="wide"><span>Anahtar adı</span><input required value={name} onChange={(event) => setName(event.target.value)} /></label><label><span>Geçerlilik süresi (gün)</span><input required type="number" min="1" max="365" value={days} onChange={(event) => setDays(event.target.value)} /></label></div>{state.error && <div className="live-form-alert"><WarningCircle />{state.error.message}</div>}<footer><button type="button" className="live-button secondary" onClick={() => setFormOpen(false)}>Vazgeç</button><button className="live-button primary" disabled={state.saving || !online}>{state.saving ? "Oluşturuluyor…" : "Anahtarı oluştur"}</button></footer></form></section></div>}{tokenAction && <WorkflowConfirmModal workflow={tokenAction} saving={state.saving} error={state.error} onClose={() => setTokenAction(null)} onConfirm={act} />}</>;
}

const fieldActions = [
  { id: "photo", title: "Fotoğraf çek", description: "İşi proje ve mahal bağlamıyla belgeleyin", icon: Camera, resource: "files", onlineRequired: true },
  { id: "survey", title: "Keşif kaydı", description: "Saha ziyareti ve keşif notu oluşturun", icon: ClipboardText, moduleId: "siteSurveys", defaults: (projectId) => ({ projectId, surveyDate: new Date().toISOString().slice(0, 10), status: "draft" }) },
  { id: "measurement", title: "Ölçü / metraj", description: "Mahal bazlı ölçü satırı ekleyin", icon: ClipboardText, moduleId: "surveyMeasurements", defaults: () => ({ quantity: 1 }) },
  { id: "quality", title: "Kalite kusuru", description: "Uygunsuzluğu ve düzeltme ihtiyacını kaydedin", icon: Check, moduleId: "qualityInspections", defaults: (projectId) => ({ projectId, inspectionType: "site", inspectionDate: new Date().toISOString().slice(0, 10), result: "pending", status: "draft" }) },
  { id: "punch", title: "Montaj eksiği", description: "Teslim veya montaj eksiği açın", icon: WarningCircle, moduleId: "handoverPunchItems", defaults: () => ({ severity: "normal", status: "open" }) },
  { id: "communication", title: "Görüşme notu", description: "Saha kararını ve müşteri taahhüdünü yazın", icon: ChatCircleText, moduleId: "projectCommunications", defaults: (projectId) => ({ projectId, channel: "site", direction: "internal", occurredAt: new Date().toISOString().slice(0, 16), status: "open" }) },
  { id: "task", title: "Görev ekle", description: "Sorumlu ve terminli saha görevi oluşturun", icon: Check, moduleId: "projectTasks", defaults: (projectId) => ({ projectId, status: "todo", priority: "normal", plannedStart: new Date().toISOString().slice(0, 10) }) },
];

function FieldMode({ session, online, queueState, onNavigate, onDataChanged }) {
  const [projects, setProjects] = useState([]);
  const [projectError, setProjectError] = useState(null);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedAction, setSelectedAction] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [notice, setNotice] = useState(null);
  const tenantId = session?.tenant?.id || "default";
  useEffect(() => {
    try { setSelectedProject(window.localStorage.getItem(`capproje.field.project.${tenantId}`) || ""); }
    catch { setSelectedProject(""); }
  }, [tenantId]);
  useEffect(() => {
    if (!selectedProject) return;
    try { window.localStorage.setItem(`capproje.field.project.${tenantId}`, selectedProject); }
    catch { /* Device preferences may be disabled. */ }
  }, [selectedProject, tenantId]);
  useEffect(() => {
    if (!online || !permissionAllows(session, "read", "projects")) return;
    setProjectError(null);
    api.list("projects", { page: 1, pageSize: 50 }).then((result) => setProjects(normalizeList(result.data))).catch(setProjectError);
  }, [online, tenantId]);
  const resourceForAction = (action) => action.resource || modules.find((item) => item.id === action.moduleId)?.resource;
  const canUseActionOffline = (action) => !action.onlineRequired && api.canQueueOffline(resourceForAction(action));
  const visibleActions = fieldActions.filter((action) => permissionAllows(session, "create", resourceForAction(action)));
  const links = [
    { moduleId: "projectTasks", label: "Görevlerim", icon: Check },
    { moduleId: "installations", label: "Montaj planı", icon: Truck },
    { moduleId: "qualityInspections", label: "Kalite kontrolleri", icon: ClipboardText },
    { moduleId: "files", label: "Proje fotoğrafları", icon: Camera },
  ].filter((item) => permissionAllows(session, "read", modules.find((module) => module.id === item.moduleId)?.resource));
  function openAction(action) {
    setNotice(null);
    setSaveError(null);
    if (!online && !canUseActionOffline(action)) { setNotice({ tone: "warning", message: "Bu kayıt türü için internet bağlantısı gerekiyor." }); return; }
    setSelectedAction(action);
  }
  async function saveRecord(values) {
    const targetModule = modules.find((item) => item.id === selectedAction?.moduleId);
    if (!targetModule) return;
    setSaving(true); setSaveError(null);
    try {
      const saved = await api.create(targetModule.resource, values);
      setSelectedAction(null);
      setNotice({ tone: saved?._offlineQueued ? "warning" : "success", message: saved?._offlineQueued ? "Kayıt çevrimdışı kuyruğa alındı." : "Saha kaydı oluşturuldu." });
      if (!saved?._offlineQueued) onDataChanged?.();
    } catch (error) { setSaveError(error); }
    finally { setSaving(false); }
  }
  async function savePhoto(values) {
    if (!online) return;
    setSaving(true); setSaveError(null);
    try { await api.uploadFile(values); setSelectedAction(null); setNotice({ tone: "success", message: "Fotoğraf proje dosyasına eklendi." }); onDataChanged?.(); }
    catch (error) { setSaveError(error); }
    finally { setSaving(false); }
  }
  const targetModule = selectedAction?.moduleId ? modules.find((item) => item.id === selectedAction.moduleId) : null;
  const selectedProjectRecord = projects.find((project) => project.id === selectedProject);
  return <><section className="live-field-mode"><header><div><small>SAHA MODU</small><h2>Sahadaki işi hızlıca kaydedin</h2><p>Önce aktif projeyi seçin; ardından fotoğraf, keşif, kalite, eksik veya görüşme kaydını açın.</p></div><span className={online ? "online" : "offline"}><i />{online ? "Bağlantı var" : "Çevrimdışı kuyruk aktif"}</span></header><label className="live-field-project"><span><b>Aktif proje</b><small>Hızlı kayıtlara otomatik aktarılır</small></span><input list="field-project-list" value={selectedProject} placeholder="Proje seçin veya ID yazın" onChange={(event) => setSelectedProject(event.target.value)} /><datalist id="field-project-list">{projects.map((project) => <option value={project.id} key={project.id}>{project.code ? `${project.code} · ` : ""}{project.name}</option>)}</datalist>{selectedProjectRecord && <em>{selectedProjectRecord.code} · {selectedProjectRecord.name}</em>}</label>{projectError && online && <div className="live-field-note warning"><WarningCircle />Proje listesi alınamadı; proje ID'sini elle girebilirsiniz.</div>}{notice && <div className={`live-field-note ${notice.tone}`}><Check />{notice.message}</div>}<div className="live-field-actions">{visibleActions.map((action) => <button key={action.id} disabled={!online && !canUseActionOffline(action)} onClick={() => openAction(action)}><span><action.icon /></span><div><b>{action.title}</b><small>{action.description}</small><em>{online ? action.onlineRequired ? "İnternet bağlantısıyla" : "Kayda hazır" : canUseActionOffline(action) ? "Çevrimdışı da kaydedilir" : "Bağlantı gerekli"}</em></div></button>)}</div><section className="live-field-links"><header><div><small>SAHA TAKİBİ</small><h3>Günlük çalışma alanları</h3></div>{queueState.items.length > 0 && <b>{queueState.items.length} işlem kuyrukta</b>}</header><div>{links.map((item) => <button onClick={() => onNavigate(item.moduleId)} key={item.moduleId}><item.icon /><span>{item.label}</span><CaretRight /></button>)}</div></section></section>{selectedAction?.id === "photo" && <QuickPhotoModal projectId={selectedProject} saving={saving} serverError={saveError} onClose={() => setSelectedAction(null)} onSave={savePhoto} />}{targetModule && <RecordModal key={`${targetModule.id}-${selectedProject}`} module={targetModule} defaults={selectedAction.defaults?.(selectedProject) || {}} session={session} saving={saving} serverError={saveError} onClose={() => setSelectedAction(null)} onSave={saveRecord} />}</>;
}

function Dashboard({ session, onNavigate, refreshKey }) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const load = async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try { setState({ loading: false, data: await api.dashboard(), error: null }); }
    catch (error) { setState({ loading: false, data: null, error }); }
  };
  useEffect(() => { load(); }, [session?.tenant?.id, refreshKey]);
  if (state.loading) return <LoadingState />;
  if (state.error) return <ErrorState error={state.error} retry={load} />;
  const data = state.data || {};
  const metrics = data.metrics || data.summary || [
    { label: "Aktif projeler", value: data.projects?.count ?? 0 },
    { label: "Açık teklifler", value: data.openOffers?.count ?? 0, note: data.openOffers?.amount != null ? money.format(data.openOffers.amount) : null },
    { label: "Üretim emirleri", value: data.production?.count ?? 0 },
    { label: "Montaj planları", value: data.installations?.count ?? 0 },
    { label: "Beklenen tahsilat", value: data.receivables?.amount != null ? money.format(data.receivables.amount) : "—" },
    { label: "Aktif personel", value: data.employees?.count ?? 0 },
  ];
  const metricItems = Array.isArray(metrics) ? metrics : Object.entries(metrics).map(([label, value]) => ({ label, value: typeof value === "object" ? value?.count ?? value?.amount ?? "—" : value }));
  const activities = normalizeList(data.activities || data.recentActivities || data.recent || data.recentProjects);
  const pipeline = normalizeList(data.pipeline);
  const attention = data.attention || {};
  return <>
    <div className="live-hero"><div><small>PROJE OPERASYON MERKEZİ</small><h2>Günaydın, {session?.user?.firstName || session?.user?.name?.split(" ")[0] || "ekip"}</h2><p>Projelerin aşamaları, bekleyen kararlar ve bugünün öncelikleri.</p></div><button onClick={() => onNavigate("projects")}>Proje portföyünü aç</button></div>
    {metricItems.length ? <div className="live-metric-grid">{metricItems.slice(0, 6).map((item, index) => <article key={item.key || item.label || index}><small>{item.label || item.title}</small><strong>{typeof item.value === "number" && /amount|revenue|cost|tutar|ciro/i.test(item.key || item.label) ? money.format(item.value) : item.value}</strong>{item.note && <span>{item.note}</span>}</article>)}</div> : <div className="live-metric-grid">{modules.slice(1, 5).map((item) => <button key={item.id} onClick={() => onNavigate(item.id)}><item.icon /><span><strong>{item.title}</strong><small>Kayıtları görüntüle</small></span></button>)}</div>}
    <section className="live-panel live-pipeline-panel"><header><div><small>PROJE AŞAMALARI</small><h3>Portföy hangi aşamada?</h3></div><button className="live-button secondary" onClick={() => onNavigate("projects")}>Tüm projeler</button></header><div className="live-dashboard-pipeline">{pipeline.length ? pipeline.map((stage) => <button key={stage.status} onClick={() => onNavigate("projects")}><span>{stage.count}</span><b>{projectStageLabels[stage.status] || stage.status}</b><small>proje</small></button>) : <div className="live-compact-empty">Aşama dağılımı için proje kaydı bekleniyor.</div>}</div></section>
    <div className="live-attention-grid"><button onClick={() => onNavigate("projectTasks")} className={attention.overdueTasks ? "danger" : ""}><WarningCircle /><span><small>GECİKMİŞ GÖREV</small><strong>{attention.overdueTasks || 0}</strong></span></button><button onClick={() => onNavigate("purchases")}><ShoppingCart /><span><small>SATIN ALMA ONAYI</small><strong>{attention.pendingPurchases || 0}</strong></span></button><button onClick={() => onNavigate("designRevisions")}><PencilSimple /><span><small>TASARIM ONAYI</small><strong>{attention.pendingDesigns || 0}</strong></span></button><button onClick={() => onNavigate("qualityInspections")} className={attention.qualityIssues ? "danger" : ""}><Check /><span><small>KALİTE UYARISI</small><strong>{attention.qualityIssues || 0}</strong></span></button><button onClick={() => onNavigate("materialRequirements")} className={attention.materialShortages ? "danger" : ""}><WarningCircle /><span><small>MALZEME EKSİĞİ</small><strong>{attention.materialShortages || 0}</strong></span></button><button onClick={() => onNavigate("resourceAssignments")} className={attention.capacityConflicts ? "danger" : ""}><UsersThree /><span><small>KAPASİTE ÇAKIŞMASI</small><strong>{attention.capacityConflicts || 0}</strong></span></button></div>
    <section className="live-panel"><header><div><small>SON HAREKETLER</small><h3>Ekip aktivitesi</h3></div></header>{activities.length ? <div className="live-activity-list">{activities.slice(0, 8).map((activity, index) => <article key={activity.id || index}><span className="live-activity-dot" /><div><b>{activity.name || activity.title || activity.action || "Kayıt güncellendi"}</b><small>{activity.code ? `${projectStageLabels[activity.status] || activity.status} · %${activity.progressPercent || 0}` : activity.description || activity.userName || activity.createdBy || "Sistem"}</small></div><time>{formatValue(activity.updatedAt || activity.createdAt || activity.date, "date", activity)}</time></article>)}</div> : <div className="live-compact-empty">Henüz görüntülenecek hareket bulunmuyor.</div>}</section>
  </>;
}

function GlobalSearch({ onNavigate }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState({ loading: false, rows: [], error: null });
  useEffect(() => {
    if (query.trim().length < 2) { setState({ loading: false, rows: [], error: null }); return undefined; }
    const timer = setTimeout(() => {
      setState((current) => ({ ...current, loading: true, error: null }));
      api.globalSearch(query.trim()).then((rows) => setState({ loading: false, rows, error: null })).catch((error) => setState({ loading: false, rows: [], error }));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  function choose(row) { setQuery(""); onNavigate(row.module); }
  return <div className="live-global-search"><MagnifyingGlass /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Proje, müşteri, teklif, ürün veya belge ara…" aria-label="Tüm uygulamada ara" />{query && <button onClick={() => setQuery("")} aria-label="Aramayı temizle"><X /></button>}{query.trim().length >= 2 && <div className="live-global-results">{state.loading ? <div className="live-search-message"><span className="live-spinner small" /> Aranıyor…</div> : state.error ? <div className="live-search-message danger">Arama şu an tamamlanamadı.</div> : state.rows.length ? state.rows.map((row) => <button key={`${row.module}-${row.id}`} onClick={() => choose(row)}><span><b>{row.title || row.code || "Kayıt"}</b><small>{row.code ? `${row.code} · ` : ""}{row.subtitle || row.module}</small></span><em>{modules.find((item) => item.id === row.module)?.title || row.module}</em></button>) : <div className="live-search-message">Eşleşen kayıt bulunamadı.</div>}</div>}</div>;
}

function NotificationsView({ onNavigate }) {
  const [state, setState] = useState({ loading: true, rows: [], error: null, unread: 0 });
  const load = () => { setState((current) => ({ ...current, loading: true, error: null })); api.notifications().then((result) => setState({ loading: false, rows: result.data, error: null, unread: result.meta?.unread || 0 })).catch((error) => setState({ loading: false, rows: [], error, unread: 0 })); };
  useEffect(() => { load(); }, []);
  async function openNotification(item) { if (item.status === "unread") await api.markNotification(item.id); if (item.module) onNavigate(item.module); else load(); }
  async function dismiss(item) { await api.markNotification(item.id, "dismissed"); load(); }
  return <section className="live-panel live-notifications"><header className="live-toolbar"><div><small>KİŞİSEL İŞ KUTUSU</small><h2>Bildirimler</h2><p>{state.unread ? `${state.unread} okunmamış bildirim var.` : "Bekleyen yeni bildiriminiz yok."}</p></div><button className="live-button secondary" onClick={load}><ArrowClockwise /> Yenile</button></header>{state.loading ? <LoadingState /> : state.error ? <ErrorState error={state.error} retry={load} /> : state.rows.length ? <div className="live-notification-list">{state.rows.map((item) => <article className={item.status === "unread" ? "unread" : ""} key={item.id}><span><Bell /></span><button onClick={() => openNotification(item)}><b>{item.title}</b><p>{item.message || "İlgili kaydı kontrol edin."}</p><small>{formatValue(item.createdAt, "date")}{item.dueAt ? ` · Hedef ${formatValue(item.dueAt, "date")}` : ""}</small></button><button className="live-dismiss" onClick={() => dismiss(item)}>Kapat</button></article>)}</div> : <EmptyState title="Bildirim" />}</section>;
}

function OfflineQueueControl({ state, online, onSynced }) {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [discardItem, setDiscardItem] = useState(null);
  const total = state.items?.length || 0;
  const moduleLabel = (resource) => modules.find((item) => item.id === resource || item.resource === resource)?.title || resource;
  async function sync(id = null) {
    if (!online) return;
    setWorking(true);
    try {
      const result = id ? await api.retryOfflineQueue(id) : await api.syncOfflineQueue();
      if (result.synced) onSynced?.();
    } finally {
      setWorking(false);
    }
  }
  async function discard() {
    if (!discardItem) return;
    setWorking(true);
    try { await api.discardOfflineMutation(discardItem.id); setDiscardItem(null); }
    finally { setWorking(false); }
  }
  return <><button className={`live-queue-button ${state.failed ? "danger" : total ? "pending" : ""}`} onClick={() => setOpen(true)} title="Çevrimdışı işlem kuyruğu" aria-label={`Çevrimdışı işlem kuyruğu, ${total} kayıt`}><CloudArrowUp /><span>Kuyruk</span>{total > 0 && <b>{total}</b>}</button>{open && <div className="live-modal-backdrop" role="presentation"><section className="live-modal compact live-queue-modal"><header><div><small>MOBİL GÜVENLİ EŞİTLEME</small><h2>Çevrimdışı işlem kuyruğu</h2><p>Yalnız güvenli yeni kayıtlar saklanır; onay, silme, dosya ve finans işlemleri çevrimdışında çalışmaz.</p></div><button className="live-icon-button" onClick={() => setOpen(false)}><X /></button></header>{state.error ? <div className="live-form-alert"><WarningCircle />{state.error.message}</div> : total ? <div className="live-queue-list">{state.items.map((item) => <article key={item.id}><span className={`live-queue-state ${item.status}`}><CloudArrowUp /></span><div><b>{moduleLabel(item.resource)} · Yeni kayıt</b><small>{formatValue(item.createdAt, "date")} · {item.status === "syncing" ? "Eşitleniyor" : item.status === "failed" ? "İnceleme gerekli" : "Bağlantı bekleniyor"}</small>{item.errorMessage && <em>{item.errorMessage}</em>}</div><div>{item.status === "failed" && <button className="live-workflow-button" disabled={!online || working} onClick={() => sync(item.id)}>Tekrar dene</button>}<button className="live-icon-button danger" disabled={working || item.status === "syncing"} onClick={() => setDiscardItem(item)} title="Kuyruktan kaldır"><X /></button></div></article>)}</div> : <div className="live-view-empty"><Check /><b>Bekleyen işlem yok</b><small>Çevrimdışı oluşturulan güvenli kayıtlar burada görünecek.</small></div>}<footer><small>Kayıtlar bu cihazda en fazla 7 gün tutulur ve yalnız aynı kullanıcı ile firma kapsamında eşitlenir.</small>{total > 0 && <button className="live-button primary" disabled={!online || working || state.syncing} onClick={() => sync()}><ArrowClockwise /> {working || state.syncing ? "Eşitleniyor…" : "Şimdi eşitle"}</button>}</footer></section></div>}{discardItem && <WorkflowConfirmModal workflow={{ row: { id: discardItem.localId }, action: { title: "Bekleyen kaydı kuyruktan kaldır", message: "Bu cihazda bekleyen kayıt silinecek ve sunucuya gönderilmeyecek.", tone: "danger" } }} saving={working} error={null} onClose={() => setDiscardItem(null)} onConfirm={discard} />}</>;
}

function ResourceView({ module, session, online, refreshKey, onDataChanged, onNavigate }) {
  let config = configs[module.id];
  const canViewOfficial = permissionAllows(session, "read", "finance.sensitive");
  const blockedColumns = new Set(config.fields.filter((item) => item.permission && !permissionAllows(session, item.permission.action, item.permission.resource)).map((item) => item.name));
  config = { ...config, officialScope: Boolean(config.officialScope && canViewOfficial), columns: config.columns.filter(([name]) => !blockedColumns.has(name)) };
  const [state, setState] = useState({ loading: true, rows: [], meta: null, error: null });
  const [query, setQuery] = useState("");
  const [view, setView] = useState("list");
  const [officialFilter, setOfficialFilter] = useState(canViewOfficial ? (config.query?.official === true ? "official" : config.query?.official === false ? "unofficial" : "all") : "all");
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [permissionRole, setPermissionRole] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [workflowError, setWorkflowError] = useState(null);
  const [detailRecord, setDetailRecord] = useState(null);
  const [deleteRecord, setDeleteRecord] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const offlineCreateAllowed = api.canQueueOffline(module.resource);
  const canCreate = !module.readOnly && (online || offlineCreateAllowed) && permissionAllows(session, "create", module.resource) && (module.id !== "accounting" || canViewOfficial);
  const canEdit = online && !module.readOnly && !module.noEdit && permissionAllows(session, "update", module.resource);
  const canDelete = online && !module.readOnly && permissionAllows(session, "delete", module.resource);
  const canManagePermissions = online && module.id === "roles" && permissionAllows(session, "manage", "roles");
  const availableViews = config.views || ["list"];
  const activeView = availableViews.includes(view) ? view : "list";

  async function load(search = query) {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const official = !canViewOfficial || officialFilter === "all" ? undefined : officialFilter === "official";
      const result = await api.list(module.resource, { page: 1, pageSize: 50, search, ...config.query, ...(config.officialScope ? { official } : {}) });
      const rows = normalizeList(result.data).filter((row) => !config.officialScope || official === undefined || Boolean(row.official) === official);
      setState({ loading: false, rows, meta: result.meta, error: null });
    } catch (error) {
      setState({ loading: false, rows: [], meta: null, error });
    }
  }
  useEffect(() => { load(""); }, [module.id, session?.tenant?.id, officialFilter, refreshKey]);
  useEffect(() => api.subscribeOfflineQueue((snapshot) => {
    const activeQueueIds = new Set(snapshot.items.map((item) => item.id));
    setState((current) => ({ ...current, rows: current.rows.filter((row) => !row._offlineQueued || activeQueueIds.has(row._offlineQueueId)) }));
  }), []);

  async function save(values) {
    if (!online && (modal?.id || module.id === "files" || !offlineCreateAllowed)) {
      setSaveError(new ApiError("Bu işlem çevrimdışıyken güvenli kuyruğa alınamaz.", { code: "OFFLINE" }));
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      let savedRecord = null;
      if (module.id === "files") savedRecord = await api.uploadFile(values);
      else {
        const payload = { ...values, ...(config.createDefaults && canViewOfficial ? config.createDefaults : {}) };
        if (modal?.id) savedRecord = await api.update(module.resource, modal.id, payload);
        else savedRecord = await api.create(module.resource, payload);
      }
      setModal(null);
      if (savedRecord?._offlineQueued) {
        setState((current) => ({ ...current, loading: false, rows: [savedRecord, ...current.rows], error: null }));
      } else {
        await load();
        onDataChanged?.();
      }
    } catch (error) {
      setSaveError(error);
    } finally {
      setSaving(false);
    }
  }

  async function runWorkflow(body) {
    if (!online || !workflow) return;
    setWorkflowSaving(true);
    setWorkflowError(null);
    try {
      await api.workflow(module.resource, workflow.row.id, workflow.action.key, body);
      setWorkflow(null);
      await load();
      onDataChanged?.();
    } catch (error) {
      setWorkflowError(error);
    } finally {
      setWorkflowSaving(false);
    }
  }

  function mayDelete(row) {
    if (!canDelete || row._offlineQueued) return false;
    if (module.id === "roles" && row.isSystem) return false;
    if (module.id === "finance" && ["approved", "reversed", "Onaylandı"].includes(row.status)) return false;
    return true;
  }

  async function confirmDelete() {
    if (!online || !deleteRecord) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.remove(module.resource, deleteRecord.id);
      setDeleteRecord(null);
      await load();
      onDataChanged?.();
    } catch (error) {
      setDeleteError(error);
    } finally {
      setDeleting(false);
    }
  }

  return <><section className="live-panel"><header className="live-toolbar"><div><small>{module.id === "projects" ? "PROJE PORTFÖYÜ" : "CANLI KAYITLAR"}</small><h2>{module.title}</h2><p>{module.id === "projects" ? "Talep, keşif, teklif, sözleşme, üretim ve teslim aşamalarını tek zincirde yönetin." : config.description}</p></div>{canCreate && <button className="live-button primary" onClick={() => setModal({})}><Plus /> Yeni {module.singular}</button>}</header>{config.officialScope && <div className="live-filter-tabs"><button className={officialFilter === "all" ? "active" : ""} onClick={() => setOfficialFilter("all")}>Tümü</button><button className={officialFilter === "official" ? "active" : ""} onClick={() => setOfficialFilter("official")}>Resmi</button><button className={officialFilter === "unofficial" ? "active" : ""} onClick={() => setOfficialFilter("unofficial")}>Proje içi / gayri resmi</button></div>}<form className="live-search" onSubmit={(event) => { event.preventDefault(); load(); }}><MagnifyingGlass /><input aria-label="Kayıtlarda ara" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Kod, ad, müşteri veya durum ara…" /><button className="live-search-submit">Ara</button>{availableViews.length > 1 && <ViewSwitcher available={availableViews} value={activeView} onChange={setView} />}</form>{state.loading ? <LoadingState /> : state.error?.status === 403 || state.error?.code === "forbidden" ? <PermissionDeniedState /> : state.error ? <ErrorState error={state.error} retry={() => load()} /> : state.rows.length ? <><ResourceDataView view={activeView} rows={state.rows} config={config} canEdit={canEdit} onEdit={setModal} onDetail={setDetailRecord} canDelete={mayDelete} onDelete={(row) => { setDeleteError(null); setDeleteRecord(row); }} onPermissions={canManagePermissions ? setPermissionRole : null} getWorkflowActions={online ? (row) => workflowActions(module, row, session) : null} onWorkflow={(row, action) => { setWorkflowError(null); setWorkflow({ row, action }); }} /><footer className="live-table-footer"><span>{config.officialScope ? state.rows.length : state.meta?.total ?? state.rows.length} kayıt</span><small>{module.id === "projects" ? "Detay düğmesi proje komuta merkezini açar" : "Tenant kapsamındaki güncel veriler"}</small></footer></> : <EmptyState title={module.title} canCreate={canCreate} onCreate={() => setModal({})} />}</section>{modal && (module.id === "files" ? <FileUploadModal saving={saving} serverError={saveError} onClose={() => setModal(null)} onSave={save} /> : <RecordModal module={module} record={modal.id ? modal : null} session={session} saving={saving} serverError={saveError} onClose={() => setModal(null)} onSave={save} />)}{detailRecord && (module.id === "projects" ? <ProjectCommandCenterModal record={detailRecord} onClose={() => setDetailRecord(null)} onNavigate={onNavigate} /> : <RecordDetailModal module={module} record={detailRecord} session={session} onClose={() => setDetailRecord(null)} />)}{deleteRecord && <DeleteConfirmModal module={module} record={deleteRecord} saving={deleting} error={deleteError} onClose={() => setDeleteRecord(null)} onConfirm={confirmDelete} />}{permissionRole && <RolePermissionsModal role={permissionRole} online={online} onClose={() => setPermissionRole(null)} />}{workflow && <WorkflowConfirmModal workflow={workflow} saving={workflowSaving} error={workflowError} onClose={() => setWorkflow(null)} onConfirm={runWorkflow} />}</>;
}

function Login({ error, loading, onSubmit, onPasswordLogin }) {
  const [values, setValues] = useState({ email: import.meta.env.VITE_DEMO_USER_EMAIL || "", tenantId: "" });
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  async function submitPassword(event) {
    event.preventDefault();
    setAuthLoading(true); setAuthError(null);
    try { await onPasswordLogin({ phone, password }); }
    catch (nextError) { setAuthError(nextError); setAuthLoading(false); }
  }

  const visibleError = authError || error;
  return <main className="live-login"><section><div className="live-login-brand"><span><Buildings /></span><div><b>Capproje</b><small>Orman Ürünleri Yönetimi</small></div></div><div><small>GÜVENLİ ÇALIŞMA ALANI</small><h1>Projelerinizi tek yerden yönetin.</h1><p>Teklif, üretim, satın alma, montaj ve proje finansı aynı operasyon zincirinde.</p></div></section>{demoAuthEnabled ? <form onSubmit={(event) => { event.preventDefault(); onSubmit(values); }}><header><small>GELİŞTİRİCİ OTURUMU</small><h2>Demo kullanıcıyla devam et</h2></header><label><span>E-posta</span><input required type="email" autoComplete="username" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} /></label><label><span>Firma / tenant ID</span><input required value={values.tenantId} onChange={(event) => setValues({ ...values, tenantId: event.target.value })} /></label>{visibleError && <div className="live-form-alert"><WarningCircle />{visibleError.message}</div>}<button className="live-button primary" disabled={loading}>{loading ? <><span className="live-spinner small" /> Bağlanıyor</> : "Demo oturumu aç"}</button></form> : <form onSubmit={submitPassword}><header><small>TELEFON VE ŞİFREYLE GİRİŞ</small><h2>Çalışma alanınıza giriş yapın</h2><p>Firma tarafından tanımlanan telefon numaranızı ve şifrenizi kullanın.</p></header><label><span>Cep telefonu</span><input required type="tel" inputMode="tel" autoComplete="username" placeholder="05xx xxx xx xx" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label><span>Şifre</span><input required type="password" minLength={8} maxLength={128} autoComplete="current-password" placeholder="Şifreniz" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{visibleError && <div className="live-form-alert"><WarningCircle />{visibleError.message}</div>}<button className="live-button primary" disabled={authLoading}>{authLoading ? <><span className="live-spinner small" /> Giriş yapılıyor</> : "Giriş yap"}</button></form>}</main>;
}

function TenantSelector({ session, onChange }) {
  const tenants = session?.tenants || session?.user?.tenants || [];
  if (tenants.length < 2) return <div className="live-tenant"><Buildings /><span><small>AKTİF FİRMA</small><b>{session?.tenant?.name || "Capproje"}</b></span></div>;
  return <label className="live-tenant selectable"><Buildings /><span><small>AKTİF FİRMA</small><select value={session?.tenant?.id || ""} onChange={(event) => onChange(event.target.value)}>{tenants.map((tenant) => <option value={tenant.id} key={tenant.id}>{tenant.name}</option>)}</select></span><CaretDown /></label>;
}

export function LiveWorkspace({ initialModule = "dashboard", onBackToPrototype }) {
  const [sessionState, setSessionState] = useState({ loading: true, session: null, error: null, needsLogin: false });
  const [activeId, setActiveId] = useState(initialModule);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [dataVersion, setDataVersion] = useState(0);
  const [queueState, setQueueState] = useState({ items: [], pending: 0, failed: 0, syncing: false });
  const active = useMemo(() => modules.find((item) => item.id === activeId) || modules[0], [activeId]);

  async function syncQueuedRecords() {
    try {
      const result = await api.syncOfflineQueue();
      if (result.synced) setDataVersion((value) => value + 1);
      return result;
    } catch {
      return { synced: 0 };
    }
  }

  async function bootstrap() {
    setSessionState((current) => ({ ...current, loading: true, error: null }));
    try {
      const session = await api.session();
      if (session?.tenant?.id) api.setTenant(session.tenant.id);
      await api.setOfflineContext({ tenantId: session?.tenant?.id, userId: session?.user?.id });
      setSessionState({ loading: false, session, error: null, needsLogin: false });
      if (navigator.onLine) syncQueuedRecords();
    } catch (error) {
      const needsLogin = error instanceof ApiError && [401, 403].includes(error.status);
      setSessionState({ loading: false, session: null, error: needsLogin ? null : error, needsLogin });
    }
  }

  useEffect(() => api.subscribeOfflineQueue(setQueueState), []);
  useEffect(() => { bootstrap(); }, []);
  useEffect(() => {
    const setConnected = () => { setOnline(true); syncQueuedRecords(); };
    const setDisconnected = () => setOnline(false);
    window.addEventListener("online", setConnected);
    window.addEventListener("offline", setDisconnected);
    return () => { window.removeEventListener("online", setConnected); window.removeEventListener("offline", setDisconnected); };
  }, []);

  async function login(values) {
    setSessionState((current) => ({ ...current, loading: true, error: null }));
    try {
      await api.login(values);
      await bootstrap();
    } catch (error) {
      setSessionState({ loading: false, session: null, error, needsLogin: true });
    }
  }

  async function logout() {
    await api.logout();
    setSessionState({ loading: false, session: null, error: null, needsLogin: true });
  }

  async function loginWithPassword(values) {
    await api.loginWithPassword(values);
    await bootstrap();
  }

  async function changeTenant(tenantId) {
    api.setTenant(tenantId);
    await bootstrap();
  }

  if (sessionState.loading && !sessionState.session) return <><LiveStyles /><div className="live-full-state"><LoadingState /></div></>;
  if (sessionState.needsLogin) return <><LiveStyles /><Login error={sessionState.error} loading={sessionState.loading} onSubmit={login} onPasswordLogin={loginWithPassword} /></>;
  if (sessionState.error) return <><LiveStyles /><div className="live-full-state"><ErrorState error={sessionState.error} retry={bootstrap} /></div></>;

  const session = sessionState.session;
  const roleCode = String(session?.role?.code || session?.user?.role || "").toLowerCase();
  const isOwner = ["owner", "admin", "super_admin"].includes(roleCode);
  const visibleModules = modules.filter((item) => {
    if (item.authenticated) return true;
    if (item.ownerOnly) return isOwner;
    if (item.specialAccess) return isOwner || hasCapability(session, item.specialAccess);
    if (item.id === "payroll" && !permissionAllows(session, "view_salary", "salary")) return false;
    return permissionAllows(session, "read", item.resource);
  });
  const selectedModule = visibleModules.some((item) => item.id === active.id) ? active : visibleModules[0];
  const navGroups = visibleModules.reduce((groups, item) => ({ ...groups, [item.group]: [...(groups[item.group] || []), item] }), {});
  return <div className="live-shell"><LiveStyles />{!online && <div className="live-offline"><WarningCircle /> Çevrimdışısınız. Uygun yeni saha kayıtları kuyruğa alınır; onay, silme ve dosya işlemleri bağlantı bekler.</div>}<aside className="live-sidebar"><div className="live-brand"><span><Buildings /></span><div><b>Capproje</b><small>Yönetim Platformu</small></div></div><TenantSelector session={session} onChange={changeTenant} /><nav>{Object.entries(navGroups).map(([group, items]) => <div className="live-nav-group" key={group}><small>{group}</small>{items.map((item) => <button key={item.id} className={item.id === selectedModule?.id ? "active" : ""} onClick={() => setActiveId(item.id)}><item.icon /><span>{item.title}</span></button>)}</div>)}</nav><div className="live-user"><UserCircle /><span><b>{session?.user?.name || session?.user?.full_name || `${session?.user?.firstName || ""} ${session?.user?.lastName || ""}`.trim() || session?.user?.email}</b><small>{session?.role?.name || session?.user?.role || "Kullanıcı"}</small></span><button onClick={logout} title="Çıkış yap"><SignOut /></button></div></aside><main className="live-main"><header className="live-topbar"><div><small>{session?.tenant?.name || "Firma"}</small><h1>{selectedModule?.title || "Çalışma alanı"}</h1></div><GlobalSearch onNavigate={setActiveId} /><div className="live-top-actions">{onBackToPrototype && <button className="live-button secondary" onClick={onBackToPrototype}>Prototipe dön</button>}<OfflineQueueControl state={queueState} online={online} onSynced={() => setDataVersion((value) => value + 1)} /><button className="live-top-icon" onClick={() => setActiveId("notifications")} title="Bildirimler"><Bell /></button><span className="live-connection"><i /> {online ? "Canlı" : "Çevrimdışı"}</span></div></header><div className="live-content">{!selectedModule ? <PermissionDeniedState /> : selectedModule.id === "fieldMode" ? <FieldMode session={session} online={online} queueState={queueState} onNavigate={setActiveId} onDataChanged={() => setDataVersion((value) => value + 1)} /> : selectedModule.id === "dashboard" ? <Dashboard session={session} onNavigate={setActiveId} refreshKey={dataVersion} /> : selectedModule.id === "notifications" ? <NotificationsView onNavigate={setActiveId} /> : selectedModule.id === "backups" ? <BackupView online={online} /> : selectedModule.id === "tokens" ? <TokenView online={online} /> : <ResourceView module={selectedModule} session={session} online={online} refreshKey={dataVersion} onNavigate={setActiveId} onDataChanged={() => setDataVersion((value) => value + 1)} />}</div></main></div>;
}

export default LiveWorkspace;

function LiveStyles() {
  return <style>{`
    :root{--live-ink:#18231e;--live-muted:#65716b;--live-green:#24533f;--live-green-2:#32745a;--live-paper:#f6f5f1;--live-line:#dddeda;--live-white:#fff;--live-danger:#a23d37;--live-warning:#946d22;--live-success:#24704f}
    .live-topbar{gap:20px}.live-top-icon{width:35px;height:35px;border:1px solid var(--live-line);border-radius:50%;background:#fff;color:var(--live-green);display:grid;place-items:center;cursor:pointer}.live-global-search{width:min(460px,38vw);height:40px;border:1px solid var(--live-line);border-radius:10px;display:flex;align-items:center;gap:8px;padding:0 11px;position:relative;color:var(--live-muted)}.live-global-search>input{border:0;outline:0;min-width:0;flex:1;font:inherit;font-size:11px}.live-global-search>button{border:0;background:transparent;color:var(--live-muted);display:grid;place-items:center;cursor:pointer}.live-global-results{position:absolute;top:46px;left:0;right:0;background:#fff;border:1px solid var(--live-line);border-radius:11px;box-shadow:0 16px 36px #15271f26;max-height:420px;overflow:auto;padding:6px;z-index:30}.live-global-results>button{width:100%;border:0;border-radius:8px;background:#fff;padding:10px;display:flex;justify-content:space-between;gap:12px;text-align:left;cursor:pointer}.live-global-results>button:hover{background:#f0f5f2}.live-global-results span{display:flex;flex-direction:column;gap:3px;min-width:0}.live-global-results b{font-size:11px;overflow:hidden;text-overflow:ellipsis}.live-global-results small{font-size:9px;color:var(--live-muted);overflow:hidden;text-overflow:ellipsis}.live-global-results em{font-size:8px;font-style:normal;color:var(--live-green);white-space:nowrap}.live-search-message{padding:15px;font-size:10px;color:var(--live-muted);display:flex;align-items:center;gap:7px}.live-search-message.danger{color:var(--live-danger)}
    .live-notification-list article{min-height:92px;padding:15px 20px;border-bottom:1px solid var(--live-line);display:grid;grid-template-columns:36px 1fr auto;align-items:center;gap:12px}.live-notification-list article:last-child{border-bottom:0}.live-notification-list article.unread{background:#f1f6f3}.live-notification-list article>span{width:34px;height:34px;border-radius:50%;background:#e6eee9;color:var(--live-green);display:grid;place-items:center}.live-notification-list article>button:not(.live-dismiss){border:0;background:transparent;text-align:left;display:flex;flex-direction:column;gap:4px;cursor:pointer}.live-notification-list b{font-size:12px}.live-notification-list p{margin:0;color:var(--live-muted);font-size:10px}.live-notification-list small{font-size:8px;color:var(--live-muted)}.live-dismiss{border:1px solid var(--live-line);background:#fff;border-radius:7px;padding:6px 8px;color:var(--live-muted);font-size:9px;cursor:pointer}.live-sidebar nav{scrollbar-width:none}.live-sidebar nav::-webkit-scrollbar{display:none}
    *{box-sizing:border-box}.live-shell{min-height:100vh;background:var(--live-paper);color:var(--live-ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;display:grid;grid-template-columns:268px 1fr}.live-sidebar{background:#173b2e;color:#e9f0ec;padding:24px 16px 18px;display:flex;flex-direction:column;gap:18px;min-height:100vh;position:sticky;top:0;height:100vh}.live-brand{display:flex;align-items:center;gap:11px;padding:0 8px}.live-brand>span,.live-login-brand>span{width:40px;height:40px;border-radius:11px;display:grid;place-items:center;background:#d9b779;color:#173b2e}.live-brand svg{font-size:22px}.live-brand div,.live-login-brand div{display:flex;flex-direction:column}.live-brand b{font-size:18px}.live-brand small{font-size:10px;color:#aabdb4;letter-spacing:.08em}.live-tenant{display:flex;align-items:center;gap:10px;padding:11px 12px;background:#214a3a;border:1px solid #315b4b;border-radius:11px}.live-tenant>svg{font-size:20px}.live-tenant span{display:flex;flex-direction:column;min-width:0;flex:1}.live-tenant small{font-size:9px;color:#9eb2a8;letter-spacing:.1em}.live-tenant b,.live-tenant select{font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.live-tenant select{appearance:none;background:transparent;border:0;outline:0;width:100%}.live-tenant option{color:#18231e}.live-tenant.selectable{cursor:pointer}.live-sidebar nav{display:flex;flex-direction:column;gap:4px;overflow:auto;padding-right:2px}.live-sidebar nav button{border:0;background:transparent;color:#b9cac1;min-height:42px;border-radius:9px;padding:0 12px;display:flex;align-items:center;gap:11px;font:inherit;font-size:13px;cursor:pointer;text-align:left}.live-sidebar nav button svg{font-size:19px;flex:none}.live-sidebar nav button:hover{background:#204939;color:#fff}.live-sidebar nav button.active{background:#e8efe9;color:#173b2e;font-weight:700}.live-user{display:flex;align-items:center;gap:9px;margin-top:auto;padding:12px 8px 0;border-top:1px solid #315344}.live-user>svg{font-size:31px;color:#d9b779}.live-user span{display:flex;flex-direction:column;min-width:0;flex:1}.live-user b{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.live-user small{font-size:10px;color:#9eb2a8}.live-user button{border:0;background:transparent;color:#c6d3cc;font-size:18px;cursor:pointer}.live-main{min-width:0}.live-topbar{height:76px;background:#fff;border-bottom:1px solid var(--live-line);display:flex;align-items:center;justify-content:space-between;padding:0 32px;position:sticky;top:0;z-index:5}.live-topbar small{font-size:10px;color:var(--live-muted);letter-spacing:.08em}.live-topbar h1{font-size:20px;margin:2px 0 0}.live-top-actions{display:flex;align-items:center;gap:10px}.live-connection{display:flex;align-items:center;gap:7px;border:1px solid var(--live-line);background:#fafafa;border-radius:18px;padding:7px 11px;font-size:11px}.live-connection i{width:7px;height:7px;background:#3a9b70;border-radius:50%;box-shadow:0 0 0 3px #dcefe6}.live-content{padding:28px 32px 48px;max-width:1500px;margin:0 auto}.live-panel{background:#fff;border:1px solid var(--live-line);border-radius:14px;box-shadow:0 2px 10px rgba(25,46,37,.04);overflow:hidden}.live-panel>header{padding:22px 24px;border-bottom:1px solid #e8e9e6}.live-toolbar{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}.live-toolbar small,.live-panel>header small{font-size:9px;color:var(--live-green-2);font-weight:800;letter-spacing:.12em}.live-toolbar h2,.live-panel h3{font-size:22px;margin:5px 0 3px}.live-toolbar p{font-size:12px;color:var(--live-muted);margin:0}.live-button{border:1px solid transparent;border-radius:9px;padding:10px 14px;min-height:40px;display:inline-flex;align-items:center;justify-content:center;gap:7px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}.live-button.primary{background:var(--live-green);color:#fff}.live-button.secondary{background:#fff;color:var(--live-ink);border-color:var(--live-line)}.live-button:disabled{opacity:.55;cursor:not-allowed}.live-search{height:54px;border-bottom:1px solid #e8e9e6;display:flex;align-items:center;padding:0 24px;gap:9px;color:var(--live-muted)}.live-search input{flex:1;border:0;outline:0;font:inherit;font-size:12px}.live-search button{background:#eef2ef;color:var(--live-green);border:0;border-radius:7px;padding:7px 13px;font-weight:700;cursor:pointer}.live-table-wrap{overflow:auto}.live-table{border-collapse:collapse;width:100%;min-width:820px}.live-table th{padding:12px 16px;text-align:left;background:#fafaf8;color:#78817c;font-size:9px;letter-spacing:.07em;text-transform:uppercase;border-bottom:1px solid var(--live-line)}.live-table td{padding:14px 16px;border-bottom:1px solid #efefec;font-size:12px;vertical-align:middle}.live-table tbody tr:hover{background:#fbfcfa}.live-table tbody tr:last-child td{border-bottom:0}.live-table-footer{display:flex;justify-content:space-between;padding:12px 18px;background:#fafaf8;border-top:1px solid var(--live-line);color:var(--live-muted);font-size:11px}.live-status{display:inline-flex;border-radius:20px;padding:5px 8px;font-size:10px;font-weight:700;white-space:nowrap}.live-status.neutral{color:#50625a;background:#edf0ee}.live-status.success{color:var(--live-success);background:#e4f3eb}.live-status.warning{color:var(--live-warning);background:#f7efda}.live-status.danger{color:var(--live-danger);background:#f8e8e6}.live-icon-button{width:34px;height:34px;border:1px solid var(--live-line);border-radius:8px;background:#fff;color:var(--live-green);display:grid;place-items:center;cursor:pointer}.live-state{min-height:330px;padding:50px 24px;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;color:var(--live-muted);gap:8px}.live-state b{color:var(--live-ink);font-size:15px}.live-state small{max-width:430px}.live-state button{margin-top:8px;border:0;border-radius:8px;background:var(--live-green);color:#fff;padding:9px 13px;display:flex;align-items:center;gap:6px;cursor:pointer}.live-state-error svg{color:var(--live-danger)}.live-compact-empty{padding:30px;color:var(--live-muted);font-size:12px}.live-spinner{width:25px;height:25px;border:2px solid #d7ded9;border-top-color:var(--live-green);border-radius:50%;animation:live-spin .7s linear infinite}.live-spinner.small{width:15px;height:15px;border-color:#ffffff66;border-top-color:#fff}@keyframes live-spin{to{transform:rotate(360deg)}}.live-hero{border-radius:15px;background:#1d4938;color:#fff;padding:28px 30px;display:flex;align-items:flex-end;justify-content:space-between;min-height:155px}.live-hero small{color:#a9c6b8;font-size:9px;font-weight:800;letter-spacing:.13em}.live-hero h2{font-size:28px;margin:8px 0 5px}.live-hero p{margin:0;color:#c0d4ca;font-size:12px}.live-hero>span{border:1px solid #4a705f;border-radius:22px;padding:8px 13px;font-size:11px}.live-metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:16px 0}.live-metric-grid article,.live-metric-grid button{min-height:105px;background:#fff;border:1px solid var(--live-line);border-radius:12px;padding:17px;text-align:left;display:flex;flex-direction:column;align-items:flex-start;justify-content:center}.live-metric-grid article small{font-size:10px;color:var(--live-muted);text-transform:uppercase;letter-spacing:.05em}.live-metric-grid article strong{font-size:24px;margin-top:7px}.live-metric-grid article span{font-size:10px;color:var(--live-success);margin-top:4px}.live-metric-grid button{cursor:pointer;flex-direction:row;align-items:center;gap:13px;color:var(--live-ink)}.live-metric-grid button>svg{font-size:25px;color:var(--live-green)}.live-metric-grid button span{display:flex;flex-direction:column}.live-metric-grid button small{color:var(--live-muted);margin-top:4px}.live-activity-list article{display:grid;grid-template-columns:10px 1fr auto;align-items:center;gap:12px;padding:13px 24px;border-bottom:1px solid #efefec}.live-activity-dot{width:8px;height:8px;background:#d9b779;border-radius:50%}.live-activity-list article div{display:flex;flex-direction:column}.live-activity-list b{font-size:12px}.live-activity-list small,.live-activity-list time{font-size:10px;color:var(--live-muted)}.live-modal-backdrop{position:fixed;inset:0;background:rgba(13,25,20,.58);z-index:50;display:grid;place-items:center;padding:20px}.live-modal{width:min(800px,100%);max-height:calc(100vh - 40px);overflow:auto;background:#fff;border-radius:15px;box-shadow:0 25px 80px rgba(0,0,0,.25)}.live-modal>header{display:flex;justify-content:space-between;align-items:flex-start;padding:22px 24px;border-bottom:1px solid var(--live-line);position:sticky;top:0;background:#fff;z-index:2}.live-modal header small{font-size:9px;color:var(--live-green-2);font-weight:800;letter-spacing:.1em}.live-modal h2{margin:5px 0 0;font-size:21px}.live-modal form{padding:23px 24px}.live-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:17px}.live-form-grid label{display:flex;flex-direction:column;gap:7px}.live-form-grid label.wide{grid-column:1/-1}.live-form-grid label>span{font-size:11px;font-weight:700;color:#46524c}.live-form-grid em{font-style:normal;color:#b74640;margin-left:3px}.live-form-grid input,.live-form-grid select,.live-form-grid textarea,.live-login input{width:100%;border:1px solid #ced3cf;border-radius:8px;background:#fff;padding:10px 11px;font:inherit;font-size:12px;outline:0}.live-form-grid textarea{resize:vertical}.live-form-grid input:focus,.live-form-grid select:focus,.live-form-grid textarea:focus,.live-login input:focus{border-color:var(--live-green-2);box-shadow:0 0 0 3px #dcece4}.live-field-error{color:var(--live-danger);font-size:10px}.live-form-alert{background:#f9e8e6;color:var(--live-danger);border:1px solid #eecbc7;border-radius:8px;padding:10px 12px;display:flex;gap:7px;align-items:center;font-size:11px}.live-modal footer{display:flex;justify-content:flex-end;gap:9px;padding-top:23px;margin-top:23px;border-top:1px solid var(--live-line)}.live-offline{position:fixed;z-index:100;left:50%;top:12px;transform:translateX(-50%);background:#7e4c18;color:#fff;padding:9px 14px;border-radius:9px;box-shadow:0 6px 20px #0002;display:flex;align-items:center;gap:7px;font-size:11px}.live-full-state{min-height:100vh;background:var(--live-paper);display:grid;place-items:center}.live-login{min-height:100vh;display:grid;grid-template-columns:1.1fr .9fr;background:#f6f5f1;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--live-ink)}.live-login>section{background:#173b2e;color:#fff;padding:52px;display:flex;flex-direction:column;justify-content:space-between}.live-login-brand{display:flex;align-items:center;gap:11px}.live-login-brand>span{display:grid;place-items:center}.live-login-brand small{color:#abc0b6}.live-login>section>div:last-child{max-width:570px}.live-login>section h1{font-size:45px;line-height:1.08;margin:12px 0}.live-login>section p{color:#bfd0c7;line-height:1.7}.live-login>form{width:min(430px,calc(100% - 48px));margin:auto;background:#fff;padding:35px;border:1px solid var(--live-line);border-radius:15px;display:flex;flex-direction:column;gap:18px;box-shadow:0 15px 45px #1935290d}.live-login form header small{font-size:9px;color:var(--live-green);font-weight:800;letter-spacing:.12em}.live-login form h2{margin:7px 0 4px}.live-login form label{display:flex;flex-direction:column;gap:7px}.live-login form label>span{font-size:11px;font-weight:700}.live-login form label small{font-weight:400;color:var(--live-muted)}
    .live-nav-group{display:flex;flex-direction:column;gap:3px}.live-nav-group>small{padding:9px 12px 4px;color:#769287;font-size:8px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.live-row-actions{display:flex;align-items:center;gap:6px;white-space:nowrap}.live-workflow-button{border:1px solid #cbd6d0;background:#edf4f0;color:var(--live-green);border-radius:7px;padding:6px 8px;font-size:9px;font-weight:800;cursor:pointer}.live-workflow-button.success{background:#e5f2ea;color:var(--live-success)}.live-workflow-button.danger{background:#f8e8e6;border-color:#ebcbc7;color:var(--live-danger)}.live-permission-body{padding:22px 24px}.live-permission-body>p{margin:0 0 16px;color:var(--live-muted);font-size:12px}.live-permission-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.live-permission-grid label{display:flex;gap:9px;align-items:flex-start;border:1px solid var(--live-line);border-radius:9px;padding:10px;cursor:pointer}.live-permission-grid input{margin-top:3px}.live-permission-grid span{display:flex;flex-direction:column}.live-permission-grid b{font-size:11px}.live-permission-grid small{font-size:9px;color:var(--live-muted)}.live-permission-body footer{display:flex;justify-content:flex-end;gap:9px;padding-top:20px}.live-modal.compact{width:min(590px,100%)}.live-confirm-body{padding:22px 24px}.live-confirm-body>p{margin:0 0 15px;color:var(--live-muted);font-size:12px;line-height:1.6}.live-record-reference{display:flex;flex-direction:column;background:#f3f5f2;border:1px solid var(--live-line);border-radius:9px;padding:11px 12px;margin-bottom:16px}.live-record-reference b{font-size:12px}.live-record-reference small{color:var(--live-muted);font-size:10px;margin-top:2px}.live-confirm-body>label{display:flex;flex-direction:column;gap:7px;margin-top:13px}.live-confirm-body>label>span{font-size:11px;font-weight:700}.live-confirm-body select,.live-confirm-body textarea{border:1px solid #ced3cf;border-radius:8px;padding:10px;font:inherit;font-size:12px}.live-confirm-body footer{display:flex;justify-content:flex-end;gap:9px;margin-top:20px;padding-top:18px;border-top:1px solid var(--live-line)}
    .live-icon-button.danger{color:var(--live-danger);border-color:#ebcbc7}.live-button.danger-action{background:var(--live-danger);color:#fff}.live-detail-grid{padding:22px 24px;display:grid;grid-template-columns:1fr 1fr;gap:10px}.live-detail-grid>div{border:1px solid var(--live-line);border-radius:9px;padding:11px 12px;display:flex;flex-direction:column;gap:5px;min-width:0}.live-detail-grid>div.wide{grid-column:1/-1}.live-detail-grid small{font-size:9px;color:var(--live-muted);text-transform:uppercase;letter-spacing:.05em}.live-detail-grid b{font-size:12px;font-weight:600;white-space:pre-wrap;overflow-wrap:anywhere}.live-breakable{word-break:break-all}.live-filter-tabs{display:flex;gap:5px;padding:10px 24px 0;background:#fff}.live-filter-tabs button{border:1px solid var(--live-line);background:#fff;color:var(--live-muted);padding:7px 10px;border-radius:8px;font-size:10px;font-weight:700;cursor:pointer}.live-filter-tabs button.active{background:#e8efe9;border-color:#b8cbc0;color:var(--live-green)}.live-secret{margin:16px 22px 0;padding:14px;border:1px solid #dfc181;background:#fff8e7;border-radius:10px;display:flex;align-items:center;gap:10px}.live-secret>div{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}.live-secret b{font-size:11px}.live-secret code{font-size:11px;word-break:break-all;color:#694d17}.live-secret small{font-size:9px;color:#80652f}
    .live-hero>button{border:1px solid #668777;background:#fff;color:var(--live-green);border-radius:9px;padding:10px 14px;font:inherit;font-size:11px;font-weight:800;cursor:pointer}.live-pipeline-panel{margin:18px 0}.live-pipeline-panel>header{display:flex;justify-content:space-between;align-items:center}.live-dashboard-pipeline{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(120px,1fr);overflow-x:auto}.live-dashboard-pipeline>button{min-height:105px;border:0;border-right:1px solid var(--live-line);background:#fff;color:var(--live-ink);padding:16px;text-align:left;cursor:pointer}.live-dashboard-pipeline>button:last-child{border-right:0}.live-dashboard-pipeline>button:hover{background:#f3f7f4}.live-dashboard-pipeline span{display:block;color:var(--live-green);font-size:24px;font-weight:800}.live-dashboard-pipeline b{display:block;margin-top:7px;font-size:11px}.live-dashboard-pipeline small{color:var(--live-muted);font-size:9px}.live-attention-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0 0 18px}.live-attention-grid>button{min-height:78px;border:1px solid var(--live-line);background:#fff;border-radius:11px;padding:14px;display:flex;align-items:center;gap:12px;text-align:left;color:var(--live-green);cursor:pointer}.live-attention-grid>button.danger{color:var(--live-danger);border-color:#e4c3bf}.live-attention-grid svg{font-size:23px}.live-attention-grid span{display:flex;flex-direction:column}.live-attention-grid small{font-size:8px;color:var(--live-muted);font-weight:800;letter-spacing:.07em}.live-attention-grid strong{font-size:21px;color:var(--live-ink);margin-top:2px}
    .live-file-detail{width:min(1100px,100%)}.live-file-detail>header p{margin:5px 0 0;color:var(--live-muted);font-size:10px}.live-file-detail-body{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(280px,.6fr);min-height:520px}.live-file-preview{min-height:520px;background:#18231f;display:grid;place-items:center;overflow:hidden}.live-file-preview img{width:100%;height:100%;max-height:70vh;object-fit:contain}.live-file-preview iframe{width:100%;height:100%;min-height:520px;border:0;background:#fff}.live-file-preview>div{display:flex;flex-direction:column;align-items:center;gap:8px;color:#fff;text-align:center}.live-file-preview>div svg{font-size:46px}.live-file-preview>div small{color:#b9c8c0}.live-file-detail aside{padding:24px;display:flex;flex-direction:column}.live-file-detail aside>small{font-size:8px;color:var(--live-green);font-weight:800;letter-spacing:.1em}.live-file-detail aside h3{font-size:14px;line-height:1.5;margin:8px 0 18px}.live-file-detail dl{margin:0}.live-file-detail dl>div{padding:10px 0;border-bottom:1px solid var(--live-line)}.live-file-detail dt{font-size:8px;color:var(--live-muted);font-weight:800}.live-file-detail dd{margin:4px 0 0;font-size:10px;word-break:break-word}.live-file-detail aside>a{margin-top:auto;text-decoration:none;text-align:center}
    .live-project-center{width:min(1180px,100%)}.live-project-center>header p{margin:5px 0 0;color:var(--live-muted);font-size:11px}.live-project-center-body{padding:22px;background:#f7f7f4}.live-project-stage-rail{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(130px,1fr);overflow-x:auto;border:1px solid var(--live-line);background:#fff}.live-project-stage-rail>div{min-height:86px;padding:13px;display:flex;align-items:center;gap:9px;border-right:1px solid var(--live-line)}.live-project-stage-rail>div:last-child{border-right:0}.live-project-stage-rail i{width:27px;height:27px;border-radius:50%;display:grid;place-items:center;flex:none;background:#edf0ee;color:#7c8781;font-size:10px;font-style:normal;font-weight:800}.live-project-stage-rail .complete i{background:var(--live-green);color:#fff}.live-project-stage-rail .current{background:#eef4f0;box-shadow:inset 0 -3px var(--live-green)}.live-project-stage-rail .current i{background:#d9b779;color:#173b2e}.live-project-stage-rail span{display:flex;flex-direction:column;gap:4px}.live-project-stage-rail b{font-size:10px}.live-project-stage-rail small{font-size:8px;color:var(--live-muted)}.live-project-summary{display:grid;grid-template-columns:1.25fr repeat(3,1fr);gap:10px;margin:14px 0}.live-project-summary>article{min-height:130px;background:#fff;border:1px solid var(--live-line);border-radius:11px;padding:16px;display:flex;flex-direction:column;align-items:flex-start}.live-project-summary small{font-size:8px;color:var(--live-muted);font-weight:800;letter-spacing:.08em}.live-project-summary strong{font-size:24px;margin:8px 0 4px}.live-project-summary p{margin:0;color:var(--live-muted);font-size:9px}.live-project-summary button{margin-top:auto;border:0;background:transparent;color:var(--live-green);font-size:9px;font-weight:800;padding:7px 0 0;cursor:pointer}.live-project-summary .readiness>span{width:100%;height:7px;background:#e7ebe8;border-radius:8px;overflow:hidden;margin:5px 0 7px}.live-project-summary .readiness>span i{height:100%;display:block;background:var(--live-green)}.live-project-columns{display:grid;grid-template-columns:1.15fr .85fr;gap:12px}.live-project-columns>section,.live-project-operational{background:#fff;border:1px solid var(--live-line);border-radius:11px;overflow:hidden}.live-project-columns section>header,.live-project-operational>header{padding:15px 16px;border-bottom:1px solid var(--live-line)}.live-project-columns header small,.live-project-operational header small{font-size:8px;color:var(--live-green);font-weight:800;letter-spacing:.09em}.live-project-columns h3,.live-project-operational h3{font-size:15px;margin:4px 0 0}.live-next-actions article{min-height:64px;display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:10px;padding:11px 15px;border-bottom:1px solid #eceeeb}.live-next-actions article:last-child{border-bottom:0}.live-next-actions article>span{width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:#edf3ef;color:var(--live-green);font-size:9px;font-weight:800}.live-next-actions article.high>span{background:#f8e8e6;color:var(--live-danger)}.live-next-actions article div{display:flex;flex-direction:column;gap:3px}.live-next-actions b{font-size:10px}.live-next-actions small{font-size:8px;color:var(--live-muted)}.live-next-actions button{border:1px solid var(--live-line);background:#fff;border-radius:7px;padding:6px 8px;color:var(--live-green);font-size:8px;font-weight:800;cursor:pointer}.live-gate-list>button{width:100%;min-height:64px;border:0;border-bottom:1px solid #eceeeb;background:#fff;display:grid;grid-template-columns:28px 1fr;align-items:center;gap:9px;padding:11px 15px;text-align:left;cursor:pointer}.live-gate-list>button:last-child{border-bottom:0}.live-gate-list>button>span{width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:#f8e8e6;color:var(--live-danger);font-weight:800}.live-gate-list>button.warning>span{background:#f7efda;color:var(--live-warning)}.live-gate-list>button div{display:flex;flex-direction:column;gap:3px}.live-gate-list b{font-size:10px}.live-gate-list small{font-size:8px;color:var(--live-muted)}.live-project-ready{min-height:96px;padding:18px;display:flex;align-items:center;gap:11px;color:var(--live-success)}.live-project-ready>svg{font-size:26px}.live-project-ready span{display:flex;flex-direction:column;gap:4px}.live-project-ready b{font-size:11px}.live-project-ready small{font-size:8px;color:var(--live-muted)}.live-project-operational{margin-top:12px}.live-project-operational>div{display:grid;grid-template-columns:repeat(6,minmax(100px,1fr));overflow-x:auto}.live-project-operational button{min-height:80px;border:0;border-right:1px solid var(--live-line);background:#fff;display:flex;flex-direction:column;justify-content:center;text-align:left;padding:13px;cursor:pointer}.live-project-operational button:last-child{border-right:0}.live-project-operational strong{font-size:17px;color:var(--live-green)}.live-project-operational span{font-size:8px;color:var(--live-muted);margin-top:4px}.live-gate-blockers{display:flex;flex-direction:column;gap:6px;margin-top:13px;padding:12px;background:#fff4f2;border:1px solid #ebcbc7;border-radius:8px}.live-gate-blockers>b{font-size:10px;color:var(--live-danger)}.live-gate-blockers>span{display:flex;align-items:center;gap:6px;font-size:9px;color:#73423e}
    .live-view-switcher{display:flex;align-items:center;gap:3px;padding:3px;background:#f2f4f2;border:1px solid var(--live-line);border-radius:9px;margin-left:8px}.live-search .live-view-switcher button{min-height:30px;padding:5px 9px;border:0;background:transparent;color:var(--live-muted);display:flex;align-items:center;gap:5px;font-size:9px}.live-search .live-view-switcher button svg{font-size:15px}.live-search .live-view-switcher button.active{background:#fff;color:var(--live-green);box-shadow:0 1px 4px #1d352a18}.live-kanban{display:grid;grid-auto-flow:column;grid-auto-columns:260px;gap:12px;padding:16px;overflow-x:auto;background:#f7f7f4;min-height:430px;align-items:start}.live-kanban-column{border:1px solid var(--live-line);border-radius:11px;background:#eef1ee;overflow:hidden}.live-kanban-column>header{min-height:48px;padding:9px 11px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--live-line)}.live-kanban-column>header>b{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#fff;color:var(--live-muted);font-size:9px}.live-kanban-column>div{padding:8px;display:flex;flex-direction:column;gap:8px}.live-kanban-card{background:#fff;border:1px solid #dfe2df;border-radius:9px;box-shadow:0 1px 4px #18231e0d;overflow:hidden}.live-kanban-card-main{width:100%;padding:12px;border:0;background:#fff;text-align:left;display:flex;flex-direction:column;align-items:flex-start;gap:6px;cursor:pointer;color:var(--live-ink)}.live-kanban-card-main:hover{background:#fbfcfa}.live-kanban-card-main>b{font-size:11px;line-height:1.4}.live-kanban-card-main>small{font-size:9px;color:var(--live-muted)}.live-kanban-card-main>span{width:100%;display:flex;align-items:center;justify-content:space-between;gap:7px;margin-top:4px}.live-kanban-card-main time{font-size:8px;color:var(--live-muted);white-space:nowrap}.live-kanban-card>footer{padding:8px;border-top:1px solid #eceeeb;display:flex;align-items:center;gap:5px;flex-wrap:wrap}.live-kanban-card>footer .live-icon-button{width:28px;height:28px;margin-left:auto}.live-kanban-empty{display:block;padding:18px 8px;text-align:center;color:var(--live-muted);font-size:9px}.live-calendar>header{min-height:62px;padding:11px 16px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-bottom:1px solid var(--live-line)}.live-calendar>header>div{display:flex;align-items:center;gap:6px}.live-calendar>header .live-button{min-height:34px;padding:7px 10px;font-size:10px}.live-calendar>header h3{font-size:16px;margin:0;text-transform:capitalize;text-align:center}.live-calendar>header>small{text-align:right;color:var(--live-muted);font-size:9px}.live-calendar-scroll{overflow-x:auto}.live-calendar-grid{min-width:840px}.live-calendar-weekdays,.live-calendar-days{display:grid;grid-template-columns:repeat(7,minmax(120px,1fr))}.live-calendar-weekdays b{padding:9px 10px;background:#fafaf8;border-right:1px solid var(--live-line);border-bottom:1px solid var(--live-line);color:var(--live-muted);font-size:9px;text-align:center}.live-calendar-days>div{min-height:124px;padding:7px;border-right:1px solid var(--live-line);border-bottom:1px solid var(--live-line);background:#fff}.live-calendar-days>div:nth-child(7n){border-right:0}.live-calendar-days>div.outside{background:#fafaf8;color:#aeb5b1}.live-calendar-days>div>time{width:23px;height:23px;display:grid;place-items:center;margin-bottom:5px;font-size:9px;font-weight:700}.live-calendar-days>div.today>time{border-radius:50%;background:var(--live-green);color:#fff}.live-calendar-days>div>div{display:flex;flex-direction:column;gap:4px}.live-calendar-days>div button{border:1px solid #d9e2dc;border-left:3px solid var(--live-green-2);border-radius:5px;background:#f1f6f3;padding:5px 6px;text-align:left;display:flex;flex-direction:column;gap:2px;cursor:pointer;min-width:0}.live-calendar-days>div button b{font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.live-calendar-days>div button small{font-size:7px;color:var(--live-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.live-calendar-days>div span{font-size:8px;color:var(--live-green);font-weight:700;padding:2px 4px}.live-view-empty{min-height:330px;padding:45px 20px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:7px;color:var(--live-muted);text-align:center}.live-view-empty svg{font-size:35px;color:var(--live-green)}.live-view-empty b{font-size:13px;color:var(--live-ink)}.live-view-empty small{font-size:10px}
    .live-queue-button{height:35px;border:1px solid var(--live-line);border-radius:18px;background:#fff;color:var(--live-green);padding:0 10px;display:flex;align-items:center;gap:6px;font:inherit;font-size:9px;font-weight:800;cursor:pointer}.live-queue-button svg{font-size:17px}.live-queue-button>b{min-width:18px;height:18px;border-radius:9px;background:var(--live-green);color:#fff;display:grid;place-items:center;font-size:8px}.live-queue-button.pending{border-color:#cfb26e;background:#fff9ea;color:#79591d}.live-queue-button.pending>b{background:#946d22}.live-queue-button.danger{border-color:#e1b4af;background:#fff2f0;color:var(--live-danger)}.live-queue-button.danger>b{background:var(--live-danger)}.live-queue-modal>header p{max-width:470px;margin:5px 0 0;color:var(--live-muted);font-size:10px;line-height:1.5}.live-queue-modal>.live-form-alert{margin:14px}.live-queue-list{max-height:52vh;overflow:auto}.live-queue-list>article{min-height:76px;padding:12px 16px;border-bottom:1px solid var(--live-line);display:grid;grid-template-columns:34px 1fr auto;align-items:center;gap:10px}.live-queue-list>article:last-child{border-bottom:0}.live-queue-state{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:#f7efda;color:var(--live-warning)}.live-queue-state.syncing{background:#e4f3eb;color:var(--live-success)}.live-queue-state.failed{background:#f8e8e6;color:var(--live-danger)}.live-queue-list article>div:nth-child(2){display:flex;flex-direction:column;gap:4px;min-width:0}.live-queue-list article>div:nth-child(2)>b{font-size:10px}.live-queue-list article>div:nth-child(2)>small{font-size:8px;color:var(--live-muted)}.live-queue-list article>div:nth-child(2)>em{font-size:8px;color:var(--live-danger);font-style:normal}.live-queue-list article>div:last-child{display:flex;align-items:center;gap:5px}.live-queue-modal>footer{margin:0;padding:13px 16px;border-top:1px solid var(--live-line);display:flex;align-items:center;justify-content:space-between;gap:12px}.live-queue-modal>footer>small{max-width:330px;color:var(--live-muted);font-size:8px;line-height:1.5}.live-queue-modal .live-view-empty{min-height:230px}.live-offline-chip{display:inline-flex;align-items:center;gap:4px;padding:5px 7px;border-radius:12px;background:#fff4d9;color:#7b5a19;font-size:8px;font-weight:800;font-style:normal;white-space:nowrap}.live-offline-chip svg{font-size:12px}.live-table tr.offline-queued{background:#fffdf6}.live-kanban-card.offline-queued{border-color:#d9bf80}
    .live-field-mode{display:flex;flex-direction:column;gap:14px}.live-field-mode>header{min-height:130px;border-radius:14px;background:#1d4938;color:#fff;padding:24px 26px;display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.live-field-mode>header small{font-size:9px;color:#a9c6b8;font-weight:800;letter-spacing:.13em}.live-field-mode>header h2{font-size:25px;margin:6px 0 4px}.live-field-mode>header p{margin:0;color:#c0d4ca;font-size:11px}.live-field-mode>header>span{border:1px solid #537665;border-radius:18px;padding:7px 10px;display:flex;align-items:center;gap:6px;font-size:9px;white-space:nowrap}.live-field-mode>header>span i{width:7px;height:7px;border-radius:50%;background:#5fd19c}.live-field-mode>header>span.offline i{background:#e8b75a}.live-field-project{background:#fff;border:1px solid var(--live-line);border-radius:12px;padding:13px 15px;display:grid;grid-template-columns:minmax(150px,.5fr) minmax(220px,1fr) auto;align-items:center;gap:12px}.live-field-project>span{display:flex;flex-direction:column;gap:3px}.live-field-project b{font-size:11px}.live-field-project small{font-size:8px;color:var(--live-muted)}.live-field-project input{height:40px;border:1px solid #ced3cf;border-radius:8px;padding:0 11px;font:inherit;font-size:11px}.live-field-project>em{font-size:9px;font-style:normal;color:var(--live-green);font-weight:700}.live-field-note{border:1px solid #c8ded1;background:#edf6f1;color:var(--live-success);border-radius:9px;padding:10px 12px;display:flex;align-items:center;gap:7px;font-size:10px}.live-field-note.warning{border-color:#e5d3a7;background:#fff8e8;color:#7b5a19}.live-field-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}.live-field-actions>button{min-height:132px;border:1px solid var(--live-line);border-radius:12px;background:#fff;padding:16px;display:flex;align-items:flex-start;gap:13px;text-align:left;color:var(--live-ink);cursor:pointer}.live-field-actions>button:hover{border-color:#aebfb5;background:#fbfcfa}.live-field-actions>button:disabled{opacity:.55;cursor:not-allowed}.live-field-actions>button>span{width:42px;height:42px;border-radius:10px;background:#e8efe9;color:var(--live-green);display:grid;place-items:center;flex:none}.live-field-actions>button:first-child>span{background:#e5c990;color:#173b2e}.live-field-actions>button>span svg{font-size:22px}.live-field-actions>button>div{display:flex;flex-direction:column;min-width:0}.live-field-actions b{font-size:13px;margin-top:2px}.live-field-actions small{font-size:9px;color:var(--live-muted);line-height:1.5;margin-top:5px}.live-field-actions em{font-size:8px;font-style:normal;color:var(--live-green);font-weight:800;margin-top:12px}.live-field-links{background:#fff;border:1px solid var(--live-line);border-radius:12px;overflow:hidden}.live-field-links>header{padding:14px 16px;border-bottom:1px solid var(--live-line);display:flex;align-items:center;justify-content:space-between}.live-field-links header small{font-size:8px;color:var(--live-green);font-weight:800;letter-spacing:.1em}.live-field-links h3{font-size:15px;margin:4px 0 0}.live-field-links header>b{font-size:9px;color:var(--live-warning);background:#fff5dc;border-radius:14px;padding:6px 9px}.live-field-links>div{display:grid;grid-template-columns:repeat(4,1fr)}.live-field-links>div>button{min-height:62px;border:0;border-right:1px solid var(--live-line);background:#fff;padding:0 14px;display:flex;align-items:center;gap:8px;color:var(--live-green);cursor:pointer}.live-field-links>div>button:last-child{border-right:0}.live-field-links>div>button span{color:var(--live-ink);font-size:10px;font-weight:700;flex:1;text-align:left}.live-quick-photo>header p{margin:5px 0 0;color:var(--live-muted);font-size:10px}.live-camera-picker{position:relative;min-height:255px;border:2px dashed #9fb8aa;border-radius:12px;background:#eff5f1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:7px;color:var(--live-green);cursor:pointer;overflow:hidden;margin-bottom:18px}.live-camera-picker>svg{font-size:46px}.live-camera-picker>b{font-size:14px}.live-camera-picker>small{font-size:9px;color:var(--live-muted)}.live-camera-picker>input{position:absolute;inset:0;opacity:0;cursor:pointer}.live-camera-picker.has-preview{border-style:solid;background:#17251f}.live-camera-picker>img{width:100%;height:255px;object-fit:contain}.live-quick-photo .live-form-alert{margin-bottom:16px}
    @media(max-width:1050px){.live-shell{grid-template-columns:76px 1fr}.live-sidebar{padding-inline:10px}.live-brand div,.live-tenant span,.live-tenant>svg+span,.live-sidebar nav button span,.live-user span,.live-user>button,.live-nav-group>small{display:none}.live-brand{padding:0;justify-content:center}.live-tenant{justify-content:center;padding:10px}.live-sidebar nav button{justify-content:center;padding:0}.live-user{justify-content:center;padding-inline:0}.live-metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.live-project-summary{grid-template-columns:1fr 1fr}.live-project-columns{grid-template-columns:1fr}.live-attention-grid{grid-template-columns:1fr 1fr}.live-field-links>div{grid-template-columns:1fr 1fr}.live-field-links>div>button:nth-child(2){border-right:0}.live-field-links>div>button{border-bottom:1px solid var(--live-line)}}
    @media(max-width:720px){.live-shell{display:block;padding-bottom:70px}.live-sidebar{position:fixed;z-index:20;bottom:0;top:auto;left:0;right:0;width:100%;height:65px;min-height:0;padding:7px 10px;background:#173b2e}.live-brand,.live-tenant,.live-user{display:none}.live-sidebar nav{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(60px,1fr);overflow-x:auto;gap:2px}.live-nav-group{display:contents}.live-sidebar nav button{height:50px;min-width:60px;flex-direction:column;gap:2px;padding:4px;font-size:8px}.live-sidebar nav button svg{font-size:18px}.live-sidebar nav button span{display:block}.live-topbar{height:65px;padding:0 16px}.live-topbar h1{font-size:17px}.live-top-actions .secondary{display:none}.live-content{padding:16px}.live-toolbar{flex-direction:column}.live-toolbar .live-button{width:100%}.live-search{padding:0 15px}.live-hero{padding:22px;min-height:165px;align-items:flex-start;flex-direction:column}.live-hero h2{font-size:22px}.live-hero>span{display:none}.live-hero>button{margin-top:18px}.live-metric-grid{grid-template-columns:1fr 1fr;gap:9px}.live-metric-grid article,.live-metric-grid button{min-height:94px;padding:13px}.live-metric-grid article strong{font-size:19px}.live-attention-grid{grid-template-columns:1fr 1fr;gap:8px}.live-attention-grid>button{min-height:72px;padding:11px}.live-project-center-body{padding:12px}.live-project-summary{grid-template-columns:1fr 1fr}.live-project-summary>article{min-height:120px;padding:13px}.live-project-operational>div{grid-template-columns:repeat(6,125px)}.live-file-detail-body{grid-template-columns:1fr}.live-file-preview,.live-file-preview iframe{min-height:280px}.live-file-detail aside{padding:18px}.live-form-grid,.live-permission-grid,.live-detail-grid{grid-template-columns:1fr}.live-form-grid label.wide,.live-detail-grid>div.wide{grid-column:auto}.live-modal-backdrop{padding:0}.live-modal{height:100vh;max-height:none;border-radius:0}.live-modal>header{padding:18px}.live-modal form{padding:18px}.live-login{grid-template-columns:1fr}.live-login>section{min-height:230px;padding:28px}.live-login>section h1{font-size:30px}.live-login>form{margin:22px auto}}
    @media(max-width:900px){.live-global-search{width:42px;flex:none}.live-global-search>input{display:none}.live-global-search:focus-within{position:absolute;left:84px;right:120px;width:auto;background:#fff}.live-global-search:focus-within>input{display:block}}
    @media(max-width:720px){.live-global-search{display:none}.live-top-icon{width:34px;height:34px}.live-notification-list article{grid-template-columns:34px 1fr;padding:13px}.live-notification-list .live-dismiss{grid-column:2;justify-self:start}.live-notifications .live-toolbar{display:flex}}
    @media(max-width:720px){.live-search{height:auto;min-height:58px;padding:9px 15px;flex-wrap:wrap}.live-search>input{min-width:150px}.live-view-switcher{order:3;width:100%;margin:0}.live-search .live-view-switcher button{flex:1;justify-content:center;min-height:34px}.live-kanban{grid-auto-columns:min(82vw,280px);min-height:390px;padding:12px}.live-calendar>header{grid-template-columns:1fr auto}.live-calendar>header>small{display:none}.live-calendar>header h3{font-size:14px;text-align:right}.live-calendar-grid{min-width:770px}.live-calendar-days>div{min-height:112px}.live-queue-button{width:35px;padding:0;justify-content:center;position:relative}.live-queue-button>span{display:none}.live-queue-button>b{position:absolute;right:-5px;top:-5px}.live-connection{display:none}.live-queue-list>article{grid-template-columns:30px 1fr}.live-queue-list article>div:last-child{grid-column:2}.live-queue-modal>footer{align-items:stretch;flex-direction:column}.live-queue-modal>footer .live-button{width:100%}.live-field-mode>header{min-height:145px;padding:20px;align-items:flex-start;flex-direction:column}.live-field-mode>header h2{font-size:21px}.live-field-project{grid-template-columns:1fr;padding:13px}.live-field-project input{width:100%}.live-field-actions{grid-template-columns:1fr 1fr;gap:8px}.live-field-actions>button{min-height:150px;padding:13px;flex-direction:column;gap:8px}.live-field-actions>button>span{width:38px;height:38px}.live-field-actions b{font-size:12px}.live-field-actions small{font-size:8px}.live-field-actions em{margin-top:8px}.live-field-links>div{grid-template-columns:1fr}.live-field-links>div>button{border-right:0;border-bottom:1px solid var(--live-line)}.live-field-links>div>button:last-child{border-bottom:0}.live-camera-picker,.live-camera-picker>img{min-height:230px;height:230px}}
  `}</style>;
}
