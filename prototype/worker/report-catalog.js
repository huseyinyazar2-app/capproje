// Hazır rapor kataloğu.
//
// Bu liste veritabanına yazılmaz, kod içinde durur: böylece silinemez,
// sahibi yoktur ve her dağıtımda güncel kalır. Kullanıcı birini kendine
// uyarlamak isterse "farklı kaydet" ile sıradan bir `saved_reports`
// satırına kopyalar; oradan sonra o kopya kullanıcının kendi malıdır.
//
// Her `definition`, worker/index.js'teki rapor motorunun kabul ettiği
// biçimdedir (bkz. rapor sözleşmesi, 1. ve 2. aşama). Süzgeçlerde geçen
// durum/tür kodları `statusEnums` ve `enumFields` içindeki gerçek kodlarla
// birebir eşleşir; uydurma bir kod sessizce boş rapor döndürür, bu yüzden
// her biri motordaki listeyle tek tek karşılaştırılarak yazıldı.
//
// Not: ilk sürümde `planned_start`/`planned_end`/`needed_by` (date) ve
// `delay_days`/`lead_time_days` (number) sütunları rapor motorunun tip
// çıkarımında "text" sayıldığı için üç rapor ve iki ölçü kataloğa alınmamıştı.
// Motor tarafı bu sütunları açıkça tanıyacak şekilde düzeltildi
// (`REPORT_DATE_COLUMNS`, `_days` soneki artık `number`); bu düzeltmeyle
// birlikte hepsi aşağıda yerini aldı.

