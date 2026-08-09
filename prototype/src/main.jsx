import React, { lazy, Suspense, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const PrototypeApp = lazy(() => import("./App.jsx").then(({ App }) => ({ default: App })));
const LiveWorkspace = lazy(() => import("./LiveWorkspace.jsx").then(({ LiveWorkspace }) => ({ default: LiveWorkspace })));

function Root() {
  const params = new URLSearchParams(window.location.search);
  const liveHost = window.location.hostname.endsWith(".chatgpt.site");
  const [prototypeMode, setPrototypeMode] = useState(() => params.get("prototype") === "1" || (!liveHost && params.get("live") !== "1"));

  return (
    <Suspense fallback={<div role="status" style={{ padding: "2rem", fontFamily: "system-ui", color: "#20262c" }}>Capproje hazırlanıyor…</div>}>
      {prototypeMode ? <PrototypeApp /> : <LiveWorkspace onBackToPrototype={() => setPrototypeMode(true)} />}
    </Suspense>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
