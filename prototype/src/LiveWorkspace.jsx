import { useEffect, useMemo, useState } from "react";
import {
  ArrowClockwise,
  Buildings,
  CaretDown,
  ChartLineUp,
  Check,
  ClipboardText,
  CurrencyCircleDollar,
  Factory,
  FolderSimple,
  Handshake,
  House,
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

const modules = [
  { id: "dashboard", group: "Genel", title: "Ana Sayfa", icon: House, resource: "dashboard", singular: "kayıt" },
  { id: "customers", group: "Müşteri & Proje", title: "Müşteriler", icon: UsersThree, resource: "customers", singular: "müşteri" },
  { id: "projects", group: "Müşteri & Proje", title: "Projeler", icon: FolderSimple, resource: "projects", singular: "proje" },
  { id: "offers", group: "Müşteri & Proje", title: "Satış & Teklif", icon: Handshake, resource: "offers", singular: "teklif" },
  { id: "workItems", group: "Operasyon", title: "İş Kalemleri", icon: ClipboardText, resource: "workItems", singular: "iş kalemi" },
  { id: "purchases", group: "Operasyon", title: "Satın Alma", icon: ShoppingCart, resource: "purchases", singular: "talep" },
  { id: "production", group: "Operasyon", title: "Üretim", icon: Factory, resource: "production", singular: "üretim emri" },
  { id: "installations", group: "Operasyon", title: "Montaj", icon: Truck, resource: "installations", singular: "montaj planı" },
  { id: "suppliers", group: "Operasyon", title: "Tedarikçiler", icon: Truck, resource: "suppliers", singular: "tedarikçi" },
  { id: "finance", group: "Finans", title: "Proje Finansları", icon: ChartLineUp, resource: "finance", singular: "finans hareketi" },
  { id: "accounting", group: "Finans", title: "Faturalar & Ön Muhasebe", icon: Wallet, resource: "accounting", singular: "fatura" },
  { id: "hr", group: "İnsan Kaynakları", title: "Personel", icon: UsersThree, resource: "hr", singular: "personel" },
  { id: "attendance", group: "İnsan Kaynakları", title: "Puantaj", icon: Check, resource: "attendance", singular: "puantaj" },
  { id: "leaves", group: "İnsan Kaynakları", title: "İzinler", icon: FolderSimple, resource: "leaves", singular: "izin talebi" },
  { id: "payroll", group: "İnsan Kaynakları", title: "Bordro Hazırlık", icon: CurrencyCircleDollar, resource: "payroll", singular: "bordro girdisi" },
  { id: "files", group: "Yönetim", title: "Dosyalar", icon: ClipboardText, resource: "files", singular: "dosya" },
  { id: "memberships", group: "Yönetim", title: "Kullanıcılar", icon: UserCircle, resource: "memberships", singular: "kullanıcı daveti", noEdit: true },
  { id: "roles", group: "Yönetim", title: "Roller & Yetkiler", icon: Buildings, resource: "roles", singular: "rol" },
  { id: "auditLogs", group: "Yönetim", title: "Denetim Kayıtları", icon: ClipboardText, resource: "auditLogs", singular: "denetim kaydı", readOnly: true },
  { id: "backups", group: "Yönetim", title: "Yedekler", icon: ArrowClockwise, resource: "backups", singular: "yedek", ownerOnly: true },
];

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
    query: { official: false },
    columns: [["projectName", "Proje"], ["type", "Hareket"], ["category", "Kategori"], ["amount", "Tutar", "money"], ["dueDate", "Vade", "date"], ["status", "Durum", "status"]],
    fields: [
      field("transactionNo", "Hareket numarası", "text", { required: true }), field("projectId", "Proje ID", "text"),
      field("type", "Hareket tipi", "select", { required: true, options: ["Gelir", "Gider", "Hakediş", "Avans", "Maliyet tahmini"] }),
      field("category", "Kategori", "select", { options: ["Malzeme", "İşçilik", "Taşeron", "Nakliye", "Montaj", "Genel gider", "Satış"] }),
      field("amount", "Tutar", "number", { required: true }), field("currency", "Para birimi", "select", { options: ["TRY", "USD", "EUR"] }),
      field("transactionDate", "İşlem tarihi", "date"), field("dueDate", "Vade / hakediş tarihi", "date"),
      field("status", "Durum", "select", { options: ["Planlandı", "Onay bekliyor", "Onaylandı", "Tahsil edildi", "Ödendi", "Gecikti"] }),
      field("description", "Açıklama", "textarea", { wide: true }),
    ],
  },
  accounting: {
    description: "Cari, kasa/banka, fatura ve ödeme takibi; resmi kayıtlar Datasoft'ta kalır",
    query: { official: true },
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
    description: "Proje fotoğrafları, çizimler, sözleşmeler ve saha evrakları",
    columns: [["fileName", "Dosya"], ["entityType", "Bağlı Modül"], ["entityId", "Kayıt ID"], ["category", "Kategori"], ["sizeBytes", "Boyut", "bytes"], ["createdAt", "Yükleme", "date"]],
    fields: [], uploadOnly: true,
  },
  memberships: {
    description: "Firma kullanıcılarını davet edin ve rollerini belirleyin",
    columns: [["userId", "Kullanıcı ID"], ["title", "Görev"], ["roleId", "Rol ID"], ["status", "Durum", "status"]],
    fields: [field("email", "E-posta", "email", { required: true }), field("fullName", "Ad soyad", "text", { required: true }), field("phone", "Telefon", "tel"), field("roleId", "Rol ID", "text", { required: true }), field("title", "Firma içi görev")],
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
  backups: { description: "Firmaya ait verilerin günlük ve isteğe bağlı güvenli yedekleri", columns: [], fields: [] },
};

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

