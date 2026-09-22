-- Rapor motoru. Aynı filtre/kırılım her ay elle kurulmasın diye tanım
-- kaydedilir; sorgunun kendisi değil, sorguyu üreten tarif saklanır (bkz.
-- rapor sözleşmesi). Sunucu bu tarifi her çalıştırmada yeniden yetki ve
-- sütun beyaz listesinden geçirir, kayıtlı olan asla doğrudan çalıştırılmaz.
CREATE TABLE IF NOT EXISTS saved_reports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  resource TEXT NOT NULL,
  definition_json TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','shared')),
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Liste ekranı hep "benim raporlarım" ile "kiracıda paylaşılanlar" diye
-- ayrı sorgular; ikisi de tenant_id ile başladığı için aynı bileşik index
-- her ikisine de hizmet eder.
CREATE INDEX IF NOT EXISTS idx_saved_reports_tenant_owner ON saved_reports(tenant_id, owner_user_id);
CREATE INDEX IF NOT EXISTS idx_saved_reports_tenant_visibility ON saved_reports(tenant_id, visibility);

INSERT OR IGNORE INTO permissions (code,description) VALUES
('reports.read','Kaydedilmiş raporları görüntüleme ve rapor çalıştırma'),
('reports.write','Rapor tanımı oluşturma ve düzenleme'),
('reports.delete','Kaydedilmiş raporu silme');

-- Rapor kurmak da ekip sohbeti gibi herkesin işi. Salt okunur rol yalnız
-- okur, kalan her rol yazar; silme yetkisi 0014'teki gibi tek elde
-- toplansın diye yalnız proje yöneticisine verilir.
UPDATE role_templates SET permissions_json=json_insert(permissions_json,'$[#]','reports.read','$[#]','reports.write')
WHERE code<>'read_only';

INSERT OR IGNORE INTO role_permissions (tenant_id,role_id,permission_code)
SELECT r.tenant_id,r.id,p.code FROM roles r JOIN permissions p ON
  (r.code<>'read_only' AND p.code IN ('reports.read','reports.write')) OR
  (r.code='read_only' AND p.code='reports.read') OR
  (r.code='project_manager' AND p.code='reports.delete');

PRAGMA optimize;
