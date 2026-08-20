import React from "react";

// React'te render sırasında atılan bir hata yakalanmazsa tüm ağaç sökülür ve
// kullanıcı bomboş beyaz bir sayfa görür; ne olduğunu anlamasının hiçbir yolu
// kalmaz. Sınır, çöken parçayı izole edip hem açıklama hem de çıkış yolu verir.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Arayüz hatası", error, info?.componentStack);
  }

  // Kullanıcı başka bir bölüme geçtiğinde çöken ekranda kilitli kalmamalıdır.
  componentDidUpdate(previous) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const detail = String(this.state.error?.message || this.state.error);
    if (this.props.inline) {
      return <div className="live-state live-state-error" role="alert">
        <b>Bu ekran görüntülenemedi.</b>
        <small>Kaydınız güvende. Başka bir bölüme geçebilir ya da sayfayı yenileyebilirsiniz.</small>
        <small><code>{detail}</code></small>
        <button onClick={() => this.setState({ error: null })}>Tekrar dene</button>
      </div>;
    }
    return <div role="alert" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem", fontFamily: "Inter,ui-sans-serif,system-ui,sans-serif", background: "#f6f5f1", color: "#20262c" }}>
      <div style={{ maxWidth: 460, textAlign: "center", display: "grid", gap: 12 }}>
        <b style={{ fontSize: 18 }}>Uygulama beklenmedik bir hatayla karşılaştı.</b>
        <small style={{ color: "#5d6b64", lineHeight: 1.6 }}>Verileriniz sunucuda kayıtlıdır. Sayfayı yenilemek sorunu çözmezse hatayı bize iletin.</small>
        <code style={{ fontSize: 11, color: "#8a4038", background: "#f9e8e6", borderRadius: 8, padding: "10px 12px", wordBreak: "break-word" }}>{detail}</code>
        <button onClick={() => window.location.reload()} style={{ border: 0, borderRadius: 9, background: "#2f6b52", color: "#fff", padding: "11px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", justifySelf: "center" }}>Sayfayı yenile</button>
      </div>
    </div>;
  }
}
