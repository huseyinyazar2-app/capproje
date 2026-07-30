import { useState } from "react";
import {
  ArrowRight,
  ArrowsLeftRight,
  Brain,
  Buildings,
  Calculator,
  Camera,
  ChartLineDown,
  Check,
  CheckCircle,
  Clock,
  Cloud,
  CurrencyCircleDollar,
  Database,
  Factory,
  FileText,
  FloppyDisk,
  GitDiff,
  HardHat,
  Lightbulb,
  LinkSimple,
  LockKey,
  MagicWand,
  MapPin,
  Package,
  Pause,
  Play,
  QrCode,
  ShieldCheck,
  Signature,
  TrendDown,
  TrendUp,
  Truck,
  Users,
  Warning,
  WifiHigh,
} from "@phosphor-icons/react";

const modules = [
  ["overview", "Değer Haritası", "Vizyon", Lightbulb],
  ["estimate", "Akıllı Teklif", "Teklif", Calculator],
  ["revision", "Revizyon & Onay", "Revizyon", GitDiff],
  ["margin", "Kâr Kontrolü", "Kâr", ChartLineDown],
  ["outsource", "Dış İşlem", "Dış İşlem", ArrowsLeftRight],
  ["shopfloor", "Atölye Mobil", "Atölye", QrCode],
  ["field", "Montaj & Hakediş", "Saha", HardHat],
  ["platform", "Firma Yönetimi", "SaaS", Cloud],
  ["intelligence", "Akıllı Öneriler", "YZ", Brain],
];

const formatMoney = (value) => `₺${new Intl.NumberFormat("tr-TR").format(value)}`;

function Status({ tone = "", children }) {
  return <span className={`vision-status ${tone}`}>{children}</span>;
}

function Metric({ label, value, note, tone = "" }) {
  return <span className={`vision-metric ${tone}`}><small>{label}</small><strong>{value}</strong><em>{note}</em></span>;
}

function Panel({ kicker, title, icon: Icon, side, className = "", children }) {
  return (
    <section className={`vision-panel ${className}`}>
      <header><div><small>{kicker}</small><h3>{title}</h3></div>{side || (Icon && <Icon size={23} />)}</header>
      {children}
    </section>
  );
}