export const builtinReports = [
  // --- Satış ---
  {
    id: "offer-conversion",
    category: "Satış",
    name: "Teklif dönüşümü",
    description: "Bu yıl verilen tekliflerin durumlara göre adedini ve tutarını gösterir.",
    definition: {
      resource: "offers",
      filters: [{ field: "offer_date", op: "between", value: { relative: "this_year" } }],
      group: {
        by: ["status"],
        aggregates: [
          { fn: "count", as: "adet" },
          { fn: "sum", field: "grand_total_minor", as: "toplam_tutar" },
        ],
      },
      sort: [{ field: "toplam_tutar", direction: "desc" }],
    },
  },
  {
    id: "lost-offer-reasons",
    category: "Satış",
    name: "Kayıp teklif nedenleri",
    // offers durum kümesinde ayrı bir "lost" kodu yok (statusEnums.offers);
    // "kaybedilmiş" burada gerçek kod olan "rejected" ile karşılanıyor.
    description: "Bu yıl reddedilen tekliflerin nedenlere göre adedini ve tutarını gösterir.",
    definition: {
      resource: "offers",
      filters: [
        { field: "offer_date", op: "between", value: { relative: "this_year" } },
        { field: "status", op: "eq", value: "rejected" },
      ],
      group: {
        by: ["rejection_reason"],
        aggregates: [
          { fn: "count", as: "adet" },
          { fn: "sum", field: "grand_total_minor", as: "toplam_tutar" },
        ],
      },
      sort: [{ field: "toplam_tutar", direction: "desc" }],
    },
  },
  {
    id: "customer-contract-volume",
    category: "Satış",
    name: "Müşteri sözleşme hacmi",
    description: "Projeleri müşteriye göre gruplayıp toplam sözleşme tutarına göre sıralar.",
    definition: {
      resource: "projects",
      group: {
        by: ["customer_id"],
        aggregates: [
          { fn: "count", as: "adet" },
          { fn: "sum", field: "contract_amount_minor", as: "toplam_tutar" },
        ],
      },
      sort: [{ field: "toplam_tutar", direction: "desc" }],
    },
  },

  // --- Proje ---
  {
    id: "portfolio-by-stage",
    category: "Proje",
    name: "Aşamalara göre portföy",
    description: "Tüm projeleri bulunduğu aşamaya göre gruplayıp adet ve sözleşme tutarını gösterir.",
    definition: {
      resource: "projects",
      group: {
        by: ["status"],
        aggregates: [
          { fn: "count", as: "adet" },
          { fn: "sum", field: "contract_amount_minor", as: "toplam_tutar" },
        ],
      },
    },
  },
  {
    id: "estimated-margin",
    category: "Proje",
    name: "Tahmini kârlılık listesi",
    // estimated_cost_minor korumalı bir sütun (cost.view); bilinçli olarak
    // eklendi, bu izni olmayan kullanıcıya rapor listede hiç görünmeyecek.
    description: "Projelerin sözleşme tutarını, tahmini maliyetini ve ilerlemesini yan yana listeler.",
    definition: {
      resource: "projects",
      columns: ["code", "name", "customer_id", "contract_amount_minor", "estimated_cost_minor", "progress_percent", "status"],
      sort: [{ field: "contract_amount_minor", direction: "desc" }],
    },
  },
  {
    id: "pending-follow-ups",
    category: "Proje",
    name: "Takip bekleyen görüşmeler",
    description: "Önümüzdeki yedi gün içinde takip tarihi gelen açık görüşmeleri listeler.",
    definition: {
      resource: "project-communications",
      columns: ["project_id", "customer_id", "channel", "direction", "contact_name", "subject", "next_follow_up_at", "owner_user_id", "status"],
      filters: [
        { field: "status", op: "in", value: ["open", "follow_up"] },
        { field: "next_follow_up_at", op: "lt", value: { relative: "today", offsetDays: 7 } },
      ],
      sort: [{ field: "next_follow_up_at", direction: "asc" }],
    },
  },
  {
    id: "overdue-tasks",
    category: "Proje",
    name: "Geciken görevler",
    description: "Bitiş tarihi geçmiş ama hâlâ açık olan görevleri en eskiden yeniye listeler.",
    definition: {
      resource: "project-tasks",
      columns: ["project_id", "title", "assignee_user_id", "department", "status", "priority", "planned_end"],
      filters: [
        { field: "status", op: "in", value: ["todo", "in_progress", "blocked"] },
        { field: "planned_end", op: "lt", value: { relative: "today", offsetDays: 0 } },
      ],
      sort: [{ field: "planned_end", direction: "asc" }],
    },
  },
  {
    id: "handover-satisfaction",
    category: "Proje",
    name: "Müşteri memnuniyeti",
    description: "Bu yıl yapılan teslimlerin projeye göre ortalama memnuniyet puanını ve adedini gösterir.",
    definition: {
      resource: "handovers",
      filters: [{ field: "handover_date", op: "between", value: { relative: "this_year" } }],
      group: {
        by: ["project_id"],
        aggregates: [
          { fn: "count", as: "adet" },
          { fn: "avg", field: "satisfaction_score", as: "ort_memnuniyet" },
        ],
      },
    },
  },

  // --- Finans ---
  {
    id: "overdue-receivables",
    category: "Finans",
    name: "Vadesi geçmiş alacaklar",
    // "draft" bilinçli olarak dışarıda: taslak fatura henüz kesilmemiştir,
    // alacak sayılmaz. open/partial/overdue gerçek birer alacak durumudur.
    description: "Vadesi bugünden önce olan, henüz tahsil edilmemiş satış faturalarını listeler.",
    definition: {
      resource: "invoices",
      columns: ["invoice_number", "customer_id", "due_date", "grand_total_minor", "paid_total_minor"],
      filters: [
        { field: "direction", op: "eq", value: "sales" },
        { field: "status", op: "in", value: ["open", "partial", "overdue"] },
        { field: "due_date", op: "lt", value: { relative: "today", offsetDays: 0 } },
      ],
      sort: [{ field: "due_date", direction: "asc" }],
    },
  },
  {
    id: "monthly-cash-flow",
    category: "Finans",
    name: "Bu ay gelir-gider özeti",
    description: "Bu ayki finansal hareketleri türüne göre gruplayıp adet ve toplam tutarını gösterir.",
    definition: {
      resource: "financial-transactions",
      filters: [{ field: "transaction_date", op: "between", value: { relative: "this_month" } }],
      group: {
        by: ["type"],
        aggregates: [
          { fn: "count", as: "adet" },
          { fn: "sum", field: "amount_minor", as: "toplam_tutar" },
        ],
      },
    },
  },
  {
    id: "project-income-expense",
    category: "Finans",
    name: "Proje gelir-gider dağılımı",
    description: "Bu yılki finansal hareketleri proje ve türe göre gruplayıp toplam tutarını gösterir.",
    definition: {
      resource: "financial-transactions",
      filters: [{ field: "transaction_date", op: "between", value: { relative: "this_year" } }],
      group: {
        by: ["project_id", "type"],
        aggregates: [{ fn: "sum", field: "amount_minor", as: "toplam_tutar" }],
      },
    },
  },
  {
    id: "progress-payment-status",
    category: "Finans",
    name: "Hakediş durumu özeti",
    description: "Hakedişleri durumlarına göre gruplayıp adet ve net ödenecek toplamını gösterir.",
    definition: {
      resource: "progress-payments",
      group: {
        by: ["status"],
        aggregates: [
          { fn: "count", as: "adet" },
          { fn: "sum", field: "net_payable_minor", as: "toplam_net_odenecek" },
        ],
      },
    },
  },

  // --- Satın Alma ---
  {
    id: "supplier-order-volume",
    category: "Satın Alma",
    name: "Tedarikçi sipariş hacmi",
    description: "Bu yılki satın alma siparişlerini tedarikçiye göre gruplayıp tutara göre sıralar.",
    definition: {
      resource: "purchase-orders",
      filters: [{ field: "order_date", op: "between", value: { relative: "this_year" } }],
      group: {
        by: ["supplier_id"],
        aggregates: [
          { fn: "count", as: "adet" },
          { fn: "sum", field: "grand_total_minor", as: "toplam_tutar" },
        ],
      },
      sort: [{ field: "toplam_tutar", direction: "desc" }],
    },
  },
  {
    id: "supplier-quote-performance",
    category: "Satın Alma",
    name: "Tedarikçi teklif performansı",
    description: "Tedarikçi tekliflerini adedine, ortalama tutarına ve ortalama termin gününe göre karşılaştırır.",
    definition: {
      resource: "supplier-quotations",
      group: {
        by: ["supplier_id"],
        aggregates: [
          { fn: "count", as: "adet" },
          { fn: "avg", field: "total_minor", as: "ort_teklif_tutar" },
          { fn: "avg", field: "lead_time_days", as: "ort_termin_gun" },
        ],
      },
    },
  },
  {
    id: "upcoming-material-needs",
    category: "Satın Alma",
    name: "Yaklaşan malzeme ihtiyaçları",
    // Yalnız üst sınır var (needed_by < bugün+14): geçmişte kalmış ama hâlâ
    // karşılanmamış ihtiyaçlar da görünsün istendi, alt sınır bilinçli olarak
    // konmadı.
    description: "Önümüzdeki 14 gün içinde (veya daha önce) gereken, henüz karşılanmamış malzeme ihtiyaçlarını en yakından listeler.",
    definition: {
      resource: "material-requirements",
      columns: ["project_id", "work_item_id", "item_code", "description", "required_quantity", "unit", "needed_by", "status", "preferred_supplier_id"],
      filters: [
        { field: "status", op: "in", value: ["draft", "shortage", "covered"] },
        { field: "needed_by", op: "lt", value: { relative: "today", offsetDays: 14 } },
      ],
      sort: [{ field: "needed_by", direction: "asc" }],
    },
  },

  // --- Üretim ---
  {
    id: "scrap-and-rework",
    category: "Üretim",
    name: "Fire ve yeniden imalat",
    // Maliyet etkisi sütunu (cost_impact_minor) bilinçli olarak hiç eklenmedi.
    description: "Bu yılki üretim sorunlarını türüne göre gruplayıp hurda, yeniden imalat miktarını ve gecikme günü toplamını gösterir.",
    definition: {
      resource: "production-issues",
      // production-issues'ın reported_at alanı rapor motorunun sütun beyaz
      // listesinde değil (yalnız serverDefaults ile yazılıyor, `fields`
      // dizisinde yok); bu yüzden "bu yıl" için created_at kullanıldı.
      filters: [{ field: "created_at", op: "between", value: { relative: "this_year" } }],
      group: {
        by: ["issue_type"],
        aggregates: [
          { fn: "count", as: "adet" },
          { fn: "sum", field: "scrap_quantity", as: "toplam_hurda" },
          { fn: "sum", field: "rework_quantity", as: "toplam_yeniden_imalat" },
          { fn: "sum", field: "delay_days", as: "toplam_gecikme_gun" },
        ],
      },
    },
  },
  {
    id: "quality-results",
    category: "Üretim",
    name: "Kalite kontrol sonuçları",
    description: "Bu ayki kalite kontrollerini kontrol türü ve sonucuna göre gruplayıp adedini gösterir.",
    definition: {
      resource: "quality-inspections",
      filters: [{ field: "inspection_date", op: "between", value: { relative: "this_month" } }],
      group: {
        by: ["inspection_type", "result"],
        aggregates: [{ fn: "count", as: "adet" }],
      },
    },
  },
  {
    id: "stock-movement-summary",
    category: "Üretim",
    name: "Stok hareket özeti",
    description: "Bu ayki stok hareketlerini türüne göre gruplayıp adet, miktar ve maliyet toplamını gösterir.",
    definition: {
      resource: "stock-movements",
      filters: [{ field: "movement_date", op: "between", value: { relative: "this_month" } }],
      group: {
        by: ["movement_type"],
        aggregates: [
          { fn: "count", as: "adet" },
          { fn: "sum", field: "quantity", as: "toplam_miktar" },
          { fn: "sum", field: "total_cost_minor", as: "toplam_maliyet" },
        ],
      },
    },
  },

  // --- Montaj ---
  {
    id: "upcoming-installations",
    category: "Montaj",
    name: "Yaklaşan ve geciken montajlar",
    // Yalnız üst sınır var (planned_start < bugün+30): upcoming-material-needs
    // ile aynı ilke. Alt sınır konsaydı başlangıcı geçmiş ama hâlâ tamamlanmamış
    // montajlar (gecikmiş montaj) listeden düşerdi — yönetici "önümüzde montaj
    // yok" sanıp boş listeye bakardı, oysa üç tanesi gecikmiş olurdu.
    description: "Bugünden 30 gün sonrasına kadar başlaması gereken, henüz tamamlanmamış montajları gecikenler en üstte olacak şekilde listeler.",
    definition: {
      resource: "installations",
      columns: ["installation_number", "project_id", "location", "team_lead_user_id", "planned_start", "planned_end", "status"],
      filters: [
        { field: "status", op: "in", value: ["planned", "survey_needed", "site_waiting", "in_transit", "in_progress", "incomplete"] },
        { field: "planned_start", op: "lt", value: { relative: "today", offsetDays: 30 } },
      ],
      sort: [{ field: "planned_start", direction: "asc" }],
    },
  },

  // --- İnsan Kaynakları ---
  {
    id: "monthly-attendance",
    category: "İnsan Kaynakları",
    name: "Bu ay puantaj özeti",
    description: "Bu ayki puantaj kayıtlarını personele göre gruplayıp çalışılan ve fazla mesai dakikasını toplar.",
    definition: {
      resource: "attendance",
      filters: [{ field: "work_date", op: "between", value: { relative: "this_month" } }],
      group: {
        by: ["employee_id"],
        aggregates: [
          { fn: "count", as: "adet" },
          { fn: "sum", field: "regular_minutes", as: "toplam_normal_dakika" },
          { fn: "sum", field: "overtime_minutes", as: "toplam_fazla_mesai" },
        ],
      },
    },
  },
  {
    id: "leave-usage",
    category: "İnsan Kaynakları",
    name: "İzin kullanımı",
    // "Bu yıl" için start_date seçildi: iznin fiilen başladığı tarih, hangi
    // yılın kullanımına sayılacağını end_date'den daha doğru yansıtır.
    description: "Bu yıl başlayan izinleri personel ve izin türüne göre gruplayıp gün toplamını gösterir.",
    definition: {
      resource: "leaves",
      filters: [{ field: "start_date", op: "between", value: { relative: "this_year" } }],
      group: {
        by: ["employee_id", "leave_type"],
        aggregates: [{ fn: "sum", field: "day_count", as: "toplam_gun" }],
      },
    },
  },
];
