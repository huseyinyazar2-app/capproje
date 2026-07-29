import {
  ArrowRight,
  Camera,
  CheckCircle,
  ClipboardText,
  FileText,
  Plus,
  SealCheck,
  Warning,
} from "@phosphor-icons/react";

export const formBlueprintMeta = {
  "customer-survey": { sections: 6, fields: 38, summary: "Müşteri · mahal metrajı · saha koşulları · görseller" },
  offer: { sections: 7, fields: 52, summary: "Metraj satırları · maliyet kırılımı · kâr · sonuç takibi" },
  "project-contract": { sections: 7, fields: 44, summary: "Sözleşme · kapsam paketleri · kilometre taşları · roller" },
  "work-item-approval": { sections: 6, fields: 43, summary: "Ölçüler · malzeme reçetesi · çizim revizyonu · numune onayı" },
  procurement: { sections: 6, fields: 47, summary: "Talep satırları · tedarikçi kıyası · bütçe · onay zinciri" },
  "production-order": { sections: 7, fields: 51, summary: "Malzeme hazırlığı · operasyon rotası · dış imalat · kalite" },
  installation: { sections: 7, fields: 46, summary: "Saha hazırlığı · sevkiyat · ekip · eksik işler · teslim" },
  "quality-photo": { sections: 6, fields: 36, summary: "Bulgu sınıfı · kanıt · kök neden · düzeltme · doğrulama" },
  "finance-progress": { sections: 7, fields: 49, summary: "Kasa/banka · kümülatif hakediş · kesintiler · tahsilat" },
  "weekly-meeting": { sections: 5, fields: 45, summary: "Proje durum matrisi · devreden işler · karar ve aksiyonlar" },
  supplier: { sections: 6, fields: 41, summary: "Yetkinlik · ticari şartlar · belgeler · performans geçmişi" },
};