function ScreenTitle({ eyebrow, title, description, status }) {
  return (
    <header className="vision-screen-title">
      <div><span>{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>
      {status}
    </header>
  );
}

function Table({ headers, rows, compact = false }) {
  return (
    <div className={`vision-table ${compact ? "compact" : ""}`} style={{ "--vision-cols": headers.length }}>
      <div className="vision-table-head">{headers.map((header) => <span key={header}>{header}</span>)}</div>
      {rows.map((row, rowIndex) => (
        <div className="vision-table-row" key={`${rowIndex}-${row[0]}`}>
          {row.map((cell, cellIndex) => <span key={`${cellIndex}-${cell}`}>{cell}</span>)}
        </div>
      ))}
    </div>
  );
}

function ContextBar({ items }) {
  return <div className="vision-context-bar">{items.map(([label, value]) => <span key={label}><small>{label}</small><strong>{value}</strong></span>)}</div>;
}

function Overview({ selectModule }) {
  const outcomes = [
    ["3×", "daha hızlı teklif", "Metraj, reçete ve güncel fiyat aynı hesapta.", Calculator, "estimate"],
    ["0", "eski revizyonla üretim", "Onaysız çizim üretime açılamaz.", GitDiff, "revision"],
    ["7 gün", "önceden kâr uyarısı", "Sapma teslimden önce görünür.", ChartLineDown, "margin"],
    ["%92", "ilk seferde doğru montaj", "Mahal ve eksik iş sahada kapanır.", HardHat, "field"],
  ];
  return (
    <div className="vision-screen">
      <ScreenTitle
        eyebrow="ÜRÜNÜN ANA SÖZÜ"
        title="Tekliften montaja hiçbir maliyet, revizyon veya ek iş kaybolmayacak."
        description="Capproje'nin ilk müşterisi olduğu; özel üretim mobilya, kapı ve mimari ahşap firmalarına tekrar satılabilen sektörel işletim sistemi."
        status={<Status tone="success"><CheckCircle weight="fill" /> Müşteri görüşme modu</Status>}
      />
      <section className="vision-outcomes">
        {outcomes.map(([value, title, note, Icon, target]) => (
          <button key={title} onClick={() => selectModule(target)}>
            <Icon size={25} /><span><strong>{value}</strong><b>{title}</b><small>{note}</small></span><ArrowRight size={18} />
          </button>
        ))}
      </section>
      <div className="vision-two-columns">
        <Panel kicker="ÜRÜN OMURGASI" title="Sektöre özgü kayıt zinciri" icon={Package}>
          <div className="vision-record-chain">
            {[
              ["01", "Proje", "CP-25018 · Gedikpaşa Otel"],
              ["02", "Blok / Kat / Mahal", "A Blok · 4. Kat · 401 numaralı oda"],
              ["03", "Ürün / İş kalemi", "Lake oda kapısı · 48 adet"],
              ["04", "Çizim / Revizyon", "R3 · müşteri onaylı"],
              ["05", "Reçete / Operasyon", "Malzeme, süre, dış işlem ve kalite"],
              ["06", "Teslim / Finans", "Montaj, hakediş ve gerçek kâr"],
            ].map(([number, title, note]) => <span key={number}><i>{number}</i><b>{title}</b><small>{note}</small></span>)}
          </div>
        </Panel>
        <Panel kicker="ÖNCELİKLİ DEĞER" title="Her ekranın cevapladığı soru" icon={Lightbulb}>
          <div className="vision-question-list">
            {[
              ["Teklif", "Bu işi hangi fiyatın altında almamalıyız?", "estimate"],
              ["Revizyon", "Üretimdeki çizim gerçekten son onaylı sürüm mü?", "revision"],
              ["Kârlılık", "Proje neden para kaybediyor?", "margin"],
              ["Dış işlem", "Hangi parça kimde ve ne zaman dönecek?", "outsource"],
              ["Montaj", "Hangi mahal eksiksiz teslim edildi?", "field"],
            ].map(([label, question, target]) => (
              <button key={label} onClick={() => selectModule(target)}><span><small>{label}</small><strong>{question}</strong></span><ArrowRight size={18} /></button>
            ))}
          </div>
        </Panel>
      </div>
      <section className="vision-boundary">
        <div><ShieldCheck size={25} /><span><strong>İlk sürüm sınırı</strong><small>Genel muhasebe, bordro ve tam CAD/CAM yeniden yapılmayacak; Datasoft ve tasarım araçlarıyla entegrasyon kurulacak.</small></span></div>
        <div><Database size={25} /><span><strong>Kalıcı avantaj</strong><small>Sektör reçeteleri, gerçek maliyet ve tedarik performans verisi zamanla güçlenecek.</small></span></div>
      </section>
    </div>
  );
}

function EstimateScreen({ notify }) {
  const [variant, setVariant] = useState("Standart");
  const variants = {
    Ekonomik: [1987200, 1640200, 17.5, "Melamin / standart aksesuar"],
    Standart: [2347200, 1741800, 25.8, "Mat lake / Blum aksesuar"],
    Premium: [2750400, 1926800, 29.9, "Doğal kaplama / premium aksesuar"],
  };
  const [sale, cost, margin, finish] = variants[variant];
  return (
    <div className="vision-screen">
      <ScreenTitle
        eyebrow="TEKLİF & MALİYET MOTORU"
        title="Fiyatı tahminle değil, ölçü ve gerçek maliyetle oluştur."
        description="Mahal bazlı metraj; malzeme, işçilik, fire, dış işlem, kur, nakliye ve montajla birlikte satış marjını teklif verilmeden korur."
        status={<Status tone="success"><ShieldCheck weight="fill" /> Marj tabanı: %22</Status>}
      />
      <ContextBar items={[["Teklif", "TKL-2026-041 · R2"], ["Proje", "Bodrum Villa"], ["Kur", "EUR 51,42 · USD 44,16"], ["Fiyat tarihi", "30 Tem · 09:10"]]} />
      <div className="vision-variant-tabs">
        {Object.entries(variants).map(([name, item]) => (
          <button key={name} className={variant === name ? "active" : ""} onClick={() => setVariant(name)}>
            <span><b>{name}</b><small>{item[3]}</small></span><strong>%{String(item[2]).replace(".", ",")}</strong>
          </button>
        ))}
      </div>
      <div className="vision-workbench">
        <Panel kicker="MAHAL BAZLI METRAJ" title="A Blok · Tip A Oda" side={<Status>12 mahal</Status>} className="estimate-lines">
          <Table
            headers={["Ürün / ölçü", "Miktar", "Malzeme", "İşçilik", "Satış", "Marj"]}
            rows={[
              ["Oda kapısı · 90×210", "48 ad", "₺1.176.000", "₺420.000", formatMoney(Math.round(sale * .56)), `%${margin}`],
              ["Gardırop · 240×260", "24 ad", "₺392.400", "₺168.000", formatMoney(Math.round(sale * .29)), `%${(margin + 2.2).toFixed(1)}`],
              ["TV paneli · 180×220", "24 ad", "₺173.400", "₺96.000", formatMoney(Math.round(sale * .15)), `%${(margin - 1.4).toFixed(1)}`],
            ]}
          />
          <button className="vision-inline-action" onClick={() => notify("Yeni mahal satırı için örnek giriş alanı açıldı.")}><Calculator size={18} /> Mahal veya ürün satırı ekle</button>
        </Panel>
        <Panel kicker="TEKLİF SONUCU" title={`${variant} senaryo`} icon={CurrencyCircleDollar} className="estimate-summary">
          <Metric label="Toplam satış" value={formatMoney(sale)} note="KDV hariç" />
          <Metric label="Tahmini maliyet" value={formatMoney(cost)} note="Güncel fiyatlarla" />
          <Metric label="Brüt kâr / marj" value={formatMoney(sale - cost)} note={`%${String(margin).replace(".", ",")} marj`} tone={margin < 22 ? "danger" : "success"} />
          <div className={`vision-margin-guard ${margin < 22 ? "danger" : "success"}`}>
            {margin < 22 ? <Warning size={22} weight="fill" /> : <ShieldCheck size={22} weight="fill" />}
            <span><strong>{margin < 22 ? "Yönetici onayı gerekli" : "Marj tabanı korunuyor"}</strong><small>{finish}</small></span>
          </div>
        </Panel>
      </div>
      <Panel kicker="MALİYET KATMANLARI" title="Teklif fiyatını oluşturan gerçek kalemler" side={<Status tone="warning">2 risk izleniyor</Status>}>
        <div className="cost-layer-grid">
          {[
            ["Malzeme", "₺1.283.400", "%7 fire dahil", 74],
            ["İşçilik", "₺684.000", "1.824 saat", 42],
            ["Dış işlem", "₺216.000", "Cila + metal", 28],
            ["Nakliye & montaj", "₺168.400", "Bodrum · 2 ekip", 22],
            ["Genel gider", "₺279.600", "%12 dağıtım", 31],
            ["Kur & risk payı", "₺92.500", "45 gün geçerlilik", 16],
          ].map(([label, value, note, width]) => <span key={label}><small>{label}</small><strong>{value}</strong><em>{note}</em><i><b style={{ width: `${width}%` }} /></i></span>)}
        </div>
      </Panel>
    </div>
  );
}

function RevisionScreen({ notify }) {
  const [revision, setRevision] = useState("R3");
  const revisions = {
    R1: ["18 Tem", "Arşiv", "İlk teknik çizim"],
    R2: ["24 Tem", "Reddedildi", "Kasa detayı değişti"],
    R3: ["29 Tem", "Onaylandı", "Kol aksı +10 cm, yangın fitili eklendi"],
  };
  const approved = revision === "R3";
  return (
    <div className="vision-screen">
      <ScreenTitle
        eyebrow="REVİZYON & MÜŞTERİ ONAYI"
        title="Üretim yalnızca son onaylı çizimle başlasın."
        description="Çizim, malzeme ve numune onaylarını değiştirilemez zaman damgasıyla mahal ve ürün seviyesinde takip eder."
        status={<Status tone="success"><LockKey weight="fill" /> Üretime açık · R3</Status>}
      />
      <ContextBar items={[["İş kalemi", "KP-01 · Lake oda kapısı"], ["Mahal", "A Blok · 2–6. kat · 48 ad"], ["Mimar", "Selin Kara"], ["Onaylayan", "Berk Akın · İşveren"]]} />
      <div className="revision-layout">
        <Panel kicker="SÜRÜM GEÇMİŞİ" title="Çizim revizyonları" icon={GitDiff} className="revision-history">
          {Object.entries(revisions).map(([id, item]) => (
            <button key={id} className={revision === id ? "active" : ""} onClick={() => setRevision(id)}>
              <i>{id}</i><span><strong>{item[2]}</strong><small>Selin Kara · {item[0]}</small></span>
              <Status tone={item[1] === "Onaylandı" ? "success" : item[1] === "Reddedildi" ? "danger" : ""}>{item[1]}</Status>
            </button>
          ))}
        </Panel>
        <Panel kicker="SEÇİLİ ÇİZİM" title={`KP-01-KAPI-${revision}.pdf`} icon={FileText} className="revision-document">
          <div className="revision-spec">
            <div>
              <span><small>Kanat ölçüsü</small><strong>900 × 2100 mm</strong></span>
              <span><small>Yüzey</small><strong>RAL 9010 · mat lake</strong></span>
              <span><small>Kasa</small><strong>{approved ? "Yangın fitilli · 42 mm" : "Standart · 40 mm"}</strong></span>
              <span><small>Kol aksı</small><strong>{revision === "R1" ? "1000" : revision === "R2" ? "1050" : "1100"} mm</strong></span>
            </div>
            <div className="revision-change-note"><GitDiff size={25} /><span><strong>{revisions[revision][2]}</strong><small>Önceki sürüme göre değişiklik</small></span></div>
          </div>
        </Panel>
        <Panel kicker="ONAY KAPISI" title="Üretime serbest bırakma" icon={LockKey} className="approval-gate">
          {[
            ["İç teknik kontrol", true, "29 Tem · 10:14"],
            ["Mimar kontrolü", true, "29 Tem · 13:42"],
            ["Müşteri onayı", approved, approved ? "29 Tem · 16:08" : "Bu sürüm için yok"],
            ["Numune onayı", approved, approved ? "N-014 · 30 Tem" : "Bekleniyor"],
          ].map(([label, done, note]) => <span key={label} className={done ? "done" : "pending"}>{done ? <Check size={17} /> : <Clock size={17} />}<b>{label}</b><small>{note}</small></span>)}
          <button disabled={!approved} onClick={() => notify("R3 üretim serbest bırakma kaydı açıldı.")}><LockKey size={18} /> {approved ? "Üretim kaydını görüntüle" : "Onaylar tamamlanmadı"}</button>
        </Panel>
      </div>
      <section className="revision-impact">
        <span><small>Maliyet etkisi</small><strong>+₺84.600</strong><em>Kasa ve fitil</em></span>
        <span><small>Termin etkisi</small><strong>+2 gün</strong><em>Numune onayı</em></span>
        <span><small>Satın alma etkisi</small><strong>2 sipariş</strong><em>Güncellendi</em></span>
        <span><small>Değişiklik emri</small><strong>DE-009</strong><em>Müşteriye iletildi</em></span>
      </section>
    </div>
  );
}

function MarginScreen() {
  return (
    <div className="vision-screen">
      <ScreenTitle
        eyebrow="TAHMİNİ BİTİŞ KÂRI"
        title="Proje para kaybetmeye başlamadan nedenini göster."
        description="Bütçe, bağlı maliyet, gerçekleşen ve kalan tahmini maliyet aynı görünümde; sapmalar mahal ve sorumluya kadar izlenir."
        status={<Status tone="danger"><TrendDown weight="bold" /> Marj %24,0 → %16,8</Status>}
      />
      <div className="margin-metrics">
        <Metric label="Sözleşme geliri" value="₺24,80 Mn" note="Ek işler dahil" />
        <Metric label="Başlangıç bütçesi" value="₺18,85 Mn" note="%24 hedef" />
        <Metric label="Gerçekleşen + bağlı" value="₺15,92 Mn" note="Bugüne kadar" />
        <Metric label="Kalan tahmin" value="₺4,71 Mn" note="Mevcut gidişle" tone="warning" />
        <Metric label="Bitiş kârı" value="₺4,17 Mn" note="%16,8 marj" tone="danger" />
      </div>
      <div className="vision-two-columns margin-columns">
        <Panel kicker="KÂR KAYBI NEDENLERİ" title="₺431.500 kontrol edilebilir sapma" icon={ChartLineDown}>
          <div className="leakage-list">
            {[
              ["Malzeme fiyat artışı", "₺182.400", 78, "Tedarik"],
              ["Yeniden üretim", "₺96.800", 44, "Kalite"],
              ["Onaysız ek iş", "₺71.500", 34, "Saha"],
              ["Fazla işçilik", "₺48.200", 23, "Üretim"],
              ["Fire sapması", "₺32.600", 16, "Malzeme"],
            ].map(([label, value, width, source]) => <span key={label}><b>{label}</b><strong>{value}</strong><i><em style={{ width: `${width}%` }} /></i><small>{source}</small></span>)}
          </div>
        </Panel>
        <Panel kicker="ERKEN MÜDAHALE" title="Bu hafta alınacak kararlar" icon={Warning}>
          <div className="intervention-list">
            <span><i>1</i><b>Kaplama siparişini iki tedarikçiye böl</b><small>Tahmini kazanım ₺74.000 · Yusuf Kaplan</small><Status tone="danger">Bugün</Status></span>
            <span><i>2</i><b>R3 dışındaki üretim çıktılarını durdur</b><small>Risk altındaki değer ₺96.800 · Ahmet Şahin</small><Status tone="warning">4 saat</Status></span>
            <span><i>3</i><b>DE-009 ek iş onayını tamamla</b><small>Tahsil edilebilir ₺71.500 · Ece Aydın</small><Status>Yarın</Status></span>
          </div>
        </Panel>
      </div>
      <Panel kicker="SAPMA DETAYI" title="En fazla kayıp üreten mahal ve ürünler" side={<Status>5 / 42 iş kalemi</Status>}>
        <Table headers={["Mahal / ürün", "Bütçe", "Bitiş tahmini", "Sapma", "Ana neden", "Sorumlu"]} rows={[
          ["Tip A Oda · Kapı", "₺2.104.000", "₺2.382.400", "+₺278.400", "Revizyon + yeniden üretim", "Ahmet Şahin"],
          ["Lobi · Duvar paneli", "₺1.860.000", "₺1.948.600", "+₺88.600", "Kaplama fiyatı", "Yusuf Kaplan"],
          ["Restoran · Sabit bank", "₺742.000", "₺806.500", "+₺64.500", "Onaysız saha değişikliği", "Mert Kaya"],
        ]} />
      </Panel>
    </div>
  );
}

function OutsourceScreen({ notify }) {
  const lanes = [
    ["Gönderime hazır", "2 parti", [["DI-104", "Lake kapak · 36 ad", "R3 · Poli Cila", "Bugün 15:00"]]],
    ["Dış işlemde", "3 parti", [["DI-101", "Kapı kanadı · 48 ad", "R3 · Poli Cila", "2 gün kaldı"], ["DI-098", "Pirinç profil · 210 mt", "R2 · Eksen Metal", "Yarın"]]],
    ["Dönüş bekleniyor", "1 parti", [["DI-094", "Cam raf · 72 ad", "R1 · Aras Cam", "1 gün gecikti"]]],
    ["Giriş kalite", "2 parti", [["DI-091", "TV paneli · 24 ad", "R2 · Poli Cila", "3 kusur"], ["DI-089", "Metal kaide · 16 ad", "R1 · Eksen Metal", "Kontrol açık"]]],
  ];
  return (
    <div className="vision-screen">
      <ScreenTitle eyebrow="DIŞ ÜRETİM & EMANET TAKİBİ" title="Hangi parça kimde, hangi revizyonda ve ne zaman dönecek?" description="Cila, cam, metal, CNC ve döşeme işlerinde adet, zimmet, numune, termin ve giriş kalite tek akışta." status={<Status tone="warning"><Warning weight="fill" /> 1 gecikme · 3 kusur</Status>} />
      <div className="outsource-board">
        {lanes.map(([title, count, cards]) => (
          <section key={title}><header><strong>{title}</strong><small>{count}</small></header>
            {cards.map(([code, item, supplier, date]) => (
              <button key={code} onClick={() => notify(`${code} dış işlem kartı açıldı.`)}>
                <span><small>{code}</small><Status tone={date.includes("gecikti") || date.includes("kusur") ? "danger" : ""}>{date}</Status></span>
                <strong>{item}</strong><small>{supplier}</small><i><MapPin size={15} /> Son konum kayıtlı</i>
              </button>
            ))}
          </section>
        ))}
      </div>
      <div className="vision-two-columns">
        <Panel kicker="ZİMMET & SAYIM" title="DI-101 · Poli Cila sevki" icon={Truck}>
          <div className="custody-grid">
            <span><small>Gönderilen</small><strong>48 adet</strong><em>29 Tem · 14:22</em></span>
            <span><small>Teslim alınan</small><strong>48 adet</strong><em>Hakan Usta imzalı</em></span>
            <span><small>Beklenen dönüş</small><strong>01 Ağu</strong><em>16:00 öncesi</em></span>
            <span><small>Revizyon</small><strong>R3</strong><em>Müşteri onaylı</em></span>
          </div>
          <div className="custody-check"><CheckCircle size={20} weight="fill" /><span><strong>Adet ve revizyon eşleşti</strong><small>İrsaliye DI-101-01 ile doğrulandı.</small></span></div>
        </Panel>
        <Panel kicker="TEDARİKÇİ PERFORMANSI" title="Son 90 gün" icon={Buildings}>
          <Table compact headers={["Firma", "Zamanında", "Kusur", "Puan"]} rows={[["Poli Cila", "%88", "%2,4", "4,2 / 5"], ["Eksen Metal", "%94", "%1,1", "4,6 / 5"], ["Aras Cam", "%71", "%3,8", "3,4 / 5"]]} />
        </Panel>
      </div>
    </div>
  );
}

function ShopfloorScreen({ notify }) {
  const [jobState, setJobState] = useState("ready");
  return (
    <div className="vision-screen">
      <ScreenTitle eyebrow="ATÖLYE TABLETİ & PWA" title="Usta yalnızca bugün yapacağı işi ve son onaylı bilgiyi görsün." description="QR ile iş emri açılır; çizim, malzeme, kontrol, süre ve fotoğraf tek dokunuşla kaydedilir. Zayıf bağlantıda çevrimdışı çalışır." status={<Status tone="success"><WifiHigh weight="bold" /> Eşitleme 09:42</Status>} />
      <div className="shopfloor-layout">
        <section className="shopfloor-traveler">
          <header><div className="qr-mark"><QrCode size={54} /></div><div><small>İŞ EMRİ · U-26018-142</small><h3>Lake oda kapısı · Kasa montajı</h3><p>Gedikpaşa Otel · Tip A Oda · 48 adet</p></div><Status tone="success"><LockKey size={15} /> R3 onaylı</Status></header>
          <div className="traveler-info">
            <span><small>İş merkezi</small><strong>Montaj Tezgâhı 2</strong></span><span><small>Planlanan</small><strong>6 saat 30 dakika</strong></span>
            <span><small>Sorumlu</small><strong>Osman Yıldız</strong></span><span><small>Hedef</small><strong>Bugün · 16:30</strong></span>
          </div>
          <div className="traveler-specs"><div><small>GÜNCEL TEKNİK BİLGİ</small><strong>90 × 210 cm · RAL 9010 mat</strong><p>Yangın fitilli kasa. Kol aksı 1100 mm. Montaj öncesi yön kontrol edilecek.</p></div><button onClick={() => notify("R3 teknik çizim açıldı.")}><FileText size={21} /> R3 çizimi aç</button></div>
          <div className="traveler-checks">{["48 kasa hazır", "Fitil ve bağlantı elemanı tam", "R3 çizimi tezgâhta", "İlk ürün kalite kontrolü"].map((item, index) => <label key={item}><input type="checkbox" defaultChecked={index < 3} /><span>{item}</span></label>)}</div>
          <div className="traveler-actions">
            {jobState === "ready" && <button className="start" onClick={() => setJobState("running")}><Play weight="fill" /> İşi başlat</button>}
            {jobState === "running" && <button className="pause" onClick={() => setJobState("paused")}><Pause weight="fill" /> Duraklat</button>}
            {jobState === "paused" && <button className="start" onClick={() => setJobState("running")}><Play weight="fill" /> Devam et</button>}
            <button onClick={() => notify("Sorun bildirim alanı açıldı.")}><Warning /> Sorun bildir</button><button onClick={() => notify("Fotoğraf ekleme alanı açıldı.")}><Camera /> Fotoğraf ekle</button>
          </div>
        </section>
        <Panel kicker="BUGÜNKÜ SIRA" title="Montaj Tezgâhı 2" icon={Factory} className="shopfloor-queue">
          {[["08:30", "Lake oda kapısı", "48 ad · Devam ediyor", "active"], ["15:00", "Kapı kolu hazırlığı", "48 takım · Hazır", ""], ["16:30", "Kasa son kontrol", "48 ad · Malzeme hazır", ""], ["Yarın", "Lobi panel altlığı", "24 modül · Bekliyor", ""]].map(([time, title, note, active]) => <span key={title} className={active}><i>{time}</i><b>{title}</b><small>{note}</small></span>)}
          <div className="queue-alert"><Warning size={20} /><span><strong>Bir sonraki iş için eksik</strong><small>2 kutu bağlantı elemanı bekleniyor.</small></span></div>
        </Panel>
      </div>
    </div>
  );
}

function FieldScreen({ notify }) {
  const [view, setView] = useState("installation");
  return (
    <div className="vision-screen">
      <ScreenTitle eyebrow="SAHA KAPANIŞI & PROJE FİNANSI" title="Montaj kanıtı, eksik iş ve hakediş aynı mahalde birleşsin." description="Paketleme ve saha hazırlığından müşteri imzasına; tamamlanan miktar doğrudan hakediş taslağına dönüşür." status={<Status tone="warning"><Clock weight="fill" /> 7 mahal teslim bekliyor</Status>} />
      <div className="vision-segmented"><button className={view === "installation" ? "active" : ""} onClick={() => setView("installation")}><HardHat /> Montaj kapanışı</button><button className={view === "progress" ? "active" : ""} onClick={() => setView("progress")}><CurrencyCircleDollar /> Hakediş hazırlığı</button></div>
      {view === "installation" ? (
        <>
          <div className="field-metrics"><Metric label="Sevk edilen" value="48 / 48" note="Paketler eşleşti" tone="success" /><Metric label="Montaj" value="41 / 48" note="%85 ilerleme" /><Metric label="Açık kusur" value="6" note="2 kritik" tone="warning" /><Metric label="Onaylı ek iş" value="₺184.500" note="DE-009 + DE-011" tone="success" /></div>
          <div className="vision-two-columns">
            <Panel kicker="MAHAL TESLİM MATRİSİ" title="A Blok · 4. Kat" icon={MapPin}><Table headers={["Mahal", "Ürün", "Montaj", "Eksik", "Fotoğraf", "İmza"]} rows={[["401", "Kapı + gardırop", "Tamam", "Yok", "12", "Alındı"], ["402", "Kapı + gardırop", "Tamam", "1 normal", "10", "Bekliyor"], ["403", "Kapı + gardırop", "%70", "2 kritik", "8", "Bekliyor"], ["404", "Kapı + gardırop", "Başlamadı", "Saha hazır değil", "3", "—"]]} /></Panel>
            <Panel kicker="MAHAL 401" title="Teslim ve imza" icon={Signature} className="field-closeout">
              {["Ürün adedi doğrulandı", "Koruma ve temizlik tamamlandı", "Kullanım kontrolü yapıldı", "Eksik iş bulunmuyor"].map((item) => <span key={item}><CheckCircle size={18} weight="fill" /> {item}</span>)}
              <div className="signature-box"><Signature size={31} /><span><strong>Berk Akın</strong><small>İşveren · 30 Tem 16:42</small></span></div><button onClick={() => notify("Mahal 401 teslim tutanağı açıldı.")}><FileText size={18} /> Teslim tutanağı</button>
            </Panel>
          </div>
        </>
      ) : (
        <>
          <div className="field-metrics"><Metric label="Sözleşme" value="₺24,80 Mn" note="KDV hariç" /><Metric label="Önceki" value="₺7,44 Mn" note="%30 tahakkuk" /><Metric label="Bu dönem brüt" value="₺5,21 Mn" note="%21 ilerleme" tone="success" /><Metric label="Net tahsilat" value="₺4,57 Mn" note="Mahsuplar sonrası" /></div>
          <div className="vision-two-columns">
            <Panel kicker="HAKEDİŞ NO · 02" title="Gerçekleşen imalat ve montaj" icon={CurrencyCircleDollar}><Table headers={["İş kalemi", "Sözleşme", "Önceki", "Bu dönem", "Kümülatif"]} rows={[["Oda kapıları", "₺6.240.000", "%30", "%35", "%65"], ["Sabit mobilyalar", "₺8.480.000", "%20", "%18", "%38"], ["Lobi panelleri", "₺4.120.000", "%10", "%12", "%22"], ["Montaj", "₺1.960.000", "%0", "%16", "%16"]]} /></Panel>
            <Panel kicker="MAHSUP & KESİNTİ" title="Net ödeme hesabı" icon={Calculator} className="progress-deductions">
              {[["Bu dönem brüt", "₺5.208.000"], ["Avans mahsubu · %10", "−₺520.800"], ["Teminat · %2", "−₺104.160"], ["Diğer kesintiler", "−₺14.500"]].map(([label, value]) => <span key={label}><small>{label}</small><strong>{value}</strong></span>)}<span className="total"><small>Net hakediş</small><strong>₺4.568.540</strong></span><button onClick={() => notify("Hakediş onay akışı başlatıldı.")}><CheckCircle size={18} /> İç onaya gönder</button>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function PlatformScreen() {
  return (
    <div className="vision-screen">
      <ScreenTitle eyebrow="SATILABİLİR SAAS ALTYAPISI" title="Tek ürün; her firma için ayrı veri, süreç ve yetki." description="Bulut aboneliği varsayılan; büyük firmalara özel sunucu. Firma ihtiyaçları kodu çatallamadan ayarlardan yönetilir." status={<Status tone="success"><Cloud weight="fill" /> 3 firma · sistem sağlıklı</Status>} />
      <div className="tenant-grid">
        {[["Capproje Orman Ürünleri", "İlk tasarım ortağı", "24 kullanıcı · 18 proje", "Bulut", "Aktif"], ["Nova Ahşap Sistemleri", "Profesyonel paket", "31 kullanıcı · 12 proje", "Bulut", "Pilot"], ["Marmara Kapı A.Ş.", "Kurumsal paket", "86 kullanıcı · 2 fabrika", "Özel sunucu", "Kurulum"]].map(([company, plan, usage, hosting, state]) => (
          <section key={company}><header><Buildings size={23} /><Status tone={state === "Aktif" ? "success" : "warning"}>{state}</Status></header><h3>{company}</h3><p>{plan}</p><span><Users size={17} />{usage}</span><span><Database size={17} />{hosting}</span>
          </section>
        ))}
      </div>
      <div className="vision-two-columns platform-columns">
        <Panel kicker="ROL & VERİ YETKİSİ" title="Kim neyi görebilir?" icon={ShieldCheck}><Table compact headers={["Rol", "Teklif", "Satın alma", "Üretim", "Saha", "Maliyet"]} rows={[["Genel Müdür", "Tam", "Tam", "Onay", "Tam", "Görür"], ["Proje Yöneticisi", "Tam", "Talep", "Başlat", "Tam", "Görür"], ["Üretim", "Okur", "Okur", "Tam", "Fotoğraf", "Gizli"], ["Montaj Ekibi", "Gizli", "Gizli", "Okur", "Tam", "Gizli"], ["Müşteri / Mimar", "Onay", "Gizli", "Gizli", "Kendi", "Gizli"]]} /></Panel>
        <Panel kicker="YEDEKLEME & GÜVENLİK" title="Son sistem kontrolleri" icon={FloppyDisk}>
          <div className="backup-list">{[["Günlük tam yedek", "Bugün 03:00 · 2,8 GB · doğrulandı"], ["Saatlik işlem yedeği", "Bugün 10:00 · 184 MB"], ["Geri yükleme testi", "27 Tem · 14 dakika · başarılı"], ["Denetim kayıtları", "Silme, onay ve maliyet değişimleri"]].map(([title, note]) => <span key={title}><CheckCircle size={19} weight="fill" /><b>{title}</b><small>{note}</small></span>)}</div>
        </Panel>
      </div>
      <Panel kicker="ENTEGRASYON STRATEJİSİ" title="Güçlü araçları yeniden yapmak yerine bağlan" icon={LinkSimple} className="integration-strip">
        <div>{["Datasoft", "Logo / Mikro", "Excel metraj", "PDF / DWG", "Cabinet Vision", "Microvellum", "E-posta", "WhatsApp"].map((item, index) => <span key={item} className={index < 4 ? "planned" : ""}><CheckCircle size={17} />{item}<small>{index < 4 ? "Öncelikli" : "Sonraki faz"}</small></span>)}</div>
      </Panel>
    </div>
  );
}

function IntelligenceScreen({ notify }) {
  return (
    <div className="vision-screen">
      <ScreenTitle eyebrow="İŞ AKIŞINA GÖMÜLÜ YAPAY ZEKÂ" title="Sohbet vitrini değil; ölçülebilir öneri ve erken uyarı." description="Her öneri kullandığı kayıtları, güven düzeyini ve para/zaman etkisini gösterir; kullanıcı onayı olmadan kritik işlem yapmaz." status={<Status tone="success"><ShieldCheck weight="fill" /> Firma verisi özel</Status>} />
      <section className="ai-brief"><Brain size={34} /><div><small>BUGÜNÜN OPERASYON ÖZETİ</small><h3>Gedikpaşa Otel projesinde 3 müdahale öneriliyor.</h3><p>18 proje, 42 iş kalemi, 12 sipariş ve son 6 haftalık üretim incelendi.</p></div><span><strong>₺242.300</strong><small>korunabilir değer</small></span><span><strong>26 saat</strong><small>kazanılabilir süre</small></span></section>
      <div className="ai-suggestion-grid">
        {[
          ["Fiyat anomalisi", "Amerikan ceviz kaplama %11,4 arttı.", "Siparişi alternatif tedarikçiyle %40 böl.", "₺74.000", "Yüksek", TrendDown],
          ["Gecikme riski", "CNC-02 mevcut yükle 1,8 gün gecikecek.", "12 emri CNC-01 akşam vardiyasına taşı.", "18 saat", "Yüksek", Clock],
          ["Onaysız ek iş", "403 ve 404'te sözleşme dışı 6 panel var.", "DE-012 değişiklik emri taslağı oluştur.", "₺96.500", "Orta", FileText],
          ["Benzer teklif", "Bodrum Villa, Tuzla Villa R4 ile %82 benzer.", "İşçilik süresini gerçekleşenden güncelle.", "8 saat", "Yüksek", MagicWand],
        ].map(([type, title, action, value, confidence, Icon]) => (
          <article key={type}><header><Icon size={23} /><Status tone={confidence === "Yüksek" ? "success" : "warning"}>{confidence} güven</Status></header><small>{type}</small><h3>{title}</h3><p>{action}</p><footer><span><strong>{value}</strong><small>beklenen etki</small></span><button onClick={() => notify(`${type} önerisinin dayanak kayıtları açıldı.`)}>Kanıtları gör <ArrowRight size={16} /></button></footer></article>
        ))}
      </div>
      <Panel kicker="KANIT VE DENETİM" title="“Kaplama fiyatı neden riskli?”" icon={Database} className="ai-evidence">
        <div>{[[FileText, "Ergin Ahşap teklifi", "29 Tem · ₺1.145/m²"], [FileText, "Son satın alma", "14 Tem · ₺1.028/m²"], [TrendUp, "90 günlük eğilim", "%17,8 artış"], [Buildings, "Alternatif tedarikçi", "₺1.086/m² · 5 gün"]].map(([Icon, title, note]) => <span key={title}><Icon size={20} /><b>{title}</b><small>{note}</small></span>)}</div>
      </Panel>
    </div>
  );
}

export function ProductVision({ notify }) {
  const [active, setActive] = useState("overview");
  const screen = {
    overview: <Overview selectModule={setActive} />,
    estimate: <EstimateScreen notify={notify} />,
    revision: <RevisionScreen notify={notify} />,
    margin: <MarginScreen />,
    outsource: <OutsourceScreen notify={notify} />,
    shopfloor: <ShopfloorScreen notify={notify} />,
    field: <FieldScreen notify={notify} />,
    platform: <PlatformScreen />,
    intelligence: <IntelligenceScreen notify={notify} />,
  }[active];
  const CurrentIcon = modules.find(([id]) => id === active)?.[3] || Lightbulb;

  return (
    <>
      <div className="vision-page-heading">
        <div><span>ÜRÜN TASARIM LABORATUVARI</span><h1>Capproje Ürün Vizyonu</h1><p>Müşteriyle nihai kapsamı konuşmak için gezilebilir ekran prototipleri</p></div>
        <button onClick={() => setActive("overview")}><CurrentIcon size={20} /> Genel görünüm</button>
      </div>
      <nav className="vision-module-nav" aria-label="Ürün vizyonu ekranları">
        {modules.map(([id, label, short, Icon]) => (
          <button key={id} className={active === id ? "active" : ""} onClick={() => setActive(id)} title={label}>
            <Icon size={20} weight={active === id ? "fill" : "regular"} /><span className="full-label">{label}</span><span className="short-label">{short}</span>
          </button>
        ))}
      </nav>
      {screen}
    </>
  );
}