function workflowActions(module, row, session) {
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
  if (module.id === "workItems" && ["draft", "review", "changes_requested", undefined, null].includes(row.revisionStatus) && hasCapability(session, "work-items.revision.approve")) return [{ key: "approve-revision", label: "Revizyonu onayla", title: "Üretim revizyonunu onayla", message: "Bu revizyon üretime salınabilir hale gelecek.", tone: "success" }];
  if (module.id === "production" && ["draft", "planned", "Planlandı"].includes(status) && hasCapability(session, "production-orders.release")) return [{ key: "release", label: "Üretime sal", title: "Üretim emrini serbest bırak", message: "Güncel iş kalemi revizyonu kontrol edilerek üretim başlatılacak.", tone: "success" }];
  if (module.id === "purchases" && ["draft", "pending", "Taslak", "Onay bekliyor"].includes(status) && hasCapability(session, "purchase-requests.approve")) return [{ key: "approve", label: "Onayla", title: "Satın alma talebini onayla", message: "Talep sipariş sürecine hazır hale gelecek.", tone: "success" }];
  if (module.id === "leaves" && status === "pending" && hasCapability(session, "leaves.approve")) return [{ key: "approve", label: "Onayla", title: "İzin talebini onayla", message: "Personelin izin talebi onaylanacak.", tone: "success" }, { key: "reject", label: "Reddet", title: "İzin talebini reddet", message: "Ret nedeni personele ait karar kaydında tutulacak.", reasonRequired: true, tone: "danger" }];
  if (module.id === "finance") {
    if (["draft", "planned", "pending", "Planlandı", "Onay bekliyor"].includes(status) && hasCapability(session, "financial-transactions.approve")) return [{ key: "approve", label: "Onayla", title: "Finans hareketini onayla", message: "Onaylanan finans kaydı değiştirilemez; düzeltme ters kayıtla yapılır.", tone: "success" }];
    if (["approved", "Onaylandı"].includes(status) && hasCapability(session, "financial-transactions.reverse")) return [{ key: "reverse", label: "Ters kayıt", title: "Finans hareketini ters kaydet", message: "Orijinal hareket korunacak ve eşit tutarlı ters kayıt oluşturulacak.", reasonRequired: true, tone: "danger" }];
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
  return <span className={`live-status ${statusTone(children)}`}>{children || "—"}</span>;
}

function Table({ rows, config, canEdit, onEdit, onPermissions, getWorkflowActions, onWorkflow }) {
  const hasActions = canEdit || Boolean(onPermissions) || Boolean(getWorkflowActions);
  return <div className="live-table-wrap"><table className="live-table"><thead><tr>{config.columns.map(([, label]) => <th key={label}>{label}</th>)}{hasActions && <th aria-label="İşlem" />}</tr></thead><tbody>{rows.map((row, index) => {
    const actions = getWorkflowActions?.(row) || [];
    return <tr key={row.id || index}>{config.columns.map(([key, , type]) => <td key={key}>{type === "status" ? <Status>{recordValue(row, key)}</Status> : formatValue(recordValue(row, key), type, row)}</td>)}{hasActions && <td><div className="live-row-actions">{actions.map((action) => <button className={`live-workflow-button ${action.tone || ""}`} key={action.key} onClick={() => onWorkflow(row, action)}>{action.label}</button>)}{onPermissions && <button className="live-icon-button" onClick={() => onPermissions(row)} title="Rol yetkileri"><ClipboardText /></button>}{canEdit && <button className="live-icon-button" onClick={() => onEdit(row)} title="Düzenle"><PencilSimple /></button>}</div></td>}</tr>;
  })}</tbody></table></div>;
}

function RecordModal({ module, record, session, saving, serverError, onClose, onSave }) {
  const config = configs[module.id];
  const canViewCost = permissionAllows(session, "view_cost", "cost");
  const canViewSalary = permissionAllows(session, "view_salary", "salary");
  const visibleFields = config.fields.filter((item) => !item.permission || permissionAllows(session, item.permission.action, item.permission.resource));
  const [values, setValues] = useState(() => Object.fromEntries(visibleFields.map((item) => [item.name, record?.[item.name] ?? item.defaultValue ?? ""])));
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

  return <div className="live-modal-backdrop" data-cost-access={canViewCost} data-salary-access={canViewSalary} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="live-modal" role="dialog" aria-modal="true" aria-labelledby="live-modal-title"><header><div><small>{record ? "KAYDI GÜNCELLE" : "YENİ KAYIT"}</small><h2 id="live-modal-title">{record ? `${module.singular} düzenle` : `Yeni ${module.singular}`}</h2></div><button className="live-icon-button" onClick={onClose} aria-label="Kapat"><X /></button></header><form onSubmit={submit}><div className="live-form-grid">{visibleFields.map((item) => <label className={item.wide ? "wide" : ""} key={item.name}><span>{item.label}{item.required && <em>*</em>}</span>{item.type === "select" ? <select value={values[item.name]} onChange={(event) => setValues({ ...values, [item.name]: event.target.value })}><option value="">Seçiniz</option>{item.options.map((option) => <option key={option}>{option}</option>)}</select> : item.type === "textarea" ? <textarea rows="3" value={values[item.name]} placeholder={item.placeholder} onChange={(event) => setValues({ ...values, [item.name]: event.target.value })} /> : <input type={item.type} value={values[item.name]} placeholder={item.placeholder} min={item.min} max={item.max} onChange={(event) => setValues({ ...values, [item.name]: event.target.value })} />}{errors[item.name] && <small className="live-field-error">{errors[item.name]}</small>}</label>)}</div>{serverError && <div className="live-form-alert"><WarningCircle />{serverError.message}</div>}<footer><button type="button" className="live-button secondary" onClick={onClose}>Vazgeç</button><button className="live-button primary" disabled={saving}>{saving ? <><span className="live-spinner small" /> Kaydediliyor</> : <><Check /> Kaydet</>}</button></footer></form></section></div>;
}

function FileUploadModal({ saving, serverError, onClose, onSave }) {
  const [values, setValues] = useState({ entityType: "projects", entityId: "", category: "photo", description: "", file: null });
  const submit = (event) => {
    event.preventDefault();
    if (values.file && values.entityId) onSave(values);
  };
  return <div className="live-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="live-modal compact" role="dialog" aria-modal="true"><header><div><small>DOSYA MERKEZİ</small><h2>Yeni dosya yükle</h2></div><button className="live-icon-button" onClick={onClose} aria-label="Kapat"><X /></button></header><form onSubmit={submit}><div className="live-form-grid"><label><span>Bağlı modül <em>*</em></span><select value={values.entityType} onChange={(event) => setValues({ ...values, entityType: event.target.value })}><option value="projects">Proje</option><option value="offers">Teklif</option><option value="production-orders">Üretim</option><option value="installations">Montaj</option><option value="employees">Personel</option></select></label><label><span>Bağlı kayıt ID <em>*</em></span><input required value={values.entityId} onChange={(event) => setValues({ ...values, entityId: event.target.value })} /></label><label><span>Kategori</span><select value={values.category} onChange={(event) => setValues({ ...values, category: event.target.value })}><option value="photo">Fotoğraf</option><option value="drawing">Çizim</option><option value="contract">Sözleşme</option><option value="report">Rapor</option><option value="other">Diğer</option></select></label><label className="wide"><span>Dosya <em>*</em></span><input required type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => setValues({ ...values, file: event.target.files?.[0] || null })} /></label><label className="wide"><span>Açıklama</span><textarea rows="3" value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} /></label></div>{serverError && <div className="live-form-alert"><WarningCircle />{serverError.message}</div>}<footer><button type="button" className="live-button secondary" onClick={onClose}>Vazgeç</button><button className="live-button primary" disabled={saving || !values.file}>{saving ? "Yükleniyor…" : "Dosyayı yükle"}</button></footer></form></section></div>;
}

function WorkflowConfirmModal({ workflow, saving, error, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [targetStatus, setTargetStatus] = useState(workflow.action.options?.[0]?.value || "");
  const disabled = saving || (workflow.action.reasonRequired && reason.trim().length < 3) || (workflow.action.options && !targetStatus);
  return <div className="live-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}><section className="live-modal compact live-confirm-modal" role="alertdialog" aria-modal="true"><header><div><small>İŞ AKIŞI ONAYI</small><h2>{workflow.action.title}</h2></div><button className="live-icon-button" disabled={saving} onClick={onClose}><X /></button></header><div className="live-confirm-body"><p>{workflow.action.message}</p><div className="live-record-reference"><b>{workflow.row.name || workflow.row.referenceNo || workflow.row.code || workflow.row.number || workflow.row.documentNo || workflow.row.id}</b><small>{workflow.row.status || workflow.row.revisionStatus || "Kayıt"}</small></div>{workflow.action.options && <label><span>Yeni aşama</span><select value={targetStatus} onChange={(event) => setTargetStatus(event.target.value)}>{workflow.action.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>}{(workflow.action.reasonRequired || workflow.action.key === "transition") && <label><span>{workflow.action.reasonRequired ? "Neden / açıklama *" : "Geçiş notu"}</span><textarea rows="3" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={workflow.action.reasonRequired ? "En az 3 karakter girin" : "İsteğe bağlı"} /></label>}{error && <div className="live-form-alert"><WarningCircle />{error.message}</div>}<footer><button className="live-button secondary" disabled={saving} onClick={onClose}>Vazgeç</button><button className={`live-button primary ${workflow.action.tone || ""}`} disabled={disabled} onClick={() => onConfirm({ reason: reason.trim() || undefined, status: targetStatus || undefined, note: reason.trim() || undefined })}>{saving ? <><span className="live-spinner small" /> İşleniyor</> : "İşlemi onayla"}</button></footer></div></section></div>;
}

const permissionCatalog = [
  ["dashboard.read", "Ana sayfa"], ["customers.read", "Müşteri görüntüleme"], ["customers.write", "Müşteri düzenleme"],
  ["projects.read", "Proje görüntüleme"], ["projects.write", "Proje düzenleme"], ["offers.read", "Teklif görüntüleme"], ["offers.write", "Teklif düzenleme"],
  ["work-items.read", "İş kalemi görüntüleme"], ["work-items.write", "İş kalemi düzenleme"], ["cost.view", "Maliyetleri görme"],
  ["purchase-requests.read", "Satın alma görüntüleme"], ["purchase-requests.write", "Satın alma düzenleme"],
  ["production-orders.read", "Üretim görüntüleme"], ["production-orders.write", "Üretim düzenleme"], ["installations.read", "Montaj görüntüleme"], ["installations.write", "Montaj düzenleme"],
  ["financial-transactions.read", "Finans görüntüleme"], ["financial-transactions.write", "Finans düzenleme"], ["invoices.read", "Fatura görüntüleme"], ["invoices.write", "Fatura düzenleme"],
  ["employees.read", "Personel görüntüleme"], ["employees.write", "Personel düzenleme"], ["attendance.read", "Puantaj görüntüleme"], ["attendance.write", "Puantaj düzenleme"],
  ["leaves.read", "İzin görüntüleme"], ["leaves.write", "İzin düzenleme"], ["payroll-inputs.read", "Bordro girdisi görüntüleme"], ["payroll-inputs.write", "Bordro girdisi düzenleme"], ["salary.view", "Ücretleri görme"],
  ["files.read", "Dosya görüntüleme"], ["files.manage", "Dosya yönetme"], ["users.manage", "Kullanıcı yönetme"], ["roles.manage", "Rol yönetme"], ["audit-logs.read", "Denetim kayıtları"],
];

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
  return <><div className="live-hero"><div><small>OPERASYON ÖZETİ</small><h2>Günaydın, {session?.user?.firstName || session?.user?.name?.split(" ")[0] || "ekip"}</h2><p>Projelerin bugünkü öncelikleri ve şirketin güncel görünümü.</p></div><span>{session?.tenant?.name || "Firma"}</span></div>{metricItems.length ? <div className="live-metric-grid">{metricItems.slice(0, 6).map((item, index) => <article key={item.key || item.label || index}><small>{item.label || item.title}</small><strong>{typeof item.value === "number" && /amount|revenue|cost|tutar|ciro/i.test(item.key || item.label) ? money.format(item.value) : item.value}</strong>{item.note && <span>{item.note}</span>}</article>)}</div> : <div className="live-metric-grid">{modules.slice(1, 5).map((item) => <button key={item.id} onClick={() => onNavigate(item.id)}><item.icon /><span><strong>{item.title}</strong><small>Kayıtları görüntüle</small></span></button>)}</div>}<section className="live-panel"><header><div><small>SON HAREKETLER</small><h3>Ekip aktivitesi</h3></div></header>{activities.length ? <div className="live-activity-list">{activities.slice(0, 8).map((activity, index) => <article key={activity.id || index}><span className="live-activity-dot" /><div><b>{activity.title || activity.action || "Kayıt güncellendi"}</b><small>{activity.description || activity.userName || activity.createdBy || "Sistem"}</small></div><time>{formatValue(activity.createdAt || activity.date, "date", activity)}</time></article>)}</div> : <div className="live-compact-empty">Henüz görüntülenecek hareket bulunmuyor.</div>}</section></>;
}

function ResourceView({ module, session, online, onDataChanged }) {
  const config = configs[module.id];
  const [state, setState] = useState({ loading: true, rows: [], meta: null, error: null });
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [permissionRole, setPermissionRole] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [workflowError, setWorkflowError] = useState(null);
  const canCreate = online && !module.readOnly && permissionAllows(session, "create", module.resource);
  const canEdit = online && !module.readOnly && !module.noEdit && permissionAllows(session, "update", module.resource);
  const canManagePermissions = online && module.id === "roles" && permissionAllows(session, "manage", "roles");

  async function load(search = query) {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const result = await api.list(module.resource, { page: 1, pageSize: 50, search, ...config.query });
      setState({ loading: false, rows: normalizeList(result.data), meta: result.meta, error: null });
    } catch (error) {
      setState({ loading: false, rows: [], meta: null, error });
    }
  }
  useEffect(() => { load(""); }, [module.id, session?.tenant?.id]);

  async function save(values) {
    if (!online) {
      setSaveError(new ApiError("Çevrimdışıyken kayıt değiştirilemez.", { code: "OFFLINE" }));
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      if (module.id === "files") await api.uploadFile(values);
      else {
        const payload = { ...values, ...(config.query || {}) };
        if (modal?.id) await api.update(module.resource, modal.id, payload);
        else await api.create(module.resource, payload);
      }
      setModal(null);
      await load();
      onDataChanged?.();
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

  return <><section className="live-panel"><header className="live-toolbar"><div><small>CANLI KAYITLAR</small><h2>{module.title}</h2><p>{config.description}</p></div>{canCreate && <button className="live-button primary" onClick={() => setModal({})}><Plus /> Yeni {module.singular}</button>}</header><form className="live-search" onSubmit={(event) => { event.preventDefault(); load(); }}><MagnifyingGlass /><input aria-label="Kayıtlarda ara" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Kod, ad, müşteri veya durum ara…" /><button>Ara</button></form>{state.loading ? <LoadingState /> : state.error?.status === 403 || state.error?.code === "forbidden" ? <PermissionDeniedState /> : state.error ? <ErrorState error={state.error} retry={() => load()} /> : state.rows.length ? <><Table rows={state.rows} config={config} canEdit={canEdit} onEdit={setModal} onPermissions={canManagePermissions ? setPermissionRole : null} getWorkflowActions={online ? (row) => workflowActions(module, row, session) : null} onWorkflow={(row, action) => { setWorkflowError(null); setWorkflow({ row, action }); }} /><footer className="live-table-footer"><span>{state.meta?.total ?? state.rows.length} kayıt</span><small>Tenant kapsamındaki güncel veriler</small></footer></> : <EmptyState title={module.title} canCreate={canCreate} onCreate={() => setModal({})} />}</section>{modal && (module.id === "files" ? <FileUploadModal saving={saving} serverError={saveError} onClose={() => setModal(null)} onSave={save} /> : <RecordModal module={module} record={modal.id ? modal : null} session={session} saving={saving} serverError={saveError} onClose={() => setModal(null)} onSave={save} />)}{permissionRole && <RolePermissionsModal role={permissionRole} online={online} onClose={() => setPermissionRole(null)} />}{workflow && <WorkflowConfirmModal workflow={workflow} saving={workflowSaving} error={workflowError} onClose={() => setWorkflow(null)} onConfirm={runWorkflow} />}</>;
}

function Login({ error, loading, onSubmit }) {
  const [values, setValues] = useState({ email: import.meta.env.VITE_DEMO_USER_EMAIL || "", tenantId: "" });
  return <main className="live-login"><section><div className="live-login-brand"><span><Buildings /></span><div><b>Capproje</b><small>Orman Ürünleri Yönetimi</small></div></div><div><small>GÜVENLİ ÇALIŞMA ALANI</small><h1>Projelerinizi tek yerden yönetin.</h1><p>Teklif, üretim, satın alma, montaj ve proje finansı aynı operasyon zincirinde.</p></div></section>{demoAuthEnabled ? <form onSubmit={(event) => { event.preventDefault(); onSubmit(values); }}><header><small>GELİŞTİRİCİ OTURUMU</small><h2>Demo kullanıcıyla devam et</h2></header><label><span>E-posta</span><input required type="email" autoComplete="username" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} /></label><label><span>Firma / tenant ID</span><input required value={values.tenantId} onChange={(event) => setValues({ ...values, tenantId: event.target.value })} /></label>{error && <div className="live-form-alert"><WarningCircle />{error.message}</div>}<button className="live-button primary" disabled={loading}>{loading ? <><span className="live-spinner small" /> Bağlanıyor</> : "Demo oturumu aç"}</button></form> : <form><header><small>KURUMSAL OTURUM</small><h2>Kimliğinizi doğrulayın</h2><p>Çalışma alanına erişmek için güvenli oturum sağlayıcısını kullanın.</p></header>{error && <div className="live-form-alert"><WarningCircle />{error.message}</div>}<a className="live-button primary" href="/signin-with-chatgpt?return_to=/">Güvenli giriş yap</a></form>}</main>;
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
  const active = useMemo(() => modules.find((item) => item.id === activeId) || modules[0], [activeId]);

  async function bootstrap() {
    setSessionState((current) => ({ ...current, loading: true, error: null }));
    try {
      const session = await api.session();
      if (session?.tenant?.id) api.setTenant(session.tenant.id);
      setSessionState({ loading: false, session, error: null, needsLogin: false });
    } catch (error) {
      setSessionState({ loading: false, session: null, error, needsLogin: error instanceof ApiError && [401, 403].includes(error.status) });
    }
  }

  useEffect(() => { bootstrap(); }, []);
  useEffect(() => {
    const setConnected = () => setOnline(true);
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
    if (!demoAuthEnabled) {
      window.location.assign("/signout-with-chatgpt?return_to=/");
      return;
    }
    await api.logout();
    setSessionState({ loading: false, session: null, error: null, needsLogin: true });
  }

  async function changeTenant(tenantId) {
    api.setTenant(tenantId);
    await bootstrap();
  }

  if (sessionState.loading && !sessionState.session) return <><LiveStyles /><div className="live-full-state"><LoadingState /></div></>;
  if (sessionState.needsLogin) return <><LiveStyles /><Login error={sessionState.error} loading={sessionState.loading} onSubmit={login} /></>;
  if (sessionState.error) return <><LiveStyles /><div className="live-full-state"><ErrorState error={sessionState.error} retry={bootstrap} /></div></>;

  const session = sessionState.session;
  const roleCode = String(session?.role?.code || session?.user?.role || "").toLowerCase();
  const isOwner = ["owner", "admin", "super_admin"].includes(roleCode);
  const visibleModules = modules.filter((item) => {
    if (item.ownerOnly) return isOwner;
    if (item.id === "payroll" && !permissionAllows(session, "view_salary", "salary")) return false;
    if (item.id === "memberships" && permissionAllows(session, "create", "memberships")) return true;
    if (item.id === "roles" && permissionAllows(session, "manage", "roles")) return true;
    return permissionAllows(session, "read", item.resource);
  });
  const selectedModule = visibleModules.some((item) => item.id === active.id) ? active : visibleModules[0];
  const navGroups = visibleModules.reduce((groups, item) => ({ ...groups, [item.group]: [...(groups[item.group] || []), item] }), {});
  return <div className="live-shell"><LiveStyles />{!online && <div className="live-offline"><WarningCircle /> Çevrimdışısınız. Kayıtlar değiştirilemez; bağlantı geldiğinde tekrar deneyin.</div>}<aside className="live-sidebar"><div className="live-brand"><span><Buildings /></span><div><b>Capproje</b><small>Yönetim Platformu</small></div></div><TenantSelector session={session} onChange={changeTenant} /><nav>{Object.entries(navGroups).map(([group, items]) => <div className="live-nav-group" key={group}><small>{group}</small>{items.map((item) => <button key={item.id} className={item.id === selectedModule?.id ? "active" : ""} onClick={() => setActiveId(item.id)}><item.icon /><span>{item.title}</span></button>)}</div>)}</nav><div className="live-user"><UserCircle /><span><b>{session?.user?.name || session?.user?.full_name || `${session?.user?.firstName || ""} ${session?.user?.lastName || ""}`.trim() || session?.user?.email}</b><small>{session?.role?.name || session?.user?.role || "Kullanıcı"}</small></span><button onClick={logout} title="Çıkış yap"><SignOut /></button></div></aside><main className="live-main"><header className="live-topbar"><div><small>{session?.tenant?.name || "Firma"}</small><h1>{selectedModule?.title || "Çalışma alanı"}</h1></div><div className="live-top-actions">{onBackToPrototype && <button className="live-button secondary" onClick={onBackToPrototype}>Prototipe dön</button>}<span className="live-connection"><i /> Canlı</span></div></header><div className="live-content">{!selectedModule ? <PermissionDeniedState /> : selectedModule.id === "dashboard" ? <Dashboard session={session} onNavigate={setActiveId} refreshKey={dataVersion} /> : selectedModule.id === "backups" ? <BackupView online={online} /> : <ResourceView module={selectedModule} session={session} online={online} onDataChanged={() => setDataVersion((value) => value + 1)} />}</div></main></div>;
}

export default LiveWorkspace;

function LiveStyles() {
  return <style>{`
    :root{--live-ink:#18231e;--live-muted:#65716b;--live-green:#24533f;--live-green-2:#32745a;--live-paper:#f6f5f1;--live-line:#dddeda;--live-white:#fff;--live-danger:#a23d37;--live-warning:#946d22;--live-success:#24704f}
    *{box-sizing:border-box}.live-shell{min-height:100vh;background:var(--live-paper);color:var(--live-ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;display:grid;grid-template-columns:268px 1fr}.live-sidebar{background:#173b2e;color:#e9f0ec;padding:24px 16px 18px;display:flex;flex-direction:column;gap:18px;min-height:100vh;position:sticky;top:0;height:100vh}.live-brand{display:flex;align-items:center;gap:11px;padding:0 8px}.live-brand>span,.live-login-brand>span{width:40px;height:40px;border-radius:11px;display:grid;place-items:center;background:#d9b779;color:#173b2e}.live-brand svg{font-size:22px}.live-brand div,.live-login-brand div{display:flex;flex-direction:column}.live-brand b{font-size:18px}.live-brand small{font-size:10px;color:#aabdb4;letter-spacing:.08em}.live-tenant{display:flex;align-items:center;gap:10px;padding:11px 12px;background:#214a3a;border:1px solid #315b4b;border-radius:11px}.live-tenant>svg{font-size:20px}.live-tenant span{display:flex;flex-direction:column;min-width:0;flex:1}.live-tenant small{font-size:9px;color:#9eb2a8;letter-spacing:.1em}.live-tenant b,.live-tenant select{font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.live-tenant select{appearance:none;background:transparent;border:0;outline:0;width:100%}.live-tenant option{color:#18231e}.live-tenant.selectable{cursor:pointer}.live-sidebar nav{display:flex;flex-direction:column;gap:4px;overflow:auto;padding-right:2px}.live-sidebar nav button{border:0;background:transparent;color:#b9cac1;min-height:42px;border-radius:9px;padding:0 12px;display:flex;align-items:center;gap:11px;font:inherit;font-size:13px;cursor:pointer;text-align:left}.live-sidebar nav button svg{font-size:19px;flex:none}.live-sidebar nav button:hover{background:#204939;color:#fff}.live-sidebar nav button.active{background:#e8efe9;color:#173b2e;font-weight:700}.live-user{display:flex;align-items:center;gap:9px;margin-top:auto;padding:12px 8px 0;border-top:1px solid #315344}.live-user>svg{font-size:31px;color:#d9b779}.live-user span{display:flex;flex-direction:column;min-width:0;flex:1}.live-user b{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.live-user small{font-size:10px;color:#9eb2a8}.live-user button{border:0;background:transparent;color:#c6d3cc;font-size:18px;cursor:pointer}.live-main{min-width:0}.live-topbar{height:76px;background:#fff;border-bottom:1px solid var(--live-line);display:flex;align-items:center;justify-content:space-between;padding:0 32px;position:sticky;top:0;z-index:5}.live-topbar small{font-size:10px;color:var(--live-muted);letter-spacing:.08em}.live-topbar h1{font-size:20px;margin:2px 0 0}.live-top-actions{display:flex;align-items:center;gap:10px}.live-connection{display:flex;align-items:center;gap:7px;border:1px solid var(--live-line);background:#fafafa;border-radius:18px;padding:7px 11px;font-size:11px}.live-connection i{width:7px;height:7px;background:#3a9b70;border-radius:50%;box-shadow:0 0 0 3px #dcefe6}.live-content{padding:28px 32px 48px;max-width:1500px;margin:0 auto}.live-panel{background:#fff;border:1px solid var(--live-line);border-radius:14px;box-shadow:0 2px 10px rgba(25,46,37,.04);overflow:hidden}.live-panel>header{padding:22px 24px;border-bottom:1px solid #e8e9e6}.live-toolbar{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}.live-toolbar small,.live-panel>header small{font-size:9px;color:var(--live-green-2);font-weight:800;letter-spacing:.12em}.live-toolbar h2,.live-panel h3{font-size:22px;margin:5px 0 3px}.live-toolbar p{font-size:12px;color:var(--live-muted);margin:0}.live-button{border:1px solid transparent;border-radius:9px;padding:10px 14px;min-height:40px;display:inline-flex;align-items:center;justify-content:center;gap:7px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}.live-button.primary{background:var(--live-green);color:#fff}.live-button.secondary{background:#fff;color:var(--live-ink);border-color:var(--live-line)}.live-button:disabled{opacity:.55;cursor:not-allowed}.live-search{height:54px;border-bottom:1px solid #e8e9e6;display:flex;align-items:center;padding:0 24px;gap:9px;color:var(--live-muted)}.live-search input{flex:1;border:0;outline:0;font:inherit;font-size:12px}.live-search button{background:#eef2ef;color:var(--live-green);border:0;border-radius:7px;padding:7px 13px;font-weight:700;cursor:pointer}.live-table-wrap{overflow:auto}.live-table{border-collapse:collapse;width:100%;min-width:820px}.live-table th{padding:12px 16px;text-align:left;background:#fafaf8;color:#78817c;font-size:9px;letter-spacing:.07em;text-transform:uppercase;border-bottom:1px solid var(--live-line)}.live-table td{padding:14px 16px;border-bottom:1px solid #efefec;font-size:12px;vertical-align:middle}.live-table tbody tr:hover{background:#fbfcfa}.live-table tbody tr:last-child td{border-bottom:0}.live-table-footer{display:flex;justify-content:space-between;padding:12px 18px;background:#fafaf8;border-top:1px solid var(--live-line);color:var(--live-muted);font-size:11px}.live-status{display:inline-flex;border-radius:20px;padding:5px 8px;font-size:10px;font-weight:700;white-space:nowrap}.live-status.neutral{color:#50625a;background:#edf0ee}.live-status.success{color:var(--live-success);background:#e4f3eb}.live-status.warning{color:var(--live-warning);background:#f7efda}.live-status.danger{color:var(--live-danger);background:#f8e8e6}.live-icon-button{width:34px;height:34px;border:1px solid var(--live-line);border-radius:8px;background:#fff;color:var(--live-green);display:grid;place-items:center;cursor:pointer}.live-state{min-height:330px;padding:50px 24px;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;color:var(--live-muted);gap:8px}.live-state b{color:var(--live-ink);font-size:15px}.live-state small{max-width:430px}.live-state button{margin-top:8px;border:0;border-radius:8px;background:var(--live-green);color:#fff;padding:9px 13px;display:flex;align-items:center;gap:6px;cursor:pointer}.live-state-error svg{color:var(--live-danger)}.live-compact-empty{padding:30px;color:var(--live-muted);font-size:12px}.live-spinner{width:25px;height:25px;border:2px solid #d7ded9;border-top-color:var(--live-green);border-radius:50%;animation:live-spin .7s linear infinite}.live-spinner.small{width:15px;height:15px;border-color:#ffffff66;border-top-color:#fff}@keyframes live-spin{to{transform:rotate(360deg)}}.live-hero{border-radius:15px;background:#1d4938;color:#fff;padding:28px 30px;display:flex;align-items:flex-end;justify-content:space-between;min-height:155px}.live-hero small{color:#a9c6b8;font-size:9px;font-weight:800;letter-spacing:.13em}.live-hero h2{font-size:28px;margin:8px 0 5px}.live-hero p{margin:0;color:#c0d4ca;font-size:12px}.live-hero>span{border:1px solid #4a705f;border-radius:22px;padding:8px 13px;font-size:11px}.live-metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:16px 0}.live-metric-grid article,.live-metric-grid button{min-height:105px;background:#fff;border:1px solid var(--live-line);border-radius:12px;padding:17px;text-align:left;display:flex;flex-direction:column;align-items:flex-start;justify-content:center}.live-metric-grid article small{font-size:10px;color:var(--live-muted);text-transform:uppercase;letter-spacing:.05em}.live-metric-grid article strong{font-size:24px;margin-top:7px}.live-metric-grid article span{font-size:10px;color:var(--live-success);margin-top:4px}.live-metric-grid button{cursor:pointer;flex-direction:row;align-items:center;gap:13px;color:var(--live-ink)}.live-metric-grid button>svg{font-size:25px;color:var(--live-green)}.live-metric-grid button span{display:flex;flex-direction:column}.live-metric-grid button small{color:var(--live-muted);margin-top:4px}.live-activity-list article{display:grid;grid-template-columns:10px 1fr auto;align-items:center;gap:12px;padding:13px 24px;border-bottom:1px solid #efefec}.live-activity-dot{width:8px;height:8px;background:#d9b779;border-radius:50%}.live-activity-list article div{display:flex;flex-direction:column}.live-activity-list b{font-size:12px}.live-activity-list small,.live-activity-list time{font-size:10px;color:var(--live-muted)}.live-modal-backdrop{position:fixed;inset:0;background:rgba(13,25,20,.58);z-index:50;display:grid;place-items:center;padding:20px}.live-modal{width:min(800px,100%);max-height:calc(100vh - 40px);overflow:auto;background:#fff;border-radius:15px;box-shadow:0 25px 80px rgba(0,0,0,.25)}.live-modal>header{display:flex;justify-content:space-between;align-items:flex-start;padding:22px 24px;border-bottom:1px solid var(--live-line);position:sticky;top:0;background:#fff;z-index:2}.live-modal header small{font-size:9px;color:var(--live-green-2);font-weight:800;letter-spacing:.1em}.live-modal h2{margin:5px 0 0;font-size:21px}.live-modal form{padding:23px 24px}.live-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:17px}.live-form-grid label{display:flex;flex-direction:column;gap:7px}.live-form-grid label.wide{grid-column:1/-1}.live-form-grid label>span{font-size:11px;font-weight:700;color:#46524c}.live-form-grid em{font-style:normal;color:#b74640;margin-left:3px}.live-form-grid input,.live-form-grid select,.live-form-grid textarea,.live-login input{width:100%;border:1px solid #ced3cf;border-radius:8px;background:#fff;padding:10px 11px;font:inherit;font-size:12px;outline:0}.live-form-grid textarea{resize:vertical}.live-form-grid input:focus,.live-form-grid select:focus,.live-form-grid textarea:focus,.live-login input:focus{border-color:var(--live-green-2);box-shadow:0 0 0 3px #dcece4}.live-field-error{color:var(--live-danger);font-size:10px}.live-form-alert{background:#f9e8e6;color:var(--live-danger);border:1px solid #eecbc7;border-radius:8px;padding:10px 12px;display:flex;gap:7px;align-items:center;font-size:11px}.live-modal footer{display:flex;justify-content:flex-end;gap:9px;padding-top:23px;margin-top:23px;border-top:1px solid var(--live-line)}.live-offline{position:fixed;z-index:100;left:50%;top:12px;transform:translateX(-50%);background:#7e4c18;color:#fff;padding:9px 14px;border-radius:9px;box-shadow:0 6px 20px #0002;display:flex;align-items:center;gap:7px;font-size:11px}.live-full-state{min-height:100vh;background:var(--live-paper);display:grid;place-items:center}.live-login{min-height:100vh;display:grid;grid-template-columns:1.1fr .9fr;background:#f6f5f1;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--live-ink)}.live-login>section{background:#173b2e;color:#fff;padding:52px;display:flex;flex-direction:column;justify-content:space-between}.live-login-brand{display:flex;align-items:center;gap:11px}.live-login-brand>span{display:grid;place-items:center}.live-login-brand small{color:#abc0b6}.live-login>section>div:last-child{max-width:570px}.live-login>section h1{font-size:45px;line-height:1.08;margin:12px 0}.live-login>section p{color:#bfd0c7;line-height:1.7}.live-login>form{width:min(430px,calc(100% - 48px));margin:auto;background:#fff;padding:35px;border:1px solid var(--live-line);border-radius:15px;display:flex;flex-direction:column;gap:18px;box-shadow:0 15px 45px #1935290d}.live-login form header small{font-size:9px;color:var(--live-green);font-weight:800;letter-spacing:.12em}.live-login form h2{margin:7px 0 4px}.live-login form label{display:flex;flex-direction:column;gap:7px}.live-login form label>span{font-size:11px;font-weight:700}.live-login form label small{font-weight:400;color:var(--live-muted)}
    .live-nav-group{display:flex;flex-direction:column;gap:3px}.live-nav-group>small{padding:9px 12px 4px;color:#769287;font-size:8px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.live-row-actions{display:flex;align-items:center;gap:6px;white-space:nowrap}.live-workflow-button{border:1px solid #cbd6d0;background:#edf4f0;color:var(--live-green);border-radius:7px;padding:6px 8px;font-size:9px;font-weight:800;cursor:pointer}.live-workflow-button.success{background:#e5f2ea;color:var(--live-success)}.live-workflow-button.danger{background:#f8e8e6;border-color:#ebcbc7;color:var(--live-danger)}.live-permission-body{padding:22px 24px}.live-permission-body>p{margin:0 0 16px;color:var(--live-muted);font-size:12px}.live-permission-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.live-permission-grid label{display:flex;gap:9px;align-items:flex-start;border:1px solid var(--live-line);border-radius:9px;padding:10px;cursor:pointer}.live-permission-grid input{margin-top:3px}.live-permission-grid span{display:flex;flex-direction:column}.live-permission-grid b{font-size:11px}.live-permission-grid small{font-size:9px;color:var(--live-muted)}.live-permission-body footer{display:flex;justify-content:flex-end;gap:9px;padding-top:20px}.live-modal.compact{width:min(590px,100%)}.live-confirm-body{padding:22px 24px}.live-confirm-body>p{margin:0 0 15px;color:var(--live-muted);font-size:12px;line-height:1.6}.live-record-reference{display:flex;flex-direction:column;background:#f3f5f2;border:1px solid var(--live-line);border-radius:9px;padding:11px 12px;margin-bottom:16px}.live-record-reference b{font-size:12px}.live-record-reference small{color:var(--live-muted);font-size:10px;margin-top:2px}.live-confirm-body>label{display:flex;flex-direction:column;gap:7px;margin-top:13px}.live-confirm-body>label>span{font-size:11px;font-weight:700}.live-confirm-body select,.live-confirm-body textarea{border:1px solid #ced3cf;border-radius:8px;padding:10px;font:inherit;font-size:12px}.live-confirm-body footer{display:flex;justify-content:flex-end;gap:9px;margin-top:20px;padding-top:18px;border-top:1px solid var(--live-line)}
    @media(max-width:1050px){.live-shell{grid-template-columns:76px 1fr}.live-sidebar{padding-inline:10px}.live-brand div,.live-tenant span,.live-tenant>svg+span,.live-sidebar nav button span,.live-user span,.live-user>button,.live-nav-group>small{display:none}.live-brand{padding:0;justify-content:center}.live-tenant{justify-content:center;padding:10px}.live-sidebar nav button{justify-content:center;padding:0}.live-user{justify-content:center;padding-inline:0}.live-metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:720px){.live-shell{display:block;padding-bottom:70px}.live-sidebar{position:fixed;z-index:20;bottom:0;top:auto;left:0;right:0;width:100%;height:65px;min-height:0;padding:7px 10px;background:#173b2e}.live-brand,.live-tenant,.live-user{display:none}.live-sidebar nav{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(60px,1fr);overflow-x:auto;gap:2px}.live-nav-group{display:contents}.live-sidebar nav button{height:50px;min-width:60px;flex-direction:column;gap:2px;padding:4px;font-size:8px}.live-sidebar nav button svg{font-size:18px}.live-sidebar nav button span{display:block}.live-topbar{height:65px;padding:0 16px}.live-topbar h1{font-size:17px}.live-top-actions .secondary{display:none}.live-content{padding:16px}.live-toolbar{flex-direction:column}.live-toolbar .live-button{width:100%}.live-search{padding:0 15px}.live-hero{padding:22px;min-height:140px}.live-hero h2{font-size:22px}.live-hero>span{display:none}.live-metric-grid{grid-template-columns:1fr 1fr;gap:9px}.live-metric-grid article,.live-metric-grid button{min-height:94px;padding:13px}.live-metric-grid article strong{font-size:19px}.live-form-grid,.live-permission-grid{grid-template-columns:1fr}.live-form-grid label.wide{grid-column:auto}.live-modal-backdrop{padding:0}.live-modal{height:100vh;max-height:none;border-radius:0}.live-modal>header{padding:18px}.live-modal form{padding:18px}.live-login{grid-template-columns:1fr}.live-login>section{min-height:230px;padding:28px}.live-login>section h1{font-size:30px}.live-login>form{margin:22px auto}}
  `}</style>;
}
