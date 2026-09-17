-- Ekip sohbeti. Bir işin konuşulduğu yer ile işin kendisi ayrı programlarda
-- durduğunda konuşma kayboluyor: karar WhatsApp'ta kalıyor, kaydın yanında izi
-- olmuyor. Mesajlar bu yüzden programın içinde ve istenirse bir kayda bağlı.

CREATE TABLE IF NOT EXISTS chat_channels (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'team' CHECK (kind IN ('team','project','announcement')),
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  topic TEXT,
  created_by TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- link_module/link_record_id bir mesajın hangi kayda işaret ettiğini tutar;
-- "şuna bir bak" derken adresi tarif etmek yerine kaydın kendisi iliştirilir.
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  author_user_id TEXT REFERENCES users(id),
  body TEXT NOT NULL,
  link_module TEXT,
  link_record_id TEXT,
  link_label TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','deleted')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Okunmamış sayısı için kişi başına tek satır; mesaj başına okundu kaydı
-- tutmak bu ölçekte gereksiz yere büyür.
CREATE TABLE IF NOT EXISTS chat_reads (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_channels_tenant_status ON chat_channels(tenant_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_chat_channels_tenant_project ON chat_channels(tenant_id, project_id);
-- Yoklama sorgusu hep "şu kanalda şu andan sonrası" diye sorar.
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_created ON chat_messages(tenant_id, channel_id, created_at);

INSERT OR IGNORE INTO permissions (code,description) VALUES
('chat.read','Ekip sohbetini okuma'),
('chat.write','Sohbete mesaj yazma ve kanal açma'),
('chat.delete','Mesaj silme ve kanal arşivleme');

-- Sohbet herkesin işi. Salt okunur rol yalnız okur, kalan her rol yazar;
-- silme yetkisi tek elde toplansın diye sadece proje yöneticisine verilir.
UPDATE role_templates SET permissions_json=json_insert(permissions_json,'$[#]','chat.read','$[#]','chat.write')
WHERE code<>'read_only';

INSERT OR IGNORE INTO role_permissions (tenant_id,role_id,permission_code)
SELECT r.tenant_id,r.id,p.code FROM roles r JOIN permissions p ON
  (r.code<>'read_only' AND p.code IN ('chat.read','chat.write')) OR
  (r.code='read_only' AND p.code='chat.read') OR
  (r.code='project_manager' AND p.code='chat.delete');

PRAGMA optimize;