function Field({ label, value, type = "text", options, required, wide, hint }) {
  return (
    <label className={`deep-field ${wide ? "wide" : ""}`}>
      <span>{label}{required && <b>Zorunlu</b>}</span>
      {type === "select" ? (
        <select defaultValue={value}>
          {(options || [value]).map((option) => <option key={option}>{option}</option>)}
        </select>
      ) : type === "textarea" ? (
        <textarea rows={3} defaultValue={value} />
      ) : (
        <input type={type} defaultValue={value} />
      )}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function FormSection({ index, title, description, action, children, tone = "" }) {
  return (
    <section className={`deep-section ${tone}`}>
      <header>
        <span className="deep-section-number">{String(index).padStart(2, "0")}</span>
        <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
        {action}
      </header>
      <div className="deep-section-body">{children}</div>
    </section>
  );
}

function AddButton({ label = "Satır ekle" }) {
  return <button type="button" className="table-add"><Plus size={16} />{label}</button>;
}

function DataGrid({ columns, rows, compact = false, footer }) {
  return (
    <div className={`deep-table-wrap ${compact ? "compact" : ""}`}>
      <table className="deep-table">
        <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${row.join("-")}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${cellIndex}-${cell}`}>
                  {typeof cell === "object" && cell !== null
                    ? <span className={`cell-badge ${cell.tone || ""}`}>{cell.text}</span>
                    : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && <tfoot><tr>{footer.map((cell, index) => <td key={`${index}-${cell}`}>{cell}</td>)}</tr></tfoot>}
      </table>
    </div>
  );
}

function Checks({ items, columns = 2 }) {
  return (
    <div className={`check-grid columns-${columns}`}>
      {items.map((item, index) => (
        <label className="check-row" key={item}>
          <input type="checkbox" defaultChecked={index < Math.ceil(items.length * 0.66)} />
          <span><CheckCircle size={18} weight="fill" />{item}</span>
        </label>
      ))}
    </div>
  );
}

function ChoiceBar({ label, options, active = 0 }) {
  return (
    <div className="choice-block">
      <span>{label}</span>
      <div className="choice-bar">
        {options.map((option, index) => <button type="button" className={index === active ? "active" : ""} key={option}>{option}</button>)}
      </div>
    </div>
  );
}

function SummaryCards({ items }) {
  return (
    <div className="summary-strip">
      {items.map(([label, value, note, tone]) => (
        <span className={tone || ""} key={label}><small>{label}</small><strong>{value}</strong>{note && <em>{note}</em>}</span>
      ))}
    </div>
  );
}

function UploadPanel({ title, note = "Fotoğraf, PDF, çizim veya ilgili teknik dosyaları ekleyin.", compact = false }) {
  return (
    <button type="button" className={`deep-upload ${compact ? "compact" : ""}`}>
      <span><Camera size={25} /></span>
      <div><strong>{title}</strong><small>{note}</small></div>
      <em>Dosya seç</em>
    </button>
  );
}

function ApprovalFlow({ steps }) {
  return (
    <div className="approval-flow">
      {steps.map(([title, person, state], index) => (
        <div className={`approval-step ${state}`} key={title}>
          <span>{state === "done" ? <CheckCircle weight="fill" /> : index + 1}</span>
          <div><strong>{title}</strong><small>{person}</small></div>
          <em>{state === "done" ? "Tamamlandı" : state === "waiting" ? "Bekliyor" : "Sırada"}</em>
        </div>
      ))}
    </div>
  );
}

function Note({ children, tone = "" }) {
  return <div className={`deep-note ${tone}`}><Warning size={21} /><p>{children}</p></div>;
}

function HeaderFields({ children, columns = 4 }) {
  return <div className={`deep-fields cols-${columns}`}>{children}</div>;
}

function CustomerSurvey() {
  return (
    <>
      <FormSection index={1} title="Müşteri, karar verici ve fırsat" description="İlk görüşmede ticari muhatabı ve karar mekanizmasını netleştirir.">
        <HeaderFields>
          <Field label="Müşteri / firma" value="Marmara Otelcilik A.Ş." required />
          <Field label="Müşteri tipi" type="select" value="Otel" options={["Otel", "Konut", "Ofis", "Mağaza", "Restoran", "Diğer"]} />
          <Field label="Karar verici" value="Deniz Arslan · Yatırım Direktörü" required />
          <Field label="Mimar / yönlendiren" value="Atölye 34 · Derya Korkmaz" />
          <Field label="Telefon" value="+90 532 555 14 20" />
          <Field label="E-posta" value="deniz.arslan@ornek.com" type="email" />
          <Field label="Fırsat kaynağı" type="select" value="Mimar yönlendirmesi" options={["Mimar yönlendirmesi", "Referans", "Eski müşteri", "Web", "Fuar"]} />
          <Field label="Karar hedefi" type="date" value="2026-08-14" />
        </HeaderFields>
      </FormSection>

      <FormSection index={2} title="İhtiyaç ve kapsam seçimi" description="Talep edilen ürün grupları işaretlenir; teklif kapsamı bu seçimden oluşur.">
        <Checks columns={3} items={["Oda kapıları", "Gardırop / giyinme", "Mutfak", "Banyo dolabı", "TV ünitesi", "Duvar paneli", "Vestiyer", "Masa / banko", "Süpürgelik", "Metal detay", "Cam / ayna", "Tezgâh"]} />
        <HeaderFields columns={3}>
          <Field label="Proje / iş adı" value="Marmara Hotel Renovasyon" required />
          <Field label="Proje adresi" value="Şişli / İstanbul" required />
          <Field label="Yaklaşık bütçe" value="₺20.000.000 – ₺25.000.000" />
          <Field label="Hedef teslim" type="date" value="2026-12-15" />
          <Field label="Teklif son tarihi" type="date" value="2026-08-10" />
          <Field label="Numune alan / oda" value="Tip A · 204 numaralı oda" />
        </HeaderFields>
      </FormSection>

      <FormSection index={3} title="Mahal ve keşif metrajı" description="Her oda veya alan ayrı satırdır; aynı ürün farklı mahalde ayrı takip edilir." action={<AddButton label="Mahal ekle" />}>
        <DataGrid
          columns={["Mahal / kat", "Ürün grubu", "En × boy × derinlik", "Miktar", "Birim", "Mevcut durum", "Ölçü durumu"]}
          rows={[
            ["Tip A Oda · 2–6. kat", "Oda giriş kapısı", "90 × 210 × 18 cm", "48", "Adet", "Söküm gerekli", { text: "Kesin", tone: "success" }],
            ["Tip A Oda · 2–6. kat", "Gardırop", "180 × 240 × 60 cm", "48", "Adet", "Duvarlar hazır değil", { text: "Kontrol", tone: "warning" }],
            ["Lobi · zemin kat", "Duvar paneli", "12,40 × 3,10 m", "38,4", "m²", "Elektrik altyapısı var", { text: "Ön ölçü", tone: "neutral" }],
          ]}
        />
      </FormSection>

      <FormSection index={4} title="Saha koşulları ve teknik kısıtlar" description="Üretim ve montaj planını etkileyen koşullar keşifte kayda alınır.">
        <Checks items={["Duvar / zemin bitmiş", "Elektrik altyapısı hazır", "Yük asansörü kullanılabilir", "Malzeme depolama alanı var", "Çalışma saati kısıtı var", "Söküm ve moloz dahil", "Yangın sınıfı belgesi gerekli", "İSG evrakı gerekli"]} />
        <HeaderFields columns={2}>
          <Field label="Saha çalışma saatleri" value="09:00–17:00 · Pazar çalışma yok" />
          <Field label="Nakliye / giriş bilgisi" value="Arka servis kapısı · max. 3,5 ton" />
          <Field label="Risk ve engeller" type="textarea" value="Lobi kullanımda kalacak; montaj iki etap planlanmalı. Bazı duvar aksları projeden 2–3 cm farklı." wide />
          <Field label="Müşteri beklentisi / kalite seviyesi" type="textarea" value="Numune oda onayı olmadan seri üretim başlamayacak. Kaplama deseni tüm katta devam edecek." wide />
        </HeaderFields>
      </FormSection>

      <FormSection index={5} title="Keşif kanıtları ve dosyalar" description="Fotoğraflar mahal ve iş kalemiyle ilişkilendirilir.">
        <div className="upload-grid">
          <UploadPanel title="Genel saha fotoğrafları" />
          <UploadPanel title="Ölçü ve detay fotoğrafları" />
          <UploadPanel title="Mimari proje / şartname" note="PDF, DWG, XLSX veya müşteri keşif listesi." />
        </div>
      </FormSection>

      <FormSection index={6} title="Keşif sonucu ve sonraki adım">
        <ChoiceBar label="Keşif sonucu" options={["Teklife uygun", "Ek bilgi gerekli", "Teklif dışı"]} />
        <HeaderFields columns={3}>
          <Field label="Teklif sorumlusu" value="Ece Aydın" />
          <Field label="Metraj kontrolü" value="Selin Kara" />
          <Field label="Satın alma fiyat talep tarihi" type="date" value="2026-08-04" />
        </HeaderFields>
      </FormSection>
    </>
  );
}

function OfferForm() {
  return (
    <>
      <FormSection index={1} title="Teklif kimliği ve revizyon" description="Müşteriye gönderilen her revizyon ayrı sürüm olarak saklanır.">
        <HeaderFields>
          <Field label="Müşteri / proje" value="Bodrum Villa" required />
          <Field label="Teklif no" value="TKL-2026-041" required />
          <Field label="Revizyon" value="R2" />
          <Field label="Hazırlayan" value="Ece Aydın" />
          <Field label="Teklif tarihi" type="date" value="2026-07-28" />
          <Field label="Geçerlilik tarihi" type="date" value="2026-08-12" />
          <Field label="Para birimi" type="select" value="TRY" options={["TRY", "EUR", "USD"]} />
          <Field label="KDV" type="select" value="Hariç" options={["Hariç", "Dahil"]} />
        </HeaderFields>
        <ChoiceBar label="Teklif durumu" options={["Maliyet çalışılıyor", "İç onay", "Müşteride", "Kabul", "Kayıp"]} active={2} />
      </FormSection>

      <FormSection index={2} title="Metraj ve fiyatlandırma satırları" description="Yüklenen teklif örneğindeki ürün tanımı, teknik açıklama, birim, miktar ve toplam yapısı; iç maliyetler müşteri çıktısında gösterilmez." action={<AddButton />}>
        <DataGrid
          columns={["No", "Mahal / ürün", "Teknik tanım", "Birim", "Miktar", "Malzeme", "İşçilik", "Dış işlem", "Satış birim", "Toplam"]}
          rows={[
            ["01", "Tip A oda · giriş kapısı", "90×210, lake MDF, yangın dayanımlı kasa", "Adet", "48", "₺24.500", "₺8.750", "₺2.400", "₺48.900", "₺2.347.200"],
            ["02", "Tip A oda · gardırop", "MDF lam gövde, kaplama kapak, Blum aksesuar", "Adet", "48", "₺31.800", "₺10.200", "₺3.600", "₺62.400", "₺2.995.200"],
            ["03", "Lobi · duvar paneli", "Amerikan ceviz kaplama, metal derz profili", "m²", "38,4", "₺8.200", "₺3.100", "₺1.750", "₺18.600", "₺714.240"],
            ["04", "Numune oda · TV ünitesi", "Kaplama panel, gizli LED, metal raf", "Adet", "1", "₺42.000", "₺14.500", "₺8.000", "₺89.000", "₺89.000"],
          ]}
          footer={["", "", "Ara toplam", "", "", "₺1.952.720", "₺650.920", "₺190.000", "", "₺6.145.640"]}
        />
      </FormSection>

      <FormSection index={3} title="Maliyet, genel gider ve kâr kontrolü" tone="summary-section">
        <SummaryCards items={[
          ["Direkt maliyet", "₺4.112.000", "Malzeme + işçilik + dış işlem"],
          ["Genel gider", "₺493.440", "%12"],
          ["Hedef kâr", "₺1.540.200", "%25,1", "positive"],
          ["Teklif toplamı", "₺6.145.640", "KDV hariç", "strong"],
        ]} />
        <HeaderFields columns={4}>
          <Field label="Kur kaynağı / tarihi" value="TCMB · 28.07.2026" />
          <Field label="Fiyat kaynağı güncelliği" value="Satın alma teyitli · 2 gün" />
          <Field label="Risk payı" value="%3" />
          <Field label="Yuvarlama" value="₺6.150.000" />
        </HeaderFields>
      </FormSection>

      <FormSection index={4} title="Kapsam, dahil olanlar ve hariçler">
        <div className="split-notes">
          <div><strong>Dahil olanlar</strong><Checks columns={1} items={["Nakliye ve sahaya indirme", "Montaj ve montaj sarfı", "Numune oda", "2 yıl imalat garantisi"]} /></div>
          <div><strong>Hariç tutulanlar</strong><Checks columns={1} items={["Elektrik tesisatı", "İnşai düzeltmeler", "Vinç / dış cephe erişimi", "Gece çalışma izinleri"]} /></div>
        </div>
        <Field label="Ticari / teknik notlar" type="textarea" value="Kaplama ve lake renk onayından sonra üretim süresi başlar. Mimari ölçü değişiklikleri fiyat revizyonuna tabidir." wide />
      </FormSection>

      <FormSection index={5} title="Ödeme planı" description="Hakedişli veya başlangıç–bitiş tipi işler aynı tabloda farklı taksit tipleriyle kurulabilir." action={<AddButton label="Ödeme adımı ekle" />}>
        <DataGrid columns={["Adım", "Tetikleyici", "Oran", "Tutar", "Vade", "Fatura"]} rows={[
          ["1", "Sözleşme imzası / avans", "%30", "₺1.845.000", "İmza + 3 gün", "Avans faturası"],
          ["2", "Malzeme siparişleri", "%30", "₺1.845.000", "Onay + 3 gün", "Fatura"],
          ["3", "İmalat tamamlanması", "%30", "₺1.845.000", "Hakediş + 7 gün", "Hakediş faturası"],
          ["4", "Teslim ve kabul", "%10", "₺615.000", "Tutanak + 7 gün", "Final fatura"],
        ]} />
      </FormSection>

      <FormSection index={6} title="İç onay ve müşteri gönderimi">
        <ApprovalFlow steps={[
          ["Metraj kontrolü", "Selin Kara · 28 Tem 10:20", "done"],
          ["Satın alma fiyat teyidi", "Yusuf Kaplan · 28 Tem 14:10", "done"],
          ["Ticari onay", "Erdem Yılmaz", "waiting"],
          ["Müşteriye gönderim", "Ece Aydın", "next"],
        ]} />
        <UploadPanel title="Müşteri teklif çıktısı ve ekleri" note="Teklif PDF, teknik şartname, görseller ve ürün kataloğu." compact />
      </FormSection>

      <FormSection index={7} title="Teklif sonucu ve kayıp nedeni" description="Kabul edilmeyen teklifler sebebiyle birlikte izlenir; sonraki fiyatlandırmalar için öğrenme verisi oluşturur.">
        <ChoiceBar label="Müşteri sonucu" options={["Beklemede", "Kabul edildi", "Revizyon istendi", "Kabul edilmedi"]} active={0} />
        <HeaderFields columns={3}>
          <Field label="Sonraki takip tarihi" type="date" value="2026-08-04" />
          <Field label="Kayıp nedeni" type="select" value="Henüz seçilmedi" options={["Henüz seçilmedi", "Fiyat yüksek", "Termin uygun değil", "Rakip seçildi", "Kapsam değişti", "Yatırım ertelendi", "İletişim kesildi", "Diğer"]} />
          <Field label="Rakip / hedef fiyat" value="Bilinmiyor" />
          <Field label="Müşteri geri bildirimi" type="textarea" value="Karar kurulu 4 Ağustos'ta toplanacak; kapı yangın sertifikası ayrıca iletilecek." wide />
        </HeaderFields>
      </FormSection>
    </>
  );
}

function ProjectContract() {
  return (
    <>
      <FormSection index={1} title="Proje kartı ve teklif bağlantısı">
        <HeaderFields>
          <Field label="Proje kodu" value="CP-26042" required />
          <Field label="Proje adı" value="Marmara Hotel Renovasyon" required />
          <Field label="Müşteri" value="Marmara Otelcilik A.Ş." required />
          <Field label="Kabul edilen teklif" value="TKL-2026-044 · R1" />
          <Field label="Proje türü" value="Otel renovasyonu" />
          <Field label="Proje adresi" value="Şişli / İstanbul" />
          <Field label="Başlangıç" type="date" value="2026-08-10" />
          <Field label="Hedef teslim" type="date" value="2026-12-15" />
        </HeaderFields>
      </FormSection>
      <FormSection index={2} title="Sözleşme kontrol kapısı" description="Sözleşme ve kritik ticari şartlar tamamlanmadan proje üretime açılamaz.">
        <Checks items={["İmzalı sözleşme yüklendi", "Kaşe / imza kontrol edildi", "Kapsam teklif ile eşleşiyor", "Teslim tarihi onaylandı", "Gecikme cezası işlendi", "Garanti koşulu işlendi", "Avans tahsil edildi", "Değişiklik yönetimi maddesi var"]} />
        <HeaderFields columns={4}>
          <Field label="Sözleşme bedeli" value="₺24.800.000" />
          <Field label="KDV" value="Hariç" />
          <Field label="Teminat kesintisi" value="%5" />
          <Field label="Garanti" value="24 ay" />
        </HeaderFields>
        <UploadPanel title="İmzalı sözleşme ve ekleri" compact />
      </FormSection>
      <FormSection index={3} title="Kapsam paketleri" action={<AddButton label="Paket ekle" />}>
        <DataGrid columns={["Paket", "Mahal", "Ürün / adet", "İmalat modeli", "Bütçe", "Teslim"]} rows={[
          ["PK-01 Numune oda", "204 · Tip A", "Kapı, gardırop, TV ünitesi · 3", "İç + dış işlem", "₺420.000", "24 Ağu"],
          ["PK-02 Odalar", "2–6. kat", "Kapı ve sabit mobilya · 192", "İç üretim", "₺16.900.000", "20 Kas"],
          ["PK-03 Lobi", "Zemin kat", "Duvar paneli ve banko · 4", "Karma", "₺4.850.000", "30 Kas"],
        ]} />
      </FormSection>
      <FormSection index={4} title="Kilometre taşları ve geçiş onayları">
        <DataGrid columns={["Aşama", "Plan tarihi", "Geçiş şartı", "Onaylayan", "Durum"]} rows={[
          ["Keşif / metraj dondurma", "12 Ağu", "Mahal ölçüleri kesin", "Proje koordinatörü", { text: "Planlandı", tone: "neutral" }],
          ["2D–3D müşteri onayı", "20 Ağu", "Son revizyon imzalı", "Müşteri + mimar", { text: "Bekliyor", tone: "warning" }],
          ["Numune oda onayı", "2 Eyl", "Renk, aksesuar, detay", "Müşteri", { text: "Kilitli", tone: "neutral" }],
          ["Seri üretim başlangıcı", "4 Eyl", "Numune onayı + malzeme hazır", "Üretim müdürü", { text: "Kilitli", tone: "neutral" }],
          ["Montaj başlangıcı", "16 Kas", "Saha hazırlık kontrolü", "Proje koordinatörü", { text: "Kilitli", tone: "neutral" }],
        ]} />
      </FormSection>
      <FormSection index={5} title="Tahsilat yöntemi ve ödeme kilometre taşları">
        <ChoiceBar label="Tahsilat modeli" options={["Hakediş usulü", "Başlangıç / bitiş", "Peşin", "Vadeli"]} />
        <DataGrid columns={["No", "Tetikleyici", "Oran", "Planlanan", "Teminat", "Durum"]} rows={[
          ["1", "Sözleşme / avans", "%30", "₺7.440.000", "—", { text: "Tahsil edildi", tone: "success" }],
          ["2", "Numune oda onayı", "%20", "₺4.960.000", "%5", { text: "Planlı", tone: "neutral" }],
          ["3", "Üretim %75", "%30", "₺7.440.000", "%5", { text: "Planlı", tone: "neutral" }],
          ["4", "Geçici kabul", "%20", "₺4.960.000", "%5", { text: "Planlı", tone: "neutral" }],
        ]} />
      </FormSection>
      <FormSection index={6} title="Ekip, dış çözüm ortakları ve iletişim">
        <HeaderFields columns={3}>
          <Field label="Proje koordinatörü" value="Mert Kaya" />
          <Field label="İç mimar" value="Selin Kara" />
          <Field label="Müşteri proje yetkilisi" value="Deniz Arslan" />
          <Field label="Üretim sorumlusu" value="Ahmet Şahin" />
          <Field label="Montaj sorumlusu" value="Mehmet Yalçın" />
          <Field label="Finans sorumlusu" value="Derya Tunç" />
          <Field label="Cila firması" value="Poli Cila" />
          <Field label="Metal işleri" value="Eksen Metal" />
          <Field label="Kapı / cam / ayna" value="İç üretim / CamArt" />
        </HeaderFields>
      </FormSection>
      <FormSection index={7} title="Başlangıç riskleri ve izinler">
        <Checks items={["Müşteri fotoğraf izni alındı", "KVKK / paylaşım tercihi kaydedildi", "Şantiye giriş prosedürü alındı", "İSG şartları paylaşıldı", "Numune sorumluları belirlendi", "Proje değişiklik yetkilisi belirlendi"]} />
        <Note tone="warning">Fotoğraf izni “iç kayıt”, “müşteriye rapor”, “referans / sosyal medya” için ayrı ayrı alınmalı.</Note>
      </FormSection>
    </>
  );
}

function WorkItemApproval() {
  return (
    <>
      <FormSection index={1} title="İş kalemi kimliği">
        <HeaderFields>
          <Field label="Proje" value="Gedikpaşa Otel" />
          <Field label="İş kalemi kodu" value="GK-ODA-KP-01" />
          <Field label="Mahal / kat" value="Tip A Oda · 2–6. kat" />
          <Field label="Ürün grubu" value="Oda giriş kapısı" />
          <Field label="Miktar / birim" value="48 · Adet" />
          <Field label="Üretim modeli" value="İç üretim + dış cila" />
          <Field label="Bağlı teklif satırı" value="TKL-041 · 01" />
          <Field label="Sorumlu mimar" value="Selin Kara" />
        </HeaderFields>
      </FormSection>
      <FormSection index={2} title="Ölçü, fonksiyon ve tolerans">
        <HeaderFields columns={4}>
          <Field label="Net en" value="900 mm" />
          <Field label="Net boy" value="2100 mm" />
          <Field label="Duvar / kasa kalınlığı" value="180 mm" />
          <Field label="Üretim toleransı" value="±2 mm" />
          <Field label="Açılım yönü" value="Sağ / içe" />
          <Field label="Yangın sınıfı" value="EI60" />
          <Field label="Akustik değer" value="Rw 32 dB" />
          <Field label="Montaj boşluğu" value="10 mm" />
        </HeaderFields>
        <Field label="Teknik tarif" type="textarea" value="6 mm MDF yüzey, masif seren, taş yünü dolgu, mat lake RAL 9010; gizli fitil ve kartlı kilit hazırlığı." wide />
      </FormSection>
      <FormSection index={3} title="Malzeme ve aksesuar reçetesi" action={<AddButton label="Reçete satırı ekle" />}>
        <DataGrid columns={["Katman / parça", "Malzeme / marka", "Ölçü", "Miktar", "Renk / desen", "Tedarik", "Onay"]} rows={[
          ["Kanat seren", "Fırınlı masif çam", "42×110 mm", "5,8 mtül", "Doğal", "Stok", { text: "Onaylı", tone: "success" }],
          ["Yüzey", "MDF 6 mm", "1220×2440", "1,8 plaka", "RAL 9010 mat", "Satın alma", { text: "Numune", tone: "warning" }],
          ["Kilit", "Häfele kartlı kilit", "DIN sağ", "1 takım", "Saten", "Sipariş", { text: "Onaylı", tone: "success" }],
          ["Kasa fitili", "Yangın / duman fitili", "15×4 mm", "5,2 mtül", "Siyah", "Sipariş", { text: "Belge bekliyor", tone: "danger" }],
        ]} />
      </FormSection>
      <FormSection index={4} title="Çizim ve revizyon geçmişi">
        <DataGrid columns={["Rev.", "Tarih", "Dosya", "Değişiklik", "Hazırlayan", "Durum"]} rows={[
          ["R0", "18 Tem", "GK-KP-01-R0.pdf", "İlk imalat çizimi", "Selin Kara", { text: "İptal", tone: "neutral" }],
          ["R1", "23 Tem", "GK-KP-01-R1.pdf", "Kasa detayı ve kartlı kilit", "Selin Kara", { text: "Revize", tone: "warning" }],
          ["R2", "28 Tem", "GK-KP-01-R2.pdf", "Kol aksı +100 mm", "Selin Kara", { text: "Müşteride", tone: "warning" }],
        ]} />
        <UploadPanel title="Yeni çizim / 3D / teknik ek yükle" compact />
      </FormSection>
      <FormSection index={5} title="Numune ve görsel onayları">
        <div className="approval-samples">
          {[
            ["Lake renk numunesi", "RAL 9010 · Mat %10", "Müşteri onayı bekliyor"],
            ["Kapı kolu / rozet", "Häfele 903.12.411", "Onaylandı"],
            ["Kasa köşe detayı", "45° birleşim", "İç onay tamam"],
          ].map(([title, detail, state]) => <div key={title}><span><SealCheck size={22} /></span><strong>{title}</strong><small>{detail}</small><em>{state}</em></div>)}
        </div>
      </FormSection>
      <FormSection index={6} title="Onay kapısı ve üretime aktarım">
        <ApprovalFlow steps={[
          ["İç mimari kontrol", "Selin Kara · tamamlandı", "done"],
          ["Üretilebilirlik kontrolü", "Ahmet Şahin · tamamlandı", "done"],
          ["Müşteri / mimar onayı", "Deniz Arslan", "waiting"],
          ["Üretime serbest bırak", "Proje koordinatörü", "next"],
        ]} />
        <Note tone="danger">Müşteri onayı ve son revizyon kilidi tamamlanmadan üretim iş emri oluşturulamaz.</Note>
      </FormSection>
    </>
  );
}

function Procurement() {
  return (
    <>
      <FormSection index={1} title="Talep başlığı ve ihtiyaç tarihi">
        <HeaderFields>
          <Field label="Talep no" value="SAT-26084" />
          <Field label="Proje" value="Kurtköy Konutları" />
          <Field label="Talep eden" value="Murat Demir" />
          <Field label="Maliyet kodu" value="740.02 · Kaplama" />
          <Field label="İhtiyaç tarihi" type="date" value="2026-08-05" />
          <Field label="Teslim yeri" value="Capproje Fabrika" />
          <Field label="Aciliyet" value="Üretimi durdurur" />
          <Field label="Bütçe kaynağı" value="Proje bütçesi · PK-02" />
        </HeaderFields>
      </FormSection>
      <FormSection index={2} title="Talep satırları" description="Bir talep birden çok ilişkili malzeme veya hizmet satırı içerebilir." action={<AddButton />}>
        <DataGrid columns={["Kod", "Malzeme / hizmet", "Teknik şart", "Miktar", "Birim", "Hedef fiyat", "İhtiyaç", "Numune"]} rows={[
          ["KPL-006", "Amerikan ceviz kaplama", "A kalite · 0,6 mm · aynı desen partisi", "1.250", "m²", "₺1.480", "5 Ağu", "Gerekli"],
          ["MDF-018", "MDF 18 mm", "E1 · 210×280", "420", "Plaka", "₺1.260", "7 Ağu", "Gerekmez"],
          ["TUT-001", "Kaplama tutkalı", "D3 · şeffaf", "320", "Kg", "₺210", "7 Ağu", "Gerekmez"],
        ]} />
      </FormSection>
      <FormSection index={3} title="Teklif toplama ve tedarikçi karşılaştırması" action={<AddButton label="Tedarikçi ekle" />}>
        <DataGrid columns={["Tedarikçi", "Birim fiyat", "Toplam", "Vade", "Teslim", "Kalite / desen", "Nakliye", "Puan"]} rows={[
          ["Ergin Ahşap", "₺1.520", "₺1.900.000", "45 gün", "5 Ağu", "A kalite · tek parti", "Dahil", { text: "92", tone: "success" }],
          ["Eksen Kaplama", "₺1.465", "₺1.831.250", "%30 peşin / 30 gün", "9 Ağu", "A kalite · 2 parti", "Hariç", { text: "81", tone: "warning" }],
          ["Ormanlar Ltd.", "₺1.610", "₺2.012.500", "60 gün", "4 Ağu", "Premium · tek parti", "Dahil", { text: "88", tone: "neutral" }],
        ]} />
        <Note>Desen sürekliliği nedeniyle yalnız en düşük fiyat değil, aynı parti garantisi ve termin birlikte değerlendirildi.</Note>
      </FormSection>
      <FormSection index={4} title="Bütçe etkisi ve satın alma kararı" tone="summary-section">
        <SummaryCards items={[
          ["Proje bütçesi", "₺1.850.000", "Bu maliyet kodu için"],
          ["Seçilen teklif", "₺1.900.000", "Ergin Ahşap"],
          ["Bütçe farkı", "+₺50.000", "%2,7 aşım", "negative"],
          ["Üretim gecikme riski", "0 gün", "5 Ağustos teslim", "positive"],
        ]} />
        <ChoiceBar label="Önerilen karar" options={["Ergin Ahşap", "Eksen Kaplama", "Yeniden teklif topla"]} />
        <Field label="Seçim gerekçesi" type="textarea" value="Tek parti desen garantisi ve üretim planını bozmayacak teslim tarihi nedeniyle Ergin Ahşap önerildi." wide />
      </FormSection>
      <FormSection index={5} title="Onay ve sipariş akışı">
        <ApprovalFlow steps={[
          ["Talep kontrolü", "Proje sorumlusu · tamamlandı", "done"],
          ["Teknik uygunluk", "Mimar / üretim · tamamlandı", "done"],
          ["Bütçe aşımı onayı", "Erdem Yılmaz", "waiting"],
          ["Sipariş oluşturma", "Yusuf Kaplan", "next"],
        ]} />
      </FormSection>
      <FormSection index={6} title="Sipariş koşulları ve ekler">
        <HeaderFields columns={3}>
          <Field label="Ödeme koşulu" value="%30 peşin · bakiye 45 gün" />
          <Field label="Teslim şekli" value="Fabrika teslim · nakliye dahil" />
          <Field label="Parti / kalite şartı" value="Tek parti · değişim garantili" />
        </HeaderFields>
        <div className="upload-grid">
          <UploadPanel title="Tedarikçi teklifleri" />
          <UploadPanel title="Numune / teknik föy" />
          <UploadPanel title="Sipariş formu" />
        </div>
      </FormSection>
    </>
  );
}

function ProductionOrder() {
  return (
    <>
      <FormSection index={1} title="İş emri ve üretim serbestliği">
        <HeaderFields>
          <Field label="İş emri no" value="URE-260197" />
          <Field label="Proje" value="Gedikpaşa Otel" />
          <Field label="İş kalemi / paket" value="GK-ODA-KP-01 · 48 kapı" />
          <Field label="Çizim revizyonu" value="R2 · kilitli" />
          <Field label="Üretim modeli" value="İç üretim + dış cila" />
          <Field label="Sorumlu" value="Ahmet Şahin" />
          <Field label="Plan başlangıcı" type="date" value="2026-08-04" />
          <Field label="Plan bitişi" type="date" value="2026-08-22" />
        </HeaderFields>
        <Checks items={["Sözleşme aktif", "Müşteri çizim onayı var", "Numune onayı var", "Metraj donduruldu", "Malzeme rezervasyonu yapıldı", "Kalite planı açıldı"]} />
      </FormSection>
      <FormSection index={2} title="Malzeme hazırlık listesi / reçete">
        <DataGrid columns={["Malzeme", "İhtiyaç", "Stok", "Sipariş", "Parti / lot", "Hazır tarihi", "Durum"]} rows={[
          ["MDF 6 mm", "96 plaka", "72", "24", "MDF-2607-A", "3 Ağu", { text: "Kısmi", tone: "warning" }],
          ["Masif seren", "278 mtül", "310", "—", "MSF-4421", "Hazır", { text: "Hazır", tone: "success" }],
          ["Yangın fitili", "250 mtül", "0", "250", "Sipariş SAT-26082", "6 Ağu", { text: "Bekliyor", tone: "danger" }],
          ["Kartlı kilit", "48 takım", "48", "—", "HF-903", "Hazır", { text: "Hazır", tone: "success" }],
        ]} />
      </FormSection>
      <FormSection index={3} title="Operasyon rotası ve kapasite" description="Her operasyonun girdi/çıktısı, iş merkezi ve kalite kapısı ayrı planlanır." action={<AddButton label="Operasyon ekle" />}>
        <DataGrid columns={["Sıra", "Operasyon", "İş merkezi / firma", "Plan", "Süre", "Girdi", "Çıktı", "Kalite kapısı", "Durum"]} rows={[
          ["10", "Seren kesim", "Ebatlama 01", "4–5 Ağu", "16 sa", "48 set", "48 set", "Ölçü", { text: "Planlı", tone: "neutral" }],
          ["20", "Kanat pres", "Pres 01", "6–8 Ağu", "24 sa", "48", "48", "Düzlemsellik", { text: "Planlı", tone: "neutral" }],
          ["30", "CNC ve kilit", "CNC 02", "9–11 Ağu", "18 sa", "48", "48", "Aks / tolerans", { text: "Kapasite riski", tone: "warning" }],
          ["40", "Lake boya", "Poli Cila · dış", "12–18 Ağu", "5 gün", "48", "48", "Renk / yüzey", { text: "Dış işlem", tone: "neutral" }],
          ["50", "Montaj öncesi kontrol", "Kalite Alanı", "20 Ağu", "8 sa", "48", "48", "Final kontrol", { text: "Kilitli", tone: "neutral" }],
        ]} />
      </FormSection>
      <FormSection index={4} title="Dış imalat ve çözüm ortağı takibi">
        <HeaderFields columns={3}>
          <Field label="Dış işlem" value="Lake boya" />
          <Field label="Firma" value="Poli Cila" />
          <Field label="Dış iş emri" value="DIS-26071" />
          <Field label="Gidiş sevk" value="SVK-26092 · 12 Ağu" />
          <Field label="Dönüş hedefi" value="18 Ağu · 48 adet" />
          <Field label="Fiyat / ödeme" value="₺2.400 / adet · 30 gün" />
        </HeaderFields>
        <Checks items={["Numune renk teslim edildi", "Renk kodu imzalı", "Giden adet sayıldı", "Ambalaj standardı iletildi", "Dönüş kontrol kriteri iletildi", "Taşeron yeterlilik belgeleri güncel"]} />
      </FormSection>
      <FormSection index={5} title="Kalite kontrol planı">
        <DataGrid columns={["Kontrol", "Aşama", "Örnekleme", "Kriter", "Sorumlu", "Kayıt"]} rows={[
          ["İlk parça", "Pres sonrası", "İlk 2 adet", "Ölçü ±2 mm · eğrilik yok", "Büşra Demir", "Foto + ölçüm"],
          ["Ara kontrol", "CNC sonrası", "%20", "Kilit aksı ve menteşe", "Cem Topal", "Kontrol formu"],
          ["Dış işlem kabul", "Cila dönüşü", "%100 görsel", "Renk tonu · dalga · çizik", "Büşra Demir", "Foto + kusur"],
          ["Final", "Paketleme öncesi", "%100", "Aksesuar ve etiket", "Ahmet Şahin", "Serbest bırakma"],
        ]} />
      </FormSection>
      <FormSection index={6} title="Paketleme, etiket ve sevkiyata hazırlık">
        <HeaderFields columns={3}>
          <Field label="Paketleme standardı" value="Köşe koruma + streç + oda etiketi" />
          <Field label="Etiket şablonu" value="Proje / kat / oda / ürün / sıra" />
          <Field label="Palet planı" value="8 palet · 6 kapı/palet" />
        </HeaderFields>
        <UploadPanel title="İmalat çizimleri ve üretim dosyaları" compact />
      </FormSection>
      <FormSection index={7} title="Gerçekleşen üretim ve kapanış">
        <SummaryCards items={[
          ["Planlanan", "48 adet", "22 Ağustos"],
          ["Üretilen", "0 adet", "İş emri açıldı"],
          ["Fire / yeniden iş", "0", "Henüz yok"],
          ["Termin riski", "+2 gün", "Yangın fitili bekleniyor", "negative"],
        ]} />
      </FormSection>
    </>
  );
}

function Installation() {
  return (
    <>
      <FormSection index={1} title="Montaj paketi ve saha randevusu">
        <HeaderFields>
          <Field label="Proje" value="Kavacık Ofis" />
          <Field label="Montaj emri" value="MON-26091" />
          <Field label="Paket / mahal" value="Danışma bankosu · zemin kat" />
          <Field label="Saha yetkilisi" value="Burak Akın · 0532 555 22 90" />
          <Field label="Başlangıç" type="date" value="2026-07-30" />
          <Field label="Hedef bitiş" type="date" value="2026-08-01" />
          <Field label="Çalışma aralığı" value="08:30–18:00" />
          <Field label="Montaj modeli" value="Capproje Ekibi 1" />
        </HeaderFields>
      </FormSection>
      <FormSection index={2} title="Saha hazırlık kontrolü" description="Saha hazır değilse sevkiyat ve ekip çıkışı ertelenebilir.">
        <Checks items={["Zemin bitmiş ve korunmuş", "Duvar aksları kontrol edildi", "Elektrik uçları hazır", "Yük asansörü rezerve", "Depolama alanı ayrıldı", "Geçiş / kapı ölçüsü uygun", "Çalışma izni alındı", "İSG evrakı onaylandı", "Aydınlatma yeterli", "Diğer ekiplerle çakışma yok"]} />
        <Note tone="warning">Yük asansörü yalnız 10:00–12:00 arası kullanılabilir; sevkiyat sırası buna göre planlandı.</Note>
      </FormSection>
      <FormSection index={3} title="Sevkiyat ve paket kabul listesi">
        <DataGrid columns={["Paket / etiket", "İçerik", "Plan", "Yüklenen", "Hasar", "Sahada", "Konum"]} rows={[
          ["KV-BNK-01", "Banko gövde", "4 modül", "4", "Yok", "4", "Zemin / resepsiyon"],
          ["KV-BNK-02", "Kaplama paneller", "12 panel", "12", "Yok", "12", "Zemin / resepsiyon"],
          ["KV-BNK-03", "Metal kaide", "2 takım", "2", "1 çizik", "2", "Zemin / resepsiyon"],
          ["KV-AKS-01", "Aksesuar / sarf", "1 koli", "1", "Yok", "1", "Ekip aracı"],
        ]} />
      </FormSection>
      <FormSection index={4} title="Ekip, araç, ekipman ve konaklama">
        <HeaderFields columns={3}>
          <Field label="Ekip sorumlusu" value="Mehmet Yalçın" />
          <Field label="Montaj personeli" value="Hasan Usta, Ali Usta, Emre K." />
          <Field label="Araç / sevkiyat" value="34 CAP 126 · SVK-26091" />
          <Field label="Zimmetli ekipman" value="Lazer, hilti, vidalama, vakum" />
          <Field label="Eksik ekipman" value="Yok" />
          <Field label="Konaklama / harcırah" value="Gerekmez" />
        </HeaderFields>
      </FormSection>
      <FormSection index={5} title="Günlük montaj planı ve ilerleme" action={<AddButton label="Gün ekle" />}>
        <DataGrid columns={["Tarih", "Mahal", "Planlanan iş", "Ekip", "Plan", "Gerçekleşen", "Engel / not"]} rows={[
          ["30 Tem", "Resepsiyon", "Kaide ve gövde montajı", "Ekip 1", "%40", "%40", "Tamamlandı"],
          ["31 Tem", "Resepsiyon", "Panel ve tezgâh", "Ekip 1", "%45", "%30", "Elektrik ekibi gecikti"],
          ["1 Ağu", "Resepsiyon", "Aksesuar, rötuş, temizlik", "Ekip 1", "%15", "—", "Planlı"],
        ]} />
      </FormSection>
      <FormSection index={6} title="Eksik / kusur / tamamlanacak işler" action={<AddButton label="Eksik iş ekle" />}>
        <DataGrid columns={["No", "Mahal", "Bulgu", "Tür", "Sorumlu", "Termin", "Kanıt", "Durum"]} rows={[
          ["E-01", "Resepsiyon", "Metal kaidede taşıma çiziği", "Rötuş", "Eksen Metal", "1 Ağu", "2 foto", { text: "Açık", tone: "danger" }],
          ["E-02", "Banko içi", "Priz kapağı eksik", "Saha işi", "Elektrik ekibi", "31 Tem", "1 foto", { text: "Takipte", tone: "warning" }],
        ]} />
      </FormSection>
      <FormSection index={7} title="Teslim, fotoğraf ve müşteri kabulü">
        <div className="upload-grid">
          <UploadPanel title="Montaj öncesi" />
          <UploadPanel title="Montaj sırasında" />
          <UploadPanel title="Tamamlandı / teslim" />
        </div>
        <Checks items={["Alan temiz bırakıldı", "Müşteriye kullanım anlatıldı", "Eksik listesi imzalandı", "Teslim tutanağı imzalandı", "Montaj fotoğrafları proje sorumlusuna iletildi", "Garanti başlangıcı kaydedildi"]} />
        <HeaderFields columns={2}>
          <Field label="Teslim alan müşteri yetkilisi" value="Burak Akın" />
          <Field label="İmza tarihi / saati" value="01.08.2026 · 17:30" />
        </HeaderFields>
      </FormSection>
    </>
  );
}

function QualityPhoto() {
  return (
    <>
      <FormSection index={1} title="Bulgu kimliği ve sınıflandırma">
        <HeaderFields>
          <Field label="Kayıt no" value="KLT-260284" />
          <Field label="Proje" value="Tuzla Villa" />
          <Field label="Aşama" value="Cila / dış işlem" />
          <Field label="Mahal / iş kalemi" value="Ana yatak · giyinme dolabı" />
          <Field label="Tespit yeri" value="Poli Cila kabul alanı" />
          <Field label="Tespit eden" value="Büşra Demir" />
          <Field label="Tespit tarihi" type="date" value="2026-07-28" />
          <Field label="Sorumlu ekip / firma" value="Poli Cila · Zeynep Aksoy" />
        </HeaderFields>
        <ChoiceBar label="Kayıt türü" options={["İlerleme kanıtı", "Eksik iş", "Uygunsuzluk", "Hasar", "Teslim kanıtı"]} active={2} />
        <ChoiceBar label="Önem derecesi" options={["Düşük", "Orta", "Yüksek", "Kritik"]} active={1} />
      </FormSection>
      <FormSection index={2} title="Konum, parça ve kusur tarifi">
        <HeaderFields columns={3}>
          <Field label="Parça / seri" value="Sağ kapak · TV-GD-04-07" />
          <Field label="Kusur kategorisi" value="Yüzey · dalgalanma" />
          <Field label="Etkilenen miktar" value="1 / 12 kapak" />
          <Field label="Ölçü / tolerans sonucu" value="Görsel kriter dışı" />
          <Field label="Müşteriye görünür mü?" value="Evet · kritik yüzey" />
          <Field label="Üretimi durdurur mu?" value="Hayır · ayır / düzelt" />
          <Field label="Bulgu açıklaması" type="textarea" value="Sağ kapak yüzeyinde yan ışık altında görülen dalgalanma ve iki noktada toz kabarcığı mevcut." wide />
        </HeaderFields>
      </FormSection>
      <FormSection index={3} title="Fotoğraf ve kanıt seti">
        <div className="upload-grid">
          <UploadPanel title="Genel görünüm" note="Bulgunun ürün üzerindeki konumunu gösterir." />
          <UploadPanel title="Yakın plan" note="Kusuru ölçek veya işaret ile gösterir." />
          <UploadPanel title="Etiket / seri no" note="Parçanın izlenebilirlik etiketini gösterir." />
        </div>
        <Checks items={["Tarih / saat bilgisi var", "Mahal veya parça etiketi görünüyor", "Kusur işaretlendi", "Ölçek / referans eklendi"]} />
      </FormSection>
      <FormSection index={4} title="Kök neden ve düzeltici faaliyet">
        <HeaderFields columns={2}>
          <Field label="Olası kök neden" type="textarea" value="Ara zımpara yetersizliği ve kabin sıcaklığındaki değişim." wide />
          <Field label="Anlık düzeltme" type="textarea" value="Parça ayrıldı; yeniden zımpara ve son kat uygulaması planlandı." wide />
        </HeaderFields>
        <DataGrid columns={["Faaliyet", "Tür", "Sorumlu", "Termin", "Kanıt", "Durum"]} rows={[
          ["Kapak yeniden zımpara + boya", "Düzeltici", "Poli Cila", "31 Tem", "Sonrası fotoğraf", { text: "Açık", tone: "danger" }],
          ["Kabin sıcaklık kayıtlarını kontrol et", "Kök neden", "Zeynep Aksoy", "30 Tem", "Kontrol çizelgesi", { text: "Devam", tone: "warning" }],
          ["İlk parça ışık kontrolü ekle", "Önleyici", "Büşra Demir", "4 Ağu", "Kalite planı rev.", { text: "Planlı", tone: "neutral" }],
        ]} />
      </FormSection>
      <FormSection index={5} title="Doğrulama ve kapatma">
        <ApprovalFlow steps={[
          ["Düzeltme tamamlandı", "Poli Cila", "waiting"],
          ["Kalite tekrar kontrolü", "Büşra Demir", "next"],
          ["Proje sorumlusu onayı", "Mert Kaya", "next"],
          ["Kayıt kapatma", "Kalite", "next"],
        ]} />
        <Field label="Doğrulama kriteri" value="Yan ışık kontrolünde dalgalanma / kabarcık görünmemeli; renk numuneyle eşleşmeli." wide />
      </FormSection>
      <FormSection index={6} title="Görünürlük ve bildirim">
        <Checks items={["İç kalite ekibine bildir", "Proje sorumlusuna bildir", "Taşerona düzeltme talebi gönder", "Müşteri raporunda göster", "Haftalık toplantı gündemine ekle"]} />
      </FormSection>
    </>
  );
}

function FinanceProgress() {
  return (
    <>
      <FormSection index={1} title="Kayıt amacı ve görünürlük">
        <ChoiceBar label="Kayıt türü" options={["Gelir", "Gider", "Hakediş", "Tahsilat", "Ödeme", "Avans / iade"]} active={2} />
        <ChoiceBar label="Muhasebe kapsamı" options={["Resmi kayıt", "İç yönetim kaydı"]} />
        <Note>Datasoft resmi muhasebenin kaynağı olmaya devam eder; bu ekran proje kârlılığı, nakit ve hakediş takibi içindir.</Note>
      </FormSection>
      <FormSection index={2} title="İşlem başlığı ve proje bağlantısı">
        <HeaderFields>
          <Field label="Proje" value="Gedikpaşa Otel" />
          <Field label="Kayıt / hakediş no" value="HKD-26018-01" />
          <Field label="Cari / karşı taraf" value="Marmara Otelcilik A.Ş." />
          <Field label="Maliyet merkezi" value="CP-25018 · Üretim" />
          <Field label="İşlem tarihi" type="date" value="2026-07-28" />
          <Field label="Vade" type="date" value="2026-08-12" />
          <Field label="Para birimi / kur" value="TRY · 1,00" />
          <Field label="Datasoft fiş no" value="DS-2026-8471" />
        </HeaderFields>
      </FormSection>
      <FormSection index={3} title="Kümülatif hakediş hesabı" description="Önceki, bu dönem ve toplam değerler birlikte görülür; mükerrer hakediş riski azaltılır." action={<AddButton label="Hakediş satırı ekle" />}>
        <DataGrid columns={["İş paketi", "Sözleşme tutarı", "Önceki oran", "Bu dönem", "Toplam oran", "Bu dönem tutar", "Kümülatif"]} rows={[
          ["Kapılar", "₺8.400.000", "%15", "%20", "%35", "₺1.680.000", "₺2.940.000"],
          ["Oda sabit mobilyaları", "₺11.200.000", "%10", "%18", "%28", "₺2.016.000", "₺3.136.000"],
          ["Lobi panelleri", "₺3.600.000", "%0", "%12", "%12", "₺432.000", "₺432.000"],
          ["Montaj / nakliye", "₺1.600.000", "%0", "%0", "%0", "₺0", "₺0"],
        ]} footer={["Toplam", "₺24.800.000", "", "", "%26,2", "₺4.128.000", "₺6.508.000"]} />
      </FormSection>
      <FormSection index={4} title="Kesintiler, vergi ve net hakediş" tone="summary-section">
        <SummaryCards items={[
          ["Brüt bu dönem", "₺4.128.000", "Onaylanan imalat"],
          ["Teminat kesintisi", "−₺206.400", "%5", "negative"],
          ["Diğer kesinti", "−₺35.000", "Saha elektriği", "negative"],
          ["Net hakediş", "₺3.886.600", "KDV hariç", "strong"],
        ]} />
        <HeaderFields columns={4}>
          <Field label="KDV oranı" value="%20" />
          <Field label="Tevkifat" value="Yok" />
          <Field label="KDV tutarı" value="₺777.320" />
          <Field label="Fatura toplamı" value="₺4.663.920" />
        </HeaderFields>
      </FormSection>
      <FormSection index={5} title="Tahsilat planı ve banka / kasa ayrımı">
        <DataGrid columns={["Taksit", "Vade", "Tutar", "Tahsilat kanalı", "Banka / kasa", "Belge", "Durum"]} rows={[
          ["Hakediş 1", "12 Ağu", "₺4.663.920", "Havale", "Garanti BBVA", "Fatura bekliyor", { text: "Planlı", tone: "neutral" }],
          ["Teminat iadesi", "Geçici kabul + 60 gün", "₺206.400", "Havale", "Garanti BBVA", "Teminat", { text: "Beklemede", tone: "warning" }],
        ]} />
        <HeaderFields columns={4}>
          <Field label="Günlük gelir açıklaması" value="1. hakediş tahsilatı" />
          <Field label="Banka girişi" value="₺4.663.920" />
          <Field label="Kasa girişi" value="₺0" />
          <Field label="Önceki devreden kasa" value="₺186.450" />
        </HeaderFields>
      </FormSection>
      <FormSection index={6} title="Proje maliyeti ve kârlılık etkisi">
        <SummaryCards items={[
          ["Teklif maliyeti", "₺17.820.000", "Başlangıç bütçesi"],
          ["Gerçekleşen", "₺12.750.000", "%71,5"],
          ["Kalan tahmin", "₺5.420.000", "Güncel tahmin"],
          ["Beklenen brüt kâr", "₺6.630.000", "%26,7", "positive"],
        ]} />
      </FormSection>
      <FormSection index={7} title="Belge, onay ve mutabakat">
        <div className="upload-grid">
          <UploadPanel title="Hakediş eki / metraj" />
          <UploadPanel title="Fatura / dekont" />
          <UploadPanel title="Müşteri onayı" />
        </div>
        <ApprovalFlow steps={[
          ["Proje kontrolü", "Mert Kaya · tamamlandı", "done"],
          ["Finans kontrolü", "Derya Tunç", "waiting"],
          ["Fatura / Datasoft", "Muhasebe", "next"],
          ["Tahsilat kapatma", "Finans", "next"],
        ]} />
      </FormSection>
    </>
  );
}

function WeeklyMeeting() {
  return (
    <>
      <FormSection index={1} title="Toplantı kimliği ve katılım">
        <HeaderFields columns={4}>
          <Field label="Toplantı tarihi" type="date" value="2026-08-03" />
          <Field label="Toplantı türü" value="Pazartesi proje & üretim" />
          <Field label="Toplantı yöneticisi" value="Erdem Yılmaz" />
          <Field label="Notları tutan" value="Mert Kaya" />
        </HeaderFields>
        <Checks columns={3} items={["Nusret Bey", "Mehmet Ali Bey", "Mücahit Bey", "Cemal Bey", "İrem Hanım", "Satın alma", "Üretim planlama", "Kalite", "Montaj sorumlusu"]} />
      </FormSection>
      <FormSection index={2} title="Geçen haftadan devreden aksiyonlar">
        <DataGrid columns={["No", "Konu", "Proje", "Sorumlu", "Eski termin", "Gecikme", "Durum"]} rows={[
          ["A-118", "Kaplama sipariş onayı", "Kurtköy 306 Daire", "Yusuf Kaplan", "31 Tem", "3 gün", { text: "Açık", tone: "danger" }],
          ["A-121", "R2 çizim müşteri onayı", "Gedikpaşa Otel", "Selin Kara", "31 Tem", "3 gün", { text: "Bekliyor", tone: "warning" }],
          ["A-124", "Lake renk numunesi", "Tuzla Villa", "Zeynep Aksoy", "2 Ağu", "1 gün", { text: "Kontrol", tone: "warning" }],
        ]} />
      </FormSection>
      <FormSection index={3} title="Proje ve üretim durum matrisi" description="Yüklenen Pazartesi toplantı tablosundaki takip alanları yapılandırılmış şekilde tutulur.">
        <DataGrid columns={["Proje", "Mimar / takip", "Yapılacak iş", "Proje / onay", "İç imalat", "Dış imalat", "Cila", "Montaj", "Teslim / kritik not"]} rows={[
          ["Kurtköy 306 Daire", "Nusret / Mücahit / Mehmet Ali", "Mutfak, kapı, vestiyer, banyo", "Çizim dönüşü bekliyor", "Numune mutfak hazır", "Kapı · Fii Door", "—", "Numune montaj", "Kaplama siparişi kritik"],
          ["Kavacık Ofis", "Cemal / İrem", "Ofis mobilyaları", "Patron oda revizyon", "Toplantı ve muhasebe üretimde", "Kapı · Ulusal Mob.", "—", "Planlanmadı", "Patron masa / sehpa kaldı"],
          ["Gedikpaşa Otel", "Mehmet Ali / Cemal", "12 oda + lobi panel", "R2 müşteri onayı", "Lobi panel sırada", "Cila · Poli", "Poli Cila", "4 Ağu", "Onaysız üretim başlamaz"],
          ["Tuzla Villa", "Mücahit / Nusret", "Kahve köşesi, vestiyer, TV", "Onaylı", "Pendik imalatta", "—", "Huzur Cila", "7 Ağu", "Montaj araç planı"],
        ]} />
      </FormSection>
      <FormSection index={4} title="Yeni kararlar ve aksiyonlar" action={<AddButton label="Aksiyon ekle" />}>
        <DataGrid columns={["No", "Karar / yapılacak iş", "Proje", "Sorumlu", "Termin", "Öncelik", "Kanıt / çıktı", "Durum"]} rows={[
          ["A-130", "Alternatif kaplama numunesi alınacak", "Kurtköy", "Yusuf Kaplan", "4 Ağu", "Yüksek", "2 numune + fiyat", { text: "Açık", tone: "danger" }],
          ["A-131", "Montaj araçları personel araçlarından ayrılacak", "Genel", "Selim Usta", "7 Ağu", "Normal", "Araç planı", { text: "Açık", tone: "warning" }],
          ["A-132", "Taşeronlar iş yapış şekline göre sınıflanacak", "Genel", "Mert Kaya", "10 Ağu", "Normal", "Onaylı liste", { text: "Planlı", tone: "neutral" }],
          ["A-133", "Montaj fotoğrafları proje sorumlusuna iletilecek", "Tüm projeler", "Ekip şefleri", "Sürekli", "Yüksek", "Teslim fotoğrafı", { text: "Kural", tone: "success" }],
        ]} />
      </FormSection>
      <FormSection index={5} title="Toplantı kapanışı ve dağıtım">
        <HeaderFields columns={3}>
          <Field label="Sonraki toplantı" type="date" value="2026-08-10" />
          <Field label="Dağıtım grubu" value="Proje + üretim + satın alma" />
          <Field label="Onaylayan yönetici" value="Erdem Yılmaz" />
        </HeaderFields>
        <Checks items={["Açık aksiyonlara sorumlu atandı", "Tüm terminler girildi", "Kritik işler yöneticiye işaretlendi", "Toplantı özeti ekiplere gönderildi", "Fotoğraf / ekler projelere bağlandı", "Gelecek haftaya devredenler belirlendi"]} />
      </FormSection>
    </>
  );
}

function Supplier() {
  return (
    <>
      <FormSection index={1} title="Firma, yetkili ve resmi bilgiler">
        <HeaderFields>
          <Field label="Firma unvanı" value="Ergin Ahşap San. Tic. Ltd." />
          <Field label="Tedarikçi kodu" value="TED-0041" />
          <Field label="Vergi dairesi / no" value="İkitelli · 1234567890" />
          <Field label="Firma tipi" value="Malzeme tedarikçisi" />
          <Field label="Yetkili" value="Hakan Ergin" />
          <Field label="Telefon" value="+90 212 555 10 20" />
          <Field label="E-posta" value="satis@erginahsap.com" />
          <Field label="Adres" value="İkitelli OSB · Başakşehir" />
        </HeaderFields>
      </FormSection>
      <FormSection index={2} title="Yetkinlik ve hizmet kapsamı">
        <Checks columns={3} items={["Kaplama", "Masif panel", "Kontrplak", "MDF / sunta", "Cila", "Döşeme", "Metal", "Tezgâh", "Cam / ayna", "Kapı", "Nakliye", "Montaj"]} />
        <HeaderFields columns={3}>
          <Field label="Hizmet bölgesi" value="Marmara · fabrika teslim" />
          <Field label="Aylık kapasite" value="8.000 m² kaplama" />
          <Field label="Tipik termin" value="5–7 iş günü" />
        </HeaderFields>
      </FormSection>
      <FormSection index={3} title="Ticari koşullar ve banka bilgisi">
        <HeaderFields columns={4}>
          <Field label="Standart vade" value="45 gün" />
          <Field label="Peşin iskonto" value="%3" />
          <Field label="Para birimi" value="TRY / EUR" />
          <Field label="Fiyat geçerliliği" value="7 gün" />
          <Field label="Minimum sipariş" value="250 m²" />
          <Field label="Nakliye" value="1.000 m² üzeri dahil" />
          <Field label="İade / değişim" value="Kusurlu ürün 7 gün" />
          <Field label="IBAN" value="TR12 0006 2000 0000 1234 5678 90" />
        </HeaderFields>
      </FormSection>
      <FormSection index={4} title="Yeterlilik, sözleşme ve belgeler">
        <DataGrid columns={["Belge", "Belge no", "Geçerlilik", "Kontrol", "Durum"]} rows={[
          ["Vergi levhası", "2026-ERG-01", "31.12.2026", "Derya Tunç", { text: "Geçerli", tone: "success" }],
          ["İmza sirküleri", "IS-2025-118", "Süresiz", "Derya Tunç", { text: "Geçerli", tone: "success" }],
          ["Kalite belgesi", "ISO 9001-4451", "18.03.2027", "Büşra Demir", { text: "Geçerli", tone: "success" }],
          ["Mesleki yeterlilik", "MYK-USTA-14", "12.09.2026", "İK", { text: "Yaklaşıyor", tone: "warning" }],
        ]} />
        <UploadPanel title="Yeni belge veya sözleşme ekle" compact />
      </FormSection>
      <FormSection index={5} title="Performans puan kartı" tone="summary-section">
        <SummaryCards items={[
          ["Fiyat", "4,2 / 5", "Son 8 teklif"],
          ["Kalite", "4,7 / 5", "2 iade / 31 teslim"],
          ["Termin", "3,8 / 5", "%84 zamanında"],
          ["İletişim", "4,5 / 5", "Ortalama yanıt 3 sa"],
        ]} />
        <ChoiceBar label="Onay statüsü" options={["Aday", "Onaylı", "Şartlı", "Bloke"]} active={1} />
      </FormSection>
      <FormSection index={6} title="Sipariş ve değerlendirme geçmişi">
        <DataGrid columns={["Sipariş", "Proje", "Kapsam", "Tutar", "Plan / gerçek", "Kalite", "Değerlendirme"]} rows={[
          ["SIP-26074", "Gedikpaşa Otel", "Amerikan ceviz kaplama", "₺485.000", "5 / 5 gün", "Uygun", "4,8 / 5"],
          ["SIP-26061", "Tuzla Villa", "Kaplama + kontrplak", "₺312.500", "4 / 6 gün", "1 iade", "3,7 / 5"],
          ["SIP-26043", "Kavacık Ofis", "Masif panel", "₺228.000", "7 / 7 gün", "Uygun", "4,5 / 5"],
        ]} />
      </FormSection>
    </>
  );
}

const formBodies = {
  "customer-survey": CustomerSurvey,
  offer: OfferForm,
  "project-contract": ProjectContract,
  "work-item-approval": WorkItemApproval,
  procurement: Procurement,
  "production-order": ProductionOrder,
  installation: Installation,
  "quality-photo": QualityPhoto,
  "finance-progress": FinanceProgress,
  "weekly-meeting": WeeklyMeeting,
  supplier: Supplier,
};

export function SpecializedForm({ id }) {
  const Body = formBodies[id] || CustomerSurvey;
  return (
    <div className={`specialized-form specialized-${id}`}>
      <div className="deep-form-guide">
        <ClipboardText size={20} />
        <p><strong>Alan değerlendirme prototipi:</strong> bölüm başlıklarını, tekrar eden satırları, onay kapılarını ve rol görünürlüklerini firma ekibiyle birlikte işaretleyin.</p>
        <button type="button"><FileText size={17} />Alan listesi</button>
      </div>
      <Body />
      <div className="deep-form-actions">
        <span>Bu prototip veri kaydetmez; alanların kapsamını netleştirmek içindir.</span>
        <button type="button" className="secondary-button">Taslak görünümü</button>
        <button type="submit" className="primary-button"><CheckCircle size={19} />Formu tamamla</button>
      </div>
    </div>
  );
}

export function FormStructureSummary({ id }) {
  const meta = formBlueprintMeta[id];
  if (!meta) return null;
  return (
    <div className="form-structure-summary">
      <strong>Bu formun iş yapısı</strong>
      <span><b>{meta.sections}</b> işe özel bölüm</span>
      <span><b>{meta.fields}</b> alan / tablo hücresi</span>
      <p>{meta.summary}</p>
      <div className="structure-tags">
        {meta.summary.split(" · ").map((item) => <em key={item}>{item}</em>)}
      </div>
      <button type="button">Form alanlarını değerlendir <ArrowRight size={16} /></button>
    </div>
  );
}
