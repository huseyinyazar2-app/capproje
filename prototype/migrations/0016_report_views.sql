-- Hazır raporda kişisel sütun görünümü. Kullanıcı bir sütunu gizlediğinde
-- raporun tamamını kopyalasaydık kopya o anda donardı: raporu sonradan
-- iyileştirdiğimizde kullanıcı iyileştirmeyi bir daha alamazdı. Bu yüzden
-- sonuç değil fark saklanır — yalnız kişinin varsayılandan sapması. Raporun
-- kendisi kodda kalır (worker/report-catalog.js) ve her dağıtımla güncellenir.
CREATE TABLE IF NOT EXISTS report_views (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  builtin_id TEXT NOT NULL,
  view_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Bir kişinin bir rapor için tek görünümü olur: ikinci satır, hangisinin
-- uygulandığı tesadüfe kalan iki tercih demektir. Aynı indeks "bu kişinin
-- görünümleri" sorgusuna da hizmet ettiği için ayrıca liste indeksi yok.
CREATE UNIQUE INDEX IF NOT EXISTS idx_report_views_tenant_user_builtin ON report_views(tenant_id, user_id, builtin_id);

-- Yeni yetki kodu bilerek yok. Görünümü okumak ve kaydetmek rapor yazmak
-- değil: kişinin zaten çalıştırabildiği bir raporda kendi ekran tercihi.
-- 0015'in dağıttığı reports.read yeter ve salt okunur rol de kendi
-- görünümünü ayarlayabilir. Yetki eşlemesi worker/index.js'te.

PRAGMA optimize;
